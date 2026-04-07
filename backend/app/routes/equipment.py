from fastapi import APIRouter, Depends, Query, HTTPException
from app.auth import get_current_user, enforce_mine_access, require_roles
from app.models import UserInfo, Role, Equipment
from app import state

router = APIRouter(prefix="/api/equipment", tags=["equipment"])


@router.get("", response_model=list[Equipment])
async def list_equipment(
    mine_id: str = Query(...),
    user: UserInfo = Depends(require_roles(Role.OPS_HEAD, Role.MINE_MANAGER, Role.FIELD_ENGINEER)),
):
    """CEO cannot access equipment-level data."""
    enforce_mine_access(user, mine_id)
    return state.get_mine_equipment(mine_id)


@router.get("/sensors/{equipment_id}")
async def get_equipment_sensors(
    equipment_id: str,
    user: UserInfo = Depends(require_roles(Role.OPS_HEAD, Role.MINE_MANAGER, Role.FIELD_ENGINEER)),
):
    """Get equipment sensor time-series data for monitoring."""
    eq = state.EQUIPMENT.get(equipment_id)
    if not eq:
        raise HTTPException(status_code=404, detail="Equipment not found")
    enforce_mine_access(user, eq.mine_id)
    sensor_data = state.EQUIPMENT_SENSORS.get(equipment_id, [])
    # Get active alerts for this equipment
    eq_alerts = [a.model_dump() for a in state.ALERTS if a.equipment_id == equipment_id and not a.acknowledged]
    # Get advisories for this equipment
    eq_advisories = [a.model_dump() for a in state.ADVISORIES if a.equipment_id == equipment_id and a.status == "active"]
    return {
        "equipment": eq.model_dump(),
        "sensors": sensor_data[-100:],
        "active_alerts": eq_alerts[:10],
        "advisories": eq_advisories[:5],
    }


@router.get("/{equipment_id}", response_model=Equipment)
async def get_equipment(
    equipment_id: str,
    user: UserInfo = Depends(require_roles(Role.OPS_HEAD, Role.MINE_MANAGER, Role.FIELD_ENGINEER)),
):
    eq = state.EQUIPMENT.get(equipment_id)
    if not eq:
        raise HTTPException(status_code=404, detail="Equipment not found")
    enforce_mine_access(user, eq.mine_id)
    return eq


@router.patch("/{equipment_id}/maintenance")
async def update_maintenance(
    equipment_id: str,
    user: UserInfo = Depends(require_roles(Role.FIELD_ENGINEER, Role.MINE_MANAGER)),
):
    """Field engineer can trigger maintenance on equipment."""
    eq = state.EQUIPMENT.get(equipment_id)
    if not eq:
        raise HTTPException(status_code=404, detail="Equipment not found")
    enforce_mine_access(user, eq.mine_id)
    from app.models import EquipmentStatus
    from datetime import datetime
    eq.status = EquipmentStatus.MAINTENANCE
    eq.utilization = 0
    eq.last_maintenance = datetime.utcnow().isoformat()
    eq.hours_since_maintenance = 0
    return {"message": f"Maintenance initiated for {eq.name}", "equipment": eq}
