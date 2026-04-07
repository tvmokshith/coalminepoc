from fastapi import APIRouter, Depends, Query
from app.auth import get_current_user, enforce_mine_access, filter_mines_for_user
from app.models import UserInfo, Advisory, AdvisoryStatus
from app import state

router = APIRouter(prefix="/api/advisory", tags=["advisory"])


@router.get("", response_model=list[Advisory])
async def list_advisories(
    mine_id: str | None = Query(None),
    user: UserInfo = Depends(get_current_user),
):
    allowed = filter_mines_for_user(user, list(state.MINES.keys()))
    advisories = state.ADVISORIES
    if mine_id:
        enforce_mine_access(user, mine_id)
        advisories = [a for a in advisories if a.mine_id == mine_id]
    else:
        advisories = [a for a in advisories if a.mine_id in allowed]
    return advisories[:50]


@router.patch("/{advisory_id}/acknowledge")
async def acknowledge_advisory(
    advisory_id: str,
    user: UserInfo = Depends(get_current_user),
):
    for adv in state.ADVISORIES:
        if adv.id == advisory_id:
            enforce_mine_access(user, adv.mine_id)
            adv.status = AdvisoryStatus.ACKNOWLEDGED
            return {"message": "Advisory acknowledged", "advisory": adv}
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Advisory not found")


@router.patch("/{advisory_id}/resolve")
async def resolve_advisory(
    advisory_id: str,
    user: UserInfo = Depends(get_current_user),
):
    for adv in state.ADVISORIES:
        if adv.id == advisory_id:
            enforce_mine_access(user, adv.mine_id)
            adv.status = AdvisoryStatus.RESOLVED
            return {"message": "Advisory resolved", "advisory": adv}
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Advisory not found")
