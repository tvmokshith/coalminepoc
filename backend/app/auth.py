from datetime import datetime, timedelta
import bcrypt
from jose import jwt, JWTError
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings
from app.models import Role, UserInfo


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


security = HTTPBearer()

# ── User Store ─────────────────────────────────────────
USERS: dict[str, dict] = {
    "ceo@astrikos.com": {
        "id": "user_ceo",
        "email": "ceo@astrikos.com",
        "name": "Rajiv Mehta",
        "role": Role.CEO,
        "assigned_mine_id": None,
        "password_hash": _hash_password("password"),
    },
    "opshead@astrikos.com": {
        "id": "user_ops",
        "email": "opshead@astrikos.com",
        "name": "Sunita Sharma",
        "role": Role.OPS_HEAD,
        "assigned_mine_id": None,
        "password_hash": _hash_password("password"),
    },
    "manager_mine1@astrikos.com": {
        "id": "user_mgr1",
        "email": "manager_mine1@astrikos.com",
        "name": "Amit Kumar",
        "role": Role.MINE_MANAGER,
        "assigned_mine_id": "mine_gevra",
        "password_hash": _hash_password("password"),
    },
    "manager_mine2@astrikos.com": {
        "id": "user_mgr2",
        "email": "manager_mine2@astrikos.com",
        "name": "Priya Patel",
        "role": Role.MINE_MANAGER,
        "assigned_mine_id": "mine_kusmunda",
        "password_hash": _hash_password("password"),
    },
    "engineer1@astrikos.com": {
        "id": "user_eng1",
        "email": "engineer1@astrikos.com",
        "name": "Vikram Singh",
        "role": Role.FIELD_ENGINEER,
        "assigned_mine_id": "mine_gevra",
        "password_hash": _hash_password("password"),
    },
    "engineer2@astrikos.com": {
        "id": "user_eng2",
        "email": "engineer2@astrikos.com",
        "name": "Deepak Rao",
        "role": Role.FIELD_ENGINEER,
        "assigned_mine_id": "mine_kusmunda",
        "password_hash": _hash_password("password"),
    },
}


def authenticate_user(email: str, password: str) -> dict | None:
    user = USERS.get(email)
    if not user:
        return None
    if not _verify_password(password, user["password_hash"]):
        return None
    return user


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UserInfo:
    payload = decode_token(credentials.credentials)
    email = payload.get("sub")
    if not email or email not in USERS:
        raise HTTPException(status_code=401, detail="Invalid user")
    u = USERS[email]
    return UserInfo(id=u["id"], email=u["email"], name=u["name"], role=u["role"], assigned_mine_id=u.get("assigned_mine_id"))


# ── RBAC Helpers ───────────────────────────────────────
def require_roles(*allowed_roles: Role):
    def checker(user: UserInfo = Depends(get_current_user)):
        if user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail=f"Role {user.role.value} not authorized")
        return user
    return checker


def enforce_mine_access(user: UserInfo, mine_id: str):
    """Ensure user can only access their assigned mine (for mine_manager and field_engineer)."""
    if user.role in (Role.CEO, Role.OPS_HEAD):
        return
    if user.assigned_mine_id and user.assigned_mine_id != mine_id:
        raise HTTPException(status_code=403, detail="Access denied: not assigned to this mine")


def filter_mines_for_user(user: UserInfo, mine_ids: list[str]) -> list[str]:
    if user.role in (Role.CEO, Role.OPS_HEAD):
        return mine_ids
    if user.assigned_mine_id:
        return [m for m in mine_ids if m == user.assigned_mine_id]
    return []
