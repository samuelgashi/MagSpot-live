import time
import subprocess
from app.config import Config
from app.repositories.tasks_repo import *
from app.automation.utils.appium_ import *
from app.repositories.devices_repo import *
from app.utils.runtime import TASK_RUNTIME
from app.utils.tools import SPLIT_PLAY_HOURS
from app.utils.tools import values_assignments
from app.automation.activities.stream_by_artist import *
from app.automation.activities.stream_by_playlist import *
from app.automation.activities.stream_by_library import *
from app.automation.utils.appium_pool_manager import POOL
from app.automation.utils.appium_ import APPIUM_DRIVER


config_env = Config.config_env


def clean_(driver, user_id, task_id, appium_port, device_ip, device_id, PACKAGE_ID, releaseDevice=True):

    if driver:
        try: driver.quit()
        except: pass

    try: subprocess.run([Config.ADB_PATH, "-P", str(Config.ADB_PORT), "-s", device_ip, "shell", "am", "force-stop", PACKAGE_ID], stdout=subprocess.DEVNULL, env=config_env)
    except: pass

    if appium_port: POOL.delete_container(appium_port)
        # task = db_get_task_by_id(user_id, task_id)
        # task_status = task.get("status")
        # if task_status in ["FAILED", "COMPLETED", "CANCELLED", "BUSY"]: POOL.delete_container(appium_port)
        # else: POOL.release_container(appium_port)

    if releaseDevice: release_device(user_id, device_id)
    


def get_appium_session(user_id, task_id, device_ip, device_id, retry_count, PACKAGE_ID, ACTIVITY_ID):

    try:

        port = POOL.assign_container(user_id, task_id)
        update_task( user_id=user_id, task_id=task_id, progress=5, status="RUNNING", log=f"### Requesting Appium container! PORT [{port}]...")
        if not port: raise Exception("No Appium container available")
        update_task(user_id, task_id, progress=5, status="RUNNING", log=f"{'-'*70 if retry_count > 1 else '#'*135}")

        # Connect device
        subprocess.run([Config.ADB_PATH, "-P", str(Config.ADB_PORT), "connect", device_ip], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=config_env)
        TASK_RUNTIME[task_id] = {"port": port, "device_id": device_id}
        
        # subprocess.run(
        #     [Config.ADB_PATH, "-s", device_id, "forward", "--remove-all"],
        #     stdout=subprocess.DEVNULL,
        #     stderr=subprocess.DEVNULL
        # )

        # # 🔥 KILL STALE UIAUTOMATOR (critical)
        # subprocess.run(
        #     [Config.ADB_PATH, "-s", device_id, "shell", "pkill", "-f", "uiautomator"],
        #     stdout=subprocess.DEVNULL,
        #     stderr=subprocess.DEVNULL
        # )

        # Create driver
        driver = APPIUM_DRIVER(PACKAGE_ID, ACTIVITY_ID, f"http://{Config.ANDROID_ADB_SERVER_ADDRESS}:{port}").create_driver(device_ip, PACKAGE_ID, ACTIVITY_ID)
        driver.get_window_size()
        return port, driver

    except Exception as e: 
        raise Exception(f"Failed To Start Appium Session {e}")




