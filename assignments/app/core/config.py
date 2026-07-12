from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5435/assignments_db"
    vehicles_service_url: str = "http://vehicles:3000"
    users_service_url: str = "http://users:8000"

    jwt_secret: str
    jwt_algorithm: str = "HS256"

    rabbitmq_host: str = "localhost"
    rabbitmq_port: int = 5672
    rabbitmq_user: str = "guest"
    rabbitmq_password: str = "guest"
    rabbitmq_exchange: str = "audit_exchange"
    rabbitmq_routing_key: str = "audit_event"


settings = Settings()
