from sqlite3 import IntegrityError
from app.db.session import SessionLocal
from app.models.users import Users
from datetime import datetime


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
    """Create an admin user if it doesn't exist."""
    db = SessionLocal()
    try:
        admin_id = "admin"
        admin = db.query(Users).filter_by(user_id=admin_id).first()
        if admin:
            print("ℹ️ Admin user already exists")
            return

        admin = Users(
            user_id=admin_id,
            external_id="admin_ext",
            first_name="Admin",
            last_name="User",
            full_name="Admin User",
            username="admin",
            primary_email_address="admin@example.com",
            email_verified=True
        )
        db.add(admin)
        db.commit()
        print("✅ Admin user created")
    except IntegrityError:
        db.rollback()
        print("⚠️ Failed to create admin user (duplicate or constraint error)")
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
