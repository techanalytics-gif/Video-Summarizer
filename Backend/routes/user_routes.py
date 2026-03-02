from fastapi import APIRouter, HTTPException, Query
from typing import List

from services.credit_service import credit_service
from models.user import UserCreditsResponse, CreditTransactionResponse

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserCreditsResponse)
async def get_my_credits(user_id: str = Query(..., description="Clerk user ID")):
    """
    Get current user's credit balance.
    Auto-creates user with signup bonus if first call.
    """
    try:
        user = await credit_service.get_or_create_user(user_id)
        return UserCreditsResponse(
            clerk_user_id=user["clerk_user_id"],
            credits=user.get("credits", 0),
            total_credits_earned=user.get("total_credits_earned", 0),
            total_credits_spent=user.get("total_credits_spent", 0)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get credits: {str(e)}")


@router.get("/me/transactions", response_model=List[CreditTransactionResponse])
async def get_my_transactions(
    user_id: str = Query(..., description="Clerk user ID"),
    limit: int = Query(50, ge=1, le=200)
):
    """Get credit transaction history for the current user"""
    try:
        transactions = await credit_service.get_transactions(user_id, limit)
        return [CreditTransactionResponse(**t) for t in transactions]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get transactions: {str(e)}")


@router.get("/estimate-cost")
async def estimate_cost(
    duration_minutes: float = Query(..., ge=0, description="Video duration in minutes"),
    visibility: str = Query("public", description="public or private")
):
    """
    Estimate credit cost before submission.
    Used by the frontend to show expected cost.
    """
    duration_seconds = duration_minutes * 60
    cost = credit_service.calculate_cost(duration_seconds, visibility)
    return {
        "estimated_cost": cost,
        "visibility": visibility,
        "duration_minutes": duration_minutes,
        "rate": f"{'3' if visibility == 'private' else '1'} credit/min"
    }
