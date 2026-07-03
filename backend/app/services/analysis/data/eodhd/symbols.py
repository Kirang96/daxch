from __future__ import annotations

_EXCHANGE_SUFFIX = {
    "NSE": "NSE",
    "BSE": "BSE",
    "NSE_INDEX": "NSE",
    "BSE_INDEX": "BSE",
}


def to_eodhd_symbol(ticker: str, exchange: str) -> str:
    symbol = ticker.upper().strip()
    exchange_upper = exchange.upper().strip()
    if "|" in symbol:
        symbol = symbol.split("|")[-1].strip()
    if "." in symbol and symbol.rsplit(".", 1)[-1] in {"NSE", "BSE", "US"}:
        return symbol
    suffix = _EXCHANGE_SUFFIX.get(exchange_upper, "NSE")
    return f"{symbol}.{suffix}"
