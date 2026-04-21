

import uuid
import threading
from flask import request, jsonify, g

from app.config import Config
from app.routes import yt_music_api
from app.utils.auth import auth_required
from app.repositories.tasks_repo import *
from app.repositories.devices_repo import *
from app.automation.handlers.stream_worker_node import stream_worker_node
# from app.automation.handlers.stream_by_library import stream_by_library_worker
# from app.automation.handlers.stream_by_playlist import stream_by_playlist_worker
from app.utils.runtime import TASK_CANCEL_EVENTS, TASK_THREADS, TASK_RUNTIME


"""
    Unified route to assign multiple tasks (playlist, library, artist).
    Example frontend payload:
    {
        "device_id": "abc123",
        "isOverrideResolution": true,
        "tasks": [
            {
                "type": "stream_by_playlist",
                "playlist_name": "My Playlist",
                "playlists_sheet_url": null,
                "play_hours": 5
            },
            {
                "type": "stream_library",
                "playlist_name": "Library Playlist",
                "playlists_sheet_url": null,
                "play_hours": 8
            },
            {
                "type": "stream_by_artist",
                "artist_name": "Coldplay",
                "artists_sheet_url": null,
                "play_hours": 12
            }
        ]
    }
"""
@yt_music_api.route('/assign_tasks', methods=['POST'])
@auth_required
def assign_tasks():
    data = request.get_json()
    device_id = data.get('device_id')
    isOverrideResolution = data.get('isOverrideResolution', Config.isOverrideResolution)
    if not isinstance(isOverrideResolution, bool):
        isOverrideResolution = Config.isOverrideResolution

    tasks = data.get('tasks', [])
    if not tasks:
        return jsonify({'error': 'No tasks provided'}), 400

    try:
        user_id = g.user_id   # capture before leaving request context
        
        device_details = get_device_details(user_id, device_id) if device_id else None
        if not device_details and device_id:
            db_add_android_device(user_id, device_id, device_id, device_id)
            device_details = get_device_details(user_id, device_id)
            device_id = device_details.get('device_id')

        if not device_details:
            return jsonify({'error': 'device_id is invalid, missing or empty device details'}), 400

        task_id = str(uuid.uuid4())
        if not book_device(user_id, device_id, task_id):
            return jsonify({'error': 'Device is busy', 'device_id': device_id}), 409

        db_create_task(user_id, task_id, device_id, f"Multi-Task")

        cancel_event = threading.Event()
        TASK_CANCEL_EVENTS[task_id] = cancel_event
        TASK_RUNTIME[task_id] = {"device_id": device_id, "container_id": None}

        def worker_sequence(user_id, task_id, device_details, tasks, isOverrideResolution, cancel_event):
            results = []

            update_task(user_id=user_id, task_id=task_id, progress=0.5, status="QUEUED", log=f"### Task Assigned {[x.get('type') for x in tasks]}...")

            for t in tasks:
                if cancel_event.is_set(): break

                ttype = t.get("type")
                play_hours = t.get("play_hours", 10)

                try:
                    if ttype == "stream_by_playlist":
                        playlists = [{"playlist": t.get("playlist_name")}]
                        stream_worker_node(user_id, task_id, device_details,  playlists, play_hours, isOverrideResolution, cancel_event, streamType="library")
                        results.append({"type": "stream_by_playlist", "status": "success"})
                    elif ttype == "stream_library":
                        playlists = [{"playlist": t.get("playlist_name")}]
                        stream_worker_node(user_id, task_id, device_details, playlists, play_hours, isOverrideResolution, cancel_event, streamType="platlist")
                        results.append({"type": "stream_library", "status": "success"})
                    elif ttype == "stream_by_artist":
                        artists = [{"artist": t.get("artist_name")}]
                        stream_worker_node(user_id, task_id, device_details, artists, play_hours, isOverrideResolution, cancel_event, streamType="artist")
                        results.append({"type": "stream_by_artist", "status": "success"})
                    else:
                        results.append({"type": ttype, "status": "skipped"})
                except Exception as e:
                    results.append({"type": ttype, "status": "failed", "error": str(e)})

            TASK_RUNTIME[task_id]["results"] = results
            update_task(user_id=user_id, task_id=task_id, progress=100, status="COMPLETED", log=f"### Results: {results}\n### Task Assigned FINISHED...")

        thread = threading.Thread(
            target=worker_sequence,
            args=(user_id, task_id, device_details, tasks, isOverrideResolution, cancel_event),
            daemon=True
        )
        TASK_THREADS[task_id] = thread
        thread.start()

        return jsonify({"message": "Tasks accepted", "task_id": task_id, "tasks_count": len(tasks)}), 202

    except Exception as e:
        return jsonify({'error': f'unexpected problem on server side: {e}'}), 400
