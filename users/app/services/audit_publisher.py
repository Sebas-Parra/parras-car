import json
import logging
from typing import Any

import pika

from app.core.config import settings

logger = logging.getLogger(__name__)


def publish_audit_event(
    accion: str,
    entidad_id: str,
    usuario: str,
    rol: str,
    datos: dict[str, Any] | None = None,
) -> None:
    event = {
        "servicio": "ms-users",
        "accion": accion,
        "entidad": "USUARIO",
        "entidadId": entidad_id,
        "datos": datos,
        "usuario": usuario,
        "rol": rol,
    }
    try:
        credentials = pika.PlainCredentials(settings.rabbitmq_user, settings.rabbitmq_password)
        connection = pika.BlockingConnection(
            pika.ConnectionParameters(
                host=settings.rabbitmq_host,
                port=settings.rabbitmq_port,
                credentials=credentials,
            )
        )
        channel = connection.channel()
        channel.exchange_declare(
            exchange=settings.rabbitmq_exchange,
            exchange_type="topic",
            durable=True,
        )
        channel.basic_publish(
            exchange=settings.rabbitmq_exchange,
            routing_key=settings.rabbitmq_routing_key,
            body=json.dumps(event, default=str).encode("utf-8"),
            properties=pika.BasicProperties(delivery_mode=2),
        )
        connection.close()
    except Exception:
        logger.exception(
            "No se pudo publicar el evento de auditoría: %s %s", accion, entidad_id
        )
