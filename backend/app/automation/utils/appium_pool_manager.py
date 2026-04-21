import docker
import threading
import time
import json
import os
import socket
import random
import requests
from datetime import datetime, timedelta, timezone
from app.repositories.tasks_repo import db_get_task_by_id, update_task
from app.config import Config

DATABASE = Config.APPIUM_POOL_CONFIG_FILE
APPIUM_POOL_SIZE = Config.APPIUM_POOL_SIZE
APPIUM_BATCH_PERCENT = Config.APPIUM_BATCH_PERCENT
APPIUM_BATCH_WAIT = Config.APPIUM_BATCH_WAIT
APPIUM_BUSY_DB_TIMEOUT = Config.APPIUM_BUSY_DB_TIMEOUT

class AppiumPoolManager:

    def __init__(self, image="appium/appium:latest", min_port=20000, max_port=40000, pool_size=10, batch_percent=20, batch_wait=60, BUSY_DB_TIMEOUT=600, requestBased=True):

        self.client = docker.from_env()
        self.image = image

        self.min_port = min_port
        self.max_port = max_port

        self.pool_size = pool_size
        self.batch_percent = batch_percent
        self.batch_wait = batch_wait
        self.BUSY_DB_TIMEOUT = BUSY_DB_TIMEOUT
        self.requestBased = requestBased
        self.create_delay = 2

        self.lock = threading.RLock()
        self.containers = {}
        self.load_database()

        print("Recovering containers...")
        self.recover_containers()

        print("Starting monitor thread...")
        self.monitor_thread = threading.Thread( target=self.monitor_loop, daemon=True)
        self.monitor_thread.start()

        print("Ensuring pool...")
        # self.ensure_pool()
        if not self.requestBased:
            self.ensure_pool_thread = threading.Thread(
                target=self.ensure_pool,
                daemon=True
            )
            self.ensure_pool_thread.start()


# ============================================================
# DATABASE
# ============================================================

    def load_database(self):
        if os.path.exists(DATABASE):
            try:
                with open(DATABASE, "r") as f: self.containers = json.load(f)
            except: self.containers = {}
        else: self.containers = {}


    def save_database(self):
        try: 
            with open(DATABASE, "w") as f: json.dump(self.containers, f, indent=4)
        except: 
            os.remove(DATABASE)
            with open(DATABASE, "w") as f: json.dump(self.containers, f, indent=4)


# ============================================================
# PORT
# ============================================================

    def get_free_port(self):

        while True:
            port = random.randint(self.min_port, self.max_port)
            if str(port) in self.containers: continue

            sock = socket.socket()
            result = sock.connect_ex(("localhost", port))
            sock.close()

            if result != 0: return port


# ============================================================
# CONTAINER NAME
# ============================================================

    def container_name(self, port):
        return f"appium_magspot_{port}"


# ============================================================
# CREATE
# ============================================================

    def create_container(self):

        port = self.get_free_port()
        name = self.container_name(port)
        print("Creating:", name)
        
        container = None
        volumes = {
            Config.ADB_VENDOR_KEYS_HOST: {
                "bind": "/home/androidusr/.android", 
                "mode": "ro"
            }
        }
        if Config.GOOGLE_CHROME_DRIVER_HOST_PATH:
            volumes[Config.GOOGLE_CHROME_DRIVER_HOST_PATH] = {
                "bind": Config.GOOGLE_CHROME_DRIVER_CONTAINER_PATH, 
                "mode": "ro"
            }
        
        environment = {
            "APPIUM_PORT": str(port),
            "ANDROID_ADB_SERVER_ADDRESS": "127.0.0.1",
            "ANDROID_ADB_SERVER_PORT": Config.ADB_PORT,
            "ADB_VENDOR_KEYS": "/home/androidusr/.android",
            "ANDROID_ADB_KEY_PATH": "/home/androidusr/.android",
            "ADB_SERVER_SOCKET": Config.ADB_SERVER_SOCKET
        }
                
        for i in range(3):
            try:
                container = self.client.containers.run(
                    self.image,
                    name=name,
                    detach=True,
                    privileged=False,
                    network_mode="host",
                    entrypoint="appium",
                    command=[
                        "--address", "0.0.0.0",
                        "--port", str(port),
                        "--relaxed-security",
                        "--allow-insecure", "uiautomator2:adb_shell,*:chromedriver_autodownload"
                        # "--allow-insecure", "chromedriver_autodownload"
                    ],
                    mem_limit="400m",
                    cpu_quota=100000,
                    cpu_period=100000,
                    auto_remove=True,
                    volumes=volumes,
                    environment=environment
                )
                break

            except Exception as e:
                print("Create failed:", e)
                container = None
                return None
        
        if container:
            self.containers[str(port)] = {
                "id": container.id,
                "port": port,
                "status": "idle",
                "task_id": None,
                "user_id": None,
                "last_updated": time.time()
            }
            self.save_database()
            return port
        
        else: return None


