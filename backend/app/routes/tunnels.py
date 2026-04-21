import uuid, re
import os, time
import subprocess
from . import api_bp
from app.config import Config
from app.utils.auth import auth_required
from app.automation.utils.appium_ import APPIUM_RUNNER_
from app.repositories.tunnels_repo import *
from app.repositories.tasks_repo import *
from flask_jwt_extended import jwt_required
from flask import Blueprint, request, jsonify, g
from app.utils.process_manager import ProcessManager


process_manager = ProcessManager()
WS_SCRCPY_PATH =  Config.WS_SCRCPY_PATH
WS_SCRCPY_PORT = Config.WS_SCRCPY_PORT



# Get tunnel status endpoint
@api_bp.route('/get_tunnel_status',   methods=['GET'])
@auth_required
def get_tunnel_status():
    user_id = g.user_id
    tunnel = get_tunnel(user_id)
    if tunnel:
        return jsonify({
            "status": "success",
            "tunnel": tunnel
        })
    else:
        return jsonify({
            "status": "error",
            "message": "Tunnel record not found"
        }), 404




@api_bp.route('/disconnect_all_devices',   methods=['POST'])
@auth_required
def disconnect_all_devices():
    try:
        # Get the list of currently connected devices
        devices_result = subprocess.run( ['adb', 'devices'], capture_output=True, text=True, check=True  )
        raw_output = devices_result.stdout.strip()
        lines = raw_output.split('\n')
        device_lines = lines[1:]
        
        disconnected_devices = []
        skipped_devices = []

        # Iterate over each device and decide whether to disconnect
        for line in device_lines:
            if not line.strip(): continue
            
            device_id = line.split('\t')[0]
            ip_match = re.match(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', device_id)
            
            # This prevents this instance from interfering with devices managed by other instances.
            if ip_match: subprocess.run(['adb', 'disconnect', device_id], capture_output=True, text=True)
            # Assuming USB devices should not be disconnected by this logic.
            else: pass

        return jsonify({
            "status": "success",
            "output": "Success",
            "details": "Disconnect command executed for devices within the allowed range."
        })
    
    except subprocess.CalledProcessError as e:
        print(e)
        return jsonify({ "status": "error", "output": e.stderr, "details": f"ADB command failed with exit code {e.returncode}" }), 500
    
    except Exception as e:
        print(e)
        return jsonify({ "status": "error", "output": "An unexpected error occurred.", "details": str(e)}), 500





# Cloudflared Tunnel Endpoints
@api_bp.route('/start_scrcpy_tunnel',  methods=['POST'])
@auth_required
def start_scrcpy_tunnel():
    try:
        init_tunnel_record(g.user_id)
        # First ensure ws-scrcpy is running
        if not process_manager.is_process_running('ws-scrcpy'):
            dist_path = os.path.join(WS_SCRCPY_PATH, 'dist', 'index.js')
            if os.path.exists(dist_path):
                start_command = ['node', 'dist/index.js']
                startup_message = "Starting ws-scrcpy from existing build..."
            else:
                start_command = ['npm', 'start']
                startup_message = "No build found. Running 'npm start' (this may take a minute)..."

            process_manager.start_process(
                'ws-scrcpy',
                start_command,
                cwd=WS_SCRCPY_PATH
            )
            time.sleep(2)  # Give it time to start
        
        # Check if tunnel is already running
        if process_manager.is_process_running('cloudflared'):
            # Get existing URL if available
            public_url = process_manager.get_cloudflared_url()
            if public_url:
                return jsonify({
                    "status": "success",
                    "output": "Tunnel is already running",
                    "public_url": public_url,
                    "local_url": f"ws://localhost:{WS_SCRCPY_PORT}"
                })
        
        # For a temporary "Quick Tunnel", we don't use a token.
        # The command is `cloudflared tunnel --url <local-service-url>`
        # This is much simpler and avoids the cert.pem error.
        # Start cloudflared quick tunnel process
        process_manager.start_process(
            'cloudflared',
            ['cloudflared', 'tunnel', '--url', f'http://localhost:{WS_SCRCPY_PORT}'],
            capture_output=True
        )

        # This will now wait for up to 20 seconds for the URL to be detected.
        public_url = process_manager.get_cloudflared_url()
        if public_url:
            update_tunnel(g.user_id, {"is_tunnel_running": True, "tunnel_url": public_url})
            return jsonify({
                "status": "success",
                "output": "Cloudflared tunnel is active.",
                "public_url": public_url,
                "local_url": f"ws://localhost:{WS_SCRCPY_PORT}"
            })
        else:
            return jsonify({
                "status": "error",
                "output": "Cloudflared tunnel started, but a public URL could not be detected in time.",
                "public_url": None,
                "local_url": f"ws://localhost:{WS_SCRCPY_PORT}"
            }), 500
        
    except Exception as e:
        return jsonify({ "status": "error", "output": "", "details": str(e) }), 500




@api_bp.route('/stop_scrcpy_tunnel', methods=['POST'])
@auth_required
def stop_scrcpy_tunnel():
    try:
        init_tunnel_record(g.user_id)
        # Stop both the tunnel and the underlying ws-scrcpy service
        tunnel_stopped = process_manager.stop_process('cloudflared')
        scrcpy_stopped = process_manager.stop_process('ws-scrcpy')
        messages = []

        if tunnel_stopped: messages.append("Tunnel closed successfully.")
        else: messages.append("Tunnel was not running.")

        if scrcpy_stopped: messages.append("ws-scrcpy service stopped.")
        else: messages.append("ws-scrcpy service was not running.")

        # Update DB
        update_tunnel(g.user_id, {"is_scrcpy_running": False, "scrcpy_url": ""})
        # Update DB
        update_tunnel(g.user_id, {"is_scrcpy_running": False, "is_tunnel_running": False, "scrcpy_url": "", "tunnel_url": ""})
        # Return a null public_url to signal the frontend to clear the field.
        return jsonify({
            "status": "success",
            "output": " ".join(messages),
            "details": "Cleanup process finished.",
            "public_url": None
        })
    
    except Exception as e:
        return jsonify({ "status": "error", "output": "", "details": str(e) }), 500
