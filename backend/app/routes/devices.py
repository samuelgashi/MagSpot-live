import os
import uuid
from . import api_bp
# from database import *
from app.utils.auth import auth_required
from flask import Flask, request, jsonify, send_from_directory, g

from app.repositories.tasks_repo import *
from app.repositories.devices_repo import *
from app.repositories.groups_repo import *
# from api.handlers.task import update_task
# from api.handlers.devices import release_device
from app.automation.utils.appium_ import APPIUM_RUNNER_
from app.utils.runtime import TASK_CANCEL_EVENTS, TASK_THREADS, TASK_RUNTIME

# --------------------------------------------------------
# -------------- ANDROID DEVICES ENDPOINTS ---------------
# --------------------------------------------------------


@api_bp.route('/android_devices', methods=['POST'])
@auth_required
def add_android_device():

    data = request.get_json()
    if not data or 'android_ip' not in data:
        return jsonify({'error': 'android_ip is required'}), 400

    device_id = str(uuid.uuid4())
    if not db_get_android_device(g.user_id, device_id):
        db_add_android_device(g.user_id, device_id, data['android_ip'], data.get('android_name'), data.get('serial_number'))

    return jsonify({
        'message': 'Android device added successfully',
        'device_id': device_id
    }), 201



@api_bp.route('/android_devices', methods=['GET'])
@auth_required
def get_all_android_devices():

    devices = db_get_android_devices(g.user_id)
    return jsonify({
        'count': len(devices),
        'devices': devices
    }), 200



@api_bp.route('/android_devices/<device_id>', methods=['GET'])
@auth_required
def get_android_device(device_id):

    row = db_get_android_device(g.user_id, device_id)
    if not row: return jsonify({ 'valid': False, 'error': 'Device not found' }), 200
    return jsonify({ 'valid': True, 'device': dict(row) }), 200



@api_bp.route('/android_devices/<device_id>', methods=['PUT'])
@auth_required
def update_android_device(device_id):
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    update_dict = {}
    if 'android_ip' in data:
        update_dict['android_ip'] = data['android_ip']
    if 'android_name' in data:
        update_dict['android_name'] = data['android_name']
    if 'serial_number' in data:
        update_dict['serial_number'] = data['serial_number']

    if not update_dict:
        return jsonify({'error': 'Nothing to update'}), 400

    updated = db_update_android_device(g.user_id, device_id, update_dict)
    if not updated:
        return jsonify({'error': 'Device not found'}), 404
    return jsonify({'message': 'Android device updated successfully'}), 200




@api_bp.route('/android_devices/<device_id>', methods=['DELETE'])
@auth_required
def delete_android_device(device_id):

    cursor = db_delete_android_device(g.user_id, device_id)
    if cursor.rowcount == 0: return jsonify({'error': 'Device not found'}), 404
    return jsonify({'message': 'Android device deleted successfully'}), 200




@api_bp.route('/devices/<device_id>/free', methods=['POST'])
@auth_required
def force_free_device(device_id):

    row = db_get_task(g.user_id, device_id)
    if not row or not row["current_task_id"]:
        return jsonify({"message": "Device already free"}), 200

    task_id = row["current_task_id"]
    cancel_event = TASK_CANCEL_EVENTS.get(task_id)
    if cancel_event: cancel_event.set()

    runtime = TASK_RUNTIME.get(task_id)
    if runtime and runtime.get("container_id"):
        APPIUM_RUNNER_.stop_container_by_id(runtime["container_id"])

    release_device(g.user_id, device_id)
    update_task(g.user_id, task_id, status="CANCELLED", log="Device force-freed by admin")

    return jsonify({
        "message": "Device freed",
        "device_id": device_id,
        "task_id": task_id
    }), 200


# --------------------------------------------------------
# ---------------- DEVICE GROUPS ENDPOINTS ----------------
# --------------------------------------------------------


@api_bp.route('/groups', methods=['POST'])
@auth_required
def create_group():
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'error': 'Group name is required'}), 400
    
    group_id = db_create_group(g.user_id, data['name'])
    return jsonify({
        'message': 'Group created successfully',
        'group_id': group_id
    }), 201


@api_bp.route('/groups', methods=['GET'])
@auth_required
def get_all_groups():
    groups = db_get_groups(g.user_id)
    return jsonify({
        'count': len(groups),
        'groups': groups
    }), 200


@api_bp.route('/groups/<group_id>', methods=['GET'])
@auth_required
def get_group(group_id):
    group = db_get_group(g.user_id, group_id)
    if not group:
        return jsonify({'error': 'Group not found'}), 404
    return jsonify({'group': group}), 200


@api_bp.route('/groups/<group_id>', methods=['PUT'])
@auth_required
def update_group(group_id):
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'error': 'Group name is required'}), 400
    
    updated = db_update_group(g.user_id, group_id, data['name'])
    if not updated:
        return jsonify({'error': 'Group not found'}), 404
    return jsonify({'message': 'Group updated successfully'}), 200


@api_bp.route('/groups/<group_id>', methods=['DELETE'])
@auth_required
def delete_group(group_id):
    deleted = db_delete_group(g.user_id, group_id)
    if not deleted:
        return jsonify({'error': 'Group not found'}), 404
    return jsonify({'message': 'Group deleted successfully'}), 200


@api_bp.route('/groups/<group_id>/devices', methods=['POST'])
@auth_required
def add_devices_to_group(group_id):
    data = request.get_json()
    if not data or 'devices' not in data:
        return jsonify({'error': 'Devices list is required'}), 400
    
    # Verify group exists
    if not db_group_exists(g.user_id, group_id):
        return jsonify({'error': 'Group not found'}), 404
    
    devices = data['devices']
    added_ids = db_add_devices_to_group(g.user_id, group_id, devices)
    
    return jsonify({
        'message': 'Devices added successfully',
        'added_count': len(added_ids),
        'device_ids': added_ids
    }), 201


@api_bp.route('/groups/<group_id>/devices/<device_id>', methods=['DELETE'])
@auth_required
def remove_device_from_group(group_id, device_id):
    removed = db_remove_device_from_group(g.user_id, group_id, device_id)
    if not removed:
        return jsonify({'error': 'Device not found in group'}), 404
    return jsonify({'message': 'Device removed from group successfully'}), 200


@api_bp.route('/groups/<group_id>/devices', methods=['DELETE'])
@auth_required
def clear_group_devices(group_id):
    cleared = db_clear_group_devices(g.user_id, group_id)
    if not cleared:
        return jsonify({'error': 'Group not found'}), 404
    return jsonify({'message': 'All devices removed from group'}), 200


@api_bp.route('/groups/<group_id>/online_devices', methods=['GET'])
@auth_required
def get_group_online_devices(group_id):
    """
    Get all online devices in a group.
    Filters by: devices whose S/N matches the group AND status is 'FREE' (online).
    """
    # Get all device S/Ns from the group
    group_sns = db_get_group_devices_sn(g.user_id, group_id)
    if group_sns is None:
        return jsonify({'error': 'Group not found'}), 404
    
    # Get all user devices from the dashboard
    all_devices = db_get_android_devices(g.user_id)
    
    # Filter: only devices that are in the group (by S/N match) AND are online (status='FREE')
    online_devices = [
        device for device in all_devices
        if device.get('serial_number') in group_sns and device.get('status') == 'FREE'
    ]
    
    return jsonify({
        'count': len(online_devices),
        'devices': online_devices
    }), 200
