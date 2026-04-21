

import uuid
import random
import threading, json
from flask import request, jsonify, g

from app.config import Config
from app.routes import google_chrome_api
from app.utils.auth import auth_required
from app.repositories.tasks_repo import *
from app.repositories.devices_repo import *
from app.utils.tools import parse_number, SPLIT_PLAY_HOURS, CHECK_INTERNET_CONNECTIVITY
from app.utils.tools import get_google_sheet_columns, values_assignments, release_busy_device
from app.automation.handlers.google_warmup_node import google_warmup_node
from app.utils.runtime import TASK_CANCEL_EVENTS, TASK_THREADS, TASK_RUNTIME
from app.automation.utils.appium_ import APPIUM_RUNNER_



@google_chrome_api.route('/google_warmup', methods=['POST'])
@auth_required
def google_warmup():
    data = request.get_json()

    # search_keyword = data.get('keyword')
    search_keywords_sheet_url = data.get('search_keywords_sheet_url')
    sheet_row_number = int(parse_number(data.get('sheet_row_number'), default=1))
    sites_limit = int(parse_number(data.get('sites_limit', 15), default=15))
    site_scroll_limit = parse_number(data.get('site_scroll_limit', 5), default=5)
    minimum_site_warmup_time = parse_number(data.get('minimum_site_warmup_time', 3), default=3)
    maximum_site_warmup_time = parse_number(data.get('maximum_site_warmup_time', 15), default=15)
    device_id_str = data.get('device_id')
    
    forceDevice = data.get('release_Device', False)
    remarks = data.get('remarks', 'Google WarmUp')
    isOverrideResolution = data.get('isOverrideResolution',  Config.isOverrideResolution)
    google_sheet_data = None
    
    if not isinstance(isOverrideResolution, bool):  isOverrideResolution = Config.isOverrideResolution
    if not isinstance(forceDevice,          bool):  forceDevice = False

    try:

        device_ids = device_id_str.split(';') if device_id_str else []
        if not device_ids:
            return jsonify({'error': 'device_id is required'}), 400

        if search_keywords_sheet_url:
            try:  google_sheet_data = get_google_sheet_columns(search_keywords_sheet_url, keep_none=True)
            except: pass

        if search_keywords_sheet_url and not sheet_row_number:
            return jsonify({'error': 'Google Sheet Range Not Provided'}), 400
    
        if search_keywords_sheet_url and sheet_row_number:
            if len(device_ids) > len(google_sheet_data):
                return jsonify({'error': f'Google Sheet Columns [{len(google_sheet_data)}] Not Equal To Number Of Device [{len(device_ids)}]'}), 400

            
        task_ids = []
        threads = []
        total_devices = len(google_sheet_data) if len(device_ids) > len(google_sheet_data) else len(device_ids)
        device_ids = device_ids[:total_devices]
    

        for device_index, device_id in enumerate(device_ids):
            
            # GETTING DEVICE DETAILS
            device_id = device_id.strip()
            device_details = get_device_details(g.user_id, device_id) if device_id else None
            if not device_details and device_id:
                db_add_android_device(g.user_id, device_id, device_id, device_id)
                device_details = get_device_details(g.user_id, device_id)
            

            # CREATING TASKS IN DATABASE
            task_name = f"{remarks.replace('  ',' ').replace(' ', '-')}-{device_index+1}-{random.randint(1111, 9999)}"
            task_id = task_name # str(uuid.uuid4())
            google_keywords_list = []

            db_create_task(g.user_id, task_id, device_id, f"{task_name.replace('  ',' ').replace(' ', '-')}-{device_index}-{random.randint(1111, 9999)}")
            update_task(g.user_id, task_id, "RUNNING", 0, f"### Task 'Google Warnup': Total Devices [{len(device_ids)}]")
            
            if not device_details:
                update_task(user_id=g.user_id, task_id=task_id, progress=0, status="FAILED", log=f"--- DEVICE_ISSUE: device_id {device_id} is invalid, missing or empty device details")
                if total_devices == 1: return jsonify({'error': f'device_id {device_id} is invalid, missing or empty device details'}), 400
                continue 
            

            # CHECK INTERNET CONNECTION ON DEVICE
            if not CHECK_INTERNET_CONNECTIVITY(device_id):
                update_task(user_id=g.user_id, task_id=task_id, progress=0, status="FAILED", log=f"--- INTERNET NOT CONNECTED: Please Check Internet Connectivity on Device {device_id}")
                if total_devices == 1: return jsonify({'error': f"--- INTERNET NOT CONNECTED: Please Check Internet Connectivity on {device_id}"}), 400
                continue
            

            # BOOK ANDROID DEVICE FOR TASK
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


            # EXTRACT SEARCH KEYWORD FROM GOOGLE SHEET
            try:  
                device_search_keyword = google_sheet_data[device_index][max(sheet_row_number-2, 0)] 
                if not device_search_keyword: raise Exception(f"Got None Value On Column [{device_index}] ROW [{sheet_row_number}] Device {device_index+1}")
                google_keywords_list.append({ 
                    "search_keyword": google_sheet_data[device_index][max(sheet_row_number-2, 0)] 
                })
            except Exception as e: 
                update_task(g.user_id, task_id, "FAILED", 1, f"Invalid Sheet Value, Device {device_index+1} Don't Have Value On Column [{device_index}] ROW [{sheet_row_number}]") 

            cancel_event = threading.Event()
            TASK_CANCEL_EVENTS[task_id] = cancel_event
            TASK_RUNTIME[task_id] = { "device_id": device_id, "container_id": None }

            thread = threading.Thread(
                target=google_warmup_node,
                args=(
                    g.user_id,
                    task_id,
                    device_details,
                    google_keywords_list,
                    isOverrideResolution,
                    cancel_event
                ),
                kwargs={ 
                    "sites_limit": sites_limit,
                    "site_scroll_limit": site_scroll_limit,
                    "minimum_site_warmup_time": minimum_site_warmup_time,
                    "maximum_site_warmup_time": maximum_site_warmup_time,
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
