from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SECRET_KEY: str = "astrikos-coalmine-platform-secret-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    DATA_UPDATE_INTERVAL: float = 5.0


settings = Settings()
