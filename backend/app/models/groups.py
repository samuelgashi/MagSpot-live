from sqlalchemy import Column, String, Text, TIMESTAMP, ForeignKey, JSON
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime
from app.db.session import Base
from app.models.users import Users

class DeviceGroup(Base):
    __tablename__ = "Device_Groups"

    group_id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("Users.user_id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(50), nullable=True)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to group devices
    devices = relationship("GroupDevice", back_populates="group", cascade="all, delete-orphan")


class GroupDevice(Base):
    __tablename__ = "Group_Devices"

    id = Column(String, primary_key=True)  # UUID as primary key
    group_id = Column(String, ForeignKey("Device_Groups.group_id", ondelete="CASCADE"), nullable=False)
    serial_number = Column(String, nullable=False)  # S/N for device matching
    device_name = Column(String, nullable=True)
    model_name = Column(String, nullable=True)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)

    group = relationship("DeviceGroup", back_populates="devices")
