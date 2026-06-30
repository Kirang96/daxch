from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TopupPack:
    id: str
    units: int
    price_inr: int
    label: str


TOPUP_PACKS: tuple[TopupPack, ...] = (
    TopupPack(id="boost_5k", units=5_000, price_inr=249, label="5,000 AI Units"),
    TopupPack(id="boost_10k", units=10_000, price_inr=449, label="10,000 AI Units"),
    TopupPack(id="boost_20k", units=20_000, price_inr=799, label="20,000 AI Units"),
)

_PACK_BY_ID = {pack.id: pack for pack in TOPUP_PACKS}


def get_topup_pack(pack_id: str) -> TopupPack | None:
    return _PACK_BY_ID.get(pack_id.strip())


def list_topup_packs() -> list[TopupPack]:
    return list(TOPUP_PACKS)
