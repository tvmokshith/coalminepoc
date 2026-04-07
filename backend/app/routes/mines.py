from fastapi import APIRouter, Depends
from app.auth import get_current_user, enforce_mine_access, filter_mines_for_user, require_roles
from app.models import UserInfo, Role, Mine
from app import state

router = APIRouter(prefix="/api/mines", tags=["mines"])


@router.get("", response_model=list[Mine])
async def list_mines(user: UserInfo = Depends(get_current_user)):
    allowed = filter_mines_for_user(user, list(state.MINES.keys()))
    return [state.MINES[mid] for mid in allowed]


@router.get("/{mine_id}", response_model=Mine)
async def get_mine(mine_id: str, user: UserInfo = Depends(get_current_user)):
    enforce_mine_access(user, mine_id)
    mine = state.MINES.get(mine_id)
    if not mine:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Mine not found")
    return mine
