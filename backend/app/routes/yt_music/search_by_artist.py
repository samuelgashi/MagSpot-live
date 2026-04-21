

import uuid
import random
import threading, json
from flask import request, jsonify, g

from app.config import Config
from app.routes import yt_music_api
from app.utils.auth import auth_required
from app.repositories.tasks_repo import *
from app.repositories.devices_repo import *
from app.utils.tools import parse_number, SPLIT_PLAY_HOURS, CHECK_INTERNET_CONNECTIVITY
from app.utils.tools import analyze_image_profile_sheet, get_google_sheet_columns, values_assignments, release_busy_device
from app.automation.handlers.stream_worker_node import stream_worker_node
from app.utils.runtime import TASK_CANCEL_EVENTS, TASK_THREADS, TASK_RUNTIME
from app.automation.utils.appium_ import APPIUM_RUNNER_



@yt_music_api.route('/stream_by_artist', methods=['POST'])
@auth_required
def stream_by_artist():
    data = request.get_json()

    artist_name = data.get('artist_name')
    artists_sheet_url = data.get('artists_sheet_url')
    max_artists = int(parse_number(data.get('max_artists', 10), default=Config.DEFAULT_MAX_STREAMERS))
    play_hours = parse_number(data.get('play_hours', 10), default=Config.DEFAULT_PLAY_HOURS)
    max_play_hours = parse_number(data.get('max_play_hours', 1.5), default=Config.MAX_PLAY_HOURS)
    min_play_minutes = parse_number(data.get('min_play_minutes', 20), default=Config.MIN_PLAY_MINUTES)
    device_id_str = data.get('device_id')
    search_filter = data.get('search_filter', 'artist')
    remarks = data.get('remarks', 'STREAM BY ARTIST')
    device_assignment = data.get('device_assignment', True)
    split_play_hours = data.get('split_play_hours', True)
    forceDevice = data.get('release_Device', False)
    # analyze_artist_profile = data.get('analyze_artiist_profile', True)
    is_youtube_premium = data.get('is_youtube_premium', True)
    verify_internet_on_device = data.get('verify_internet_on_device', True)
    isOverrideResolution = data.get('isOverrideResolution',  Config.isOverrideResolution)

    streamType="artist"
    use_sheet = False
    google_sheet_data = None
    
    if not isinstance(isOverrideResolution, bool):  isOverrideResolution = Config.isOverrideResolution
    if not isinstance(device_assignment,    bool):  return jsonify({'error': 'Device Assignment Should Be Bool Value'}), 400
    if not isinstance(split_play_hours,     bool):  return jsonify({'error': 'Split Play Hours Should Be Bool Value'}), 400
    if not isinstance(forceDevice,          bool):  forceDevice = False

    try:
        device_ids = device_id_str.split(';') if device_id_str else []
        if not device_ids:
            return jsonify({'error': 'device_id is required'}), 400

        artist_name = artist_name.split(',,') if artist_name else []
        if not artist_name and not artists_sheet_url: 
            return jsonify({'error': 'Artist Name or Artist Sheet is required'}), 400

        if artists_sheet_url:
            try: 
                google_sheet_data = analyze_image_profile_sheet(artists_sheet_url)
                # google_sheet_data = get_google_sheet_columns(artists_sheet_url)[0]
                use_sheet = True
            except: use_sheet = False

            
        task_ids = []
        threads = []
        play_hours_list = []  
        streaming_inputs = {}   
        total_devices = len(device_ids)
        
        if artist_name:
            for artist in artist_name: 
                if artist: streaming_inputs[artist.strip()] = { "streamer": artist.strip().lower(), "streamer_thumbnail": None, "streamer_songs": [] }
                    
        if use_sheet and google_sheet_data:
            
            for artist in google_sheet_data:
                artist_name = artist.get("Artist")
                if not artist_name: continue

                artist_thumbnail = artist.get("Image", "")
                if not artist_thumbnail or "http" not in artist_thumbnail: artist_thumbnail = None
                
                artist_songs = artist.get("Songs", '')
                if not artist_songs: artist_songs = ''

                streaming_inputs[artist_name] = {
                    "streamer": artist_name.strip().lower(),
                    "streamer_thumbnail": artist_thumbnail,
                    "streamer_songs": [x.strip() for x in artist_songs.split(';') if x]
                } 

        for device_index, device_id in enumerate(device_ids):

            device_id = device_id.strip()
            device_details = get_device_details(g.user_id, device_id) if device_id else None
            if not device_details and device_id:
                db_add_android_device(g.user_id, device_id, device_id, device_id)
                device_details = get_device_details(g.user_id, device_id)

            task_name = f"{remarks.replace('  ',' ').replace(' ', '-')}-{device_index+1}-{random.randint(1111, 9999)}"
            task_id = task_name # str(uuid.uuid4())

            artists = values_assignments(list(streaming_inputs.keys()), total_devices, device_index+1, device_assignment)
            artists = artists[:max_artists if len(artists) > max_artists else len(artists)]

            if artists: artists = [
                {**streaming_inputs[artist], **{'streamer': artist}}
                for artist in dict.fromkeys(artists)
            ]

            if split_play_hours: play_hours_list = SPLIT_PLAY_HOURS(len(artists), play_hours, min_play_minutes, max_play_hours)
            else: play_hours_list = [play_hours for x in artists]
            for index, x in enumerate(artists): x['play_hours'] = play_hours_list[index]
            
            db_create_task(g.user_id, task_id, device_id, f"{task_name.replace('  ',' ').replace(' ', '-')}-{device_index}-{random.randint(1111, 9999)}")
            update_task(user_id=g.user_id, task_id=task_id, progress=0, status="RUNNING", log=f"### Task 'STREAM BY ARTIST': Total Devices [{len(device_ids)}] Total Artists: [{len(artists)}] Total Play Hours [{len(play_hours_list)}]")
            # if google_sheet_data: update_task(user_id=g.user_id, task_id=task_id, progress=0, status="RUNNING", log=f"### Total [{len(google_sheet_data)}] Enteries Found From Sheet. Starting [{google_sheet_data[0] if google_sheet_data else ''}...]")
            
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
                    artists,
                    play_hours_list,
                    isOverrideResolution,
                    cancel_event,
                    streamType
                ),
                kwargs={ 
                    "search_filter": search_filter,
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
