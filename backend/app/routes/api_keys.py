import uuid
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.utils.auth import auth_required
from . import api_bp as api_keys_bp
from app.repositories.api_keys_repo import (
    db_add_api_key,
    db_get_all_api_keys,
    db_get_api_key,
    db_delete_api_key,
)

# POST /api/api_keys
@api_keys_bp.route("/api_keys", methods=["POST"])
@auth_required
def create_api_key():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400

    # Default lifetime: 30 day
    life_time_hours = int(data.get("life_time", 30))
    life_time = datetime.utcnow() + timedelta(days=life_time_hours)
    authorized_endpoints = data.get("authorized_endpoints", "*")

    key_id = str(uuid.uuid4())
    raw_key = str(uuid.uuid4())

    success = db_add_api_key(
        user_id=user_id,
        key_id=key_id,
        new_key=raw_key,
        life_time=life_time,
        auth_endpoints=authorized_endpoints,
    )

    if not success:
        return jsonify({"error": "Failed to create API key"}), 500

    return jsonify({"api_key": raw_key, "key_id": key_id}), 201


# GET /api/api_keys
@api_keys_bp.route("/api_keys", methods=["GET"])
# @jwt_required()
@auth_required
def list_api_keys():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400

    keys = db_get_all_api_keys(user_id)
    return jsonify([
        {"key_id": k[0], "life_time": k[1], "authorized_endpoints": k[2]}
        for k in keys
    ])


# GET /api/api_keys/<key_id>
@api_keys_bp.route("/api_keys/<key_id>", methods=["GET"])
# @jwt_required()
@auth_required
def get_api_key_route(key_id):
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400

    key = db_get_api_key(user_id, key_id)
    if not key:
        return jsonify({"error": "Not found"}), 404

    return jsonify({
        "key_id": key.key_id,
        "life_time": key.life_time,
        "authorized_endpoints": key.authorized_endpoints,
    })


# DELETE /api/api_keys/<key_id>
@api_keys_bp.route("/api_keys/<key_id>", methods=["DELETE"])
# @jwt_required()
@auth_required
def delete_api_key_route(key_id):
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400

    deleted = db_delete_api_key(user_id, key_id)
    if not deleted:
        return jsonify({"error": "Not found"}), 404

    return jsonify({"message": "Deleted"}), 200
