


import os
import json
import time
import random
import docker
import subprocess
import requests
import socket

from app.config import Config
from appium import webdriver as appium_webdriver
from appium.webdriver.common.appiumby import AppiumBy
from appium.options.android import UiAutomator2Options

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from seleniumwire import webdriver as wire_webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from appium.webdriver.extensions.android.nativekey import AndroidKey
from selenium.webdriver.common.actions.pointer_input import PointerInput
from selenium.webdriver.common.actions.action_builder import ActionBuilder
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse, quote_plus, unquote


APPIUM_CONTAINERS_DATABASE = Config.APPIUM_CONTAINERS_DATABASE


class APPIUM_DRIVER:
    
    def __init__(self, PACKAGE_ID, ACTIVITY_ID, APPIUM_SERVER):
        self.PACKAGE_ID = PACKAGE_ID
        self.ACTIVITY = ACTIVITY_ID
        self.APPIUM_SERVER = APPIUM_SERVER


    def is_app_running(self, device_id, package_name):
        result = subprocess.getoutput(f"adb -s {device_id} shell pidof {package_name}")
        return bool(result.strip())


    
    def get_unique_free_port(self, used_ports=None, min_port=10000, max_port=65000, max_attempts=1000):
        """
        Returns a free TCP port number that is not in used_ports.
        """
        if used_ports is None:
            used_ports = set()

        for _ in range(max_attempts):
            port = random.randint(min_port, max_port)
            if port in used_ports: continue
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.settimeout(0.5)
                if sock.connect_ex(("localhost", port)) != 0:  # port is free
                    used_ports.add(port)
                    return port
        raise RuntimeError("Could not find a free port after many attempts")



    def get_ports_for_device(self, device_id):
        ip = device_id.split(":")[0]        # "192.168.9.21"
        base = int(ip.split(".")[-1])       # 21

        return {
            "systemPort": 8200 + base,
            "webviewDevtoolsPort": 9200 + base,
            "chromedriverPort": 10000 + base
        }



    def create_driver(self, device_id, PACKAGE_ID, ACTIVITY, driver_name=None):
        # ports = self.get_ports_for_device(device_id)

        caps_ = {
            "platformName": "Android",
            "automationName": "UiAutomator2",
            "udid": device_id,
            "deviceName": device_id,

            "appPackage": PACKAGE_ID,
            "appActivity": ACTIVITY,

            "autoLaunch": True,
            "forceAppLaunch": True,
            "noReset": True,
            "androidUseRunningApp": True,

            "newCommandTimeout": 3600,
            "uiautomator2ServerInstallTimeout": 120000, # 60 seconds 
            "uiautomator2ServerLaunchTimeout": 120000, # optional, for server startup 
            "adbExecTimeout": 90000, # optional, for adb commands
            "systemPort": self.get_unique_free_port(),
            "webviewDevtoolsPort":  self.get_unique_free_port(),
            # "systemPort": ports["systemPort"],
            # "webviewDevtoolsPort": ports["webviewDevtoolsPort"],
            # "chromedriverPort": ports["chromedriverPort"],
            "ensureWebviewsHavePages": True,
            "chromedriverAutodownload": True
        }
        if driver_name: 
            caps_["chromedriverExecutable"] = os.path.join(Config.GOOGLE_CHROME_DRIVER_CONTAINER_PATH, driver_name)

        # caps_["appium:systemPort"] = ports["systemPort"]
        # caps_["appium:webviewDevtoolsPort"] = ports["webviewDevtoolsPort"]
        # caps_["appium:chromedriverPort"] = ports["chromedriverPort"]

        options = UiAutomator2Options().load_capabilities(caps_)
        driver = appium_webdriver.Remote(command_executor=self.APPIUM_SERVER, options=options)
        time.sleep(1)
        return driver
    





