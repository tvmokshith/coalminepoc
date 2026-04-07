from fastapi import APIRouter, Depends, Query
from app.auth import get_current_user, enforce_mine_access, filter_mines_for_user
from app.models import UserInfo, Role, KPIReading, KPIDefinition, KPITimeSeries
from app import state
import random

router = APIRouter(prefix="/api/kpi", tags=["kpi"])


@router.get("/definitions", response_model=list[KPIDefinition])
async def get_kpi_definitions(user: UserInfo = Depends(get_current_user)):
    return state.KPI_DEFINITIONS


@router.get("/current", response_model=dict)
async def get_current_kpis(
    mine_id: str | None = Query(None),
    user: UserInfo = Depends(get_current_user),
):
    """Get current KPI values. CEO gets aggregated, others get per-mine."""
    if user.role == Role.CEO and not mine_id:
        return {"aggregated": state.get_aggregated_kpis()}

    if mine_id:
        enforce_mine_access(user, mine_id)
        return {"mine_id": mine_id, "kpis": {k: v.model_dump() for k, v in state.KPI_CURRENT.get(mine_id, {}).items()}}

    allowed = filter_mines_for_user(user, list(state.MINES.keys()))
    result = {}
    for mid in allowed:
        result[mid] = {k: v.model_dump() for k, v in state.KPI_CURRENT.get(mid, {}).items()}
    return result


@router.get("/history", response_model=KPITimeSeries)
async def get_kpi_history(
    mine_id: str = Query(...),
    kpi_name: str = Query(...),
    user: UserInfo = Depends(get_current_user),
):
    enforce_mine_access(user, mine_id)
    data = state.KPI_HISTORY.get(mine_id, {}).get(kpi_name, [])
    # Simple forecast: extend last 5 values with slight trend
    forecast = []
    rolling_avg = 0.0
    if len(data) >= 5:
        recent = [d["value"] for d in data[-5:]]
        avg = sum(recent) / len(recent)
        rolling_avg = round(avg, 2)
        trend = (recent[-1] - recent[0]) / len(recent)
        from datetime import datetime, timedelta
        last_ts = datetime.fromisoformat(data[-1]["timestamp"])
        for i in range(1, 9):
            forecast.append({
                "value": round(avg + trend * i, 2),
                "timestamp": (last_ts + timedelta(seconds=i * 3)).isoformat(),
            })

    # Fetch anomalies
    anomalies = state.KPI_ANOMALIES.get(mine_id, {}).get(kpi_name, [])[-20:]

    # Find KPI definition for context
    kpi_def = next((d for d in state.KPI_DEFINITIONS if d.name == kpi_name), None)
    definition = kpi_def.description if kpi_def else ""
    methodology = ""
    if kpi_def:
        methodology = f"Measured as {kpi_def.unit}. Green: {kpi_def.green_threshold}, Amber: {kpi_def.amber_threshold}, Red: {kpi_def.red_threshold}."

    # Target, YTD avg, industry avg (synthetic but reasonable)
    _TARGET_MAP = {
        "Production Rate": 600.0, "Equipment Utilization": 90.0, "Downtime": 5.0,
        "Stripping Ratio": 2.5, "Dispatch Efficiency": 95.0, "Wagon Availability": 90.0,
        "Cost Per Tonne": 700.0, "CO₂ Emissions": 120.0, "Workforce Attendance": 95.0,
        "Safety Score": 90.0,
    }
    _INDUSTRY_MAP = {
        "Production Rate": 520.0, "Equipment Utilization": 82.0, "Downtime": 10.0,
        "Stripping Ratio": 3.5, "Dispatch Efficiency": 87.0, "Wagon Availability": 80.0,
        "Cost Per Tonne": 850.0, "CO₂ Emissions": 180.0, "Workforce Attendance": 90.0,
        "Safety Score": 82.0,
    }
    target_val = _TARGET_MAP.get(kpi_name, 0.0)
    industry_val = _INDUSTRY_MAP.get(kpi_name, 0.0)

    # YTD average from history
    all_vals = [d["value"] for d in data]
    ytd_avg = round(sum(all_vals) / max(len(all_vals), 1), 2) if all_vals else 0.0

    # Delta vs yesterday (compare last reading vs one ~100 readings ago)
    delta = 0.0
    if len(data) >= 100:
        delta = round(data[-1]["value"] - data[-100]["value"], 2)
    elif len(data) >= 2:
        delta = round(data[-1]["value"] - data[0]["value"], 2)

    # Percent of target
    current_val = data[-1]["value"] if data else 0
    pct_target = round((current_val / target_val) * 100, 1) if target_val else 0.0

    # AI summary text
    ai_summary = ""
    if data:
        status_word = "normal" if abs(current_val - target_val) / max(target_val, 1) < 0.1 else "diverging from target"
        ai_summary = (
            f"{kpi_name} currently at {current_val:.1f} {kpi_def.unit if kpi_def else ''}. "
            f"Tracking {status_word}. "
            f"{'No significant anomalies detected.' if len(anomalies) == 0 else f'{len(anomalies)} anomaly events detected in recent history.'}"
        )

    return KPITimeSeries(
        kpi_name=kpi_name, mine_id=mine_id,
        data=data[-100:], forecast=forecast,
        rolling_avg=rolling_avg,
        anomalies=anomalies,
        ai_summary=ai_summary,
        definition=definition,
        methodology=methodology,
        target_value=target_val,
        ytd_avg=ytd_avg,
        industry_avg=industry_val,
        delta_vs_yesterday=delta,
        pct_of_target=pct_target,
    )


@router.get("/aggregated")
async def get_aggregated(user: UserInfo = Depends(get_current_user)):
    return state.get_aggregated_kpis()
