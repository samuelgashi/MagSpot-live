from flask import Blueprint, request, jsonify, Response
from . import api_bp as api_keys_bp
import subprocess
import socket
import time
import os
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from app.config import Config
import requests
from app.utils.tools import system_cpu_usage, system_ram_usage, system_containers_usage

# Configuration
SUBNET_BASE = Config.SUBNET_BASE
ADB_PORT = Config.ADB_PORT
CONCURRENCY = Config.CONCURRENCY
SCAN_TIMEOUT_MS = Config.SCAN_TIMEOUT_MS

env = os.environ.copy()
env["ADB_PATH"] = Config.ADB_PATH
env["ADB_PORT"] = Config.ADB_PORT
env["ADB_SERVER_SOCKET"] = Config.ADB_SERVER_SOCKET
env["ADB_SERVER_PORT"] = Config.ADB_PORT
env["ANDROID_ADB_SERVER_PORT"] = Config.ADB_PORT

for x in env.keys():
    env[x] = str(env[x])

def dict_to_indexed_list(d): 
    return [ {"index": i, "key": k, **v} for i, (k, v) in enumerate(d.items()) ]


ACTIVITIES_ROUTES = {
    "stream_by_artist": {
        "name": "Stream By Artist",
        "endpoint": "/yt_music/stream_by_artist",
        "method": "POST",
        "icon": "youtube_music",
        "args": dict_to_indexed_list({
            "artist_name": {
                "description": "Provde Artist Name To Stream...",
                "default": None,
                "type": "input",
                "is_required": False
            },
            "artists_sheet_url" : {
                "description": "Stream Multiple Artist! Provide Google Sheet URL...",
                "default": None,
                "type": "input",
                "is_required": False
            },
            "max_artists": {
                "description": "Maximum Artists To Pick [If Artists greater than Max_Artist]...",
                "default": Config.DEFAULT_MAX_STREAMERS,
                "type": "input",
                "is_required": True
            },
            "play_hours": {
                "description": "How many hours to stream artist...",
                "default": Config.DEFAULT_PLAY_HOURS,
                "type": "input",
                "is_required": True
            },
            "max_play_hours": {
                "description": "Maximum Play Hours Per Artist...",
                "default": Config.MAX_PLAY_HOURS,
                "type": "input",
                "is_required": True
            },
            "min_play_minutes": {
                "description": "Minimum Play Minutes Per Artist...",
                "default": Config.MIN_PLAY_MINUTES,
                "type": "input",
                "is_required": True
            },
            "search_filter": {
                "description": "Type of content to fetch from library...",
                "default": ["Artist", "Albums", "Songs", "Profiles"],
                "type": "select",
                "is_required": True
            },
            "device_id": {
                "description": "Device ID which should be used to the artist...",
                "default": 10,
                "type": "input",
                "is_required": True
            },
            'remarks': {
                "description": "Assign any Optional Name To Task...",
                "default": "STREAM-BY-ARTIST",
                "type": "input",
                "is_required": False
            }
        }),
        "kwaygs": dict_to_indexed_list({
            "isOverrideResolution": {
                "description": "Select Yes If Your Devices Don't Have Display Panels",
                "default": True,
                "type": "checkbox",
                "is_required": False
            },
            "split_play_hours": {
                "description": "Split Play Hours Between Tasks",
                "default": True,
                "type": "checkbox",
                "is_required": False
            },
            "is_youtube_premium": {
                "description": "Is the devices containing youtube premium...",
                "default": True,
                "type": "checkbox",
                "is_required": False
            },
            "device_assignment": {
                "description": "Should The Enteries Assigned Per Device [DEVICES > 1]",
                "default": False,
                "type": "checkbox",
                "is_required": False
            },
            "verify_internet_on_device": {
                "description": "Check Device Getting Internet Before Sending Task",
                "default": True,
                "type": "checkbox",
                "is_required": False
            },
            "release_Device": {
                "description": "Release The Device Forcily If Buzy...",
                "default": False,
                "type": "checkbox",
                "is_required": False
            },
            "analyze_artiist_profile": {
                "description": "Analyze Currect Artist Using Profile Thumbnail...",
                "default": False,
                "type": "checkbox",
                "is_required": False
            }
        })
    },
    "stream_by_library": {
        "name": "Stream By Library",
        "endpoint": "/yt_music/stream_by_library",
        "method": "POST",
        "icon": "youtube_music",
        "args": dict_to_indexed_list({
            "playlist_name": {
                "description": "Provde Playlist Name To Stream...",
                "default": None,
                "type": "input",
                "is_required": False
            },
            "playlists_sheet_url" : {
                "description": "Stream Multiple Playlist! Provide Google Sheet URL...",
                "default": None,
                "type": "input",
                "is_required": False
            },
            "max_playlists": {
                "description": "Maximum Playlists To Pick [If Playlists greater than Max_Playlists]...",
                "default": Config.DEFAULT_MAX_STREAMERS,
                "type": "input",
                "is_required": True
            },
            "play_hours": {
                "description": "How many hours to stream Playlist...",
                "default": Config.DEFAULT_PLAY_HOURS,
                "type": "input",
                "is_required": True
            },
            "max_play_hours": {
                "description": "Maximum Play Hours Per Playlist...",
                "default": Config.MAX_PLAY_HOURS,
                "type": "input",
                "is_required": True
            },
            "min_play_minutes": {
                "description": "Minimum Play Minutes Per Playlist...",
                "default": Config.MIN_PLAY_MINUTES,
                "type": "input",
                "is_required": True
            },
            "fetch_saved_content_first": {
                "description": "Extract the content from library and match with above streaming list...",
                "default": True,
                "type": "checkbox",
                "is_required": True
            },
            "fetch_content_type": {
                "description": "Type of content to fetch from library...",
                "default": ["Playlists", "Artists", "Albums", "Songs", "Profiles"],
                "type": "select",
                "is_required": True
            },
            "device_id": {
                "description": "Device ID which should be used to the Playlist...",
                "default": 10,
                "type": "input",
                "is_required": True
            },
            "remarks": {
                "description": "Assign any Optional Name To Task...",
                "default": "STREAM-BY-LIBRARY",
                "type": "input",
                "is_required": False
            }
        }),
        "kwaygs": dict_to_indexed_list({
            "isOverrideResolution": {
                "description": "Select Yes If Your Devices Don't Have Display Panels",
                "default": True,
                "type": "checkbox",
                "is_required": False
            },
            "split_play_hours": {
                "description": "Split Play Hours Between Tasks",
                "default": True,
                "type": "checkbox",
                "is_required": False
            },
            "is_youtube_premium": {
                "description": "Is the devices containing youtube premium...",
                "default": True,
                "type": "checkbox",
                "is_required": False
            },
            "device_assignment": {
                "description": "Should The Enteries Assigned Per Device [DEVICES > 1]",
                "default": False,
                "type": "checkbox",
                "is_required": False
            },
            "verify_internet_on_device": {
                "description": "Check Device Getting Internet Before Sending Task",
                "default": True,
                "type": "checkbox",
                "is_required": False
            },
            "release_Device": {
                "description": "Release The Device Forcily If Buzy...",
                "default": False,
                "type": "checkbox",
                "is_required": False
            }
        })
    },
    "stream_by_playlist": {
        "name": "Stream By Playlist",
        "endpoint": "/yt_music/stream_by_playlist",
        "method": "POST",
        "icon": "youtube_music",
        "args": dict_to_indexed_list({
            "playlist_name": {
                "description": "Provde Playlist Name To Stream...",
                "default": None,
                "type": "input",
                "is_required": False
            },
            "playlists_sheet_url" : {
                "description": "Stream Multiple Playlist! Provide Google Sheet URL...",
                "default": None,
                "type": "input",
                "is_required": False
            },
            "max_playlists": {
                "description": "Maximum Playlists To Pick [If Playlists greater than Max_Playlists]...",
                "default": Config.DEFAULT_MAX_STREAMERS,
                "type": "input",
                "is_required": True
            },
            "play_hours": {
                "description": "How many hours to stream Playlist...",
                "default": Config.DEFAULT_PLAY_HOURS,
                "type": "input",
                "is_required": True
            },
            "max_play_hours": {
                "description": "Maximum Play Hours Per Playlist...",
                "default": Config.MAX_PLAY_HOURS,
                "type": "input",
                "is_required": True
            },
            "min_play_minutes": {
                "description": "Minimum Play Minutes Per Playlist...",
                "default": Config.MIN_PLAY_MINUTES,
                "type": "input",
                "is_required": True
            },
            "device_id": {
                "description": "Device ID which should be used to the Playlist...",
                "default": 10,
                "type": "input",
                "is_required": True
            },
            'remarks': {
                "description": "Assign any Optional Name To Task...",
                "default": "STREAM-BY-PLAYLIST",
                "type": "input",
                "is_required": False
            }
        }),
        "kwaygs": dict_to_indexed_list({
            "isOverrideResolution": {
                "description": "Select Yes If Your Devices Don't Have Display Panels",
                "default": True,
                "type": "checkbox",
                "is_required": False
            },
            "split_play_hours": {
                "description": "Split Play Hours Between Tasks",
                "default": True,
                "type": "checkbox",
                "is_required": False
            },
            "is_youtube_premium": {
                "description": "Is the devices containing youtube premium...",
                "default": True,
                "type": "checkbox",
                "is_required": False
            },
            "device_assignment": {
                "description": "Should The Enteries Assigned Per Device [DEVICES > 1]",
                "default": False,
                "type": "checkbox",
                "is_required": False
            },
            "verify_internet_on_device": {
                "description": "Check Device Getting Internet Before Sending Task",
                "default": True,
                "type": "checkbox",
                "is_required": False
            },
            "release_Device": {
                "description": "Release The Device Forcily If Buzy...",
                "default": False,
                "type": "checkbox",
                "is_required": False
            }
        })
    },
    "google_warmup": {
        "name": "Google Warm-UP",
        "endpoint": "/google_chrome/google_warmup",
        "method": "POST",
        "icon": "google",
        "args": dict_to_indexed_list({
            "search_keywords_sheet_url" : {
                "description": "Search Keyword Sheet For Devices! Provide Google Sheet URL...",
                "default": None,
                "type": "input",
                "is_required": True
            },
            "sheet_row_number": {
                "description": "Google Sheet Keyword Row Number...",
                "default": 1,
                "type": "input",
                "is_required": True
            },
            "sites_limit": {
                "description": "Maximum Number Of Sites To Visit For Each Keyword...",
                "default": 15,
                "type": "input",
                "is_required": True
            },
            "site_scroll_limit": {
                "description": "Maximum Number of Time To Scroll On Site...",
                "default": 5,
                "type": "input",
                "is_required": True
            },
            "minimum_site_warmup_time": {
                "description": "How Long [Minutes] To Stay On Each Site [Minimum]...",
                "default": 3,
                "type": "input",
                "is_required": True
            },
            "maximum_site_warmup_time": {
                "description": "How Long [Minutes] To Stay On Each Site [Maximum]...",
                "default": 15,
                "type": "input",
                "is_required": True
            },
            "device_id": {
                "description": "Device ID which should be used to the Playlist...",
                "default": 10,
                "type": "input",
                "is_required": True
            },
            'remarks': {
                "description": "Assign any Optional Name To Task...",
                "default": "GOOGLE-WARM-UP",
                "type": "input",
                "is_required": False
            }
        }),
        "kwaygs": dict_to_indexed_list({
            "isOverrideResolution": {
                "description": "Select Yes If Your Devices Don't Have Display Panels",
                "default": True,
                "type": "checkbox",
                "is_required": False
            },
            "verify_internet_on_device": {
                "description": "Check Device Getting Internet Before Sending Task",
                "default": True,
                "type": "checkbox",
                "is_required": False
            },
            "release_Device": {
                "description": "Release The Device Forcily If Buzy...",
                "default": False,
                "type": "checkbox",
                "is_required": False
            }
        })
    },
    "stream_youtube_shorts": {
        "name": "Stream YouTube Shorts",
        "endpoint": "/youtube_api/stream_youtube_shorts",
        "method": "POST",
        "icon": "youtube_shorts",
        "args": dict_to_indexed_list({
            "max_play_hours": {
                "description": "Maximum Play Hours For Each Device...",
                "default": 10,
                "type": "input",
                "is_required": True
            },
            "min_play_hours" : {
                "description": "Minimum Play Hours For Each Device...",
                "default": 1,
                "type": "input",
                "is_required": True
            },
            "device_id": {
                "description": "Device ID which should be used to the artist...",
                "default": 10,
                "type": "input",
                "is_required": True
            },
            'remarks': {
                "description": "Assign any Optional Name To Task...",
                "default": "STREAM-YOUTUBE-SHORTS",
                "type": "input",
                "is_required": False
            }
        }),
        "kwaygs": dict_to_indexed_list({
            "isOverrideResolution": {
                "description": "Select Yes If Your Devices Don't Have Display Panels",
                "default": True,
                "type": "checkbox",
                "is_required": False
            },
            "is_youtube_premium": {
                "description": "Is the devices containing youtube premium...",
                "default": True,
                "type": "checkbox",
                "is_required": False
            },
            "device_assignment": {
                "description": "Should The Enteries Assigned Per Device [DEVICES > 1]",
                "default": False,
                "type": "checkbox",
                "is_required": False
            },
            "verify_internet_on_device": {
                "description": "Check Device Getting Internet Before Sending Task",
                "default": True,
                "type": "checkbox",
                "is_required": False
            },
            "release_Device": {
                "description": "Release The Device Forcily If Buzy...",
                "default": False,
                "type": "checkbox",
                "is_required": False
            }
        })
    }
}