def get_saved_content_from_library(user_id, task_id, device_ip, device_id, PACKAGE_ID, ACTIVITY_ID, is_youtube_premium, isOverrideResolution, cancel_event, kwargs):
    
    driver = None 
    port = None 
    MAX_RETRIES = 3

    try:
        try:  port, driver = get_appium_session(user_id, task_id, device_ip, device_id, 1, PACKAGE_ID, ACTIVITY_ID)
        except: raise

        max_playlists = kwargs.get("max_playlists")
        play_hours = kwargs.get("play_hour")
        max_play_hours = kwargs.get('"max_play_hours"')
        min_play_minutes = kwargs.get("min_play_minutes")
        total_devices = kwargs.get("total_devices")
        device_assignment = kwargs.get("device_assignment")
        device_index = kwargs.get("device_index")
        split_play_hours = kwargs.get("split_play_hours")
        fetch_saved_content_first = kwargs.get('fetch_saved_content_first', False)
        fetch_content_type = kwargs.get('fetch_content_type', "playlists")

        STREAM_BY_LIBRARY_ = STREAM_BY_LIBRARY(driver, user_id, device_ip, task_id, is_youtube_premium, isOverrideResolution, cancel_event)
        saved_library_contents = STREAM_BY_LIBRARY_.get_all_saved_content_from_library(fetch_content_type)       

        if not saved_library_contents: raise Exception(f"No Saved Content In Device Library For [{fetch_content_type.upper()}]...")
        update_task(user_id, task_id, "RUNNING", 7, f"### Total {len(saved_library_contents)} Saved {fetch_content_type} Content Found From Library")
        update_task(user_id, task_id, "RUNNING", 7, f"### Getting Saved Content {fetch_content_type} From Library")
        
        playlists = values_assignments(saved_library_contents, total_devices, device_index+1, device_assignment)
        playlists = playlists[:max_playlists if len(playlists) > max_playlists else len(playlists) ]
        playlists = [{'streamer': a.strip()} for a in dict.fromkeys(playlists)]

        if split_play_hours: play_hours_list = SPLIT_PLAY_HOURS(len(playlists), play_hours, min_play_minutes, max_play_hours)
        else: play_hours_list = [play_hours for x in playlists]

        for index, x in enumerate(playlists): x['play_hours'] = play_hours_list[index]
        return playlists
    
    except Exception as e: 
        status = "CANCELLED" if cancel_event.is_set() else "FAILED"
        update_task(user_id, task_id, progress=20, status=status, log=str(e))

    finally: 
        try: clean_(driver, user_id, task_id, port, device_ip, device_id, PACKAGE_ID, releaseDevice=False)
        except Exception as e: print(f"Failed Cleaning [Stream By Library]\n{e}")







