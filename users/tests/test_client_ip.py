from starlette.requests import Request

from app.utils.client_ip import get_client_ip


def _make_request(headers: list[tuple[bytes, bytes]], client: tuple[str, int] | None) -> Request:
    scope = {"type": "http", "headers": headers, "client": client}
    return Request(scope)


def test_prefers_the_first_x_forwarded_for_value_over_the_socket_address():
    request = _make_request(
        headers=[(b"x-forwarded-for", b"203.0.113.5, 10.0.0.1")],
        client=("172.18.0.7", 12345),
    )
    assert get_client_ip(request) == "203.0.113.5"


def test_falls_back_to_the_socket_address_when_no_forwarded_header_is_present():
    request = _make_request(headers=[], client=("172.18.0.7", 12345))
    assert get_client_ip(request) == "172.18.0.7"


def test_strips_the_ipv4_mapped_ipv6_prefix():
    request = _make_request(headers=[], client=("::ffff:127.0.0.1", 12345))
    assert get_client_ip(request) == "127.0.0.1"


def test_returns_none_when_there_is_no_client_and_no_forwarded_header():
    request = _make_request(headers=[], client=None)
    assert get_client_ip(request) is None