# In-memory device store
devices = {}

def get_octet(ip):
    parts = ip.split('.')
    return int(parts[3]) if len(parts) > 3 else 0




def adb_exec(command):
    try:
        result = subprocess.run(
            [Config.ADB_PATH] + ["-P", str(ADB_PORT)] + command.split(),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=30,
            env=env  # inherit your shell environment
        )
        output = {
            'success': result.returncode == 0,
            'output': result.stdout.strip(),
            'error': result.stderr.strip()
        }
        return output
    except subprocess.TimeoutExpired:
        return {'success': False, 'output': '', 'error': 'Command timed out'}
    except Exception as e:
        print(e)
        return {'success': False, 'output': '', 'error': str(e)}



def adb_device_exec(device_id, command):
    return adb_exec(f'-s {device_id} {command}')



def check_port(host, port, timeout=SCAN_TIMEOUT_MS / 1000):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    try:
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except:
        sock.close()
        return False


def get_device_info(device_id):
    ip = device_id.split(':')[0]
    port = int(device_id.split(':')[1]) if ':' in device_id else ADB_PORT

    model = 'Unknown'
    serial = 'Unknown'
    name = 'Unknown'

    try:
        model_result = adb_device_exec(device_id, 'shell getprop ro.product.model')
        if model_result['success']:
            model = model_result['output'] or 'Unknown'

        serial_result = adb_device_exec(device_id, 'shell getprop ro.serialno')
        if serial_result['success']:
            serial = serial_result['output'] or device_id

        name_result = adb_device_exec(device_id, 'shell settings get global device_name')
        if name_result['success'] and name_result['output']:
            name = name_result['output']
    except:
        pass

    return {
        'id': device_id,
        'ip': ip,
        'port': port,
        'serial': serial or device_id,
        'model': model or 'Unknown',
        'name': name or 'Unknown',
        'status': 'online',
        'lastSeen': datetime.utcnow().isoformat() + 'Z',
        'octet': get_octet(ip)
    }

