from fastapi import APIRouter

router = APIRouter(prefix="/providers", tags=["providers"])

@router.get("")
def list_providers():
    return []
