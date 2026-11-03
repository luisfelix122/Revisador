from typing import Literal
from pydantic import BaseModel, Field, SecretStr, field_validator


class ConfiguracionIA(BaseModel):
    proveedor: Literal["openai", "gemini"]
    clave_api: SecretStr
    modelo: str = Field(default="", max_length=150, pattern=r"^[a-zA-Z0-9._-]*$")

    @field_validator("clave_api")
    @classmethod
    def validar_clave(cls, clave: SecretStr) -> SecretStr:
        if not clave.get_secret_value().strip() or len(clave.get_secret_value()) > 512:
            raise ValueError("Ingresa una clave válida")
        return clave