# ============================================================
# DELETE
# ============================================================

    def delete_container(self, port):
        
        port = str(port)
        if port not in self.containers: return
        container_id = self.containers[port]["id"]
        print("Deleting:", port)

        try:
            container = self.client.containers.get(container_id)
            container.remove(force=True)
        except: pass

        del self.containers[port]
        self.save_database()


# ============================================================
# FORCE DELETE ALL
# ============================================================

    def force_cleanup_all(self):
        print("Force cleaning all")
        for port in list(self.containers.keys()):
            self.delete_container(port)


# ============================================================
# WAIT READY
# ============================================================

    def is_ready(self, port):
        try:
            r = requests.get( f"http://localhost:{port}/status", timeout=2)
            return r.status_code == 200
        except: return False


    # ============================================================
    # SYNC WITH DOCKER (CRITICAL FIX)
    # ============================================================

    def sync_with_docker(self):

        with self.lock:
            docker_containers = self.client.containers.list(all=True)
            docker_map = {}

            for c in docker_containers:
                if c.name.startswith("appium_magspot_"):
                    port = c.name.split("_")[-1]
                    docker_map[str(port)] = c

            # ============================================
            # REMOVE FROM DB IF NOT EXIST IN DOCKER
            # ============================================

            for port in list(self.containers.keys()):
                if port not in docker_map:
                    print(f"[SYNC] Container missing in Docker → removing DB entry {port}")
                    del self.containers[port]

            # ============================================
            # ADD TO DB IF EXIST IN DOCKER BUT NOT IN DB
            # ============================================

            for port, c in docker_map.items():
                if port not in self.containers:
                    print(f"[SYNC] Container exists in Docker → recovering {port}")
                    self.containers[port] = {
                        "id": c.id,
                        "port": int(port),
                        "status": "idle",
                        "task_id": None,
                        "user_id": None,
                        "last_updated": time.time()
                    }
                
                if c.status in ["exited", "dead"] or c.status != "running":
                    print(f"[SYNC] Container not running → removing {port}")
                    c.remove(force=True)
                    continue

            self.save_database()

        
    # ============================================================
    # ASSIGN
    # ============================================================

    def assign_container(self, user_id, task_id):

        with self.lock:
            # reuse idle
            for port, data in self.containers.items():

                if data["status"] == "idle":
                    data["status"] = "starting"

                    if self.is_ready(port):
                        data["status"] = "busy"
                        data["task_id"] = task_id
                        data["user_id"] = user_id
                        data["last_updated"] = time.time()
                        self.save_database()
                        return port

            # create new if requestBased
            if self.requestBased:
                if len(self.containers) >= self.pool_size:
                    print("[POOL LIMIT] Cannot create container")
                    return None

                print("[REQUEST MODE] Creating new container")
                
                port = self.create_container()
                if not port: return None

                ready = False
                for _ in range(15):
                    if self.is_ready(port):
                        ready = True
                        break

                    time.sleep(2)
                
                if not ready:
                    print("[FAILED] Container not ready → deleting")
                    self.delete_container(port)
                    return None
                
                data = self.containers[str(port)]
                data["status"] = "busy"
                data["task_id"] = task_id
                data["user_id"] = user_id
                data["last_updated"] = time.time()
                self.save_database()
                return port

            return None


    # ============================================================
    # RELEASE
    # ============================================================

    def release_container(self, port):

        with self.lock:
            port = str(port)
            if port not in self.containers:return

            self.containers[port]["status"] = "idle"
            self.containers[port]["task_id"] = None
            self.containers[port]["user_id"] = None
            self.containers[port]["last_updated"] = time.time()
            self.save_database()


    # ============================================================
    # RECREATE
    # ============================================================

    def recreate_container(self, port):
        print("Recreating:", port)
        self.delete_container(port)

        with self.lock:
            return self.create_container()


    # ============================================================
    # RECOVERY
    # ============================================================

    def recover_containers(self):

        with self.lock:
            docker_containers = self.client.containers.list(all=True)
            docker_map = {}

            for c in docker_containers:
                if "appium_magspot_" in c.name:
                    port = c.name.split("_")[-1]
                    docker_map[port] = c

            for port in list(self.containers.keys()):
                if port not in docker_map:
                    print("Missing container:", port)
                    del self.containers[port]


            for port, c in docker_map.items():
                if c.status in ["exited", "dead"]:
                    c.remove(force=True)
                    continue

                if port not in self.containers:
                    print("Recovering:", port)
                    self.containers[port] = {
                        "id": c.id,
                        "port": int(port),
                        "status": "idle",
                        "task_id": None,
                        "user_id": None,
                        "last_updated": time.time()
                    }

            self.save_database()


    # ============================================================
    # MONITOR
    # ============================================================

    def monitor_loop(self):

        while True:
            try:
                self.sync_with_docker()
                self.cleanup_old()
                # if not self.requestBased: self.ensure_pool()

            except Exception as e: print("Monitor error:", e)
            time.sleep(10)


    # ============================================================
    # CLEANUP OLD
    # ============================================================

    def cleanup_old(self):

        with self.lock:

            now = time.time()
            idle_timeout = 600      # 10 min
            busy_timeout = 7200      # 2 hour safety

            for port, data in list(self.containers.items()):

                port_str = str(port)
                last = data.get("last_updated", 0)
                status = data.get("status")
                task_id = data.get("task_id")
                user_id = data.get("user_id")
                

                # =====================================================
                # BUSY CONTAINER → CHECK TASK STATUS
                # =====================================================

                if status == "busy":

                    # No task → remove
                    if not task_id:
                        print(f"[CLEANUP] No task_id → removing {port_str}")
                        self.delete_container(port_str)
                        continue

                    task = db_get_task_by_id(user_id, task_id)

                    # Task not exist
                    if not task:
                        print(f"[CLEANUP] Task missing → removing {port_str}")
                        self.delete_container(port_str)
                        continue
                    
                    # =====================================================
                    # CRASH DETECTION USING DATABASE updated_at
                    # =====================================================

                    last_db_update = task.get('updated_at')
                    task_status = task.get('status', "empty")

                    if last_db_update:
                        # Force UTC interpretation if timestamp is naive
                        if last_db_update.tzinfo is None:
                            last_db_update = last_db_update.replace(tzinfo=timezone.utc)

                        elapsed = time.time() - last_db_update.timestamp()
                        threshold = self.BUSY_DB_TIMEOUT + 60

                        if elapsed > threshold:
                            if task_status == "RUNNING":
                                update_task(user_id, task_id, status="FAILED", log="No Updates From Container, Might Be Crashed")
                            self.delete_container(port_str)
                            continue

                    
                    # Task finished
                    if task_status in [ "FAILED", "COMPLETED", "CANCELLED"]:
                        print(f"[CLEANUP] Task finished ({task_status}) → removing {port_str}")
                        self.delete_container(port_str)
                        continue


                    # Safety timeout (worker crash)
                    # if now - last > busy_timeout:
                    #     print(f"[CLEANUP] Busy timeout → removing {port_str}")
                    #     self.delete_container(port_str)
                    #     continue

                    # HEARTBEAT UPDATE ← IMPORTANT FIX
                    if self.is_ready(port): data["last_updated"] = now
                    self.save_database()
                        

                # =====================================================
                # IDLE CONTAINER → NORMAL TIMEOUT
                # =====================================================
                    
                elif status == "idle":
                    if now - last > idle_timeout:
                        print(f"[CLEANUP] Idle timeout → removing {port_str}")
                        self.delete_container(port_str)




    # ============================================================
    # ENSURE POOL
    # ============================================================

    def ensure_pool(self):

        if self.requestBased: return  # ✅ skip in request mode

        required = self.pool_size - len(self.containers)
        if required <= 0: return

        # initial batch
        batch = max( 1, int(self.pool_size * self.batch_percent / 100))
        create_initial = min(batch, required)
        print(f"[INIT BATCH] Creating {create_initial}")

        # ==========================================
        # INITIAL BATCH
        # ==========================================

        for _ in range(create_initial):
            self.create_container()
            time.sleep(self.create_delay)  # ✅ NEW CPU SAFE

        required -= create_initial

        # ==========================================
        # REMAINING CREATE ONE BY ONE
        # ==========================================

        while required > 0 and len(self.containers) < self.pool_size:
            print( f"[POOL] Creating 1 container " f"{len(self.containers)}/{self.pool_size}")

            self.create_container()
            required -= 1
            time.sleep(self.create_delay)  # ✅ NEW CPU SAFE


    # ============================================================
    # GET URL
    # ============================================================

    def get_url(self, port):
        return f"http://127.0.0.1:{port}"



    # ============================================================
    # FAIL SAFE CLEAN
    # ============================================================

    def clean_by_task(self, task_id):

        for port, data in self.containers.items():
            if data["task_id"] == task_id:
                self.delete_container(port)
                return True
        return False





# ============================================================
# GLOBAL INSTANCE
# ============================================================


POOL = AppiumPoolManager(
    pool_size=APPIUM_POOL_SIZE, 
    batch_percent=APPIUM_BATCH_PERCENT, 
    batch_wait=APPIUM_BATCH_WAIT, 
    BUSY_DB_TIMEOUT=APPIUM_BUSY_DB_TIMEOUT
)
