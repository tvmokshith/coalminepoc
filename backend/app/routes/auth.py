from fastapi import APIRouter, Depends
from app.auth import authenticate_user, create_access_token, get_current_user
from app.models import LoginRequest, TokenResponse, UserInfo

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    user = authenticate_user(req.email, req.password)
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": user["email"]})
    return TokenResponse(
        access_token=token,
        user=UserInfo(
            id=user["id"], email=user["email"], name=user["name"],
            role=user["role"], assigned_mine_id=user.get("assigned_mine_id"),
        ),
    )


@router.get("/me", response_model=UserInfo)
async def get_me(user: UserInfo = Depends(get_current_user)):
    return user
