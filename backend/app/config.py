from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SECRET_KEY: str = "astrikos-coalmine-platform-secret-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    DATA_UPDATE_INTERVAL: float = 3.0
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]


settings = Settings()
