from backend.app.services.analysis.schemas import StrategyAnalysisResult
from pydantic import BaseModel


class ResearchSnapshotResponse(BaseModel):
    ticker: str
    exchange: str
    ltp: float
    change_percent: float | None = None
    analysis: StrategyAnalysisResult
    recent_decisions: list[dict]
