import time
import subprocess
from app.config import Config
from app.repositories.tasks_repo import *
from app.automation.utils.appium_ import *
from app.repositories.devices_repo import *
from app.utils.runtime import TASK_RUNTIME
from app.utils.tools import SPLIT_PLAY_HOURS
from app.utils.tools import values_assignments
from app.automation.utils.appium_ import APPIUM_DRIVER
from app.automation.utils.appium_pool_manager import POOL
from app.automation.activities.google_search import GOOGLE_SEARCH



import os
import subprocess
import re
import json
from typing import Optional, List

def get_chrome_version_trimmed(device_id: str, timeout: int = 30) -> Optional[str]:
    """
    Query an Android device via adb for Chrome's versionName and return the
    version trimmed to the first three dot-separated components (X.Y.Z).
    Returns None on error or if Chrome/versionName is not found.
    """
    env = os.environ.copy()
    env["ADB_SERVER_SOCKET"] = f"tcp:127.0.0.1:{Config.ADB_PORT}"
    try:
        proc = subprocess.run(
            ["adb", "-s", device_id, "shell", "dumpsys", "package", "com.android.chrome"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout,
            env=env
        )
    except subprocess.TimeoutExpired: return None

    if proc.returncode != 0: return None

    for line in proc.stdout.splitlines():
        if "versionName=" in line:
            m = re.search(r"versionName\s*=\s*(\S+)", line) or re.search(r"versionName\s*=\s*(.+)", line)
            if not m:
                parts = line.split("=", 1)
                if len(parts) < 2: continue
                version_full = parts[1].strip()
            else: version_full = m.group(1).strip().strip('"').strip("'")

            comps = version_full.split(".")
            if len(comps) >= 3: trimmed = ".".join(comps[:3])
            else: trimmed = ".".join(comps)
            return trimmed

    return None



def clean_(driver, user_id, task_id, appium_port, device_ip, device_id, PACKAGE_ID, releaseDevice=True):

    if driver:
        try: driver.quit()
        except: pass

    try: subprocess.run(["adb", "-s", device_ip, "shell", "am", "force-stop", PACKAGE_ID], stdout=subprocess.DEVNULL)
    except: pass

    if appium_port: POOL.delete_container(appium_port)
    if releaseDevice: release_device(user_id, device_id)
    

def get_appium_session(user_id, task_id, device_ip, device_id, retry_count, PACKAGE_ID, ACTIVITY_ID):

    try:

        port = POOL.assign_container(user_id, task_id)
        update_task( user_id=user_id, task_id=task_id, progress=5, status="RUNNING", log=f"### Requesting Appium container! PORT [{port}]...")
        if not port: raise Exception("No Appium container available")
        update_task(user_id, task_id, progress=5, status="RUNNING", log=f"{'-'*70 if retry_count > 1 else '#'*135}")

        # Connect device
        subprocess.run(["adb", "connect", device_ip], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        TASK_RUNTIME[task_id] = {"port": port, "device_id": device_id}
        
        device_chrome_app_version = get_chrome_version_trimmed(device_ip)
        if not device_chrome_app_version: raise Exception("Failed! To Get The Device Chrome App Version")
        device_chrome_app_version = f"chromedriver_{device_chrome_app_version.replace('.', '_').strip()}"
        update_task( user_id=user_id, task_id=task_id, progress=5, status="RUNNING", log=f"### Using ChromeDriver [{device_chrome_app_version}]...")
            
        # Create driver
        driver = APPIUM_DRIVER(PACKAGE_ID, ACTIVITY_ID, f"http://127.0.0.1:{port}").create_driver(device_ip, PACKAGE_ID, ACTIVITY_ID, driver_name=device_chrome_app_version)
        driver.get_window_size()
        return port, driver

    except Exception as e: 
        raise Exception(f"Failed To Start Appium Session {e}")





def google_warmup_node(user_id, task_id, device, keywords, isOverrideResolution, cancel_event, **kwargs):
    
    driver, port, MAX_RETRIES = None, None, 3
    max_sites_limit = kwargs.get('sites_limit', 15)
    site_scroll_limit = kwargs.get('site_scroll_limit', 5)
    minimum_site_warmup_time = kwargs.get('minimum_site_warmup_time', 3)
    maximum_site_warmup_time = kwargs.get('maximum_site_warmup_time', 15)
    device_ip = device.get("device", {}).get("android_ip")
    device_id = device.get("device", {}).get("device_id")

    PACKAGE_ID = Config.CHROME_PACKAGE_NAME
    ACTIVITY_ID = Config.CHROME_ACTIVITY_NAME


    try:

        for keyword in keywords:

            if cancel_event.is_set(): raise Exception("Cancelled")
            search_keyword = keyword["search_keyword"]

            update_task(user_id, task_id, "RUNNING", 5, f"{'#'*135}")
            update_task(user_id, task_id, "RUNNING", 5, f"### DeviceID: {device_ip}  TaskID: {task_id}")
            update_task( user_id, task_id, "RUNNING", 5, f"### Search Keyword: [{search_keyword}]" )

            try:
                
                try: 
                    port, driver = get_appium_session( user_id, task_id, device_ip, device_id, 0, PACKAGE_ID, ACTIVITY_ID)
                except: raise


                GOOGLE_SEARCH(
                    driver, user_id, device_ip, 
                    task_id,  int(site_scroll_limit), isOverrideResolution, 
                    cancel_event).start_warmup(search_keyword, minimum_site_warmup_time, maximum_site_warmup_time, int(max_sites_limit))

                time.sleep(1)
                clean_( driver, user_id, task_id, port, device_ip, device_id, PACKAGE_ID, releaseDevice=False)
                driver, port = None, None
                break


            except Exception as e:
                update_task(user_id, task_id, "RUNNING", 15, f"### Failed: {str(e)[:200 if len(str(e))>200 else len(str(e))]}")
                clean_(driver, user_id, task_id, port, device_ip, device_id, PACKAGE_ID, releaseDevice=False)

                if "Task Cancelled By User" in str(e): break

                driver, port = None, None
                time.sleep(2)


        status = "CANCELLED" if cancel_event.is_set() else "COMPLETED"
        update_task(user_id, task_id, status, 100, log="### Task Completed")


    except Exception as e:
        status = "CANCELLED" if cancel_event.is_set() else "FAILED"
        update_task(user_id, task_id, progress=99, status=status, log=str(e))


    finally:
        try: clean_(driver, user_id, task_id, port, device_ip, device_id, PACKAGE_ID, releaseDevice=True)
        except Exception as e: print(f"Failed Cleaning [Stream By Library]\n{e}")