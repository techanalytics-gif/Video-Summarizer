from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from bson import ObjectId


class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema):
        field_schema.update(type="string")


class User(BaseModel):
    """User profile with credit balance"""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    clerk_user_id: str
    credits: float = 0.0
    total_credits_earned: float = 0.0
    total_credits_spent: float = 0.0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class CreditTransaction(BaseModel):
    """Audit log for every credit change"""
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    clerk_user_id: str
    amount: float  # positive = credit, negative = deduction
    type: str  # "signup_bonus", "video_processing", "refund"
    description: str = ""
    job_id: Optional[str] = None
    balance_after: float = 0.0
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class UserCreditsResponse(BaseModel):
    """Response model for credit balance endpoint"""
    clerk_user_id: str
    credits: float
    total_credits_earned: float
    total_credits_spent: float


class CreditTransactionResponse(BaseModel):
    """Response model for transaction history"""
    transaction_id: str
    amount: float
    type: str
    description: str
    job_id: Optional[str] = None
    balance_after: float
    created_at: datetime
