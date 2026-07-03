from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import httpx

from backend.app.core.config import get_settings

@dataclass(frozen=True)
class ScripInfo:
    ticker: str
    exchange: str
    exch: str
    exch_type: str
    scrip_code: int
    scrip_data: str


_DEMO_SCRIPS: dict[tuple[str, str], ScripInfo] = {
    ("RELIANCE", "NSE"): ScripInfo(ticker="RELIANCE", exchange="NSE", exch="N", exch_type="C", scrip_code=2885, scrip_data="RELIANCE_EQ"),
    ("ITC", "NSE"): ScripInfo(ticker="ITC", exchange="NSE", exch="N", exch_type="C", scrip_code=1660, scrip_data="ITC_EQ"),
    ("TCS", "NSE"): ScripInfo(ticker="TCS", exchange="NSE", exch="N", exch_type="C", scrip_code=11536, scrip_data="TCS_EQ"),
    ("INFY", "NSE"): ScripInfo(ticker="INFY", exchange="NSE", exch="N", exch_type="C", scrip_code=1594, scrip_data="INFY_EQ"),
}


_CACHE: dict[str, ScripInfo] = {}
_CACHE_LOADED_AT: datetime | None = None
_CACHE_TTL = timedelta(hours=12)


def _exchange_codes(exchange: str) -> tuple[str, str]:
    exchange_upper = exchange.upper()
    if exchange_upper == "BSE":
        return "B", "C"
    return "N", "C"


async def _load_nse_equity_cache() -> None:
    global _CACHE_LOADED_AT
    settings = get_settings()
    base = settings.fivepaisa_api_url.rstrip("/")
    url = f"{base}/ScripMaster/segment/nse_eq"
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.get(url)
        response.raise_for_status()
        text = response.text

    reader = csv.DictReader(io.StringIO(text))
    for row in reader:
        name = (row.get("Name") or row.get("name") or "").strip().upper()
        scrip_data = (row.get("ScripData") or row.get("scripdata") or "").strip()
        if not name and scrip_data.endswith("_EQ"):
            name = scrip_data.replace("_EQ", "")
        if not name:
            continue
        try:
            scrip_code = int(row.get("ScripCode") or row.get("scripcode") or 0)
        except ValueError:
            continue
        if scrip_code <= 0:
            continue
        exch = (row.get("Exch") or row.get("exch") or "N").strip().upper()
        exch_type = (row.get("ExchType") or row.get("exchtype") or "C").strip().upper()
        info = ScripInfo(
            ticker=name,
            exchange="NSE" if exch == "N" else "BSE",
            exch=exch,
            exch_type=exch_type,
            scrip_code=scrip_code,
            scrip_data=scrip_data or f"{name}_EQ",
        )
        _CACHE[f"{name}:NSE"] = info

    _CACHE_LOADED_AT = datetime.now(tz=timezone.utc)


async def resolve_scrip(ticker: str, exchange: str = "NSE", *, demo: bool = False) -> ScripInfo:
    ticker_upper = ticker.upper().strip()
    exchange_upper = exchange.upper().strip()
    key = f"{ticker_upper}:{exchange_upper}"

    if demo:
        demo_key = (ticker_upper, exchange_upper)
        if demo_key in _DEMO_SCRIPS:
            return _DEMO_SCRIPS[demo_key]
        exch, exch_type = _exchange_codes(exchange_upper)
        return ScripInfo(
            ticker=ticker_upper,
            exchange=exchange_upper,
            exch=exch,
            exch_type=exch_type,
            scrip_code=1000,
            scrip_data=f"{ticker_upper}_EQ",
        )

    global _CACHE_LOADED_AT
    if not _CACHE_LOADED_AT or datetime.now(tz=timezone.utc) - _CACHE_LOADED_AT > _CACHE_TTL:
        await _load_nse_equity_cache()

    if key in _CACHE:
        return _CACHE[key]

    if exchange_upper == "NSE" and f"{ticker_upper}:NSE" in _CACHE:
        return _CACHE[f"{ticker_upper}:NSE"]

    exch, exch_type = _exchange_codes(exchange_upper)
    return ScripInfo(
        ticker=ticker_upper,
        exchange=exchange_upper,
        exch=exch,
        exch_type=exch_type,
        scrip_code=0,
        scrip_data=f"{ticker_upper}_EQ",
    )
