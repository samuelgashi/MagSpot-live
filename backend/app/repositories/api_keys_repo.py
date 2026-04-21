from app.db.session import SessionLocal
from app.models.apiKeys import ApiKey
from datetime import datetime

# Utility: hash API key before storing
def hash_api_key(raw_key: str) -> str:
    import hashlib
    return hashlib.sha256(raw_key.encode()).hexdigest()


def db_add_api_key(user_id: str, key_id: str, new_key: str, life_time: datetime, auth_endpoints: str) -> bool:
    db = SessionLocal()
    try:
        api_key = ApiKey(
            user_id=user_id,
            key_id=key_id,
            api_key=hash_api_key(new_key),
            life_time=life_time,
            authorized_endpoints=auth_endpoints
        )
        db.add(api_key)
        db.commit()
        return True
    finally:
        db.close()


def db_get_all_api_keys(user_id: str):
    db = SessionLocal()
    try:
        return db.query(ApiKey.key_id, ApiKey.life_time, ApiKey.authorized_endpoints).filter(ApiKey.user_id == user_id).all()
    finally:
        db.close()


def db_get_api_key(user_id: str, key_id: str):
    db = SessionLocal()
    try:
        return db.query(ApiKey).filter(ApiKey.user_id == user_id, ApiKey.key_id == key_id)\
                 .first()
    finally:
        db.close()


def db_auth_api_key(api_key: str):
    db = SessionLocal()
    try:
        return db.query(ApiKey).filter(ApiKey.api_key == api_key)\
                 .first()
    finally:
        db.close()


def db_delete_api_key(user_id: str, key_id: str) -> bool:
    db = SessionLocal()
    try:
        api_key = db.query(ApiKey).filter(ApiKey.user_id == user_id, ApiKey.key_id == key_id).first()
        if not api_key:
            return False
        db.delete(api_key)
        db.commit()
        return True
    finally:
        db.close()
