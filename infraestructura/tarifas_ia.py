import asyncio
import re
import time
from decimal import Decimal
import httpx


class ServicioTarifasOficiales:
    """Consulta dinámica de las tarifas oficiales de Google Gemini y OpenAI.

    Obtiene los precios en vivo directamente de ai.google.dev/pricing para reflejar
    cualquier variación sin valores fijos, manteniendo una caché en memoria y tarifas
    oficiales de respaldo en caso de desconexión.
    """

    TARIFAS_BASE_GEMINI = {
        "gemini-3.8-flash": (Decimal("0.75"), Decimal("3.75")),
        "gemini-3.6-flash": (Decimal("0.75"), Decimal("3.75")),
        "gemini-3.5-flash-lite": (Decimal("0.30"), Decimal("2.50")),
        "gemini-flash-lite-latest": (Decimal("0.30"), Decimal("2.50")),
        "gemini-flash-latest": (Decimal("0.75"), Decimal("3.75")),
        "gemini-3.1-flash-lite": (Decimal("0.25"), Decimal("1.50")),
        "gemini-3-flash-preview": (Decimal("0.75"), Decimal("3.75")),
        "gemini-3.5-flash": (Decimal("0.75"), Decimal("3.75")),
        "gemini-2.5-flash": (Decimal("0.30"), Decimal("2.50")),
        "gemini-2.5-flash-lite": (Decimal("0.10"), Decimal("0.40")),
        "gemini-2.5-pro": (Decimal("1.25"), Decimal("10.00")),
        "gemini-pro-latest": (Decimal("1.25"), Decimal("10.00")),
    }

    TARIFAS_BASE_OPENAI = {
        "gpt-4o-mini": (Decimal("0.15"), Decimal("0.60")),
        "gpt-4o": (Decimal("2.50"), Decimal("10.00")),
    }

    _cache_gemini: dict[str, tuple[Decimal, Decimal]] = {}
    _expiracion_cache: float = 0.0

    async def _actualizar_cache_gemini(self) -> None:
        ahora = time.time()
        if ahora < self._expiracion_cache and self._cache_gemini:
            return

        try:
            async with httpx.AsyncClient(timeout=8, follow_redirects=True) as cliente:
                respuesta = await cliente.get("https://ai.google.dev/pricing")
            if respuesta.status_code == 200:
                nuevas_tarifas: dict[str, tuple[Decimal, Decimal]] = {}
                secciones = re.split(r"##\s+", respuesta.text)
                for seccion in secciones:
                    lineas = seccion.split("\n")
                    encabezado = lineas[0]
                    match_id = re.search(r'id=["\']([^"\']+)["\']', encabezado)
                    nombre = match_id.group(1).lower() if match_id else None
                    if not nombre:
                        match_doc = re.search(r"\[`([a-zA-Z0-9.-]+)`\]", seccion)
                        if match_doc:
                            nombre = match_doc.group(1).lower()

                    if nombre:
                        match_in = re.search(
                            r"\*\s*Input price.*?\*\s*Free of charge.*?\*\s*\$([0-9.]+)",
                            seccion,
                            re.DOTALL | re.IGNORECASE,
                        )
                        match_out = re.search(
                            r"\*\s*Output price.*?\*\s*Free of charge.*?\*\s*\$([0-9.]+)",
                            seccion,
                            re.DOTALL | re.IGNORECASE,
                        )
                        if match_in and match_out:
                            nuevas_tarifas[nombre] = (
                                Decimal(match_in.group(1)),
                                Decimal(match_out.group(1)),
                            )

                if nuevas_tarifas:
                    # Mapear alias estándar
                    if "gemini-3.5-flash-lite" in nuevas_tarifas:
                        nuevas_tarifas["gemini-flash-lite-latest"] = nuevas_tarifas["gemini-3.5-flash-lite"]
                    if "gemini-3.8-flash" in nuevas_tarifas:
                        nuevas_tarifas["gemini-flash-latest"] = nuevas_tarifas["gemini-3.8-flash"]
                    if "gemini-3.6-flash" in nuevas_tarifas:
                        nuevas_tarifas["gemini-3-flash-preview"] = nuevas_tarifas["gemini-3.6-flash"]

                    self._cache_gemini = nuevas_tarifas
                    self._expiracion_cache = ahora + 3600  # 1 hora de caché
        except Exception:
            # Si falla la conexión remota, se mantienen las tarifas previas o de respaldo
            pass

    async def obtener_tarifa(self, proveedor: str, modelo: str) -> dict:
        proveedor_limpio = (proveedor or "").strip().lower()
        modelo_limpio = (modelo or "").strip().lower().removeprefix("models/")

        if proveedor_limpio == "gemini":
            await self._actualizar_cache_gemini()
            if modelo_limpio in self._cache_gemini:
                entrada, salida = self._cache_gemini[modelo_limpio]
                fuente = "ai.google.dev/pricing (oficial en vivo)"
            elif modelo_limpio in self.TARIFAS_BASE_GEMINI:
                entrada, salida = self.TARIFAS_BASE_GEMINI[modelo_limpio]
                fuente = "ai.google.dev/pricing (tarifas de respaldo; verifica el precio actual)"
            else:
                raise ValueError("No hay una tarifa disponible para este modelo")

            return {
                "proveedor": "gemini",
                "modelo": modelo_limpio,
                "tarifa_entrada": entrada,
                "tarifa_salida": salida,
                "moneda": "USD",
                "unidad": "por millón de tokens",
                "fuente": fuente,
            }

        if proveedor_limpio == "openai" and modelo_limpio in self.TARIFAS_BASE_OPENAI:
            entrada, salida = self.TARIFAS_BASE_OPENAI[modelo_limpio]
        else:
            raise ValueError("No hay una tarifa disponible para este modelo")

        return {
            "proveedor": "openai",
            "modelo": modelo_limpio,
            "tarifa_entrada": entrada,
            "tarifa_salida": salida,
            "moneda": "USD",
            "unidad": "por millón de tokens",
            "fuente": "openai.com/pricing (tarifas de respaldo; verifica el precio actual)",
        }
