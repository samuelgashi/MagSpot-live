
from app.config import Config
from . import admin_bp

from flask import request, jsonify
from datetime import timedelta

import jwt
from datetime import datetime, timedelta

@admin_bp.route('/authenticate_admin', methods=['POST'])
def authenticate_admin():
    data = request.get_json()
    if not data or data.get('admin_key') != Config.ADMIN_KEY:
        return jsonify({'error': 'Invalid admin key'}), 403
    
    expires = datetime.utcnow() + timedelta(hours=Config.TOKEN_EXPIRE_LIMIT)
    payload = {"sub": "admin", "exp": expires}
    token = jwt.encode(payload, Config.ADMIN_KEY, algorithm="HS256")
    
    return jsonify({'token': token}), 200




# @admin_bp.route("/users", methods=["GET"])
# @jwt_required()
# def get_users():
#     users = User.query.all()
#     return jsonify([{"id": u.id, "username": u.username, "email": u.email} for u in users])



# @admin_bp.route("/users", methods=["DELETE"])
# @jwt_required()
# def delete_user():
#     data = request.get_json()
#     user_id = data.get("user_id")
#     user = User.query.get(user_id)
#     if not user:
#         return jsonify({"error": "User not found"}), 404
#     db.session.delete(user)
#     db.session.commit()
#     return jsonify({"message": "User deleted"})



