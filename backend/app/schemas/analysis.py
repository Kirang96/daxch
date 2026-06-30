from backend.app.services.analysis.schemas import StrategyAnalysisResult, StrategyMeta
from pydantic import BaseModel


class StrategyAnalysisResponse(BaseModel):
    ticker: str
    exchange: str
    analysis: StrategyAnalysisResult


class StrategyListResponse(BaseModel):
    plan: str
    strategies: list[StrategyMeta]
