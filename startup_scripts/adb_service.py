#!/usr/bin/env python3
"""
adb_auto_service.py
- Reads env vars (overridable via systemd EnvironmentFile)
- Polls `adb devices` every INTERVAL seconds
- Serves latest devices as JSON on HTTP_PORT
- Handles port-in-use with retries and graceful shutdown
- Supports /restart endpoint to restart ADB and scan network
"""

import os
import time
import threading
import subprocess
import json
import signal
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
import socket
import errno
from typing import Optional
import pwd
from concurrent.futures import ThreadPoolExecutor
import netifaces

# --- Configuration ---
env = os.environ.copy()
ADB_PATH = env.get("ADB_PATH", "/usr/bin/adb")
ADB_VENDOR_KEYS = env.get("ADB_VENDOR_KEYS", "/home/glitch/adb_keys_backup")
ANDROID_ADB_KEY_PATH = env.get("ANDROID_ADB_KEY_PATH", "/home/glitch/adb_keys_backup")
INTERVAL = float(env.get("ADB_POLL_INTERVAL", "3"))
HTTP_PORT = int(env.get("ADB_API_PORT", "8999"))
LOG_PATH = env.get("ADB_SERVICE_LOG", "/var/log/adb_auto_service.log")
RUN_AS_USER = env.get("RUN_AS_USER", "glitch")
BIND_RETRY_COUNT = int(env.get("BIND_RETRY_COUNT", "6"))
BIND_RETRY_BASE = float(env.get("BIND_RETRY_BASE", "0.5"))

_state = {
    "devices": [],
    "last_run": None,
    "last_error": None,
    "running": True,
}

# --- Logging ---
def log(msg: str):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    line = f"{ts} {msg}\n"
    try:
        with open(LOG_PATH, "a") as f:
            f.write(line)
    except Exception:
        sys.stdout.write(line)
        sys.stdout.flush()

# --- Parse adb devices output ---
def parse_adb_devices(output_text: str):
    devices = []
    for line in output_text.splitlines():
        line = line.strip()
        if not line or line.startswith("List of devices"):
            continue
        parts = line.split()
        if len(parts) >= 2:
            devices.append({"device": parts[0], "status": parts[1]})
    return devices

# --- Helper: Get local network prefix ---
def get_local_network_prefix():
    """Detect local IP and return network prefix, e.g., 192.168.1"""
    for iface in netifaces.interfaces():
        addrs = netifaces.ifaddresses(iface)
        inet = addrs.get(netifaces.AF_INET)
        if inet:
            for addr in inet:
                ip = addr.get('addr')
                if ip and not ip.startswith("127."):
                    parts = ip.split(".")
                    if len(parts) == 4:
                        return ".".join(parts[:3])
    return "192.168.1"  # fallback

# --- Fast network scan ---
def fast_network_adb_scan(child_env, network_prefix):
    discovered = []

    def try_connect(last_octet):
        ip = f"{network_prefix}.{last_octet}"
        try:
            proc = subprocess.run(
                [ADB_PATH, "connect", f"{ip}:5555"],
                capture_output=True, text=True, env=child_env, timeout=1
            )
            if "connected" in (proc.stdout or "") or "already connected" in (proc.stdout or ""):
                discovered.append(ip)
        except Exception:
            pass

    with ThreadPoolExecutor(max_workers=50) as executor:
        executor.map(try_connect, range(1, 255))

    return discovered

# --- Restart ADB and scan network ---
def restart_adb_and_scan():
    child_env = os.environ.copy()
    if ADB_VENDOR_KEYS:
        child_env["ADB_VENDOR_KEYS"] = ADB_VENDOR_KEYS
        child_env["ANDROID_ADB_KEY_PATH"] = ANDROID_ADB_KEY_PATH
    if RUN_AS_USER:
        try:
            pw = pwd.getpwnam(RUN_AS_USER)
            child_env.setdefault("HOME", pw.pw_dir)
        except KeyError:
            log(f"Warning: RUN_AS_USER '{RUN_AS_USER}' not found; leaving HOME as-is")

    # Restart ADB
    try:
        subprocess.run([ADB_PATH, "kill-server"], env=child_env)
        subprocess.run([ADB_PATH, "start-server"], env=child_env)
        log("ADB server restarted via /restart endpoint")
    except Exception as e:
        log(f"Failed to restart ADB server: {e}")
        return {"status": "error", "message": str(e)}

    # Fast network scan
    net_prefix = get_local_network_prefix()
    log(f"Starting fast network scan on {net_prefix}.0/24")
    devices_found = fast_network_adb_scan(child_env, net_prefix)
    log(f"Discovered ADB devices on network: {devices_found}")

    # Refresh poller state immediately
    try:
        proc = subprocess.run([ADB_PATH, "devices"], capture_output=True, text=True, env=child_env, timeout=10)
        _state["devices"] = parse_adb_devices(proc.stdout or "")
        _state["last_run"] = time.time()
        _state["last_error"] = None
    except Exception as e:
        _state["last_error"] = str(e)
        log(f"Error updating devices after restart: {e}")

    return {"status": "ok", "devices": _state["devices"], "network_discovered": devices_found}