def refresh_devices():
    result = adb_exec('devices')
    if not result['success']:
        return

    lines = result['output'].split('\n')[1:]  # Skip header
    current_ids = set()

    for line in lines:
        parts = line.strip().split()
        if len(parts) >= 2 and parts[1] == 'device':
            device_id = parts[0]
            current_ids.add(device_id)

            if device_id not in devices:
                info = get_device_info(device_id)
                devices[device_id] = info
            else:
                devices[device_id]['lastSeen'] = datetime.utcnow().isoformat() + 'Z'
                devices[device_id]['status'] = 'online'

    # Mark disconnected as offline
    for device_id in list(devices.keys()):
        if device_id not in current_ids:
            devices[device_id]['status'] = 'offline'


# GET /api/health_check
@api_keys_bp.route("/health_check", methods=["GET"])
def health_check_alt():
    """
    Alternative health check endpoint.
    Returns 200 OK with a JSON payload.
    """
    return jsonify({
        "status": "ok",
        "message": "Service is healthy"
    }), 200


import json
# print(json.dumps(ACTIVITIES_ROUTES, indent=4))
print("DEBUG KEYS:", [kw["key"] for kw in ACTIVITIES_ROUTES["stream_by_artist"]["kwaygs"]])

# GET /api/get_activities
@api_keys_bp.route("/get_activities", methods=["GET"])
def get_activities():
    print("sending data back")
    return jsonify({
        "status": "ok",
        "message": "Activities retrieved successfully",
        "data": ACTIVITIES_ROUTES
    }), 200