class APPIUM_RUNNER:

    def __init__(self, image_name="appium/appium:latest"):
        self.client = docker.from_env()
        self.image_name = image_name
        self.running_containers = self.load_containers()


    def load_containers(self):
        if os.path.exists(APPIUM_CONTAINERS_DATABASE):
            with open(APPIUM_CONTAINERS_DATABASE, "r") as f: return json.load(f)
        return []


    def save_containers(self):
        with open(APPIUM_CONTAINERS_DATABASE, "w") as f:
            json.dump(self.running_containers, f, indent=2)


    
    def wait_for_appium(self, host_port, timeout=130):
        url = f"http://localhost:{host_port}/status"
        start_time = time.time()
        while True:
            try:
                r = requests.get(url)
                if r.status_code == 200 and r.json().get("value", {}).get("ready", False): return True
            except Exception: pass
            if time.time() - start_time > timeout:
                raise Exception(f"Appium server not ready after {timeout} seconds on port {host_port}")
            time.sleep(1)


    def is_port_open(self, host, port):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(1)
            return sock.connect_ex((host, port)) == 0


    def get_random_free_port(self, timeout=5):
        while True:
            host_port = random.randint(20000, 40000)  # unpredictable range
            if self.is_port_open("localhost", host_port):
                if self.wait_for_appium(host_port, timeout=timeout): continue
                else: continue
            else:  return host_port


    def run_appium_containers(self, number_of_runners=1, post_start_cmd: str = None):
        runners = []

        for _ in range(number_of_runners):

            host_port = self.get_random_free_port()
            container_name = "appium_" + str(random.randint(11111, 99999))
            volumes = {
                "/dev/bus/usb": {"bind": "/dev/bus/usb", "mode": "rw"},
                os.path.expanduser("~/.gradle"): {"bind": "/root/.gradle", "mode": "rw"},
            }
            # ports = {"4723/tcp": host_port}
            extra_hosts = {"host.docker.internal": "host-gateway"}
            command = [
                # "appium",
                "--allow-cors",
                "--address", "0.0.0.0",
                "--port", str(host_port),
                "--allow-insecure", "uiautomator2:adb_shell"
            ]

            # stop/remove if exists
            try:
                existing_container = self.client.containers.get(container_name)
                existing_container.stop()
                existing_container.remove()
            except docker.errors.NotFound: pass

            environment = {"APPIUM_PORT": str(host_port)}
            container = self.client.containers.run(
                image=self.image_name,
                name=container_name,
                privileged=True,
                volumes=volumes,
                extra_hosts=extra_hosts,
                network_mode="host",
                environment=environment,
                entrypoint="appium",
                command=command,
                detach=True,
                mem_limit="512m",
                cpu_quota=100000,
                cpu_period=100000,
                auto_remove=True
            )


            container_info = {
                "id": container.id,
                "name": container_name,
                "host_port": host_port,
                "type": "appium"
            }
            self.running_containers.append(container_info)
            runners.append(container_info)

            if post_start_cmd:
                try:
                    # print(f"Running post-start command: {post_start_cmd}")
                    result = subprocess.run(post_start_cmd, shell=True, check=True, capture_output=True, text=True )
                    # Attach response to container_info
                    container_info["post_start_output"] = result.stdout.strip()
                    container_info["post_start_error"] = result.stderr.strip()
                    # print(container_info["post_start_output"], container_info["post_start_error"])
                except subprocess.CalledProcessError as e:
                    print(f"Post-start command failed: {e}")
                    container_info["post_start_error"] = str(e)


        self.save_containers()
        # for r in runners: print(r)
        return runners




    def stop_container_by_id(self, container_id):
        """
        Stops and removes a running Docker container by its ID.
        Returns True on success, False on failure.
        Handles NotFound, APIError, and already removed cases.
        """
        if not container_id:
            return True
            
        container_stopped = False
        try:
            container = self.client.containers.get(container_id)
            container.reload()  # refresh state from Docker

            # Stop if running (ignore if already stopped/exited)
            if container.status == "running":
                try:
                    container.stop(timeout=10)
                except docker.errors.APIError as e:
                    # Container might have stopped between reload and stop
                    if "not running" not in str(e).lower():
                        print(f"Error stopping container {container_id}: {e}")

            # Force remove regardless of state (handles auto_remove edge cases)
            try:
                container.remove(force=True)
            except docker.errors.APIError as e:
                # Already removed or being removed
                if "no such container" not in str(e).lower():
                    print(f"Warning during container removal {container_id}: {e}")

            container_stopped = True
            print(f"Container {container_id} stopped and removed successfully.")

        except docker.errors.NotFound:
            # Container already removed - this is actually fine
            print(f"Container {container_id} not found (already removed).")
            container_stopped = True
            
        except docker.errors.APIError as e:
            print(f"API Error for container {container_id}: {e}")
            # Try force remove as fallback
            try:
                container = self.client.containers.get(container_id)
                container.remove(force=True)
                container_stopped = True
                print(f"Container {container_id} force-removed successfully.")
            except Exception as e2:
                if "not found" in str(e2).lower() or "no such container" in str(e2).lower():
                    container_stopped = True
                    print(f"Container {container_id} already removed.")
                else: print(f"Force remove also failed for {container_id}: {e2}")

        except Exception as e:
            print(f"Unexpected error stopping container {container_id}: {e}")
            # Last resort: try force remove
            try:
                container = self.client.containers.get(container_id)
                container.remove(force=True)
                container_stopped = True
            except Exception: container_stopped = True  # Assume success if not found

        # Update tracking only if removal succeeded
        if container_stopped:
            self.running_containers = [
                c for c in self.running_containers if c["id"] != container_id
            ]
            self.save_containers()

        return container_stopped




    def stop_all_containers(self, container_type="appium"):
        still_running = []
        for c in self.running_containers:
            if c["type"] != container_type:
                still_running.append(c)
                continue

            try:
                container = self.client.containers.get(c["id"])
                print(f"Stopping container {c['name']}...")
                container.stop()
                container.remove()
            except docker.errors.NotFound: print(f"Container {c['name']} already removed.")

        self.running_containers = still_running
        self.save_containers()
        print(f"All '{container_type}' containers stopped and removed successfully.")




    def list_running_containers(self, container_type=None):
        if container_type:
            return [c for c in self.running_containers if c["type"] == container_type]
        return self.running_containers




