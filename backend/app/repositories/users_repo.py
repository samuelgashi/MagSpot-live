from sqlite3 import IntegrityError
from app.db.session import SessionLocal
from app.models.users import Users
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash


def init_user_records(user_id: str, user_data: dict):
    """Insert or update a user record without passing db explicitly."""
    db = SessionLocal()
    try:
        user = db.query(Users).filter(Users.user_id == user_id).first()
        if user:
            for field, value in user_data.items():
                if hasattr(user, field): setattr(user, field, value)
            Users.updated_at = datetime.utcnow()
        else:
            user = Users(
                user_id=user_id,
                **{k: v for k, v in user_data.items() if hasattr(Users, k)}
            )
            db.add(user)

        db.commit()
        db.refresh(user)
        return user
    finally:  db.close()


def init_admin_user():
    """Create or update the admin user with the password from config."""
    from app.config import Config
    db = SessionLocal()
    try:
        admin_id = "admin"
        pw_hash = generate_password_hash(Config.ADMIN_PASSWORD)
        admin = db.query(Users).filter_by(user_id=admin_id).first()
        if admin:
            admin.password_hash = pw_hash
            db.commit()
            print("ℹ️ Admin user password synced from config")
            return

        admin = Users(
            user_id=admin_id,
            external_id="admin_ext",
            first_name="Admin",
            last_name="User",
            full_name="Admin User",
            username="admin",
            primary_email_address="admin@example.com",
            email_verified=True,
            password_hash=pw_hash,
        )
        db.add(admin)
        db.commit()
        print("✅ Admin user created")
    except Exception as e:
        db.rollback()
        print(f"⚠️ Failed to initialize admin user: {e}")
    finally:
        db.close()


def db_verify_password(username: str, password: str):
    """Verify username + password. Returns the Users row or None."""
    db = SessionLocal()
    try:
        user = db.query(Users).filter_by(username=username).first()
        if not user or not user.password_hash:
            return None
        if check_password_hash(user.password_hash, password):
            return user
        return None
    finally:
        db.close()


def db_change_password(user_id: str, new_password: str) -> bool:
    """Update the password_hash for a user. Returns True on success."""
    db = SessionLocal()
    try:
        user = db.query(Users).filter_by(user_id=user_id).first()
        if not user:
            return False
        user.password_hash = generate_password_hash(new_password)
        db.commit()
        return True
    except Exception:
        db.rollback()
        return False
    finally:
        db.close()



def db_get_all_users():
    db = SessionLocal()
    try: return db.query(Users).all()
    finally: db.close()



def db_delete_user(user_id: str):
    db = SessionLocal()
    try:
        user = db.query(Users).filter(Users.user_id == user_id).first()
        if not user: return False
        db.delete(user)
        db.commit()
        return True
    finally:  db.close()
