# Common NSE/BSE trading symbols → company names for news search.
# Unknown tickers fall back to the symbol itself.
NSE_COMPANY_NAMES: dict[str, str] = {
    "RELIANCE": "Reliance Industries",
    "TCS": "Tata Consultancy Services",
    "INFY": "Infosys",
    "HDFCBANK": "HDFC Bank",
    "ICICIBANK": "ICICI Bank",
    "HINDUNILVR": "Hindustan Unilever",
    "ITC": "ITC Limited",
    "SBIN": "State Bank of India",
    "BHARTIARTL": "Bharti Airtel",
    "KOTAKBANK": "Kotak Mahindra Bank",
    "LT": "Larsen & Toubro",
    "AXISBANK": "Axis Bank",
    "ASIANPAINT": "Asian Paints",
    "MARUTI": "Maruti Suzuki",
    "TITAN": "Titan Company",
    "BAJFINANCE": "Bajaj Finance",
    "WIPRO": "Wipro",
    "HCLTECH": "HCL Technologies",
    "SUNPHARMA": "Sun Pharmaceutical",
    "TATAMOTORS": "Tata Motors",
    "TATASTEEL": "Tata Steel",
    "POWERGRID": "Power Grid Corporation",
    "NTPC": "NTPC",
    "ONGC": "Oil and Natural Gas Corporation",
    "ADANIENT": "Adani Enterprises",
    "ADANIPORTS": "Adani Ports",
    "COALINDIA": "Coal India",
    "NESTLEIND": "Nestle India",
    "ULTRACEMCO": "UltraTech Cement",
    "M&M": "Mahindra & Mahindra",
}


def resolve_company_name(ticker: str) -> str:
    key = ticker.upper().strip()
    return NSE_COMPANY_NAMES.get(key, key)


def build_news_queries(ticker: str, exchange: str = "NSE") -> list[str]:
    symbol = ticker.upper().strip()
    company = resolve_company_name(symbol)
    exchange_label = exchange.upper()

    queries = [
        f'"{company}" {exchange_label} stock',
        f"{company} India stock earnings",
        f"{symbol} {exchange_label} share price news",
    ]
    if company != symbol:
        queries.append(f"{symbol} {company} India")

    # Preserve order, drop duplicates
    seen: set[str] = set()
    unique: list[str] = []
    for q in queries:
        if q not in seen:
            seen.add(q)
            unique.append(q)
    return unique
