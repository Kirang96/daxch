from backend.app.services.broker.base import BaseBroker
from backend.app.services.broker.upstox import UpstoxBroker


def get_broker(name: str = "upstox") -> BaseBroker:
    if name.lower() == "upstox":
        return UpstoxBroker()
    raise ValueError(f"Unsupported broker: {name}")

