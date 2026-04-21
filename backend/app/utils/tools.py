import io
import time
import psutil
import subprocess
import psutil
import docker
import re, requests
import pandas as pd
import numpy as np
from PIL import Image
import re, random, time
from app.config import Config
from app.repositories.tasks_repo import *
from app.repositories.devices_repo import *
from app.automation.utils.appium_ import APPIUM_RUNNER_
from app.utils.runtime import TASK_CANCEL_EVENTS, TASK_THREADS, TASK_RUNTIME

config_env = Config.config_env


def screenshot_element(driver, element, filename="element.png"):
    """
    Capture a screenshot of a specific element and save it.
    Args:
        driver: Selenium/Appium driver instance
        element: WebElement (e.g. thumbnail_obj)
        filename: Output file name
    """
    png = driver.get_screenshot_as_png()
    img = Image.open(io.BytesIO(png))
    location = element.location
    size = element.size
    left = location['x']
    top = location['y']
    right = left + size['width']
    bottom = top + size['height']
    img = img.crop((left, top, right, bottom))
    img.save(filename)
    return filename


def download_image(url: str, filename: str):
    """
    Download an image from a given URL and save it locally.
    Args:
        url (str): The image URL.
        filename (str): The local filename to save as (e.g. 'artist.png').
    """
    response = requests.get(url, stream=True)
    if response.status_code == 200:
        with open(filename, "wb") as f:
            for chunk in response.iter_content(1024): f.write(chunk)
        return True
    else:
        raise Exception(f"Failed to download image. Status code: {response.status_code}")
    


def analyze_image_profile_sheet(sheet_url: str):
    """
    Convert a Google Sheet into a list of row dictionaries.
    Empty cells are converted to None.
    """
    # Extract sheet ID
    match_id = re.search(r"/d/([a-zA-Z0-9-_]+)", sheet_url)
    if not match_id: raise ValueError("Invalid Google Sheet URL: Cannot find sheet ID")
    sheet_id = match_id.group(1)

    # Extract gid (sheet/tab ID)
    match_gid = re.search(r"gid=([0-9]+)", sheet_url)
    gid = match_gid.group(1) if match_gid else "0"

    # Build proper CSV export URL
    csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?tqx=out:csv&gid={gid}"

    # Load CSV into pandas
    df = pd.read_csv(csv_url)
    # Replace NaN/NaT/inf with None
    df = df.replace({np.nan: None, pd.NaT: None, np.inf: None, -np.inf: None})
    # Convert to list of row dictionaries
    return df.to_dict(orient="records")



def get_google_sheet_columns(sheet_url: str, keep_none: bool = False):
    """
    Fetches Google Sheet data from a given URL, removes header row,
    and returns the data as a list of columns (2D list).

    Args: sheet_url (str): The full Google Sheet URL (must be public or shared).
    Returns: list[list]: 2D list where each inner list contains all values of a column.
    """
    # Extract the sheet ID from the URL
    match = re.search(r"/d/([a-zA-Z0-9-_]+)", sheet_url)
    if not match: raise ValueError("Invalid Google Sheet URL")
    sheet_id = match.group(1)
    # Construct CSV export URL
    csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    # Read into pandas DataFrame
    df = pd.read_csv(csv_url)
    # Drop header row (first row of data)
    df_no_header = df.iloc[:]
    # Convert to list of columns
    if keep_none:
        df = df.where(pd.notna(df), None)
        columns = [df[col].tolist() for col in df.columns]
    else: columns = [df_no_header[col].dropna().tolist() for col in df_no_header.columns]
    return columns


def values_assignments(values, total_devices, current_device, device_assignment=True):
    """
    Assign values to devices based on rules.

    Args:
        values (list): List of values to assign.
        total_devices (int): Total number of devices.
        current_device (int): Current device index (1-based).
        device_assignment (bool): If True, assign per device. If False, return shuffled list.

    Returns:
        list or single value: Assigned value(s).

    values = ["Artist1", "Artist2", "Artist3", "Artist4"]
    print(assign_value(values, total_devices=1, current_device=1, device_assignment=True))
    # → ['A', 'B', 'C', 'D'] (all values for one device)
    print(assign_value(values, total_devices=4, current_device=2, device_assignment=True))
    # → 'B' (second device gets second value)
    print(assign_value(values, total_devices=6, current_device=5, device_assignment=True))
    # → cycles through shuffled list, e.g. 'C'
    print(assign_value(values, total_devices=2, current_device=1, device_assignment=True))
    # → 'A' (first device gets one of two unique values)
    print(assign_value(values, total_devices=3, current_device=2, device_assignment=False))
    # → ['C', 'A', 'B', 'D'] (random order list)
    """
    if not values:
        return []   # always return a list

    # Random shuffle mode (device_assignment=False)
    if not device_assignment:
        shuffled = values[:]
        random.shuffle(shuffled)
        return shuffled

    # Device assignment mode
    if total_devices == 1:
        # One device gets all values, but in random order
        shuffled = values[:]
        random.shuffle(shuffled)
        return shuffled

    if total_devices == len(values):
        # Each device gets one unique value
        return [values[current_device - 1]]

    if total_devices > len(values):
        # More devices than values: cycle through values randomly
        shuffled = values[:]
        random.shuffle(shuffled)
        return [shuffled[(current_device - 1) % len(shuffled)]]

    if total_devices < len(values):
        # Fewer devices than values: assign unique values only
        shuffled = values[:]
        random.shuffle(shuffled)
        selected = shuffled[:total_devices]
        return [selected[current_device - 1]]
    
    

