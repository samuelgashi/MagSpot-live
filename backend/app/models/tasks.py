from sqlalchemy import Column, String, Integer, Text, TIMESTAMP, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.session import Base
from app.models.users import Users

class Task(Base):
    __tablename__ = "Tasks"

    task_id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("Users.user_id", ondelete="CASCADE"), nullable=False)
    device_id = Column(String, ForeignKey("Android_Devices.device_id", ondelete="CASCADE"), nullable=False)
    task_type = Column(String, nullable=False)
    status = Column(String, nullable=False)
    progress = Column(Integer, default=0)
    logs = Column(Text, default="")
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # relationships (optional, if you want ORM navigation)
    device = relationship("AndroidDevice", back_populates="tasks")