# GET /api/get_activities
@api_keys_bp.route("/assign_multiple_activites", methods=["GET"])
def assign_multiple_activites():
    return jsonify({
        "status": "ok",
        "message": "Activities retrieved successfully",
        "data": ACTIVITIES_ROUTES
    }), 200


# GET /api/devices - List all devices
@api_keys_bp.route('/devices', methods=['GET'])
def get_devices():
    refresh_devices()
    return jsonify(list(devices.values()))


# POST /api/devices/connect - Connect to a single device
@api_keys_bp.route('/devices/connect', methods=['POST'])
def connect_device():
    data = request.get_json()
    host = data.get('host')
    port = data.get('port', ADB_PORT)

    if not host:
        return jsonify({'message': 'Host is required'}), 400

    if not check_port(host, port):
        return jsonify({'message': f'Cannot reach {host}:{port}'}), 400

    result = adb_exec(f'connect {host}:{port}')
    if not result['success'] or 'failed' in result['output']:
        return jsonify({'message': result['output'] or 'Connection failed'}), 400

    time.sleep(0.5)
    device_id = f'{host}:{port}'
    info = get_device_info(device_id)
    devices[device_id] = info
    return jsonify(info)

# POST /api/devices/connect-range - Connect to a range of devices
@api_keys_bp.route('/devices/connect-range', methods=['POST'])
def connect_device_range():
    data = request.get_json()
    base_subnet = data.get('baseSubnet')
    start_octet = data.get('startOctet')
    end_octet = data.get('endOctet')
    port = data.get('port', ADB_PORT)

    if not all([base_subnet, start_octet, end_octet]):
        return jsonify({'message': 'baseSubnet, startOctet, and endOctet are required'}), 400

    connected_devices = []

    def connect_octet(octet):
        host = f'{base_subnet}.{octet}'
        if check_port(host, port):
            result = adb_exec(f'connect {host}:{port}')
            if result['success'] and 'failed' not in result['output']:
                return octet
        return None

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        futures = [executor.submit(connect_octet, octet) for octet in range(start_octet, end_octet + 1)]
        for future in as_completed(futures):
            octet = future.result()
            if octet:
                device_id = f'{base_subnet}.{octet}:{port}'
                info = get_device_info(device_id)
                devices[device_id] = info
                connected_devices.append(info)

    return jsonify(connected_devices)

