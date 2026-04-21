import jwt
import hmac
import base64
import hashlib
from app.config import Config
from jwt import PyJWKClient
from functools import wraps
from datetime import datetime
from flask import request, g, jsonify
from cryptography.fernet import Fernet
# from database import *
from app.repositories.api_keys_repo import *

ENV = Config.ENV
SECRET_KEY = Config.SECRET_KEY
ADMIN_KEY = Config.ADMIN_KEY
DEV_API_KEY = Config.DEV_API_KEY

CLERK_SECRET_KEY = Config.CLERK_SECRET_KEY
CLERK_ISSUER = Config.CLERK_ISSUER
CLERK_JWKS_URL = Config.CLERK_JWKS_URL

from jwt import PyJWKClient
jwks_url = Config.CLERK_JWKS_URL
jwks_client = PyJWKClient(jwks_url)


# --------------------------------------------------------
# ------------ DECORATORS FOR AUTHENTICATION -------------
# --------------------------------------------------------

ONLY_ADMIN = "admin"


def admin_token_required(f):
    """Decorator to protect routes with admin JWT."""
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            token = request.headers.get('x-access-token')
            if not token: return jsonify({'error': 'Admin token is missing'}), 401
            try: jwt.decode(token, ADMIN_KEY, algorithms=["HS256"])
            except (jwt.ExpiredSignatureError, jwt.InvalidTokenError): return jsonify({'error': 'Admin token is invalid or expired'}), 401
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({'error': 'Authorization Failed!'}), 400
    return decorated



def token_required(f):
    """Decorator to protect routes with admin JWT."""
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            token = request.headers.get('x-access-token')
            if not token: return jsonify({'error': 'Admin token is missing'}), 401
            try: jwt.decode(token, ADMIN_KEY, algorithms=["HS256"])
            except (jwt.ExpiredSignatureError, jwt.InvalidTokenError): return jsonify({'error': 'Admin token is invalid or expired'}), 401
            data = request.get_json()
            if not data or not data.get('user_id'):
                return jsonify({'error': 'User Authentication Failed'}), 400
            g.user_id = data['user_id']
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({'error': 'Authorization Failed!'}), 400
    return decorated



def verify_jwt(token: str):
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,          # <-- PEM key (this fixes your error)
            algorithms=["RS256"],
            issuer=CLERK_ISSUER,
            options={   "verify_aud": False, },
        )
        return payload
    except Exception as e: raise ValueError(f"Invalid token: {e}")



def auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            auth_header = request.headers.get("Authorization")
            api_key = (
                request.headers.get('X-API-KEY') or
                request.headers.get('x-api-key') or
                request.args.get('api_key')
            )

            # --- Clerk JWT via Authorization: Bearer ---
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ", 1)[1]
                try:
                    payload = verify_jwt(token)
                    g.user_id = payload.get("sub")
                    g.user = payload
                    if not g.user_id:
                        return jsonify({"error": "Invalid token payload"}), 401
                    g.user_id = ONLY_ADMIN
                except ValueError as e:
                    return jsonify({"error": str(e)}), 401
                return f(*args, **kwargs)
            
            # --- Development shortcut ---
            if ENV == 'development' and api_key == DEV_API_KEY:
                g.user_id = "user_dev"
                return f(*args, **kwargs)

            # --- API Key authentication ---
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

            # --- Admin access via x-access-token ---
            token = request.headers.get('x-access-token')
            if token:
                try:
                    # Verify admin token
                    payload = jwt.decode(token, ADMIN_KEY, algorithms=["HS256"])
                except jwt.ExpiredSignatureError:
                    return jsonify({"error": "Admin token expired"}), 401
                except jwt.InvalidTokenError:
                    return jsonify({"error": "Admin token invalid"}), 401

                # Get user_id from request (query or JSON body)
                user_id = request.args.get("user_id")
                if not user_id:
                    data = request.get_json(silent=True)
                    user_id = data.get("user_id") if data else None

                if not user_id:
                    return jsonify({"error": "User Authentication Failed"}), 400

                g.user_id = user_id
                g.admin = payload
                return f(*args, **kwargs)

            return jsonify({'error': 'API key or Token is missing'}), 401

        except Exception as e :
            print(e)
            return jsonify({'error': 'Authorization Failed!'}), 400
    
    return decorated



def clerk_auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")

        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authorization header missing"}), 401

        token = auth_header.split(" ", 1)[1]
        try:
            payload = verify_jwt(token)
            g.user_id = payload.get("sub")
            g.user = payload
            if not g.user_id:
                return jsonify({"error": "Invalid token payload"}), 401

        except ValueError as e: return jsonify({"error": str(e)}), 401
        return f(*args, **kwargs)
    return decorated


def api_key_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        api_key = (
            request.headers.get('X-API-KEY') or
            request.headers.get('x-api-key') or
            request.args.get('api_key')
        )
        
        # Development shortcut
        if ENV == 'development' and api_key == DEV_API_KEY:
            return f(*args, **kwargs)

        if not api_key:
            return jsonify({'error': 'API key is missing'}), 401

        key_data = db_auth_api_key(hash_api_key(api_key))
        if not key_data:
            return jsonify({'error': 'Invalid API key'}), 403

        # Expiry check (life_time is already a datetime from psycopg2)
        if key_data['life_time'] < datetime.utcnow():
            return jsonify({'error': 'API key has expired'}), 403

        return f(*args, **kwargs)
    return decorated
