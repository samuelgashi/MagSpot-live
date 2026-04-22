
import jwt
import datetime as dt
from . import auth_bp
from app.config import Config
from flask import request, jsonify, g
from app.utils.auth import auth_required, create_session_token
from app.repositories.users_repo import db_verify_password, db_change_password


# ─────────────────────────────────────────────────────────
# POST /api/auth/login  — browser login (returns JWT session token)
# ─────────────────────────────────────────────────────────
@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"error": "username and password are required"}), 400

    user = db_verify_password(username, password)
    if not user:
        return jsonify({"error": "Invalid username or password"}), 401

    token = create_session_token(user.user_id)
    return jsonify({"token": token, "user_id": user.user_id}), 200


# ─────────────────────────────────────────────────────────
# POST /api/auth/change_password  — change password (requires session or API key)
# ─────────────────────────────────────────────────────────
@auth_bp.route('/change_password', methods=['POST'])
@auth_required
def change_password():
    data = request.get_json() or {}
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""

    if not current_password or not new_password:
        return jsonify({"error": "current_password and new_password are required"}), 400

    if len(new_password) < 4:
        return jsonify({"error": "New password must be at least 4 characters"}), 400

    # Verify current password first
    from app.repositories.users_repo import db_verify_password as _verify
    from app.db.session import SessionLocal
    from app.models.users import Users as _Users
    db = SessionLocal()
    try:
        user = db.query(_Users).filter_by(user_id=g.user_id).first()
    finally:
        db.close()

    if not user:
        return jsonify({"error": "User not found"}), 404

    from werkzeug.security import check_password_hash
    if not check_password_hash(user.password_hash or "", current_password):
        return jsonify({"error": "Current password is incorrect"}), 401

    success = db_change_password(g.user_id, new_password)
    if not success:
        return jsonify({"error": "Failed to update password"}), 500

    return jsonify({"message": "Password changed successfully"}), 200


# ─────────────────────────────────────────────────────────
# GET /api/auth/me  — check session / get current user info
# ─────────────────────────────────────────────────────────
@auth_bp.route('/me', methods=['GET'])
@auth_required
def me():
    return jsonify({"user_id": g.user_id}), 200