# POST /api/devices/disconnect - Disconnect a device
@api_keys_bp.route('/devices/disconnect', methods=['POST'])
def disconnect_device():
    data = request.get_json()
    device_id = data.get('id')

    if not device_id:
        return jsonify({'message': 'Device ID is required'}), 400

    result = adb_exec(f'disconnect {device_id}')
    if result['success']:
        if device_id in devices:
            devices[device_id]['status'] = 'offline'
        return jsonify({'success': True})
    else:
        return jsonify({'message': result['error']}), 400

# POST /api/devices/command - Execute ADB command on devices
@api_keys_bp.route('/devices/command', methods=['POST'])
def execute_command():
    data = request.get_json()
    device_ids = data.get('deviceIds', [])
    command = data.get('command')
    args = data.get('args', [])

    if not device_ids or not isinstance(device_ids, list) or len(device_ids) == 0:
        return jsonify({'message': 'deviceIds array is required'}), 400

    if not command:
        return jsonify({'message': 'command is required'}), 400

    full_command = ' '.join([command] + args)

    results = []

    def execute_on_device(device_id):
        if device_id in devices:
            devices[device_id]['status'] = 'busy'

        result = adb_device_exec(device_id, full_command)

        if device_id in devices:
            devices[device_id]['status'] = 'online'
            devices[device_id]['lastSeen'] = datetime.utcnow().isoformat() + 'Z'

        return {
            'deviceId': device_id,
            'success': result['success'],
            'output': result['output'],
            'error': result['error']
        }

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        futures = [executor.submit(execute_on_device, did) for did in device_ids]
        for future in as_completed(futures):
            results.append(future.result())

    return jsonify(results)