class AppiumContainerManager:
    """
    Context manager for automatic Appium container lifecycle management.
    Ensures container is always cleaned up even on exceptions or crashes.
    """
    
    def __init__(self, device_ip, post_start_cmd=None):
        self.device_ip = device_ip
        self.post_start_cmd = post_start_cmd
        self.container = None
        self.container_id = None
        self.host_port = None
        
    def __enter__(self):
        """Create and start the Appium container."""
        result = APPIUM_RUNNER_.run_appium_containers(
            number_of_runners=1, 
            post_start_cmd=self.post_start_cmd
        )
        self.container = result[0]
        self.container_id = self.container.get("id")
        self.host_port = self.container.get("host_port")
        
        # Wait for Appium to be ready
        APPIUM_RUNNER_.wait_for_appium(self.host_port)
        
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Always cleanup the container when exiting."""
        if self.container_id:
            print(f"Cleaning up container {self.container_id} via context manager")
            APPIUM_RUNNER_.stop_container_by_id(self.container_id)
        return False  # Don't suppress exceptions
    
    def get_connection_url(self):
        """Return the Appium server connection URL."""
        return f"http://127.0.0.1:{self.host_port}" if self.host_port else None




def cleanup_task_container(task_id):
    """
    Failsafe cleanup function for a task container.
    Reads container_id from TASK_RUNTIME and stops the container safely.
    Used for task cancel, server restart recovery, and manual cleanup.
    """
    from app.utils.runtime import TASK_RUNTIME
    
    try:
        runtime = TASK_RUNTIME.get(task_id)
        if not runtime:
            print(f"No runtime data found for task {task_id}")
            return True
            
        container_id = runtime.get("container_id")
        if not container_id:
            print(f"No container_id found for task {task_id}")
            return True
            
        print(f"Cleaning up container {container_id} for task {task_id}")
        stopped = APPIUM_RUNNER_.stop_container_by_id(container_id)
        
        if stopped:
            # Clear from runtime
            TASK_RUNTIME[task_id]["container_id"] = None
            print(f"Successfully cleaned up container for task {task_id}")
        else:
            print(f"Failed to clean up container for task {task_id}")
            
        return stopped
        
    except Exception as e:
        print(f"Error in cleanup_task_container for task {task_id}: {e}")
        return False








APPIUM_RUNNER_ = APPIUM_RUNNER()




if __name__ == "__main__":

    print(APPIUM_CONTAINERS_DATABASE)
    # obj = APPIUM_RUNNER()
    # runners = obj.run_appium_containers(number_of_runners=2)
    # print(json.dumps(runners, indent=4))

    # time.sleep(4)
    # obj.list_running_containers
    # input("Delete? ")
    # obj.stop_all_containers()