# --- Poller ---
def adb_poller():
    child_env = os.environ.copy()
    if ADB_VENDOR_KEYS:
        child_env["ADB_VENDOR_KEYS"] = ADB_VENDOR_KEYS
        child_env["ANDROID_ADB_KEY_PATH"] = ANDROID_ADB_KEY_PATH
    if RUN_AS_USER:
        try:
            pw = pwd.getpwnam(RUN_AS_USER)
            child_env.setdefault("HOME", pw.pw_dir)
        except KeyError:
            log(f"Warning: RUN_AS_USER '{RUN_AS_USER}' not found; leaving HOME as-is")

    # Initial ADB start
    try:
        subprocess.run([ADB_PATH, "kill-server"], env=child_env)
        subprocess.run([ADB_PATH, "start-server"], env=child_env)
        log("ADB server started in poller")
    except Exception as e:
        log(f"Failed to start ADB server: {e}")

    while _state["running"]:
        try:
            proc = subprocess.run([ADB_PATH, "devices"], capture_output=True, text=True, env=child_env, timeout=20)
            out = proc.stdout or ""
            _state["devices"] = parse_adb_devices(out)
            _state["last_run"] = time.time()
            _state["last_error"] = None
            log(f"adb devices -> {len(_state['devices'])} devices")
        except subprocess.TimeoutExpired as e:
            _state["last_error"] = "timeout"
            log(f"adb poll timeout: {e}")
        except FileNotFoundError:
            _state["last_error"] = "adb not found"
            log("adb binary not found at " + ADB_PATH)
        except Exception as e:
            _state["last_error"] = str(e)
            log(f"adb poll error: {e}")
        slept = 0.0
        while _state["running"] and slept < INTERVAL:
            time.sleep(0.1)
            slept += 0.1

# --- HTTP Handler ---
class Handler(BaseHTTPRequestHandler):
    def _send_json(self, data, code=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/" or self.path.startswith("/devices"):
            resp = {
                "devices": _state["devices"],
                "last_run": _state["last_run"],
                "last_error": _state["last_error"],
            }
            self._send_json(resp)
        elif self.path.startswith("/restart"):
            resp = restart_adb_and_scan()
            self._send_json(resp)
        else:
            self._send_json({"error": "not found"}, code=404)

    def log_message(self, format, *args):
        log("HTTP " + format % args)

# --- Threaded HTTP Server ---
class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

# --- Try bind server with retry ---
def try_bind_server(host: str, port: int, retries: int, base_delay: float) -> Optional[ThreadedHTTPServer]:
    ThreadedHTTPServer.allow_reuse_address = True
    attempt = 0
    while attempt <= retries and _state["running"]:
        try:
            server = ThreadedHTTPServer((host, port), Handler)
            server.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            return server
        except OSError as e:
            if e.errno == errno.EADDRINUSE:
                attempt += 1
                delay = base_delay * (2 ** (attempt - 1))
                log(f"Port {port} in use (attempt {attempt}/{retries}). Retrying in {delay:.1f}s...")
                time.sleep(delay)
                continue
            else:
                log(f"Failed to bind server socket: {e}")
                raise
    return None

# --- Signal handler ---
def shutdown_handler(signum, frame):
    log(f"Received signal {signum}, initiating shutdown")
    _state["running"] = False

# --- Main ---
def main():
    try:
        open(LOG_PATH, "a").close()
    except Exception:
        pass

    signal.signal(signal.SIGTERM, shutdown_handler)
    signal.signal(signal.SIGINT, shutdown_handler)

    try:
        uid = os.getuid()
        user = pwd.getpwuid(uid).pw_name
    except Exception:
        user = "unknown"
    log(f"Service starting as user={user}, RUN_AS_USER={RUN_AS_USER}")

    poller = threading.Thread(target=adb_poller, daemon=True)
    poller.start()

    server = try_bind_server("0.0.0.0", HTTP_PORT, BIND_RETRY_COUNT, BIND_RETRY_BASE)
    if server is None:
        log(f"Could not bind to 0.0.0.0:{HTTP_PORT} after {BIND_RETRY_COUNT} attempts. Exiting.")
        _state["running"] = False
        poller.join(timeout=2)
        sys.exit(1)

    log(f"HTTP API listening on 0.0.0.0:{HTTP_PORT}")
    server_thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.5}, daemon=True)
    server_thread.start()

    while _state["running"]:
        time.sleep(0.5)

    # Graceful shutdown
    log("Shutting down HTTP server...")
    server.shutdown()
    server.server_close()
    server_thread.join(timeout=5)
    _state["running"] = False
    poller.join(timeout=5)
    log("Service stopped cleanly")

if __name__ == "__main__":
    main()