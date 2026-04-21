import time
import subprocess
from app.config import Config
from app.repositories.tasks_repo import *
from app.automation.utils.appium_ import *
from app.repositories.devices_repo import *
from app.utils.runtime import TASK_RUNTIME
from app.utils.tools import SPLIT_PLAY_HOURS
from app.utils.tools import values_assignments
from app.automation.activities.youtube_feeds import *
from app.automation.utils.appium_pool_manager import POOL
from app.automation.utils.appium_ import APPIUM_DRIVER





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
        
        # Create driver
        driver = APPIUM_DRIVER(PACKAGE_ID, ACTIVITY_ID, f"http://127.0.0.1:{port}").create_driver(device_ip, PACKAGE_ID, ACTIVITY_ID)
        driver.get_window_size()
        return port, driver

    except Exception as e: 
        raise Exception(f"Failed To Start Appium Session {e}")





def stream_worker_node(user_id, task_id, device, play_hours, isOverrideResolution, cancel_event, **kwargs):
    
    driver, port, MAX_RETRIES = None, None, 3
    device_ip = device.get("device", {}).get("android_ip")
    device_id = device.get("device", {}).get("device_id")
    is_youtube_premium = kwargs.get("is_youtube_premium", True)

    PACKAGE_ID = Config.YOUTUBE_PACKAGE_NAME
    ACTIVITY_ID = Config.YOUTUBE_ACTIVITY_NAME

    try:

        if cancel_event.is_set(): raise Exception("Cancelled")

        retry_count, streamer_start_time = 0, None
        original_play_hours = round(float(play_hours), 3) + 0.02
        remaining_play_hours = original_play_hours

        update_task(user_id, task_id, "RUNNING", 5, f"{'#'*135}")
        update_task(user_id, task_id, "RUNNING", 5, f"### DeviceID: {device_ip}  TaskID: {task_id}")


        while retry_count < MAX_RETRIES:
            try:
                retry_count += 1

                # Track elapsed play time if retrying
                if streamer_start_time is not None:
                    elapsed_hours = (time.monotonic() - streamer_start_time) / 3600
                    remaining_play_hours = max(0, original_play_hours - elapsed_hours)
                    if remaining_play_hours <= 0: break


                if streamer_start_time is None: streamer_start_time = time.monotonic()
                current_play_hours = remaining_play_hours + 0.02 if retry_count > 1 else original_play_hours

                if retry_count > 1: update_task(user_id, task_id, progress=5, status="RUNNING", log=f"{'-'*70}")
                update_task( user_id, task_id, "RUNNING", 5, f"### YouTube Shorts! PlayHours: {current_play_hours:.3f}  Retry: [{retry_count}/{MAX_RETRIES}]" )

                try: 
                    port, driver = get_appium_session(
                    user_id, task_id, device_ip, device_id, retry_count, PACKAGE_ID, ACTIVITY_ID)
                except: raise
                
                YOUTUBE_SHORTS(
                    driver, user_id, device_ip, 
                    task_id, is_youtube_premium, isOverrideResolution, 
                    cancel_event).start_shorts_stream(current_play_hours)
 
                break


            except Exception as e:
                update_task(user_id, task_id, "RUNNING", 15, f"### Retry {retry_count} failed: {str(e)[:200 if len(str(e))>200 else len(str(e))]}")
                clean_(driver, user_id, task_id, port, device_ip, device_id, PACKAGE_ID, releaseDevice=False)

                driver = None
                port = None

                if "Task Cancelled By User" in str(e): break

                if retry_count >= MAX_RETRIES: 
                    update_task(user_id, task_id, "RUNNING", 15, f"### Failed After {MAX_RETRIES} Retries For YouTube Shorts!")
                    break
                
                time.sleep(2)


        status = "CANCELLED" if cancel_event.is_set() else "COMPLETED"
        update_task(user_id, task_id, "COMPLETED", 100, log="### Task Completed")


    except Exception as e:
        status = "CANCELLED" if cancel_event.is_set() else "FAILED"
        update_task(user_id, task_id, progress=99, status=status, log=str(e))


    finally:
        try: clean_(driver, user_id, task_id, port, device_ip, device_id, PACKAGE_ID, releaseDevice=True)
        except Exception as e: print(f"Failed Cleaning [Youtube Shorts Stream]\n{e}")