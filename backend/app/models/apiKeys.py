# app/models/api_keys.py
from sqlalchemy import Column, String, TIMESTAMP, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db.session import Base

class ApiKey(Base):
    __tablename__ = "ApiKeys"

    key_id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("Users.user_id", ondelete="CASCADE"), nullable=False)
    api_key = Column(String, nullable=False)
    life_time = Column(TIMESTAMP, nullable=False)
    authorized_endpoints = Column(Text, nullable=False)

    # Optional: relationship back to User
    user = relationship("Users", backref="api_keys")