# POST /api/scan - Scan subnet for devices
@api_keys_bp.route('/scan', methods=['POST'])
def scan_subnet():
    data = request.get_json()
    base_subnet = data.get('baseSubnet', SUBNET_BASE)
    start_octet = data.get('startOctet', 1)
    end_octet = data.get('endOctet', 254)
    concurrency = data.get('concurrency', CONCURRENCY)

    found = []

    def scan_octet(octet):
        host = f'{base_subnet}.{octet}'
        if check_port(host, ADB_PORT):
            return {'host': host, 'octet': octet}
        return None

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(scan_octet, octet) for octet in range(start_octet, end_octet + 1)]
        for future in as_completed(futures):
            result = future.result()
            if result:
                found.append(result)

    return jsonify({
        'found': len(found),
        'devices': [{'ip': f['host'], 'port': ADB_PORT, 'octet': f['octet']} for f in found]
    })



@api_keys_bp.route('/devices/restart-adb', methods=['POST'])
def restart_adb():
    results = {}
    adb_host_url = f"http://{Config.ANDROID_ADB_SERVER_ADDRESS}:8999/restart"
    try:
        resp = requests.get(adb_host_url, timeout=35)
        if resp.status_code == 200:
            data = resp.json()
            return jsonify({
                "success": True,
                "message": "ADB restart requested via ADB service",
                "results": data
            })
        else:
            # Non-200 response, fallback
            raise Exception(f"Non-200 response: {resp.status_code}")
    except Exception as e:
        # fallback to manual ADB commands
        reconnect = adb_exec("reconnect")
        devices = adb_exec("devices")
        results["reconnect"] = reconnect
        results["devices"] = devices
        return jsonify({
            "success": True,
            "message": f"ADB restarted locally (fallback). Reason: {e}",
            "results": results
        })


