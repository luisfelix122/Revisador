import httpx
import asyncio
import json

from dominio.puertos import ErrorProveedor


class ErrorTemporalProveedor(ErrorProveedor):
    pass


class ProveedorHTTP:
    def __init__(self, proveedor: str):
        self.proveedor = proveedor

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
        if respuesta.status_code == 429:
            raise ErrorTemporalProveedor("Cuota agotada o límite de solicitudes. Revisa tu cuenta.")
        if respuesta.status_code in (500, 502, 503, 504):
            raise ErrorTemporalProveedor('El proveedor no está disponible temporalmente.')
        if respuesta.status_code >= 400:
            raise ErrorProveedor("El proveedor no pudo completar la solicitud. Revisa el modelo e inténtalo otra vez.")
        try:
            return respuesta.json()
        except ValueError:
            raise ErrorProveedor("El proveedor devolvió una respuesta no válida.") from None

    async def listar_modelos(self, clave: str) -> list[str]:
        datos = await self.solicitar("GET", "/models", clave)
        if self.proveedor == "openai":
            return sorted(modelo["id"] for modelo in datos.get("data", []))
        return sorted(modelo["name"].removeprefix("models/") for modelo in datos.get("models", []) if "generateContent" in modelo.get("supportedGenerationMethods", []))

    async def comprobar(self, clave: str, modelo: str) -> None:
        if self.proveedor == "openai":
            await self.solicitar("POST", "/responses", clave, {"model": modelo, "input": "Responde únicamente: OK", "max_output_tokens": 16, "store": False})
            return
        await self.solicitar("POST", f"/models/{modelo}:generateContent", clave, {"contents": [{"parts": [{"text": "Responde únicamente: OK"}]}], "generationConfig": {"maxOutputTokens": 16}})

    async def generar(self, clave: str, modelo: str, instrucciones: str, documentos: list, esquema: dict) -> dict:
        imagenes = [imagen for documento in documentos for imagen in documento.imagenes]
        texto = instrucciones + '\n\n' + '\n'.join(documento.texto for documento in documentos)
        if len(imagenes)>120 or len(texto)>300000:
            raise ErrorProveedor('Los documentos superan el contexto permitido. Reduce los materiales.')
        if self.proveedor == 'openai':
            contenido = [{'type':'input_text','text':texto}] + [{'type':'input_image','image_url':'data:image/jpeg;base64,'+imagen} for imagen in imagenes]
            ruta = '/responses'
            cuerpo = {'model':modelo,'store':False,'input':[{'role':'user','content':contenido}], 'text':{'format':{'type':'json_schema','name':'evaluacion','schema':esquema,'strict':True}},'max_output_tokens':16000}
        else:
            partes = [{'text':texto}] + [{'inline_data':{'mime_type':'image/jpeg','data':imagen}} for imagen in imagenes]
            ruta = f'/models/{modelo}:generateContent'
            cuerpo = {'contents':[{'parts':partes}],'generationConfig':{'responseMimeType':'application/json','responseJsonSchema':esquema,'maxOutputTokens':16000}}
        for intento in range(3):
            try:
                datos = await self.solicitar('POST',ruta,clave,cuerpo)
                break
            except ErrorTemporalProveedor:
                if intento == 2:
                    raise
                await asyncio.sleep(2 ** intento)
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
