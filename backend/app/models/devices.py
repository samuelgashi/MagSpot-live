from sqlalchemy import Column, String, Text, TIMESTAMP, ForeignKey, PrimaryKeyConstraint
from sqlalchemy.orm import relationship, declarative_base, Session
from sqlalchemy import create_engine, update
from datetime import datetime
from app.db.session import Base
from app.models.users import Users

class AndroidDevice(Base):
    __tablename__ = "Android_Devices"

    device_id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("Users.user_id", ondelete="CASCADE"), nullable=False)
    android_ip = Column(String, nullable=False)
    android_name = Column(String)
    serial_number = Column(String, nullable=True)
    status = Column(String, default="FREE")
    current_task_id = Column(String, nullable=True)
    model = Column(String(255), nullable=True)
    android_version = Column(String(50), nullable=True)
    battery_level = Column(String(10), nullable=True)
    sheet_url = Column(Text, nullable=True)
    last_seen = Column(TIMESTAMP, default=datetime.utcnow)
    tasks = relationship("Task", back_populates="device", cascade="all, delete-orphan")

    # __table_args__ = ( PrimaryKeyConstraint("user_id", "device_id"), )
    # relationships (if Accounts table is also ORM defined)
    # accounts = relationship("Account", back_populates="device", cascade="all, delete-orphan")
