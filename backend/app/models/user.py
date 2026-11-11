from sqlalchemy import Column, DateTime, Integer, String

from app.core.database import Base
from app.core.timeutil import utcnow


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    code = Column(String(16), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False, default="operator")
    email = Column(String(120), unique=True, nullable=False, index=True)
    password_hash = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)


class AppSetting(Base):
    __tablename__ = "app_settings"

    key = Column(String(60), primary_key=True)
    value = Column("value", String(2000), nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
