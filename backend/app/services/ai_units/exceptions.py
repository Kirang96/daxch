class AiQuotaExceededError(Exception):
    def __init__(
        self,
        message: str = "AI Units exhausted for this billing period.",
        *,
        total_remaining: int = 0,
        bonus_balance: int = 0,
        resets_at: str | None = None,
    ) -> None:
        super().__init__(message)
        self.total_remaining = total_remaining
        self.bonus_balance = bonus_balance
        self.resets_at = resets_at
