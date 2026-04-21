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

from app.utils.tools import screenshot_element

config_env = Config.config_env


class YT_MUSIC_TOOL:

    def __init__(self, driver: appium_webdriver, device_id: str, isOverrideResolution: bool, totalRetries=2, is_youtube_premium=True):
        self.driver = driver
        self.device_id = device_id
        self.isOverrideResolution = isOverrideResolution
        self.totalRetries = totalRetries
        self.is_youtube_premium = is_youtube_premium
        self.screenWidth, self.screenHeight = get_screen_resolution(self.driver)


    def wake_device(self, device_ip: str):
        # Wake up the device if screen is off
        subprocess.run([Config.ADB_PATH, "-P", str(Config.ADB_PORT), "-s", device_ip, "shell", "input", "keyevent", "KEYCODE_WAKEUP"], env=config_env)
        # Dismiss keyguard if present
        subprocess.run([Config.ADB_PATH, "-P", str(Config.ADB_PORT), "-s", device_ip, "shell", "wm", "dismiss-keyguard"], env=config_env)

    

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


    def skip_ads(self):

        limit, skiped_ads = 0, 0
        while True:
            
            time.sleep(0.1)
            ads_objs = self.driver.find_elements(By.XPATH, SKIP_ADS_XPATH)
            if ads_objs:
                try:  
                    ads_objs[0].click()
                    limit = 0
                    skiped_ads += 1
                except Exception as e: pass
            
            self.startup_buy_premium_popup()

            if ads_objs: 
                try: self.driver.find_element(By.XPATH, CLOSE_AD_PANEL).click()
                except Exception as e: pass

            self.buy_premium_popup()
            
            limit += 1
            if limit >= 3: break
            else: continue
        return skiped_ads


    def startup_buy_premium_popup(self):
        try: self.driver.find_element(By.XPATH, CLOSE_PREMIUM_POPUP).click()
        except Exception as e: pass


    def buy_premium_popup(self):
        try: self.driver.find_element(By.XPATH, NO_THANKS_BUY_PREMIUM_BTN_XPATH).click()
        except Exception as e: pass


    def age_verification_popup(self):
        try:
            if self.driver.find_elements(By.XPATH, VERIFY_NOW_AGA_VERIFICATION_XPATH):
                self.driver.find_element(By.XPATH, NOT_NOW_AGA_VERIFICATION_XPATH).click()
        except: pass


    def inappropriate_content_popup(self):
        try:
            if self.driver.find_elements(By.XPATH, INAPPROPRIATE_POPUPP_XPATH):
                self.driver.find_element(By.XPATH, CONFIRM_BUTTON_XPATH).click()
        except Exception as e: pass
    

    def like_content_popup(self):
        try:
            if self.driver.find_elements(By.XPATH, LIKE_SONG_POPUP_XPATH):
                self.driver.find_element(By.XPATH, OK_BUTTON_TEXT_TRANSLATOR).click()
        except: pass


    def click_nav_home_button(self):

        nav_home_obj, xpaths = None, [ HOME_BUTTON_XPATH1, HOME_BUTTON_XPATH2]            
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
    


    def click_nav_library_button(self):

        nav_libray_obj, xpaths = None, [ LIBRARY_BUTTON_XPATH1, LIBRARY_BUTTON_XPATH2]            
        for xpath in xpaths:
            try:
                WebDriverWait(self.driver, timeout=7).until(EC.presence_of_element_located((By.XPATH, xpath)))
                nav_libray_obj = self.driver.find_element(By.XPATH, xpath)
                break
            except: continue
        if not nav_libray_obj: raise Exception(f"Failed to Click Navigation Home Button...")
        try:
            coordx, coordy = get_element_coord(nav_libray_obj, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.75)
            tempx, tempy = tapOnScreenCoord(self.driver, coordx, coordy, android_ip=self.device_id)
            return tempx, tempy, nav_libray_obj
        except Exception as e: raise Exception(f"Failed to Calculate Navigation Library Button Coordinates...")

        

    def click_home_page_search_button(self):

        search_icon_btn, xpaths = None, [ SEARCH_BUTTON_XPATH1, NAV_SEARCH_BUTTON_XPATH1, SEARCH_BUTTON_XPATH2, NAV_SEARCH_BUTTON_XPATH2]            
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
        


    def click_search_results_no_shuffle_(self):

        try:
            WebDriverWait(self.driver, timeout=12).until(EC.presence_of_element_located((By.XPATH, SEARCH_ACTION_MENU_XPATH)))
            search_action_button = self.driver.find_element(By.XPATH, SEARCH_ACTION_MENU_XPATH)
            coordx, coordy = get_element_coord(search_action_button, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.75)
            tempx, tempy = tapOnScreenCoord(self.driver, coordx, coordy, android_ip=self.device_id)
        except Exception as e: raise Exception(f"Failed! Click Action Button, {e}")

        try:
            WebDriverWait(self.driver, timeout=12).until(EC.presence_of_element_located((By.XPATH, SEARCH_BOTTOM_SHUFFLE_PLAY_BUTTON_XPATH)))
            search_bottom_shuffle_button = self.driver.find_element(By.XPATH, SEARCH_BOTTOM_SHUFFLE_PLAY_BUTTON_XPATH)
            coordx, coordy = get_element_coord(search_bottom_shuffle_button, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.75)
            tempx, tempy = tapOnScreenCoord(self.driver, coordx, coordy, android_ip=self.device_id)
            return tempx, tempy, search_bottom_shuffle_button
        except Exception as e: raise Exception(f"Failed! Click Shuffle Play Button, {e}")



    def click_search_results_shuffle_button(self):
        try:
            shuffle_play_btn, xpaths = None, [ SHUFFLE_PLAY_BUTTON_XPATH1, SHUFFLE_PLAY_BUTTON_XPATH1]            
            for xpath in xpaths:
                try:
                    WebDriverWait(self.driver, timeout=12).until(EC.presence_of_element_located((By.XPATH, xpath)))
                    shuffle_play_btn = self.driver.find_element(By.XPATH, xpath)
                    break
                except: continue

            if not shuffle_play_btn: raise Exception(f"Failed to Click 'Shuffle' Button From Results...")
            
            try:
                coordx, coordy = get_element_coord(shuffle_play_btn, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.75)
                tempx, tempy = tapOnScreenCoord(self.driver, coordx, coordy, android_ip=self.device_id)
                return tempx, tempy, shuffle_play_btn
            except Exception as e: raise Exception(f"Failed! Click Shuffle Play Button, {e}")
        except:
            try: return self.click_search_results_no_shuffle_()
            except: raise


    def click_search_results_featured_box(self, click_search_results_no_shuffle_=True,  profile_image_path=None):

        similarity_score = 0.0
        temp_image_path = os.path.join(Config.DATABASE_DIR, "images", "tmp",  f"{os.path.basename(profile_image_path)}_{random.randint(1111, 9999)}_featured__similarity_check.png") if profile_image_path else None

        try:
            shuffle_play_btn, xpaths = None, [ SEARCH_RESULT_FEATURED_BOX_XPATH1, SEARCH_RESULT_FEATURED_BOX_XPATH2, SEARCH_RESULT_FEATURED_BOX_XPATH3]            
            for xpath in xpaths:
                try:
                    WebDriverWait(self.driver, timeout=10).until(EC.presence_of_element_located((By.XPATH, xpath)))
                    shuffle_play_btn = self.driver.find_element(By.XPATH, xpath)
                    break
                except: continue

            if not shuffle_play_btn: raise Exception(f"Failed to Click Featured Box From Results...")
            coordx, coordy = get_element_coord(shuffle_play_btn, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.75)

            if profile_image_path:
                thumbnail_obj = shuffle_play_btn.find_element( By.XPATH, ".//android.view.ViewGroup[1]/android.widget.ImageView" )
                coordx, coordy = get_element_coord(thumbnail_obj, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.75)
                screenshot_element(self.driver, thumbnail_obj, temp_image_path)
                similarity_score = compare_images(profile_image_path, temp_image_path)
                print("Similarity Score: ", similarity_score)
                if similarity_score < 0.45: raise Exception(f"Failed To Compare Profile Image! Similarity Score: {similarity_score}" )

            try:
                tempx, tempy = tapOnScreenCoord(self.driver, coordx, coordy, android_ip=self.device_id)
                return tempx, tempy, shuffle_play_btn
            except Exception as e: raise Exception(f"Failed! Click Featured Box, {e}")

        except:
            if click_search_results_no_shuffle_:
                try: return self.click_search_results_no_shuffle_()
                except: raise
            else: raise
        
        finally:
            try: 
                if temp_image_path: os.remove(temp_image_path)
            except: pass


    def click_matched_search_profile(self, profile_image_path=None):

        similarity_score = 0.0
        coordx, coordy = 0, 0
        target_obj = None
        temp_image_path = os.path.join(Config.DATABASE_DIR, "images", "tmp",  f"{os.path.basename(profile_image_path)}_{random.randint(1111, 9999)}_profile_similarity_check.png") if profile_image_path else None

        try:
            search_thumbnails_results, xpaths = None, [ SEARCH_RESULTS_THUMBNAILS_XPATH ]            
            WebDriverWait(self.driver, timeout=10).until(EC.presence_of_all_elements_located((By.XPATH, SEARCH_RESULTS_THUMBNAILS_XPATH)))
            search_thumbnails_results = self.driver.find_elements(By.XPATH, SEARCH_RESULTS_THUMBNAILS_XPATH)
            if not search_thumbnails_results: raise Exception(f"No Results Found...")

            for thumbnail_obj in search_thumbnails_results:
                temp_coordx, temp_coordy = get_element_coord(thumbnail_obj, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.75)
                screenshot_element(self.driver, thumbnail_obj, temp_image_path)
                temp_similarity_score = compare_images(profile_image_path, temp_image_path)

                if temp_similarity_score > similarity_score: 
                    similarity_score = temp_similarity_score
                    coordx, coordy = temp_coordx, temp_coordy
                    target_obj = thumbnail_obj
            
            if similarity_score < 0.45: raise Exception(f"Failed To Compare Profile Image! Similarity Score: {similarity_score}" )

            try:
                tempx, tempy = tapOnScreenCoord(self.driver, coordx, coordy, android_ip=self.device_id)
                return tempx, tempy, target_obj
            except Exception as e: raise Exception(f"Failed! Click Target Profile, {e}")

        except: raise
        
        finally:
            try: 
                if temp_image_path: os.remove(temp_image_path)
            except: pass
    

    def click_play_all_button(self, click_search_results_no_shuffle_=True):
        try:
            shuffle_play_btn, xpaths = None, [ TARGET_PLAYALL_BUTTON_XPATH]            
            for xpath in xpaths:
                try:
                    WebDriverWait(self.driver, timeout=12).until(EC.presence_of_all_elements_located((By.XPATH, xpath)))
                    shuffle_play_btn = self.driver.find_elements(By.XPATH, xpath)
                    shuffle_play_btn = (
                        shuffle_play_btn[1] if len(shuffle_play_btn) > 1
                        else shuffle_play_btn[0] if shuffle_play_btn
                        else None
                    )
                    break
                except: continue

            if not shuffle_play_btn: raise Exception(f"Failed to Click 'Play All' Button From Results...")
            
            try:
                coordx, coordy = get_element_coord(shuffle_play_btn, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.75)
                tempx, tempy = tapOnScreenCoord(self.driver, coordx, coordy, android_ip=self.device_id)
                return tempx, tempy, shuffle_play_btn
            except Exception as e: raise Exception(f"Failed! Click 'Play All' Button, {e}")
        except:
            if click_search_results_no_shuffle_:
                try: return self.click_search_results_no_shuffle_()
                except: raise
            else: raise



    def click_player_artist_name(self):
        player_artist_btn, xpaths = None, [ PLAYER_ARTIST_NAME_XPATH1, PLAYER_ARTIST_NAME_XPATH2]            
        for xpath in xpaths:
            try:
                WebDriverWait(self.driver, timeout=12).until(EC.presence_of_element_located((By.XPATH, xpath)))
                player_artist_btn = self.driver.find_element(By.XPATH, xpath)
                break
            except: continue

        if not player_artist_btn: raise Exception(f"Failed to Click Player 'Artist' Button...")
        try:
            coordx, coordy = get_element_coord(player_artist_btn, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.75)
            tempx, tempy = tapOnScreenCoord(self.driver, coordx, coordy, android_ip=self.device_id)
            return tempx, tempy, player_artist_btn
        except Exception as e: raise Exception(f"Failed! Click Player Artist Button Failed, {e}")



    def click_player_shuffle_button(self):
        isShuffled, shuffle_btn_obj = True, None
        tempx, tempy = 0, 0
        try: WebDriverWait(self.driver, timeout=10).until(EC.presence_of_element_located((By.XPATH, PLAYER_SHUFFLE_INDICATOR_XPATH1)))
        except: isShuffled = False

        try:
            if not isShuffled:       
                shuffle_btn_obj = self.driver.find_element(By.XPATH, PLAYER_SHUFFLE_XPATH1)
                coordx, coordy = get_element_coord(shuffle_btn_obj, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.75)
                tempx, tempy = tapOnScreenCoord(self.driver, coordx, coordy, android_ip=self.device_id)
            return tempx, tempy, shuffle_btn_obj, isShuffled
        except Exception as e: raise Exception(f"Failed! Click Player Shuffle Button Failed, {e}")



    def click_player_loop_button(self):
        try:
            reqeat_btn_obj = self.driver.find_element(By.XPATH, PLAYER_REPEAT_XPATH1)
            reqeat_btn_x, reqeat_btn_y = get_element_coord(reqeat_btn_obj, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.75)
            tempx, tempy = tapOnScreenCoord(self.driver, reqeat_btn_x, reqeat_btn_y, android_ip=self.device_id)
            return tempx, tempy, reqeat_btn_obj
        except Exception as e: raise Exception(f"Failed! Click Player Repeat Button Failed, {e}")



    def click_player_palyer_button(self):
        player_play_btn, xpaths = None, [ PLAYER_PLAY_XPATH1, PLAYER_PLAY_XPATH2]            
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



    def click_player_next_button(self):
        player_next_play_btn, xpaths = None, [ PLAYER_NEXT_XPATH1, PLAYER_NEXT_XPATH2]            
        for xpath in xpaths:
            try:
                WebDriverWait(self.driver, timeout=12).until(EC.presence_of_element_located((By.XPATH, xpath)))
                player_next_play_btn = self.driver.find_element(By.XPATH, xpath)
                break
            except: continue

        if not player_next_play_btn: raise Exception(f"Failed to Click Player 'Next' Button...")
        try:
            coordx, coordy = get_element_coord(player_next_play_btn, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.75)
            tempx, tempy = tapOnScreenCoord(self.driver, coordx, coordy, android_ip=self.device_id)
            return tempx, tempy, player_next_play_btn
        except Exception as e: raise Exception(f"Failed! Click Player Next Button Failed, {e}")



    def click_player_like_button(self):
        player_like_btn, xpaths = None, [ PLAYER_LIKE_MUSIC_XPATH ]            
        for xpath in xpaths:
            try:
                WebDriverWait(self.driver, timeout=12).until(EC.presence_of_element_located((By.XPATH, xpath)))
                player_like_btn = self.driver.find_element(By.XPATH, xpath)
                break
            except: continue

        if not player_like_btn: return # raise Exception(f"Failed to Click Player 'Next' Button...")
        try:
            coordx, coordy = get_element_coord(player_like_btn, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.75)
            tempx, tempy = tapOnScreenCoord(self.driver, coordx, coordy, android_ip=self.device_id)
            return tempx, tempy, player_like_btn
        except Exception as e: raise Exception(f"Failed! Click Player Like Button Failed, {e}")



    def generate_music_skipping_rates(self):
        random_skipping_rates, rates_avg = generate_skipping_rates(
            Config.SKIPPING_RATES_COUNT if self.is_youtube_premium else Config.FREE_YOUTUBE_SKIPPING_RATES_COUNT,
            Config.SKIPPING_LOW_RANGE   if self.is_youtube_premium else Config.FREE_YOUTUBE_SKIPPING_LOW_RANGE,
            Config.SKIPPING_HIGH_RANGE  if self.is_youtube_premium else Config.FREE_YOUTUBE_SKIPPING_HIGH_RANGE,
            Config.SKIPPING_HIGH_COUNT  if self.is_youtube_premium else Config.FREE_YOUTUBE_SKIPPING_HIGH_COUNT,
            Config.SKIPPING_AVG_RANGE   if self.is_youtube_premium else Config.FREE_YOUTUBE_SKIPPING_AVG_RANGE
        )
        return random_skipping_rates, rates_avg



    def selecting_community_playlist_filter_SEARCH(self):
        while True:
            try:
                WebDriverWait(self.driver, timeout=5).until(EC.presence_of_element_located((By.XPATH, SEARCH_FILTERS_COMMUNITY_PL_XPATH1)))
                filter_obj = self.driver.find_element(By.XPATH, SEARCH_FILTERS_COMMUNITY_PL_XPATH1)
                coordx, coordy = get_element_coord(filter_obj, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.75)
                tempx, tempy = tapOnScreenCoord(self.driver, coordx, coordy, android_ip=self.device_id)
                return tempx, tempy, filter_obj
            except Exception as e:
                if "Invalid coordinates or element" in str(e): raise Exception(f"Failed! Click Community Playlist Filter, {e}")
                filter_box = self.driver.find_element(By.XPATH, SEARCH_FILTERS_BOX_XPATH1)
                left_scroll(self.driver, percent=20, element=filter_box)
    

    def selecting_albums_filter_SEARCH(self):
        while True:
            try:
                WebDriverWait(self.driver, timeout=5).until(EC.presence_of_element_located((By.XPATH, SEARCH_FILTERS_ALBUMS_XPATH1)))
                filter_obj = self.driver.find_element(By.XPATH, SEARCH_FILTERS_ALBUMS_XPATH1)
                coordx, coordy = get_element_coord(filter_obj, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.75)
                tempx, tempy = tapOnScreenCoord(self.driver, coordx, coordy, android_ip=self.device_id)
                return tempx, tempy, filter_obj
            except Exception as e:
                if "Invalid coordinates or element" in str(e): raise Exception(f"Failed! Click Albums Filter, {e}")
                filter_box = self.driver.find_element(By.XPATH, SEARCH_FILTERS_BOX_XPATH1)
                left_scroll(self.driver, percent=20, element=filter_box)
    

    def selecting_artists_filter_SEARCH(self):
        while True:
            try:
                WebDriverWait(self.driver, timeout=5).until(EC.presence_of_element_located((By.XPATH, SEARCH_FILTERS_ARTISTS_XPATH1)))
                filter_obj = self.driver.find_element(By.XPATH, SEARCH_FILTERS_ARTISTS_XPATH1)
                coordx, coordy = get_element_coord(filter_obj, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.75)
                tempx, tempy = tapOnScreenCoord(self.driver, coordx, coordy, android_ip=self.device_id)
                return tempx, tempy, filter_obj
            except Exception as e:
                if "Invalid coordinates or element" in str(e): raise Exception(f"Failed! Click Albums Filter, {e}")
                filter_box = self.driver.find_element(By.XPATH, SEARCH_FILTERS_BOX_XPATH1)
                left_scroll(self.driver, percent=20, element=filter_box)



    def loop_through_results(self, playlist_name, profile_image_path=None):
        current_scroll = 1
        scroll_limit = Config.SCROLL_DOWN_LIMIT
        similarity_score = 0.0
        coordx, coordy = 0, 0
        temp_image_path = os.path.join(Config.DATABASE_DIR, "images", "tmp",  f"{os.path.basename(profile_image_path)}_similarity_check.png") if profile_image_path else None

        while True: 
            try: 
                print(playlist_name)
                WebDriverWait(self.driver, timeout=5).until(EC.presence_of_element_located((By.XPATH, LIBRARY_SEARCH_PLAYLIST(playlist_name))))
                playlist_obj = self.driver.find_elements(By.XPATH, LIBRARY_SEARCH_PLAYLIST(playlist_name))
                if not playlist_obj: raise Exception("No Mactching Target Found During Search")
                if not profile_image_path: playlist_obj = [playlist_obj[0]]
                
                for target in playlist_obj:
                    temp_coordx, temp_coordy = get_element_coord(target, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.75)

                    if profile_image_path:
                        thumbnail_obj = target.find_element( By.XPATH, ".//android.widget.ImageView[contains(@resource-id, 'thumbnail')]" )
                        screenshot_element(self.driver, thumbnail_obj, temp_image_path)
                        temp_similarity_score = compare_images(profile_image_path, temp_image_path)
                        if temp_similarity_score > similarity_score:
                            similarity_score = temp_similarity_score
                            coordx, coordy = temp_coordx, temp_coordy
                    else: coordx, coordy = temp_coordx, temp_coordy

                if profile_image_path:
                    if similarity_score < 0.55: raise Exception(f"Similarity Scrore Less than 0.45: {similarity_score}")
                    print("Testing Similarity Score: ", similarity_score)

                tempx, tempy = tapOnScreenCoord(self.driver, coordx, coordy, android_ip=self.device_id)
                try: os.remove(temp_image_path)
                except: pass
                return tempx, tempy, playlist_obj
                    
            except Exception as e: 
                print(e)
                if "Invalid coordinates or element" in str(e): raise Exception(f"Failed! Click Playlist, {e}")
                if current_scroll >= scroll_limit: raise Exception("Scroll Down Limit Hit! Cannot Find PlayList...")
                else: current_scroll += 1
                try: scroll_down(self.driver, percent=25)
                except: raise Exception(f"No Results Found With Name [{playlist_name}]! SCROLL LIMIT REACHED... {e}")
            
            finally:
                try:
                    if temp_image_path: os.remove(temp_image_path)
                except: pass

    

    def click_play_button_PLAYLIST_SERACH(self):
        try:
            WebDriverWait(self.driver, timeout=5).until(EC.presence_of_element_located((By.XPATH, LIBRARY_PLAYLIST_PLAY_BUTTON_XPATH)))
            playlist_play_obj = self.driver.find_element(By.XPATH, LIBRARY_PLAYLIST_PLAY_BUTTON_XPATH)
            coordx, coordy = get_element_coord(playlist_play_obj, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.75)
            tempx, tempy = tapOnScreenCoord(self.driver, coordx, coordy, android_ip=self.device_id)
            return tempx, tempy, playlist_play_obj
        except Exception as e: raise Exception(f"Failed! Click Playlist Play Button, {e}")



    def click_action_menu_button_SERACH(self, firstActionButton=False):

        xpaths =  [ 
            ACTION_MENU_BUTTON_XPAHT1, 
            ACTION_MENU_BUTTON_XPAHT2 
            ] if not firstActionButton else [ 
            FIRST_ACTION_MENU_BUTTON_XPAHT1, 
            FIRST_ACTION_MENU_BUTTON_XPAHT2 
            ]
        
        action_menu_obj = None, 
            
        for xpath in xpaths:
            try:
                WebDriverWait(self.driver, timeout=12).until(EC.presence_of_element_located((By.XPATH, xpath)))
                action_menu_obj = self.driver.find_element(By.XPATH, xpath)
                break
            except: continue
        
        try:
            coordx, coordy = get_element_coord(action_menu_obj, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.75)
            tempx, tempy = tapOnScreenCoord(self.driver, coordx, coordy, android_ip=self.device_id)
            return tempx, tempy, action_menu_obj
        except Exception as e: raise Exception(f"Failed! Click Action Menu Button, {e}")



    def click_shuffle_from_action_menu_SERACH(self):
        try:
            WebDriverWait(self.driver, timeout=5).until(EC.presence_of_element_located((By.XPATH, ACTIION_MENU_SHUFFLE_PLAY_BUTTON)))
            action_menu_shuffle_obj = self.driver.find_element(By.XPATH, ACTIION_MENU_SHUFFLE_PLAY_BUTTON)
            coordx, coordy = get_element_coord(action_menu_shuffle_obj, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.75)
            tempx, tempy = tapOnScreenCoord(self.driver, coordx, coordy, android_ip=self.device_id)
            return tempx, tempy, action_menu_shuffle_obj
        except Exception as e: raise Exception(f"Failed! Click Action Menu Shuffle Button, {e}")
    

    def click_mix_from_action_menu_SERACH(self):
        try:
            WebDriverWait(self.driver, timeout=5).until(EC.presence_of_element_located((By.XPATH, START_MIX_BUTTON_XPATH)))
            action_menu_mix_obj = self.driver.find_element(By.XPATH, START_MIX_BUTTON_XPATH)
            coordx, coordy = get_element_coord(action_menu_mix_obj, self.screenWidth, self.screenHeight, self.isOverrideResolution, scale=0.75)
            tempx, tempy = tapOnScreenCoord(self.driver, coordx, coordy, android_ip=self.device_id)
            return tempx, tempy, action_menu_mix_obj
        except Exception as e: raise Exception(f"Failed! Click Action Menu Shuffle Button, {e}")



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
        

    def get_all_library_saved_content(self):
        current_scroll = 1
        scroll_limit = Config.SCROLL_DOWN_LIMIT
        unique_results = set()

        while True: 
            try: 
                WebDriverWait(self.driver, timeout=5).until(EC.presence_of_all_elements_located((By.XPATH, LIBRARY_RESULTS_LIST)))
                results_list = self.driver.find_elements(By.XPATH, LIBRARY_RESULTS_LIST)
                for res in results_list: unique_results.add(res.get_attribute('text').strip())
                
                try: scroll_down(self.driver, percent=25)
                except Exception as e: return list(unique_results)
                
            except Exception as e: 
                if "Invalid coordinates or element" in str(e): raise Exception(f"Failed! Click Playlist, {e}")
                return list(unique_results)
                # if current_scroll >= scroll_limit: raise Exception("Scroll Down Limit Hit! Cannot Find PlayList...")
                # else: current_scroll += 1


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
                    subprocess.run([Config.ADB_PATH, "-P", str(Config.ADB_PORT), "-s", self.device_id, "shell", "input", "keyevent", "KEYCODE_BACK"], env=config_env)
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