def stream_worker_node(user_id, task_id, device, streamers, play_hours, isOverrideResolution, cancel_event, streamType, **kwargs):
    
    driver, port, MAX_RETRIES = None, None, 3
    device_ip = device.get("device", {}).get("android_ip")
    device_id = device.get("device", {}).get("device_id")
    is_youtube_premium = kwargs.get("is_youtube_premium", True)

    PACKAGE_ID = Config.YT_MUSIC_PACKAGE_NAME
    ACTIVITY_ID = Config.YT_MUSIC_ACTIVITY_NAME

    # ---> Library Stream Variables
    if streamType == "library":
        fetch_library_saved_content_first = kwargs.get('fetch_saved_content_first', False)

        if fetch_library_saved_content_first:
            
            max_playlists = kwargs.get("max_playlists")
            update_task(user_id, task_id, "RUNNING", 5, f"{'#'*135}")
            update_task(user_id, task_id, "RUNNING", 5, f"### DeviceID: {device_ip}  TaskID: {task_id}")
            update_task(user_id, task_id, "RUNNING", 5, f"### YouTube Subscription Type: {'Premiumum' if is_youtube_premium else 'Free'}...")

            saved_library_content = get_saved_content_from_library( user_id, task_id, device_ip, device_id, PACKAGE_ID, ACTIVITY_ID, is_youtube_premium, isOverrideResolution, cancel_event, kwargs)
            temp = {x['streamer'].strip().lower() for x in streamers}
            matched_streamers = []

            for x in saved_library_content:
                for y in streamers:
                    if x['streamer'].strip().lower() == y['streamer'].strip().lower():
                        matched_streamers.append(y)

            streamers = matched_streamers    
            random.shuffle(streamers)
            streamers = streamers[:max_playlists if max_playlists else len(streamers)]
            update_task(user_id, task_id, "RUNNING", 5, f"### Total {len(streamers)} Streamers Matched...")
            update_task(user_id, task_id, "RUNNING", 5, f"{'#'*135}")
            update_task(user_id, task_id, "RUNNING", 5, f"")

    try:

        for streamer in streamers:
            if cancel_event.is_set(): raise Exception("Cancelled")
            name = streamer["streamer"]
            streamer_thumbnail = streamer["streamer_thumbnail"]
            streamer_songs = streamer["streamer_songs"]
            retry_count, streamer_start_time = 0, None
            original_play_hours = round(float(streamer["play_hours"]), 3) + 0.02
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
                        if remaining_play_hours <= 0:
                            update_task(user_id, task_id, "RUNNING", 100, f"### Streamer [{name}] already completed play time during retry")
                            break


                    if streamer_start_time is None: streamer_start_time = time.monotonic()
                    current_play_hours = remaining_play_hours + 0.02 if retry_count > 1 else original_play_hours

                    if retry_count > 1: update_task(user_id, task_id, progress=5, status="RUNNING", log=f"{'-'*70}")
                    update_task( user_id, task_id, "RUNNING", 5, f"### Streamer: [{name}]  PlayHours: {current_play_hours:.3f}  Retry: [{retry_count}/{MAX_RETRIES}]   {'[Profile Image Analyze]' if streamer_thumbnail else ''}" )
                    
                    try: 
                        port, driver = get_appium_session(
                        user_id, task_id, device_ip, device_id, retry_count, PACKAGE_ID, ACTIVITY_ID)
                    except: raise

                    if streamType == "artist":
                        filter_type = kwargs.get('search_filter')
                        SEARCH_BY_ARTIST(
                            driver, user_id, device_ip, 
                            task_id, is_youtube_premium, isOverrideResolution, 
                            cancel_event).start_search_by_artist_stream(name, streamer_thumbnail, streamer_songs, current_play_hours, filter_type)

                    elif streamType == "playlist":
                        STREAM_BY_PLAYLIST(
                            driver, user_id, device_ip, 
                            task_id, is_youtube_premium, isOverrideResolution, 
                            cancel_event).start_stream_by_playlist(name, current_play_hours)

                    elif streamType == "library":
                        STREAM_BY_LIBRARY(
                            driver, user_id, device_ip, 
                            task_id, is_youtube_premium, isOverrideResolution, 
                            cancel_event).start_stream_by_library_stream(name, current_play_hours)    


                    time.sleep(1)
                    clean_( driver, user_id, task_id, port, device_ip, device_id, PACKAGE_ID, releaseDevice=False)
                    driver, port = None, None
                    break


                except Exception as e:
                    update_task(user_id, task_id, "RUNNING", 15, f"### Retry {retry_count} failed: {str(e)[:200 if len(str(e))>200 else len(str(e))]}")
                    clean_(driver, user_id, task_id, port, device_ip, device_id, PACKAGE_ID, releaseDevice=False)

                    driver = None
                    port = None

                    if "Task Cancelled By User" in str(e): break

                    if retry_count >= MAX_RETRIES: 
                        update_task(user_id, task_id, "RUNNING", 15, f"### Failed After {MAX_RETRIES} Retries For Streamer [{name}]!")
                        break
                    
                    time.sleep(2)


        status = "CANCELLED" if cancel_event.is_set() else "COMPLETED"
        update_task(user_id, task_id, "COMPLETED", 100, log="### Task Completed")



    except Exception as e:
        status = "CANCELLED" if cancel_event.is_set() else "FAILED"
        update_task(user_id, task_id, progress=99, status=status, log=str(e))


    finally:
        try: clean_(driver, user_id, task_id, port, device_ip, device_id, PACKAGE_ID, releaseDevice=True)
        except Exception as e: print(f"Failed Cleaning [Stream By Library]\n{e}")