# GET /api/system/resources - Get system resource usage
@api_keys_bp.route('/system/resources', methods=['GET'])
def get_system_resources():
    """
    Get system resource usage including CPU, RAM, and container usage.
    """
    try:
        cpu = system_cpu_usage()
        ram = system_ram_usage()
        containers = system_containers_usage()
        
        return jsonify({
            "status": "ok",
            "data": {
                "cpu": cpu,
                "ram": ram,
                "containers": containers
            }
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


SCRCPY_SERVER_JAR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    'ws-scrcpy', 'vendor', 'Genymobile', 'scrcpy', 'scrcpy-server.jar',
)

# POST /api/devices/start-scrcpy-server
@api_keys_bp.route('/devices/start-scrcpy-server', methods=['POST'])
def start_scrcpy_server():
    data = request.get_json() or {}
    device_id = data.get('deviceId', '')
    if not device_id:
        return jsonify({'message': 'deviceId is required'}), 400

    device_ip = device_id.split(':')[0]

    try:
        # Push scrcpy-server.jar to device
        push = subprocess.run(
            [Config.ADB_PATH, '-s', device_id, 'push', SCRCPY_SERVER_JAR, '/data/local/tmp/scrcpy-server.jar'],
            capture_output=True, timeout=30,
        )
        if push.returncode != 0:
            return jsonify({'message': f'Failed to push jar: {push.stderr.decode(errors="replace")}'}), 500

        # Kill any previous instance
        subprocess.run(
            [Config.ADB_PATH, '-s', device_id, 'shell', 'pkill -f scrcpy-server.jar || true'],
            capture_output=True, timeout=5,
        )
        time.sleep(0.4)

        # Start scrcpy-server on all interfaces (true = listen on 0.0.0.0)
        server_cmd = (
            'CLASSPATH=/data/local/tmp/scrcpy-server.jar '
            'nohup app_process / com.genymobile.scrcpy.Server '
            '1.19-ws6 web ERROR 8886 true '
            '> /dev/null 2>&1 &'
        )
        subprocess.run(
            [Config.ADB_PATH, '-s', device_id, 'shell', server_cmd],
            capture_output=True, timeout=10,
        )

        # Wait until the server process appears (max 4 s)
        for _ in range(20):
            time.sleep(0.2)
            check = subprocess.run(
                [Config.ADB_PATH, '-s', device_id, 'shell', 'pgrep -f scrcpy-server || true'],
                capture_output=True, timeout=5,
            )
            if check.stdout.strip():
                break

        return jsonify({'wsUrl': f'ws://{device_ip}:8886'}), 200

    except subprocess.TimeoutExpired:
        return jsonify({'message': 'Timeout starting scrcpy server'}), 504
    except Exception as e:
        return jsonify({'message': str(e)}), 500


# POST /api/devices/stop-scrcpy-server
@api_keys_bp.route('/devices/stop-scrcpy-server', methods=['POST'])
def stop_scrcpy_server():
    data = request.get_json() or {}
    device_id = data.get('deviceId', '')
    if not device_id:
        return jsonify({'message': 'deviceId is required'}), 400
    subprocess.run(
        [Config.ADB_PATH, '-s', device_id, 'shell', 'pkill -f scrcpy-server.jar || true'],
        capture_output=True, timeout=5,
    )
    return jsonify({'ok': True}), 200


# GET /api/devices/stream - MJPEG screencap stream
@api_keys_bp.route('/devices/stream', methods=['GET'])
def device_stream():
    device_id = request.args.get('deviceId')
    fps = max(1, min(int(request.args.get('fps', 2)), 15))

    if not device_id:
        return jsonify({'message': 'deviceId is required'}), 400

    def generate():
        while True:
            try:
                result = subprocess.run(
                    [Config.ADB_PATH, '-s', device_id, 'exec-out', 'screencap', '-p'],
                    capture_output=True,
                    timeout=15,
                )
                if result.returncode == 0 and result.stdout:
                    frame = result.stdout
                    header = (
                        b'--frame\r\n'
                        b'Content-Type: image/png\r\n'
                        b'Content-Length: ' + str(len(frame)).encode() + b'\r\n\r\n'
                    )
                    yield header + frame + b'\r\n'
            except Exception:
                break
            time.sleep(1.0 / fps)

    return Response(
        generate(),
        mimetype='multipart/x-mixed-replace; boundary=frame',
    )


# GET /api/devices/screenshot - Single screenshot (PNG)
@api_keys_bp.route('/devices/screenshot', methods=['GET'])
def device_screenshot():
    device_id = request.args.get('deviceId')
    if not device_id:
        return jsonify({'message': 'deviceId is required'}), 400

    try:
        result = subprocess.run(
            [Config.ADB_PATH, '-s', device_id, 'exec-out', 'screencap', '-p'],
            capture_output=True,
            timeout=15,
        )
        if result.returncode == 0 and result.stdout:
            return Response(result.stdout, mimetype='image/png')
        return jsonify({'message': 'Failed to capture screenshot'}), 500
    except subprocess.TimeoutExpired:
        return jsonify({'message': 'Screenshot timed out'}), 504
    except Exception as e:
        return jsonify({'message': str(e)}), 500


# # POST /api/devices/restart-adb - Restart ADB server
# @api_keys_bp.route('/devices/restart-adb', methods=['POST'])
# def restart_adb():
#     """
#     Restart ADB server by running:
#     1. adb kill-server
#     2. adb start-server
#     3. adb devices
#     """
#     results = {}
    
#     # Kill ADB server
#     kill_result = adb_exec('kill-server')
#     results['kill-server'] = {'success': kill_result['success'], 'output': kill_result['output'], 'error': kill_result['error']}
    
#     # Small delay
#     time.sleep(1)
    
#     # Start ADB server
#     start_result = adb_exec('start-server')
#     results['start-server'] = {'success': start_result['success'], 'output': start_result['output'], 'error': start_result['error']}
    
#     # Get devices list
#     devices_result = adb_exec('devices')
#     results['devices'] = {'success': devices_result['success'], 'output': devices_result['output'], 'error': devices_result['error']}
    
#     # Determine overall success
#     overall_success = all([
#         results['kill-server']['success'],
#         results['start-server']['success'],
#         results['devices']['success']
#     ])
    
#     return jsonify({
#         'success': overall_success,
#         'message': 'ADB server restarted successfully' if overall_success else 'ADB restart completed with some errors',
#         'results': results
#     })
