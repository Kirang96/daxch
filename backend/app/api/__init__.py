from fastapi import APIRouter

from backend.app.api import admin, agents, ai_units, analysis, auth, broker, notifications, research, settings, stocks, subscriptions, watchlist

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(admin.router)
api_router.include_router(broker.router)
api_router.include_router(stocks.router)
api_router.include_router(agents.router)
api_router.include_router(subscriptions.router)
api_router.include_router(ai_units.router)
api_router.include_router(notifications.router)
api_router.include_router(watchlist.router)
api_router.include_router(settings.router)
api_router.include_router(research.router)
api_router.include_router(analysis.router)

