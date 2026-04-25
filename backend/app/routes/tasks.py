import uuid
from . import api_bp as tasks_bp
from app.utils.auth import auth_required
from app.automation.utils.appium_ import APPIUM_RUNNER_
from app.repositories.devices_repo import *
from app.repositories.tasks_repo import *
from flask_jwt_extended import jwt_required
from flask import Blueprint, request, jsonify, g


@tasks_bp.route('/tasks', methods=['GET'])
@auth_required
def get_tasks():
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 300))
        result = db_get_tasks(g.user_id, page=page, limit=limit)
        return jsonify(result), 200

    except Exception as e:
        return jsonify({
            "error": f"Server Side Issue: {e}"
        }), 400



@tasks_bp.route('/tasks', methods=['DELETE'])
@auth_required
def clear_all_tasks():

    db_delete_all_tasks(g.user_id)
    return jsonify({
        "message": "All tasks cleared successfully"
    }), 200




@tasks_bp.route('/tasks/<task_id>', methods=['GET'])
@auth_required
def get_task(task_id):

    row = db_get_task_by_id(g.user_id, task_id)
    if not row:
        return jsonify({'error': 'Task not found'}), 404

    return jsonify(dict(row)), 200




@tasks_bp.route('/tasks/<task_id>/stop', methods=['POST'])
@auth_required
def stop_task(task_id):

    cancel_event = TASK_CANCEL_EVENTS.get(task_id)
    runtime = TASK_RUNTIME.get(task_id)
    user_id = g.user_id

    if not cancel_event:
        return jsonify({'error': 'Task not running'}), 404

    cancel_event.set()
    update_task(user_id, task_id, status="CANCELLED", log="Task cancelled by user")

    if runtime:
        if runtime.get("container_id"):
            APPIUM_RUNNER_.stop_container_by_id(runtime["container_id"])
        if runtime.get("device_id"):
            release_device(user_id, runtime["device_id"])

    return jsonify({
        "message": "Task cancellation requested",
        "task_id": task_id
    }), 200




@tasks_bp.route('/tasks/stop-all', methods=['POST'])
@auth_required
def stop_all_tasks():
    user_id = g.user_id
    for task_id, cancel_event in list(TASK_CANCEL_EVENTS.items()):
        cancel_event.set()

        runtime = TASK_RUNTIME.get(task_id)
        if runtime:
            if runtime.get("container_id"):
                APPIUM_RUNNER_.stop_container_by_id(runtime["container_id"])
            if runtime.get("device_id"):
                release_device(user_id, runtime["device_id"])

        update_task(user_id, task_id, status="CANCELLED", log="Stopped by system")

    TASK_CANCEL_EVENTS.clear()
    TASK_RUNTIME.clear()
    TASK_THREADS.clear()

    return jsonify({"message": "All running tasks stopped"}), 200