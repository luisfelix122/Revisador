from typing import Literal
from pydantic import BaseModel, Field, SecretStr, field_validator


class ConfiguracionIA(BaseModel):
    proveedor: Literal["openai", "gemini"]
    clave_api: SecretStr
    claves_adicionales: list[SecretStr] = Field(default_factory=list)
    modelo: str = Field(default="", max_length=150, pattern=r"^[a-zA-Z0-9._-]*$")

    @field_validator("clave_api")
    @classmethod
    def validar_clave(cls, clave: SecretStr) -> SecretStr:
        if not clave.get_secret_value().strip() or len(clave.get_secret_value()) > 512:
            raise ValueError("Ingresa una clave válida")
        return clave

    @field_validator("claves_adicionales")
    @classmethod
    def validar_adicionales(cls, claves: list[SecretStr]) -> list[SecretStr]:
        validas = []
        for c in claves:
            val = c.get_secret_value().strip()
            if val and len(val) <= 512:
                validas.append(c)
        return validas


class PeticionComprobarLote(BaseModel):
    proveedor: Literal["openai", "gemini"]
    claves_api: list[SecretStr] = Field(min_length=1, max_length=20)
    modelo: str = Field(min_length=1, max_length=150)
