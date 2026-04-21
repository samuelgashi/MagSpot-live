import time
import random
import hashlib
import subprocess
import os, ffmpeg
import subprocess
from appium import webdriver as appium_webdriver
from app.automation.utils.HumanTapper import HumanTapper
from app.automation.utils.HumanTyper import HumanTyper
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



def get_active_display_size(device_ip):

    subprocess.run(["adb", "connect", device_ip], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    result = subprocess.run(
        ["adb", "-s", device_ip, "shell", "wm", "size"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    if result.returncode != 0: raise RuntimeError(f"ADB error: {result.stderr.strip()}")
    for line in result.stdout.splitlines():
        if "Override size" in line: return line.split(":")[1].strip()
        if "Physical size" in line: return line.split(":")[1].strip()

    return None



def tapOnScreenCoord(driver: appium_webdriver, x: int, y: int, android_ip: str, element=None):
    """ Tap on the screen at absolute coordinates (x, y). """

    if element:
        
        elem_loc = element.location
        elem_siz = element.size

        center_x = elem_loc['x']  + elem_siz['width'] / 2
        center_y = elem_loc['y']  + elem_siz['height'] / 2

        x = center_x
        y = center_y

    # driver.tap([(x, y)])
    width_x, width_y = get_active_display_size(android_ip if "5555" in android_ip else f"{android_ip}:5555").split('x')
    # print(width_x, width_y)
    HumanTapper(driver, screen_width=int(width_x), screen_height=int(width_y)).tap(x, y)
    
    if x is None or y is None: 
        raise Exception(f"Invalid coordinates or element [{x}, {y}]")
            
    time.sleep(1)
    return x, y


def tapOnScreen(driver: appium_webdriver, x_per=0.93, y_per=0.29):
    # get screen size
    size = driver.get_window_size()
    # print(size)
    width = size['width']
    height = size['height']
    # convert percentages to pixels
    x = int(width * x_per)
    y = int(height * y_per)
    driver.tap([(x, y)])
    time.sleep(1)


def setBackgrounMusicVolume(driver, x_per=0.17, y_per=0.89):
    # Get screen size
    size = driver.get_window_size()
    width = size['width']
    height = size['height']
    # Convert percentages → pixels
    x = int(width * x_per)   # 17%
    y = int(height * y_per)  # 89%
    # Build tap gesture
    actions = ActionBuilder(driver, mouse=PointerInput("touch", "finger"))
    actions.pointer_action.move_to_location(x, y)
    actions.pointer_action.pointer_down()
    actions.pointer_action.pointer_up()
    actions.perform()
    time.sleep(1)



class ScrollLimitReached(Exception):
    """Raised when no more scrolling is possible."""
    pass

def _page_fingerprint(driver):
    return hashlib.md5(driver.page_source.encode("utf-8")).hexdigest()


def scroll_up(driver, percent=40):
    size = driver.get_window_size()
    width = size['width']
    height = size['height']

    scroll_px = height * (percent / 100)

    start_x = width // 2
    start_y = int((height / 2) - (scroll_px / 2))
    end_y   = int((height / 2) + (scroll_px / 2))

    before = _page_fingerprint(driver)
    try:
        actions = ActionBuilder(driver, mouse=PointerInput("touch", "finger"))
        finger = actions.pointer_action

        finger.move_to_location(start_x, start_y)
        finger.pointer_down()
        finger.move_to_location(start_x, end_y)
        finger.pointer_up()
        actions.perform()
        time.sleep(0.4)
        after = _page_fingerprint(driver)
        if before == after:
            raise ScrollLimitReached("Reached TOP – no more content to scroll up")

    except ScrollLimitReached:  raise Exception("SCROLL LIMIT: Scrolled To The Top Of Screen")
    except Exception as e: raise RuntimeError(f"Scroll up failed: {e}")

    
def scroll_down(driver, percent=40):
    size = driver.get_window_size()
    width = size['width']
    height = size['height']

    scroll_px = height * (percent / 100)

    start_x = width // 2
    start_y = int((height / 2) + (scroll_px / 2))
    end_y   = int((height / 2) - (scroll_px / 2))

    before = _page_fingerprint(driver)

    try:
        actions = ActionBuilder(driver, mouse=PointerInput("touch", "finger"))
        finger = actions.pointer_action

        finger.move_to_location(start_x, start_y)
        finger.pointer_down()
        finger.move_to_location(start_x, end_y)
        finger.pointer_up()
        actions.perform()
        time.sleep(0.4)
        after = _page_fingerprint(driver)
        if before == after:
            raise ScrollLimitReached("Reached BOTTOM – no more content to scroll down")

    except ScrollLimitReached: raise Exception("SCROLL LIMIT: Scrolled To The Bottom Of Screen")
    except Exception as e: raise RuntimeError(f"Scroll down failed: {e}")



def _get_scroll_center(driver, element=None):
    """Return center coordinates of window or element if provided."""
    if element:
        rect = element.rect
        center_x = rect['x'] + rect['width'] // 2
        center_y = rect['y'] + rect['height'] // 2
    else:
        size = driver.get_window_size()
        center_x = size['width'] // 2
        center_y = size['height'] // 2
    return center_x, center_y



def left_scroll(driver, percent=40, element=None):
    size = driver.get_window_size()
    width = size['width']

    scroll_px = width * (percent / 100)
    center_x, center_y = _get_scroll_center(driver, element)

    start_x = int(center_x + (scroll_px / 2))
    end_x   = int(center_x - (scroll_px / 2))
    start_y = center_y

    before = _page_fingerprint(driver)
    try:
        actions = ActionBuilder(driver, mouse=PointerInput("touch", "finger"))
        finger = actions.pointer_action

        finger.move_to_location(start_x, start_y)
        finger.pointer_down()
        finger.move_to_location(end_x, start_y)
        finger.pointer_up()
        actions.perform()
        time.sleep(0.4)

        after = _page_fingerprint(driver)
        if before == after: raise ScrollLimitReached("Reached LEFT – no more content to scroll left")

    except ScrollLimitReached: raise Exception("SCROLL LIMIT: Scrolled To The Left Edge Of Screen")
    except Exception as e: raise RuntimeError(f"Left scroll failed: {e}")



def right_scroll(driver, percent=40, element=None):
    size = driver.get_window_size()
    width = size['width']

    scroll_px = width * (percent / 100)
    center_x, center_y = _get_scroll_center(driver, element)

    start_x = int(center_x - (scroll_px / 2))
    end_x   = int(center_x + (scroll_px / 2))
    start_y = center_y

    before = _page_fingerprint(driver)
    try:
        actions = ActionBuilder(driver, mouse=PointerInput("touch", "finger"))
        finger = actions.pointer_action

        finger.move_to_location(start_x, start_y)
        finger.pointer_down()
        finger.move_to_location(end_x, start_y)
        finger.pointer_up()
        actions.perform()
        time.sleep(0.4)

        after = _page_fingerprint(driver)
        if before == after: raise ScrollLimitReached("Reached RIGHT – no more content to scroll right")

    except ScrollLimitReached: raise Exception("SCROLL LIMIT: Scrolled To The Right Edge Of Screen")
    except Exception as e: raise RuntimeError(f"Right scroll failed: {e}")
    

    

def lower_video_quality(input_file, output_dir="compressed_videos", qualities=None):
    """
    Create lower-quality versions of a video.
    Args:
        input_file (str): Path to the input video.
        output_dir (str): Directory to save converted videos.
        qualities (dict): Mapping of resolution name -> scale height (width auto).
        Example: {"720p": 720, "480p": 480, "360p": 360}
    """
    if qualities is None: qualities = {"720p": 720, "480p": 480, "360p": 360}
    if not os.path.exists(output_dir): os.makedirs(output_dir)

    base_name = os.path.splitext(os.path.basename(input_file))[0]
    output_files = {}

    for label, height in qualities.items():
        out_path = os.path.join(output_dir, f"{base_name}_{label}.mp4")
        try:
            (
                ffmpeg
                .input(input_file)
                .output(out_path, vf=f"scale=-2:{height}", vcodec="libx264", crf=28, preset="fast")
                .overwrite_output()
                .run(quiet=True)
            )
            output_files[label] = out_path
            # print(f"✅ Saved {label} video: {out_path}")
        except Exception as e: print(f"❌ Failed to create {label} version: {e}")
    return output_files



def push_video_to_android(video_path, device_id):
    try:
        # STEP 1: Push Video To Android Phone
        local_file = video_path
        # pushed_file = os.path.join(FILE_UPLOAD_FOLDER, f"Video_{random.randint(1111,9999)}.mp4")
        # output_ = lower_video_quality(local_file, FILE_UPLOAD_FOLDER, qualities = {"720p": 720})
        output_ = {'720p': local_file}
        remote_path = f"/storage/emulated/0/Download/{os.path.basename(output_['720p'])}"

        # Push file
        subprocess.run(["adb", "-s", device_id, "push", output_['720p'], remote_path])

        # Trigger MediaScanner
        subprocess.run([
            "adb", "-s", device_id, "shell", 
            "am", "broadcast", "-a", "android.intent.action.MEDIA_SCANNER_SCAN_FILE", 
            "-d", f"file://{remote_path}"
        ])
        return remote_path, output_
    except Exception as e:
        raise Exception(f"ERROR: Failed To Push Video To Android {device_id} PATH:{video_path}. \n{e} --Output: {output_}")



def remove_video_from_android(android_video, device_id):
    subprocess.run([
        "adb", "-s", device_id, "shell", 
        "rm", f"/storage/emulated/0/Download/{os.path.basename(android_video['720p'])}"
    ])



def get_screen_resolution(driver):
    """
    Get the current screen resolution from an Appium driver.
    Returns (width, height) as integers.
    """
    size = driver.get_window_size()
    width = size['width']
    height = size['height']
    return width, height


