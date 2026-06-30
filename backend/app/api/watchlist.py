from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.middleware.auth import get_current_user
from backend.app.models.entities import User, WatchlistItem
from backend.app.schemas.watchlist import WatchlistCreateRequest, WatchlistResponse, WatchlistUpdateRequest

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


@router.get("", response_model=list[WatchlistResponse])
def list_watchlist(
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[WatchlistResponse]:
    stmt = select(WatchlistItem).where(WatchlistItem.user_id == current_user.id).order_by(WatchlistItem.created_at.desc())
    items = db.execute(stmt).scalars().all()
    if search:
        lowered = search.lower()
        items = [item for item in items if lowered in item.ticker.lower() or lowered in item.exchange.lower()]
    return [WatchlistResponse.model_validate(item) for item in items]


@router.post("", response_model=WatchlistResponse, status_code=status.HTTP_201_CREATED)
def create_watchlist_item(
    payload: WatchlistCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WatchlistResponse:
    existing = db.execute(
        select(WatchlistItem).where(
            WatchlistItem.user_id == current_user.id,
            WatchlistItem.ticker == payload.ticker.upper(),
            WatchlistItem.exchange == payload.exchange.upper(),
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ticker already in watchlist.")

    item = WatchlistItem(
        user_id=current_user.id,
        ticker=payload.ticker.upper(),
        exchange=payload.exchange.upper(),
        note=payload.note,
        target_price=payload.target_price,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return WatchlistResponse.model_validate(item)


@router.patch("/{item_id}", response_model=WatchlistResponse)
def update_watchlist_item(
    item_id: str,
    payload: WatchlistUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WatchlistResponse:
    item = db.get(WatchlistItem, UUID(item_id))
    if not item or item.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watchlist item not found")

    if payload.note is not None:
        item.note = payload.note
    if payload.target_price is not None:
        item.target_price = payload.target_price

    db.commit()
    db.refresh(item)
    return WatchlistResponse.model_validate(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_watchlist_item(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    item = db.get(WatchlistItem, UUID(item_id))
    if not item or item.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watchlist item not found")
    db.delete(item)
    db.commit()

