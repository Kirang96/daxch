from backend.app.services.broker.base import BaseBroker, BrokerMeta
from backend.app.services.broker.fivepaisa import FivePaisaBroker
from backend.app.services.broker.upstox import UpstoxBroker

_BROKERS: dict[str, type[BaseBroker]] = {
    "upstox": UpstoxBroker,
    "5paisa": FivePaisaBroker,
}

_BROKER_META: list[BrokerMeta] = [
    BrokerMeta(
        id="upstox",
        name="Upstox",
        description="OAuth · sync orders and execute trades you approve.",
        available=True,
    ),
    BrokerMeta(
        id="5paisa",
        name="5paisa",
        description="OAuth · trade and market data via Xstream API.",
        available=True,
    ),
    BrokerMeta(id="zerodha", name="Zerodha", description="Kite Connect integration in review.", available=False),
    BrokerMeta(id="angelone", name="Angel One", description="SmartAPI integration on the way.", available=False),
    BrokerMeta(id="groww", name="Groww", description="Pending Groww API partnership.", available=False),
]


def get_broker(name: str) -> BaseBroker:
    broker_cls = _BROKERS.get(name.lower())
    if not broker_cls:
        raise ValueError(f"Unsupported broker: {name}")
    return broker_cls()


def list_supported_brokers() -> list[BrokerMeta]:
    return list(_BROKER_META)
