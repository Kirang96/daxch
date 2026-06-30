from datetime import datetime, timedelta, timezone
from typing import Any


def should_auto_execute(agent_config: dict[str, Any]) -> bool:
    return bool(agent_config.get("auto_execute_on_timeout", False))


def confirmation_timeout_minutes(agent_config: dict[str, Any]) -> int:
    return int(agent_config.get("confirmation_timeout_minutes", 5))


def confirmation_deadline(agent_config: dict[str, Any]) -> datetime:
    minutes = confirmation_timeout_minutes(agent_config)
    return (datetime.now(tz=timezone.utc) + timedelta(minutes=minutes)).replace(second=0, microsecond=0)

