

import uuid, json
import threading, random
from flask import request, jsonify, g

from app.config import Config
from app.routes import yt_music_api
from app.utils.auth import auth_required
from app.repositories.tasks_repo import *
from app.repositories.devices_repo import *
from app.utils.tools import parse_number, SPLIT_PLAY_HOURS, CHECK_INTERNET_CONNECTIVITY
from app.utils.tools import get_google_sheet_columns, values_assignments, release_busy_device
from app.automation.handlers.stream_worker_node import stream_worker_node
from app.utils.runtime import TASK_CANCEL_EVENTS, TASK_THREADS, TASK_RUNTIME



@yt_music_api.route('/stream_by_library', methods=['POST'])
@auth_required
def stream_by_library():
    data = request.get_json()
    device_id_str = data.get('device_id')
    max_playlists = int(parse_number(data.get('max_playlists', 10), default=Config.DEFAULT_MAX_STREAMERS))
    play_hours = parse_number(data.get('play_hours', 10), default=Config.DEFAULT_PLAY_HOURS)
    max_play_hours = parse_number(data.get('max_play_hours', 1.5), default=Config.MAX_PLAY_HOURS)
    min_play_minutes = parse_number(data.get('min_play_minutes', 20), default=Config.MIN_PLAY_MINUTES)
    split_play_hours = data.get('split_play_hours', True)
    playlist_name = data.get('playlist_name')
    playlists_sheet_url = data.get('playlists_sheet_url')
    remarks = data.get('remarks', 'STREAM BY LIBRARY')
    device_assignment = data.get('device_assignment', True)
    forceDevice = data.get('force_Device', False)
    fetch_saved_content_first = data.get('fetch_saved_content_first', True)
    fetch_content_type = data.get('fetch_content_type', None)
    is_youtube_premium = data.get('is_youtube_premium', True)
    verify_internet_on_device = data.get('verify_internet_on_device', True)
    isOverrideResolution = data.get('isOverrideResolution', Config.isOverrideResolution)
    if not isinstance(isOverrideResolution, bool):  isOverrideResolution = Config.isOverrideResolution
    # android_ip = data.get('android_ip')

    streamType="library"
    use_sheet = False
    google_sheet_data = None

    if not isinstance(isOverrideResolution, bool):  isOverrideResolution = Config.isOverrideResolution
    if not isinstance(device_assignment,    bool):  return jsonify({'error': 'Device Assignment Should Be Bool Value'}), 400
    if not isinstance(split_play_hours,     bool):  return jsonify({'error': 'Split Play Hours Should Be Bool Value'}), 400
    if not isinstance(forceDevice,          bool):  forceDevice = False
    if not isinstance(fetch_saved_content_first,   bool):  fetch_saved_content_first = True
    if fetch_saved_content_first and not fetch_content_type: return jsonify({'error': f'Fetch Content Type Should Not Be Empty [{fetch_content_type}]'}), 400                  

    try:
        device_ids = device_id_str.split(';') if device_id_str else []
        if not device_ids:
            return jsonify({'error': 'device_id is required'}), 400

        playlist_name = playlist_name.split(',,') if playlist_name else []
        if not playlist_name and not playlists_sheet_url: 
            return jsonify({'error': 'Artist Name or Artist Sheet is required'}), 400

        if playlists_sheet_url:
            try: 
                google_sheet_data = get_google_sheet_columns(playlists_sheet_url)[0]
                use_sheet = True
            except: use_sheet = False

        threads = []   
        task_ids = []
        streaming_inputs = []  
        play_hours_list = []      
        total_devices = len(device_ids)
        
        if playlist_name: streaming_inputs.extend(x.strip() for x in playlist_name if x)
        if use_sheet and google_sheet_data: streaming_inputs.extend(x.strip() for x in google_sheet_data if x)
        streaming_inputs = [a for a in dict.fromkeys(streaming_inputs)]

        for device_index, device_id in enumerate(device_ids):

            device_id = device_id.strip()
            device_details = get_device_details(g.user_id, device_id) if device_id else None
            if not device_details and device_id:
                db_add_android_device(g.user_id, device_id, device_id, device_id)
                device_details = get_device_details(g.user_id, device_id)

            task_name = f"{remarks.replace('  ',' ').replace(' ', '-')}-{device_index+1}-{random.randint(1111, 9999)}"
            task_id = task_name # str(uuid.uuid4())
            
            # If we need to get saved contents from library we have to use all streamers not max_playlists
            # because we will extract max_streamers once we get the saved library content from each device
            playlists = values_assignments(streaming_inputs, total_devices, device_index+1, device_assignment)
            playlists = playlists[
                :max_playlists 
                if ( len(playlists) > max_playlists and not fetch_saved_content_first)
                else len(playlists)
            ]
            if playlists: playlists = [{'streamer': a} for a in dict.fromkeys(playlists)]

            # We will not the SPLIT_PLAY_HOURS in case of fetch_saved_content_first because we don;t know
            # the streamers names right now, so use default play_hours for now here.
            if split_play_hours and not fetch_saved_content_first: 
                play_hours_list = SPLIT_PLAY_HOURS(
                    play_hours=play_hours, 
                    min_minutes=min_play_minutes, 
                    max_hours=max_play_hours,
                    total_streamers=len(playlists)
                )
            else: play_hours_list = [play_hours for x in playlists]

            # In case of fetch_saved_content_first we have to set the play_hours 1 because we only generated
            # the play hours for max_streamers not full playlists which is in case of NOT fetch_saved_content_first
            for index, x in enumerate(playlists): x['play_hours'] = play_hours_list[index]

            db_create_task(g.user_id, task_id, device_id, f"{task_name.replace('  ',' ').replace(' ', '-')}-{device_index}-{random.randint(1111, 9999)}")
            update_task(user_id=g.user_id, task_id=task_id, progress=0, status="RUNNING", log=f"### Task 'STREAM BY LIBRARY': Total Devices [{len(device_ids)}] Total Playlists: [{len(playlists)}] Total Play Hours [{len(play_hours_list)}]")
            
            if not device_details:
                update_task(user_id=g.user_id, task_id=task_id, progress=0, status="FAILED", log=f"--- DEVICE_ISSUE: device_id {device_id} is invalid, missing or empty device details")
                if total_devices == 1: return jsonify({'error': f'device_id {device_id} is invalid, missing or empty device details'}), 400
                continue 
            
            if verify_internet_on_device:
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
                    playlists,
                    play_hours_list,
                    isOverrideResolution,
                    cancel_event,
                    streamType
                ),
                kwargs={ 
                    "max_playlists": max_playlists,
                    "play_hour": play_hours,
                    "max_play_hours": max_play_hours,
                    "min_play_minutes": min_play_minutes,
                    "total_devices": total_devices,
                    "device_index": device_index,
                    "split_play_hours": split_play_hours,
                    "device_assignment": device_assignment,
                    "fetch_content_type": fetch_content_type,
                    "fetch_saved_content_first": fetch_saved_content_first,
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
