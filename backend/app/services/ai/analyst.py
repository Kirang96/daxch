class AIConfigurationError(RuntimeError):
    pass


def clamp_polling_frequency(value: int) -> int:
    return max(2, min(12, int(value)))
