import jwt
import hashlib
from app.config import Config
from functools import wraps
from datetime import datetime, timedelta
from flask import request, g, jsonify
from app.repositories.api_keys_repo import db_auth_api_key, hash_api_key

ENV = Config.ENV
SECRET_KEY = Config.SECRET_KEY
ADMIN_KEY = Config.ADMIN_KEY
DEV_API_KEY = Config.DEV_API_KEY


def create_session_token(user_id: str) -> str:
    """Create a signed JWT session token for browser login."""
    payload = {
        "user_id": user_id,
        "sub": user_id,
        "type": "session",
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(days=Config.SESSION_EXPIRE_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def admin_token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            token = request.headers.get('x-access-token')
            if not token:
                return jsonify({'error': 'Admin token is missing'}), 401
            try:
                jwt.decode(token, ADMIN_KEY, algorithms=["HS256"])
            except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
                return jsonify({'error': 'Admin token is invalid or expired'}), 401
            return f(*args, **kwargs)
        except Exception:
            return jsonify({'error': 'Authorization Failed!'}), 400
    return decorated


def auth_required(f):
    """
    Protect routes with either:
      1. Session JWT  — Authorization: Bearer <token>  (browser login)
      2. API Key      — x-api-key header or ?api_key   (programmatic / APIAAS)
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            auth_header = request.headers.get("Authorization")
            api_key = (
                request.headers.get('X-API-KEY') or
                request.headers.get('x-api-key') or
                request.args.get('api_key')
            )

            # ── 1. Session JWT (browser login) ────────────────────────
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ", 1)[1]
                try:
                    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
                    user_id = payload.get("user_id") or payload.get("sub")
                    if not user_id:
                        return jsonify({"error": "Invalid session token"}), 401
                    g.user_id = user_id
                    return f(*args, **kwargs)
                except jwt.ExpiredSignatureError:
                    return jsonify({"error": "Session expired, please log in again"}), 401
                except jwt.InvalidTokenError:
                    return jsonify({"error": "Invalid session token"}), 401

            # ── 2. Dev shortcut ───────────────────────────────────────
            if ENV == 'development' and api_key == DEV_API_KEY:
                g.user_id = "admin"
                return f(*args, **kwargs)

            # ── 3. API Key (APIAAS / headless clients) ────────────────
            if api_key:
                key_data = db_auth_api_key(hash_api_key(api_key))
                if not key_data:
                    return jsonify({'error': 'Invalid API key'}), 403
                if key_data.life_time < datetime.utcnow():
                    return jsonify({'error': 'API key has expired'}), 403
                g.user_id = key_data.user_id
                if not g.user_id:
                    return jsonify({"error": "Invalid API key payload"}), 401
                return f(*args, **kwargs)

            return jsonify({'error': 'Authentication required. Use browser login (session token) or an API key.'}), 401

        except Exception as e:
            print(e)
            return jsonify({'error': 'Authorization Failed!'}), 400

    return decorated


def api_key_required(f):
    """Require only an API key (no session JWT fallback)."""
    @wraps(f)
    def decorated(*args, **kwargs):
        api_key = (
            request.headers.get('X-API-KEY') or
            request.headers.get('x-api-key') or
            request.args.get('api_key')
        )
        if ENV == 'development' and api_key == DEV_API_KEY:
            return f(*args, **kwargs)
        if not api_key:
            return jsonify({'error': 'API key is missing'}), 401
        key_data = db_auth_api_key(hash_api_key(api_key))
        if not key_data:
            return jsonify({'error': 'Invalid API key'}), 403
        if key_data.life_time < datetime.utcnow():
            return jsonify({'error': 'API key has expired'}), 403
        return f(*args, **kwargs)
    return decorated
