
import jwt
import datetime
import requests
from . import auth_bp
from app.config import Config
from flask import Blueprint, request, jsonify,  g
from flask_jwt_extended import create_access_token
from app.repositories.users_repo import init_user_records
from app.utils.auth import auth_required

CLERK_SECRET_KEY = Config.CLERK_SECRET_KEY

@auth_bp.route('/api/authenticate_admin', methods=['POST'])
def authenticate_admin():
    """Generates a JWT for admin operations."""
    data = request.get_json()
    if not data or data.get('admin_key') != Config.ADMIN_KEY:
        return jsonify({'error': 'Invalid admin key'}), 403
    
    token = jwt.encode({
        'exp': datetime.utcnow() + datetime.timedelta(hours=Config.TOKEN_EXPIRE_LIMIT)
    }, Config.ADMIN_KEY, algorithm="HS256")
    return jsonify({'token': token}), 200



# CLERK AUTHENTICATIONS
@auth_bp.route('/clerk', methods=['GET'])
@auth_required
def test_auth():
    resp = requests.get(
        f"https://api.clerk.dev/v1/users/{g.user_id}",
        headers={"Authorization": f"Bearer {CLERK_SECRET_KEY}"}
    )
    resp.raise_for_status()
    user_data = resp.json()

    # Normalize Clerk fields
    email = None
    email_verified = None
    if user_data.get("email_addresses"):
        primary_email = next(
            (e for e in user_data["email_addresses"] 
             if e["id"] == user_data.get("primary_email_address_id")), 
            None
        )
        if primary_email:
            email = primary_email["email_address"]
            email_verified = primary_email["verification"]["status"] == "verified"

    phone = None
    phone_verified = None
    if user_data.get("phone_numbers"):
        primary_phone = next(
            (p for p in user_data["phone_numbers"] 
             if p["id"] == user_data.get("primary_phone_number_id")), 
            None
        )
        if primary_phone:
            phone = primary_phone["phone_number"]
            phone_verified = primary_phone["verification"]["status"] == "verified"

    # Convert timestamps
    def to_datetime(ms):
        return datetime.datetime.utcfromtimestamp(ms / 1000) if ms else None

    user_record = {
        "external_id": user_data.get("external_id"),
        "first_name": user_data.get("first_name"),
        "last_name": user_data.get("last_name"),
        "full_name": f"{user_data.get('first_name','')} {user_data.get('last_name','')}".strip(),
        "username": user_data.get("username"),
        "created_at": to_datetime(user_data.get("created_at")),
        "updated_at": to_datetime(user_data.get("updated_at")),
        "last_sign_in_at": to_datetime(user_data.get("last_sign_in_at")),
        "primary_email_address": email,
        "primary_phone_number": phone,
        "email_verified": email_verified,
        "phone_number_verified": phone_verified,
        "image_url": user_data.get("image_url"),
    }

    # init_user_records(g.user_id, user_record)
    return jsonify({'user_id': g.user_id}), 200