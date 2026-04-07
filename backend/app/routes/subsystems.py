from fastapi import APIRouter, Depends, Query
from app.auth import get_current_user, enforce_mine_access, filter_mines_for_user
from app.models import (
    UserInfo, Alert, WorkOrder, LogisticsData, HRData,
    FinanceData, ESGData, EHSData,
)
from app import state
import uuid
from datetime import datetime

router = APIRouter(prefix="/api", tags=["subsystems"])


# ── Alerts ───────────────────────────────────────────
@router.get("/alerts", response_model=list[Alert])
async def list_alerts(
    mine_id: str | None = Query(None),
    user: UserInfo = Depends(get_current_user),
):
    allowed = filter_mines_for_user(user, list(state.MINES.keys()))
    alerts = state.ALERTS
    if mine_id:
        enforce_mine_access(user, mine_id)
        alerts = [a for a in alerts if a.mine_id == mine_id]
    else:
        alerts = [a for a in alerts if a.mine_id in allowed]
    return alerts[:50]


@router.patch("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, user: UserInfo = Depends(get_current_user)):
    for a in state.ALERTS:
        if a.id == alert_id:
            enforce_mine_access(user, a.mine_id)
            a.acknowledged = True
            return {"message": "Alert acknowledged"}
    from fastapi import HTTPException
    raise HTTPException(404, "Alert not found")


# ── Work Orders ──────────────────────────────────────
@router.get("/work-orders", response_model=list[WorkOrder])
async def list_work_orders(user: UserInfo = Depends(get_current_user)):
    allowed = filter_mines_for_user(user, list(state.MINES.keys()))
    return [w for w in state.WORK_ORDERS if w.mine_id in allowed][:50]


@router.post("/work-orders", response_model=WorkOrder)
async def create_work_order(
    mine_id: str, equipment_id: str = "", description: str = "Maintenance work order",
    priority: str = "medium",
    user: UserInfo = Depends(get_current_user),
):
    enforce_mine_access(user, mine_id)
    wo = WorkOrder(
        id=f"wo_{uuid.uuid4().hex[:8]}", mine_id=mine_id,
        equipment_id=equipment_id, type="maintenance",
        description=description, priority=priority,
        created_by=user.email, created_at=datetime.utcnow().isoformat(),
    )
    state.WORK_ORDERS.insert(0, wo)
    return wo


# ── Logistics ────────────────────────────────────────
@router.get("/subsystems/logistics", response_model=list[LogisticsData])
async def get_logistics(
    mine_id: str | None = Query(None),
    user: UserInfo = Depends(get_current_user),
):
    allowed = filter_mines_for_user(user, list(state.MINES.keys()))
    if mine_id:
        enforce_mine_access(user, mine_id)
        return [state.LOGISTICS[mine_id]] if mine_id in state.LOGISTICS else []
    return [state.LOGISTICS[m] for m in allowed if m in state.LOGISTICS]


# ── HR ───────────────────────────────────────────────
@router.get("/subsystems/hr", response_model=list[HRData])
async def get_hr(
    mine_id: str | None = Query(None),
    user: UserInfo = Depends(get_current_user),
):
    allowed = filter_mines_for_user(user, list(state.MINES.keys()))
    if mine_id:
        enforce_mine_access(user, mine_id)
        return [state.HR_DATA[mine_id]] if mine_id in state.HR_DATA else []
    return [state.HR_DATA[m] for m in allowed if m in state.HR_DATA]


# ── Finance ──────────────────────────────────────────
@router.get("/subsystems/finance", response_model=list[FinanceData])
async def get_finance(
    mine_id: str | None = Query(None),
    user: UserInfo = Depends(get_current_user),
):
    allowed = filter_mines_for_user(user, list(state.MINES.keys()))
    if mine_id:
        enforce_mine_access(user, mine_id)
        return [state.FINANCE_DATA[mine_id]] if mine_id in state.FINANCE_DATA else []
    return [state.FINANCE_DATA[m] for m in allowed if m in state.FINANCE_DATA]


# ── ESG ──────────────────────────────────────────────
@router.get("/subsystems/esg", response_model=list[ESGData])
async def get_esg(
    mine_id: str | None = Query(None),
    user: UserInfo = Depends(get_current_user),
):
    allowed = filter_mines_for_user(user, list(state.MINES.keys()))
    if mine_id:
        enforce_mine_access(user, mine_id)
        return [state.ESG_DATA[mine_id]] if mine_id in state.ESG_DATA else []
    return [state.ESG_DATA[m] for m in allowed if m in state.ESG_DATA]


# ── EHS ──────────────────────────────────────────────
@router.get("/subsystems/ehs", response_model=list[EHSData])
async def get_ehs(
    mine_id: str | None = Query(None),
    user: UserInfo = Depends(get_current_user),
):
    allowed = filter_mines_for_user(user, list(state.MINES.keys()))
    if mine_id:
        enforce_mine_access(user, mine_id)
        return [state.EHS_DATA[mine_id]] if mine_id in state.EHS_DATA else []
    return [state.EHS_DATA[m] for m in allowed if m in state.EHS_DATA]
