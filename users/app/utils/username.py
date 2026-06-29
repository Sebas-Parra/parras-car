import re
import unicodedata
from collections.abc import Callable


def _normalize_part(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    without_accents = normalized.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]", "", without_accents.lower())


def _first_token(value: str | None) -> str:
    if not value:
        return ""
    parts = value.split()
    return parts[0] if parts else ""


def generate_unique_username(
    first_name: str,
    middle_name: str,
    last_name: str,
    username_exists: Callable[[str], bool],
) -> str:
    f = _normalize_part(_first_token(first_name))
    m = _normalize_part(_first_token(middle_name))
    last = _normalize_part(_first_token(last_name))
    base = f"{f[:1]}{m[:1]}{last}"
    username = base
    suffix = 1
    while username_exists(username):
        username = f"{base}{suffix}"
        suffix += 1
    return username
