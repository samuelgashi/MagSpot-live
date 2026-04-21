from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.tunnels import Tunnel


def init_tunnel_record(user_id: str):
    """Initialize a tunnel record if not exists."""
    with SessionLocal() as session:
        tunnel = session.query(Tunnel).filter_by(user_id=user_id).first()
        if not tunnel:
            tunnel = Tunnel(user_id=user_id)
            session.add(tunnel)
            try:
                session.commit()
            except IntegrityError:
                session.rollback()


def get_tunnel(user_id: str):
    """Fetch tunnel record by user_id."""
    with SessionLocal() as session:
        tunnel = session.query(Tunnel).filter_by(user_id=user_id).first()
        if tunnel:
            # Convert to dict without SQLAlchemy state
            return {
                "user_id": tunnel.user_id,
                "is_scrcpy_running": tunnel.is_scrcpy_running,
                "is_tunnel_running": tunnel.is_tunnel_running,
                "tunnel_url": tunnel.tunnel_url,
                "scrcpy_url": tunnel.scrcpy_url,
                "scrcpy_process_id": tunnel.scrcpy_process_id,
            }
        return None


def update_tunnel(user_id: str, updates: dict):
    """Update tunnel record fields dynamically."""
    with SessionLocal() as session:
        tunnel = session.query(Tunnel).filter_by(user_id=user_id).first()
        if tunnel:
            for field, value in updates.items():
                if hasattr(tunnel, field):
                    setattr(tunnel, field, value)
            session.commit()