def SPLIT_PLAY_HOURS(total_streamers: int, play_hours: float, min_minutes: int = 20, max_hours: float = None):
    """
    Randomly split play_hours among total_streamers.
    - play_hours is in hours (float).
    - min_minutes is the minimum allocation per streamer.
    - max_hours is the maximum allocation per streamer (float, in hours).
    - Returns a list of floats in hours, rounded to 2 decimals.
    """

    total_minutes = play_hours * 60
    min_total = min_minutes * total_streamers

    # If total_minutes is less than min_total, ignore minimums
    if total_minutes < min_total:
        # Just split randomly without enforcing min
        cuts = sorted([random.uniform(0, total_minutes) for _ in range(total_streamers - 1)])
        cuts = [0] + cuts + [total_minutes]
        shares = [cuts[i+1] - cuts[i] for i in range(total_streamers)]
        allocations = shares
    else:
        # Reserve minimum for each streamer
        remaining = total_minutes - min_total
        cuts = sorted([random.uniform(0, remaining) for _ in range(total_streamers - 1)])
        cuts = [0] + cuts + [remaining]
        shares = [cuts[i+1] - cuts[i] for i in range(total_streamers)]
        allocations = [min_minutes + share for share in shares]

    # Apply maximum cap if provided
    if max_hours is not None:
        max_minutes = max_hours * 60
        allocations = [min(a, max_minutes) for a in allocations]

    # Convert to hours, rounded
    return [round(m / 60, 2) for m in allocations]



def parse_number(value, default=0.0): 
    try: return float(value) 
    except (ValueError, TypeError): return default


def release_busy_device(user_id, device_id):
    row = db_get_task(user_id, device_id)
    if not row or not row["current_task_id"]: return True

    task_id = row["current_task_id"]
    cancel_event = TASK_CANCEL_EVENTS.get(task_id)
    if cancel_event: cancel_event.set()

    runtime = TASK_RUNTIME.get(task_id)
    
    if runtime and runtime.get("container_id"): 
        APPIUM_RUNNER_.stop_container_by_id(runtime["container_id"])

    if runtime and  runtime.get('port'):
        POOL.delete_container(runtime.get('port'))

    release_device(user_id, device_id)
    return True


def checkPlayHours(max_duration, start_time, task_id, user_id):
    if max_duration is not None and (time.monotonic() - start_time) >= max_duration: 
        update_task(user_id, task_id, progress=99, status="COMPLETED", log=f"*** Hours Play Kill Switch Triggered [{max_duration/3600}] Hours")
        return True
    else: return False 


import subprocess

def get_active_display_size(device_ip):
    subprocess.run([Config.ADB_PATH, "-P", str(Config.ADB_PORT), "connect", device_ip], stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=config_env)
    result = subprocess.run(
        [Config.ADB_PATH, "-P", str(Config.ADB_PORT), "-s", device_ip, "shell", "wm", "size"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=config_env
    )
    if result.returncode != 0:
        raise RuntimeError(f"ADB error: {result.stderr.strip()}")

    for line in result.stdout.splitlines():
        if "Override size" in line:
            return line.split(":")[1].strip()
        if "Physical size" in line:
            return line.split(":")[1].strip()
    return None




def CHECK_INTERNET_CONNECTIVITY(device_ip: str) -> bool:
    try:
        result = subprocess.run(
            [Config.ADB_PATH, "-P", str(Config.ADB_PORT), "-s", device_ip, "shell", "ping", "-c", "1", "-W", "3", "google.com"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=2,
            env=config_env
        )
        return result.returncode == 0
    except subprocess.TimeoutExpired: return False
    except Exception: return False





# =========================
# CPU USAGE
# =========================
def system_cpu_usage():
    try:
        # psutil.cpu_percent(interval=0.1) waits 100ms and returns usage
        usage = psutil.cpu_percent(interval=0.1)
        return {
            "percent": f"{round(usage)}%",
            "values": {}
        }
    except Exception as e:
        print(e)
        return {"percent": "N/A%", "values": {}}


# =========================
# RAM USAGE
# =========================
def system_ram_usage():
    try:
        mem = psutil.virtual_memory()
        total = round(mem.total / (1024**3), 2)   # GB
        free = round(mem.available / (1024**3), 2)
        used = total - free
        percent = round(mem.percent)

        return {
            "percent": f"{percent}%",
            "values": {
                "total": str(total),
                "free": str(free)
            }
        }
    except Exception as e:
        print(e)
        return {
            "percent": "N/A%",
            "values": {"total": "-1", "free": "-1", "running": "-1"}
        }


MEM_LIMIT_MB = 200
SYSTEM_RESERVE_GB = 2

client = docker.from_env()
from app.automation.utils.appium_pool_manager import POOL

def system_containers_usage():

    try:
        # containers = client.containers.list(filters={"name": "appium_magspot_"})
        running = len(POOL.containers)

        # mem = psutil.virtual_memory()
        # reserve_bytes = SYSTEM_RESERVE_GB * 1024**3
        # total_memory = max(mem.total - reserve_bytes, 0)
        # usable_bytes = max(mem.available - reserve_bytes, 0)

        # max_new_containers = usable_bytes // (MEM_LIMIT_MB * 1024 * 1024)
        total_capacity =  Config.APPIUM_POOL_SIZE
        usage_percent = round(
            (running / total_capacity) * 100
        ) if total_capacity else 0

        return {
            "percent": f"{usage_percent}%",
            "values": {
                "total": str(total_capacity),
                "running": str(running),
                "free": str(total_capacity - running)
            }
        }

    except Exception as e:
        print(e)
        return {
            "percent": "N/A",
            "values": {
                "total": "-1",
                "running": "-1",
                "free": "-1"
            }
        }
