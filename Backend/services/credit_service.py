import math
from datetime import datetime
from models.database import db
import config


# Credit system constants
SIGNUP_BONUS = getattr(config, 'SIGNUP_BONUS_CREDITS', 100)
CREDITS_PER_MINUTE = getattr(config, 'CREDITS_PER_MINUTE', 1)
PRIVATE_MULTIPLIER = getattr(config, 'PRIVATE_CREDIT_MULTIPLIER', 3)
MIN_CHARGE = 1  # minimum credit charge per video


class CreditService:
    """Handles all credit operations with atomic MongoDB updates"""

    def calculate_cost(self, duration_seconds: float, visibility: str = "public") -> float:
        """
        Calculate credit cost for a video.
        
        Args:
            duration_seconds: Video duration in seconds
            visibility: "public" or "private"
        
        Returns:
            Credit cost (float, at least MIN_CHARGE)
        """
        minutes = duration_seconds / 60.0
        base_cost = math.ceil(minutes * CREDITS_PER_MINUTE)
        if visibility == "private":
            base_cost *= PRIVATE_MULTIPLIER
        return max(base_cost, MIN_CHARGE)

    async def get_or_create_user(self, clerk_user_id: str) -> dict:
        """
        Get user doc or auto-create with signup bonus.
        Uses upsert to avoid race conditions on first call.
        
        Returns:
            The user document dict
        """
        database = db.get_db()

        # Atomic upsert: only $setOnInsert runs on first creation
        result = await database.users.find_one_and_update(
            {"clerk_user_id": clerk_user_id},
            {
                "$setOnInsert": {
                    "clerk_user_id": clerk_user_id,
                    "credits": SIGNUP_BONUS,
                    "total_credits_earned": SIGNUP_BONUS,
                    "total_credits_spent": 0.0,
                    "created_at": datetime.utcnow(),
                },
                "$set": {"updated_at": datetime.utcnow()}
            },
            upsert=True,
            return_document=True  # Motor uses return_document=True for ReturnDocument.AFTER
        )

        # If this was a brand-new user, log the signup bonus transaction
        # Check if total_credits_spent == 0 and credits == SIGNUP_BONUS to detect fresh account
        if result.get("total_credits_spent", 0) == 0 and result.get("credits") == SIGNUP_BONUS:
            # Check if we already logged a signup bonus
            existing_bonus = await database.credit_transactions.find_one({
                "clerk_user_id": clerk_user_id,
                "type": "signup_bonus"
            })
            if not existing_bonus:
                await database.credit_transactions.insert_one({
                    "clerk_user_id": clerk_user_id,
                    "amount": SIGNUP_BONUS,
                    "type": "signup_bonus",
                    "description": f"Welcome bonus: {SIGNUP_BONUS} credits",
                    "job_id": None,
                    "balance_after": SIGNUP_BONUS,
                    "created_at": datetime.utcnow()
                })

        return result

    async def get_balance(self, clerk_user_id: str) -> float:
        """Get current credit balance for a user"""
        user = await self.get_or_create_user(clerk_user_id)
        return user.get("credits", 0)

    async def check_credits(self, clerk_user_id: str) -> bool:
        """Check if user has any credits remaining (pre-submission check)"""
        balance = await self.get_balance(clerk_user_id)
        return balance > 0

    async def deduct_credits(self, clerk_user_id: str, amount: float, job_id: str, description: str = "") -> dict:
        """
        Atomically deduct credits from user balance.
        
        Uses findOneAndUpdate with a $gte guard so the deduction only
        succeeds if the user actually has enough credits.
        
        Args:
            clerk_user_id: Clerk user ID
            amount: Positive number of credits to deduct
            job_id: Associated job ID
            description: Human-readable description
        
        Returns:
            dict with "success", "balance", "charged"
        
        Raises:
            Nothing — returns {"success": False} on insufficient credits
        """
        database = db.get_db()
        amount = abs(amount)  # ensure positive

        # Atomic: only deduct if balance >= amount
        result = await database.users.find_one_and_update(
            {"clerk_user_id": clerk_user_id, "credits": {"$gte": amount}},
            {
                "$inc": {
                    "credits": -amount,
                    "total_credits_spent": amount
                },
                "$set": {"updated_at": datetime.utcnow()}
            },
            return_document=True
        )

        if not result:
            # Insufficient credits
            user = await self.get_or_create_user(clerk_user_id)
            return {
                "success": False,
                "balance": user.get("credits", 0),
                "charged": 0,
                "message": f"Insufficient credits. Need {amount}, have {user.get('credits', 0)}"
            }

        new_balance = result.get("credits", 0)

        # Log transaction
        await database.credit_transactions.insert_one({
            "clerk_user_id": clerk_user_id,
            "amount": -amount,
            "type": "video_processing",
            "description": description,
            "job_id": job_id,
            "balance_after": new_balance,
            "created_at": datetime.utcnow()
        })

        return {
            "success": True,
            "balance": new_balance,
            "charged": amount
        }

    async def refund_credits(self, clerk_user_id: str, amount: float, job_id: str, reason: str = "Processing failed") -> dict:
        """
        Refund credits back to user after a failed job.
        
        Args:
            clerk_user_id: Clerk user ID
            amount: Positive number of credits to refund
            job_id: Associated job ID
            reason: Reason for refund
        
        Returns:
            dict with "success", "balance", "refunded"
        """
        database = db.get_db()
        amount = abs(amount)

        result = await database.users.find_one_and_update(
            {"clerk_user_id": clerk_user_id},
            {
                "$inc": {
                    "credits": amount,
                    "total_credits_spent": -amount
                },
                "$set": {"updated_at": datetime.utcnow()}
            },
            return_document=True
        )

        if not result:
            return {"success": False, "balance": 0, "refunded": 0}

        new_balance = result.get("credits", 0)

        # Log refund transaction
        await database.credit_transactions.insert_one({
            "clerk_user_id": clerk_user_id,
            "amount": amount,
            "type": "refund",
            "description": f"Refund: {reason}",
            "job_id": job_id,
            "balance_after": new_balance,
            "created_at": datetime.utcnow()
        })

        return {
            "success": True,
            "balance": new_balance,
            "refunded": amount
        }

    async def get_transactions(self, clerk_user_id: str, limit: int = 50) -> list:
        """Get recent credit transactions for a user"""
        database = db.get_db()
        cursor = database.credit_transactions.find(
            {"clerk_user_id": clerk_user_id}
        ).sort("created_at", -1).limit(limit)

        transactions = await cursor.to_list(length=limit)
        return [
            {
                "transaction_id": str(t["_id"]),
                "amount": t.get("amount", 0),
                "type": t.get("type", ""),
                "description": t.get("description", ""),
                "job_id": t.get("job_id"),
                "balance_after": t.get("balance_after", 0),
                "created_at": t.get("created_at")
            }
            for t in transactions
        ]


# Module-level singleton
credit_service = CreditService()
