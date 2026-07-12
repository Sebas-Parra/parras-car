from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5433/auth_db"

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_issuer: str = "parras-app-key"
    jwt_expire_minutes: int = 60 * 24  # 24 hours
    refresh_token_expire_days: int = 7

    rabbitmq_host: str = "localhost"
    rabbitmq_port: int = 5672
    rabbitmq_user: str = "guest"
    rabbitmq_password: str = "guest"
    rabbitmq_exchange: str = "audit_exchange"
    rabbitmq_routing_key: str = "audit_event"


settings = Settings()
