"""
God mode (staff only, owner 2026-10-19: "in god mode no limitation for territory discovery, safari, money").
The client sends X-Hexod-God: 1 while the GOD MODE switch is on; GodModeMiddleware keeps it for the request and
is_god(player) is true only when that player is also staff, so the header alone grants nothing.
"""
from contextvars import ContextVar

_GOD: ContextVar[bool] = ContextVar('hexod_god', default=False)


def is_god(player) -> bool:
    return bool(_GOD.get() and player is not None and getattr(player, 'is_staff', False))


def god_cost(player, cost):
    """Price for this player: free in god mode."""
    return 0 if is_god(player) else cost


class GodModeMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = _GOD.set(request.headers.get('X-Hexod-God') == '1')
        try:
            return self.get_response(request)
        finally:
            _GOD.reset(token)
