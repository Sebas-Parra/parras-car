from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5435/assignments_db"
    vehicles_service_url: str = "http://vehicles:3000"
    users_service_url: str = "http://users:8000"


settings = Settings()
