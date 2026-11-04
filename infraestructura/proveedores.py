import copy
import httpx
import json

from dominio.puertos import ErrorProveedor


class ErrorTemporalProveedor(ErrorProveedor):
    pass


def adaptar_esquema_gemini(esquema: dict) -> dict:
    """Adapta un JSON Schema de Pydantic al dialecto OpenAPI 3.0 compatible con Gemini.

    Gemini rechaza esquemas con $defs, $ref y restricciones de validación complejas
    como maximum, minimum, maxLength, minLength, maxItems, minItems, additionalProperties y title.
    """
    CAMPOS_PERMITIDOS = {
        "type",
        "format",
        "description",
        "nullable",
        "enum",
        "items",
        "properties",
        "required",
    }
    copia = copy.deepcopy(esquema)
    defs = copia.pop("$defs", {})

    def limpiar_nodo(nodo):
        if not isinstance(nodo, dict):
            return nodo
        if "$ref" in nodo:
            ref = nodo.pop("$ref")
            nombre = ref.split("/")[-1]
            if nombre in defs:
                nodo.update(copy.deepcopy(defs[nombre]))
                return limpiar_nodo(nodo)
        claves = list(nodo.keys())
        for clave in claves:
            if clave == "properties" and isinstance(nodo["properties"], dict):
                nodo["properties"] = {
                    p_nom: limpiar_nodo(p_val)
                    for p_nom, p_val in nodo["properties"].items()
                }
            elif clave == "items":
                nodo["items"] = limpiar_nodo(nodo["items"])
            elif clave not in CAMPOS_PERMITIDOS:
                nodo.pop(clave, None)
        return nodo

    return limpiar_nodo(copia)


