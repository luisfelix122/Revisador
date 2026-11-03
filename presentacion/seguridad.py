from typing import Annotated
from uuid import UUID
from fastapi import Depends, Header, HTTPException
import httpx
from infraestructura.supabase import SesionProfesor, RepositorioSupabase, URL_SUPABASE, CLAVE_PUBLICABLE


async def obtener_sesion(authorization: Annotated[str | None, Header()] = None) -> SesionProfesor:
    if not authorization or not authorization.startswith('Bearer ') or len(authorization) > 8192:
        raise HTTPException(401, 'Inicia sesión para acceder a tu biblioteca.')
    token = authorization[7:]
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=False) as cliente:
            respuesta = await cliente.get(URL_SUPABASE + '/auth/v1/user', headers={'apikey': CLAVE_PUBLICABLE, 'Authorization': authorization})
        if respuesta.status_code != 200:
            raise HTTPException(401, 'Sesión no válida. Vuelve a iniciar sesión.')
        datos = respuesta.json()
        return SesionProfesor(UUID(datos['id']), token)
    except (httpx.HTTPError, ValueError, KeyError):
        raise HTTPException(503, 'No pudimos verificar tu sesión. Inténtalo otra vez.') from None


def obtener_repositorio(sesion: Annotated[SesionProfesor, Depends(obtener_sesion)]) -> RepositorioSupabase:
    return RepositorioSupabase(sesion)
