# app/models/tunnels.py
from sqlalchemy import Column, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base

class Tunnel(Base):
    __tablename__ = "Tunnels"

    user_id = Column(String, ForeignKey("Users.user_id", ondelete="CASCADE"), primary_key=True)
    is_scrcpy_running = Column(Boolean, default=False)
    is_tunnel_running = Column(Boolean, default=False)
    tunnel_url = Column(String, nullable=True)
    scrcpy_url = Column(String, nullable=True)
    scrcpy_process_id = Column(String, nullable=True)

    # Relationship to Users model
    user = relationship("Users", back_populates="tunnel", uselist=False)
