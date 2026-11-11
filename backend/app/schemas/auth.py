import re

from pydantic import BaseModel, Field, field_validator

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=120)
    password: str = Field(min_length=1, max_length=200)
    remember: bool = False

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        return value.strip().lower()


class SignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=5, max_length=120)
    password: str = Field(min_length=8, max_length=200)
    accept_terms: bool = True

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if len(cleaned) < 2:
            raise ValueError("Enter your full name.")
        return cleaned

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if not EMAIL_PATTERN.match(cleaned):
            raise ValueError("Enter a valid email address.")
        return cleaned

    @field_validator("accept_terms")
    @classmethod
    def _terms(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Accept the terms to create an account.")
        return value
