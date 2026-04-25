

import uuid
import random
import threading, json
from flask import request, jsonify, g

from app.config import Config
from app.routes import youtube_api
from app.utils.auth import auth_required
from app.repositories.tasks_repo import *
from app.repositories.devices_repo import *
from app.utils.tools import parse_number, SPLIT_PLAY_HOURS, CHECK_INTERNET_CONNECTIVITY
from app.utils.tools import get_google_sheet_columns, values_assignments, release_busy_device
from app.automation.handlers.stream_yt_shots_node import stream_worker_node
from app.utils.runtime import TASK_CANCEL_EVENTS, TASK_THREADS, TASK_RUNTIME
from app.automation.utils.appium_ import APPIUM_RUNNER_



@youtube_api.route('/stream_youtube_shorts', methods=['POST'])
@auth_required
def stream_youtube_shorts():
    data = request.get_json()

    max_play_hours = parse_number(data.get('max_play_hours', 20), default=20)
    min_play_hours = parse_number(data.get('min_play_hours', 1), default=1)
    device_id_str = data.get('device_id')
    remarks = data.get('remarks', 'STREAM YOUTUBE SHORTS')
    device_assignment = data.get('device_assignment', True)
    # split_play_hours = data.get('split_play_hours', True)
    forceDevice = data.get('release_Device', False)
    is_youtube_premium = data.get('is_youtube_premium', True)
    isOverrideResolution = data.get('isOverrideResolution',  Config.isOverrideResolution)


    if not isinstance(isOverrideResolution, bool):  isOverrideResolution = Config.isOverrideResolution
    if not isinstance(device_assignment,    bool):  return jsonify({'error': 'Device Assignment Should Be Bool Value'}), 400
    # if not isinstance(split_play_hours,     bool):  return jsonify({'error': 'Split Play Hours Should Be Bool Value'}), 400
    if not isinstance(forceDevice,          bool):  forceDevice = False

    try:
        device_ids = device_id_str.split(';') if device_id_str else []
        if not device_ids:
            return jsonify({'error': 'device_id is required'}), 400

        task_ids = []
        threads = []
        play_hours_list = []     
        total_devices = len(device_ids)

        for device_index, device_id in enumerate(device_ids):

            device_id = device_id.strip()
            device_details = get_device_details(g.user_id, device_id) if device_id else None
            if not device_details and device_id:
                db_add_android_device(g.user_id, device_id, device_id, device_id)
                device_details = get_device_details(g.user_id, device_id)

            task_name = f"{remarks.replace('  ',' ').replace(' ', '-')}-{device_index+1}-{random.randint(1111, 9999)}"
            task_id = task_name 
            
            db_create_task(g.user_id, task_id, device_id, f"{task_name.replace('  ',' ').replace(' ', '-')}-{device_index}-{random.randint(1111, 9999)}")
            update_task(user_id=g.user_id, task_id=task_id, progress=0, status="RUNNING", log=f"### Task 'STREAM YOUTUBE SHORTS': Total Devices [{len(device_ids)}]  Total Play Hours [{len(play_hours_list)}]")
            
            if not device_details:
                update_task(user_id=g.user_id, task_id=task_id, progress=0, status="FAILED", log=f"--- DEVICE_ISSUE: device_id {device_id} is invalid, missing or empty device details")
                if total_devices == 1: return jsonify({'error': f'device_id {device_id} is invalid, missing or empty device details'}), 400
                continue 

            if not CHECK_INTERNET_CONNECTIVITY(device_id):
                update_task(user_id=g.user_id, task_id=task_id, progress=0, status="FAILED", log=f"--- INTERNET NOT CONNECTED: Please Check Internet Connectivity on Device {device_id}")
                if total_devices == 1: return jsonify({'error': f"--- INTERNET NOT CONNECTED: Please Check Internet Connectivity on {device_id}"}), 400
                continue

            if not book_device(g.user_id, device_id, task_id):
                if forceDevice: 
                    release_busy_device(g.user_id, device_id)
                    update_task(user_id=g.user_id, task_id=task_id, progress=0, status="RUNNING", log=f"--- DEVICE FREED: Device {device_id} was busy & Freeed Successfully...")
                    if not book_device(g.user_id, device_id, task_id):
                        update_task(user_id=g.user_id, task_id=task_id, progress=0, status="BUSY", log=f"--- DEVICE_ISSUE: Device {device_id} is busy")
                        continue
                else:
                    update_task(user_id=g.user_id, task_id=task_id, progress=0, status="BUSY", log=f"--- DEVICE_ISSUE: Device {device_id} is busy")
                    if total_devices == 1: return jsonify({ 'error': 'Device is busy', 'device_id': device_id }), 409
                    continue 
            
            cancel_event = threading.Event()
            TASK_CANCEL_EVENTS[task_id] = cancel_event
            TASK_RUNTIME[task_id] = { "device_id": device_id, "container_id": None }

            thread = threading.Thread(
                target=stream_worker_node,
                args=(
                    g.user_id,
                    task_id,
                    device_details,
                    random.uniform(min_play_hours, max_play_hours),
                    isOverrideResolution,
                    cancel_event
                ),
                kwargs={ 
                    "is_youtube_premium": is_youtube_premium
                },
                daemon=True
            )
            TASK_THREADS[task_id] = thread
            threads.append(thread)
            task_ids.append(task_id)

        for thread in threads:
            thread.start()

        return jsonify({
            'message': f'Tasks accepted for {len(task_ids)} devices',
            'task_id': task_ids[0] if task_ids else '0000'
        }), 202

    except Exception as e:
        print(e)
        return jsonify({ 'error': 'unexpected problem on server side' }), 400
