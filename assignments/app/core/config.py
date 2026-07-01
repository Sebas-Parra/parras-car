from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5435/assignments_db"
    vehicles_service_url: str = "http://vehicles:3000"
    users_service_url: str = "http://users:8000"

    # Must match the secret used by the users service and Kong
    jwt_secret: str = "6f2f368a76edefcc1859716acadb5cd68ac14bd4186334c03ba341da97dff77c"
    jwt_algorithm: str = "HS256"


settings = Settings()
