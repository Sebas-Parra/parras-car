from starlette.requests import Request


def get_client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        raw = forwarded.split(",")[0].strip()
    else:
        raw = request.client.host if request.client else None
    if raw and raw.startswith("::ffff:"):
        raw = raw[len("::ffff:") :]
    return raw
