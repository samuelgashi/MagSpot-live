# app/models/user.py
from sqlalchemy import Column, String, Text, TIMESTAMP, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base

class Users(Base):
    __tablename__ = "Users"

    user_id = Column(String, primary_key=True)
    external_id = Column(String, nullable=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    full_name = Column(String, nullable=True)
    username = Column(String, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, onupdate=func.now())
    last_sign_in_at = Column(TIMESTAMP, nullable=True)
    primary_email_address = Column(String, nullable=True)
    primary_phone_number = Column(String, nullable=True)
    email_verified = Column(Boolean, default=False)
    phone_number_verified = Column(Boolean, default=False)
    image_url = Column(Text, nullable=True)

    tunnel = relationship("Tunnel", back_populates="user", uselist=False)
