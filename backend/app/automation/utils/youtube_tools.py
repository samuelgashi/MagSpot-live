import os
import random
import subprocess
from app.config import Config
from app.automation.utils.tools import *
from app.repositories.tasks_repo import *
from app.automation.utils.yt_xpaths import *
from app.automation.utils.driver_utils import *
from app.automation.utils.HumanVolumer import HumanVolumer

from appium import webdriver as appium_webdriver
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

class YOUTUBE_APP:

    def __init__(self, driver: appium_webdriver, device_id: str, isOverrideResolution: bool, totalRetries=2, is_youtube_premium=True):
        self.driver = driver
        self.device_id = device_id
        self.isOverrideResolution = isOverrideResolution
        self.totalRetries = totalRetries
        self.is_youtube_premium = is_youtube_premium
        self.screenWidth, self.screenHeight = get_screen_resolution(self.driver)


    def wake_device(self, device_ip: str):
        # Wake up the device if screen is off
        subprocess.run(["adb", "-s", device_ip, "shell", "input", "keyevent", "KEYCODE_WAKEUP"])
        # Dismiss keyguard if present
        subprocess.run(["adb", "-s", device_ip, "shell", "wm", "dismiss-keyguard"])

    

    def perform_action(self, func_name, *args, total_retries=None, **kwargs):
        retryAttempt = 0
        total_retries = total_retries if total_retries else self.totalRetries
        
        while True:
            try:
                func = getattr(self, func_name)
                return func(*args, **kwargs)
            except Exception as e:
                if retryAttempt >= total_retries: raise Exception(f"Action '{func_name}' failed after {total_retries} retries. {e}")
                retryAttempt += 1
                self.wake_device(self.device_id)



    def click_nav_home_button(self):

        nav_home_obj, xpaths = None, [YOUTUBE_NAV_HOME_BUTTON_XPATH1, YOUTUBE_NAV_HOME_BUTTON_XPATH2]            
        for xpath in xpaths:
            try:
                WebDriverWait(self.driver, timeout=7).until(EC.presence_of_element_located((By.XPATH, xpath)))
                nav_home_obj = self.driver.find_element(By.XPATH, xpath)
                break
            except: continue
        if not nav_home_obj: raise Exception(f"Failed to Click Navigation Home Button...")
        try:
            coordx, coordy = get_element_coord(nav_home_obj, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.75)
            tempx, tempy = tapOnScreenCoord(self.driver, coordx, coordy, android_ip=self.device_id)
            return tempx, tempy, nav_home_obj
        except Exception as e: raise Exception(f"Failed to Calculate Navigation Home Button Coordinates...")
    


    def click_nav_shorts_button(self):

        nav_libray_obj, xpaths = None, [ YOUTUBE_NAV_SHORTS_XPATH1, YOUTUBE_NAV_SHORTS_XPATH2]            
        for xpath in xpaths:
            try:
                WebDriverWait(self.driver, timeout=7).until(EC.presence_of_element_located((By.XPATH, xpath)))
                nav_libray_obj = self.driver.find_element(By.XPATH, xpath)
                break
            except: continue
        if not nav_libray_obj: raise Exception(f"Failed to Click Navigation Shorts Button...")
        try:
            coordx, coordy = get_element_coord(nav_libray_obj, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.75)
            tempx, tempy = tapOnScreenCoord(self.driver, coordx, coordy, android_ip=self.device_id)
            return tempx, tempy, nav_libray_obj
        except Exception as e: raise Exception(f"Failed to Calculate Navigation Library Button Coordinates...")

        

    def click_home_page_search_button(self):

        search_icon_btn, xpaths = None, [ YOUTUBE_NAV_SEARCH_XPATH1 ]            
        for xpath in xpaths:
            try:
                WebDriverWait(self.driver, timeout=7).until(EC.presence_of_element_located((By.XPATH, xpath)))
                search_icon_btn = self.driver.find_element(By.XPATH, xpath)
                break
            except: continue
        if not search_icon_btn: raise Exception("Failed to Click Search Icon...")

        try:
            coordx, coordy = get_element_coord(search_icon_btn, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.75)
            tempx, tempy = tapOnScreenCoord(self.driver, coordx, coordy, android_ip=self.device_id)
            return tempx, tempy, search_icon_btn
        except Exception as e: raise Exception(f"Failed to Click Navigation Search Button Coordinates...")
    


    def click_and_serach_yt_directory(self, artist_name):
        search_inp_obj, xpaths = None, [ SEARCH_INPUT_XPATH1, SEARCH_INPUT_XPATH2]            
        for xpath in xpaths:
            try:
                WebDriverWait(self.driver, timeout=7).until(EC.presence_of_element_located((By.XPATH, xpath)))
                search_inp_obj = self.driver.find_element(By.XPATH, xpath)
                break
            except: continue
            
        if not search_inp_obj: raise Exception(f"Failed to Find Search Input Box...")
        coordx, coordy = get_element_coord(search_inp_obj, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.80)

        try: 
            search_inp_obj.click()
            HumanTyper(self.driver).type_text(artist_name)
            self.driver.execute_script("mobile: performEditorAction", {
                "action": "search"
            })
        except Exception as e: raise Exception(f"Failed to Type Artist Name...")
        # tempx, tempy = tapOnScreenCoord(self.driver, coordx, coordy, android_ip=self.device_id)
        return coordx, coordy, search_inp_obj



    def click_player_like_button(self):
        try:
            reqeat_btn_obj = self.driver.find_element(By.XPATH, YOUTUBE_LIKE_BUTTON_XPATH)
            reqeat_btn_x, reqeat_btn_y = get_element_coord(reqeat_btn_obj, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.75)
            tempx, tempy = tapOnScreenCoord(self.driver, reqeat_btn_x, reqeat_btn_y, android_ip=self.device_id)
            return tempx, tempy, reqeat_btn_obj
        except Exception as e: raise Exception(f"Failed! Click Player Repeat Button Failed, {e}")



    def click_player_dislike_button(self):
        player_play_btn, xpaths = None, [ PLAYER_PLAY_XPATH1, YOUTUBE_DISLIKE_BUTTON_XPATH]            
        for xpath in xpaths:
            try:
                WebDriverWait(self.driver, timeout=12).until(EC.presence_of_element_located((By.XPATH, xpath)))
                player_play_btn = self.driver.find_element(By.XPATH, xpath)
                break
            except: continue

        if not player_play_btn: raise Exception(f"Failed to Click Player 'Next' Button...")
        try:
            coordx, coordy = get_element_coord(player_play_btn, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.75)
            tempx, tempy = tapOnScreenCoord(self.driver, coordx, coordy, android_ip=self.device_id)
            return tempx, tempy, player_play_btn
        except Exception as e: raise Exception(f"Failed! Click Player Play Button Failed, {e}")



    def generate_music_skipping_rates(self):
        random_skipping_rates, rates_avg = generate_skipping_rates(
            Config.SKIPPING_RATES_COUNT if self.is_youtube_premium else Config.FREE_YOUTUBE_SKIPPING_RATES_COUNT,
            Config.SKIPPING_LOW_RANGE   if self.is_youtube_premium else Config.FREE_YOUTUBE_SKIPPING_LOW_RANGE,
            Config.SKIPPING_HIGH_RANGE  if self.is_youtube_premium else Config.FREE_YOUTUBE_SKIPPING_HIGH_RANGE,
            Config.SKIPPING_HIGH_COUNT  if self.is_youtube_premium else Config.FREE_YOUTUBE_SKIPPING_HIGH_COUNT,
            Config.SKIPPING_AVG_RANGE   if self.is_youtube_premium else Config.FREE_YOUTUBE_SKIPPING_AVG_RANGE
        )
        return random_skipping_rates, rates_avg




    def launch_app(self, package, activity):
        result = subprocess.run(
            [
                "adb", "-s", self.device_id,
                "shell", "am", "start",
                "-n", f"{package}/{activity}",
                "-a", "android.intent.action.MAIN",
                "-c", "android.intent.category.LAUNCHER",
                "-f", "0x10200000"
            ],
            capture_output=True,
            text=True
        )
        time.sleep(1)
        return True
        

    def switch_to_home_page(self, APP_PACKAGE_ID, APP_ACTIVITY_ID):

        for i in range(3):

            isOnPlayScreen = False
            isOnHomeScreen = False

            try:
                if not isOnPlayScreen:     
                    try: 
                        WebDriverWait(self.driver, timeout=4).until(EC.presence_of_element_located((By.XPATH, PLAYER_NEXT_XPATH1)))
                        isOnHomeScreen, isOnPlayScreen = False, True
                    except: pass
                
                if not isOnPlayScreen:
                    try: 
                        WebDriverWait(self.driver, timeout=4).until(EC.presence_of_element_located((By.XPATH, PLAYER_NEXT_XPATH2)))
                        isOnHomeScreen, isOnPlayScreen = False, True
                    except: pass

                if isOnPlayScreen: 
                    subprocess.run(["adb", "-s", self.device_id, "shell", "input", "keyevent", "KEYCODE_BACK"])
                    time.sleep(3)
                
                if not isOnHomeScreen: 
                    try: 
                        WebDriverWait(self.driver, timeout=4).until(EC.presence_of_element_located((By.XPATH, HOME_BUTTON_XPATH1)))
                        isOnHomeScreen, isOnPlayScreen = True, False
                    except: pass
                
                if not isOnHomeScreen: 
                    try: 
                        WebDriverWait(self.driver, timeout=4).until(EC.presence_of_element_located((By.XPATH, HOME_BUTTON_XPATH2)))
                        isOnHomeScreen, isOnPlayScreen = True, False
                    except: pass

                if isOnHomeScreen: return True

            except Exception as e: 
                try: self.launch_app(APP_PACKAGE_ID, APP_ACTIVITY_ID) 
                except Exception as inner_e: 
                    raise Exception(f"Failed To Launch App Again: {inner_e}")