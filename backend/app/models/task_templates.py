from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.session import Base
from app.models.users import Users

class TaskTemplate(Base):
    __tablename__ = "Task_Templates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("Users.user_id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    type = Column(String, default="custom")
    script_ref = Column(String, nullable=True)
    duration_min = Column(Integer, default=30)
    duration_max = Column(Integer, default=120)
    created_at = Column(TIMESTAMP, server_default=func.now())