class ProveedorHTTP:
    def __init__(self, proveedor: str):
        self.proveedor = proveedor

    PREFERIDOS_GEMINI = [
        "gemini-flash-lite-latest",
        "gemini-3.6-flash",
        "gemini-3.5-flash-lite",
        "gemini-3-flash-preview",
        "gemini-3.5-flash",
        "gemini-3.8-flash",
        "gemini-flash-latest",
        "gemini-3.1-flash-lite",
        "gemini-pro-latest",
    ]
    MODELOS_DEPRECADOS = {
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-2.5-flash-lite",
    }
    PATRONES_EXCLUIDOS = (
        "tts",
        "preview-tts",
        "transcribe",
        "robotics",
        "computer-use",
        "clip",
        "banana",
        "argon",
        "embedding",
        "aqa",
    )

    async def solicitar(self, metodo: str, ruta: str, clave: str, cuerpo: dict | None = None) -> dict:
        base = "https://api.openai.com/v1" if self.proveedor == "openai" else "https://generativelanguage.googleapis.com/v1beta"
        cabeceras = {"Authorization": f"Bearer {clave}"} if self.proveedor == "openai" else {"x-goog-api-key": clave}
        try:
            async with httpx.AsyncClient(timeout=110 if cuerpo and ruta != '/models' else 25, follow_redirects=False) as cliente:
                respuesta = await cliente.request(metodo, base + ruta, headers=cabeceras, json=cuerpo)
        except httpx.HTTPError:
            raise ErrorTemporalProveedor("No se pudo conectar. Revisa tu red e inténtalo otra vez.") from None
        if respuesta.status_code in (401, 403):
            raise ErrorProveedor("Clave inválida o sin permisos para el modelo.")
        if respuesta.status_code == 404:
            sugerencia = " como 'gemini-flash-lite-latest' o 'gemini-3.6-flash'" if self.proveedor != 'openai' else ""
            raise ErrorProveedor(f"El modelo seleccionado no está disponible (404). Carga la lista y selecciona otro modelo del proveedor{sugerencia}.")
        if respuesta.status_code == 429:
            raise ErrorTemporalProveedor("Cuota agotada o límite de solicitudes. Revisa tu cuenta.")
        if respuesta.status_code in (500, 502, 503, 504):
            sugerencia = " como 'gemini-flash-lite-latest' o 'gemini-3.6-flash'" if self.proveedor != 'openai' else ""
            raise ErrorTemporalProveedor(f"El proveedor no está disponible temporalmente ({respuesta.status_code}). Inténtalo más tarde o selecciona otro modelo compatible{sugerencia}.")
        if respuesta.status_code >= 400:
            raise ErrorProveedor("El proveedor no pudo completar la solicitud. Revisa el modelo e inténtalo otra vez.")
        try:
            datos = respuesta.json()
            if not isinstance(datos, dict):
                raise ValueError('La respuesta debe ser un objeto')
            return datos
        except ValueError:
            raise ErrorProveedor("El proveedor devolvió una respuesta no válida.") from None

    async def listar_modelos(self, clave: str) -> list[str]:
        datos = await self.solicitar("GET", "/models", clave)
        campo = 'data' if self.proveedor == 'openai' else 'models'
        modelos = datos.get(campo)
        if not isinstance(modelos, list) or any(not isinstance(modelo, dict) for modelo in modelos):
            raise ErrorProveedor('El proveedor devolvió una respuesta no válida.')
        if self.proveedor == "openai":
            if any(not isinstance(modelo.get('id'), str) for modelo in modelos):
                raise ErrorProveedor('El proveedor devolvió una respuesta no válida.')
            return sorted(modelo['id'] for modelo in modelos)

        candidatos = []
        for modelo in modelos:
            if not isinstance(modelo.get('name'), str) or not isinstance(modelo.get('supportedGenerationMethods', []), list):
                raise ErrorProveedor('El proveedor devolvió una respuesta no válida.')
            nombre = modelo.get("name", "").removeprefix("models/")
            if any(ignorar in nombre for ignorar in self.PATRONES_EXCLUIDOS):
                continue
            if nombre in self.MODELOS_DEPRECADOS:
                continue
            if "generateContent" in modelo.get("supportedGenerationMethods", []):
                candidatos.append(nombre)

        def prioridad(m: str) -> tuple[int, str]:
            if m in self.PREFERIDOS_GEMINI:
                return (self.PREFERIDOS_GEMINI.index(m), m)
            return (100, m)

        return sorted(candidatos, key=prioridad)

    async def comprobar(self, clave: str, modelo: str) -> None:
        if self.proveedor == "openai":
            datos = await self.solicitar("POST", "/responses", clave, {"model": modelo, "input": "Responde únicamente: OK", "max_output_tokens": 16, "store": False})
        else:
            datos = await self.solicitar("POST", f"/models/{modelo}:generateContent", clave, {"contents": [{"parts": [{"text": "Responde únicamente: OK"}]}], "generationConfig": {"maxOutputTokens": 200}})
        try:
            if self.proveedor == 'openai':
                texto = ''.join(parte['text'] for salida in datos['output'] for parte in salida.get('content', []) if parte.get('type') == 'output_text')
            else:
                candidatos = datos.get('candidates', [])
                if not candidatos:
                    raise ValueError('Sin candidatos')
                partes = candidatos[0].get('content', {}).get('parts', [])
                texto = ''.join(parte.get('text', '') for parte in partes if isinstance(parte, dict))
                if not texto.strip() and candidatos[0].get('finishReason') in ('STOP', 'MAX_TOKENS', None):
                    texto = 'OK'
            if not texto.strip():
                raise ValueError('Respuesta vacía')
        except (KeyError, IndexError, TypeError, AttributeError, ValueError):
            raise ErrorProveedor('El modelo no devolvió una respuesta válida para comprobar la conexión.') from None

    async def generar(self, clave: str, modelo: str, instrucciones: str, documentos: list, esquema: dict) -> dict:
        imagenes = [imagen for documento in documentos for imagen in documento.imagenes]
        texto = instrucciones + '\n\n' + '\n'.join(documento.texto for documento in documentos)
        if len(imagenes)>120 or len(texto)>300000:
            raise ErrorProveedor('Los documentos superan el contexto permitido. Reduce los materiales.')
        if self.proveedor == 'openai':
            contenido = [{'type':'input_text','text':instrucciones}]
            for numero, documento in enumerate(documentos, 1):
                contenido.append({'type':'input_text','text':f'Documento {numero} de {len(documentos)}:\n{documento.texto}'})
                contenido.extend({'type':'input_image','image_url':'data:image/jpeg;base64,'+imagen} for imagen in documento.imagenes)
            ruta = '/responses'
            cuerpo = {'model':modelo,'store':False,'input':[{'role':'user','content':contenido}], 'text':{'format':{'type':'json_schema','name':'evaluacion','schema':esquema,'strict':True}},'max_output_tokens':16000}
        else:
            partes = [{'text':instrucciones}]
            for numero, documento in enumerate(documentos, 1):
                partes.append({'text':f'Documento {numero} de {len(documentos)}:\n{documento.texto}'})
                partes.extend({'inline_data':{'mime_type':'image/jpeg','data':imagen}} for imagen in documento.imagenes)
            ruta = f'/models/{modelo}:generateContent'
            esquema_gemini = adaptar_esquema_gemini(esquema)
            cuerpo = {'contents':[{'parts':partes}],'generationConfig':{'responseMimeType':'application/json','responseJsonSchema':esquema_gemini,'maxOutputTokens':16000}}
        try:
            datos = await self.solicitar('POST',ruta,clave,cuerpo)
        except ErrorTemporalProveedor as error:
            raise ErrorTemporalProveedor(f'{error} La solicitud podría haber consumido saldo; comprueba tu proveedor antes de reintentar.') from None
        try:
            if self.proveedor == 'openai':
                texto_salida = ''.join(parte['text'] for salida in datos.get('output',[]) for parte in salida.get('content',[]) if parte.get('type')=='output_text')
            else:
                texto_salida = ''.join(parte.get('text','') for parte in datos['candidates'][0]['content']['parts'])
            resultado = json.loads(texto_salida)
            if not isinstance(resultado,dict):
                raise ValueError()
            return resultado
        except (KeyError,IndexError,ValueError,TypeError):
            raise ErrorProveedor('La IA no devolvió una evaluación válida. Revisa el modelo y vuelve a intentarlo.') from None
