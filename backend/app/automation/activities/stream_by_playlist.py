import os
import random
import subprocess
from app.automation.utils.driver_utils import *
from app.repositories.tasks_repo import *
from app.automation.utils.yt_xpaths import *
from app.automation.utils.tools import *
from app.config import Config
from app.automation.utils.yt_music_tools import *
from app.automation.utils.HumanVolumer import HumanVolumer
# from configs import *
# from automation.handlers.tasks import *
# from api.channels.tools  import *


class STREAM_BY_PLAYLIST:

    def __init__(self, driver, user_id, android_id, task_id, is_youtube_premium, isOverrideResolution, cancel_event):
        self.driver = driver
        self.user_id = user_id
        self.device_id = android_id
        self.task_id = task_id
        self.is_youtube_premium = is_youtube_premium
        self.cancel_event = cancel_event
        self.isOverrideResolution =  isOverrideResolution
        self.HumanVolumer_ = HumanVolumer(android_id)
        self.YT_MUSIC_TOOL_ = YT_MUSIC_TOOL(driver, android_id, isOverrideResolution, is_youtube_premium=is_youtube_premium)
        self.current_path = os.path.dirname(os.path.abspath(__file__))
        

    def checkPlayHours(self, max_duration, start_time):
        if max_duration is not None and (time.monotonic() - start_time) >= max_duration: 
            update_task(
                self.user_id, 
                self.task_id, progress=99, 
                status="COMPLETED", 
                log=f"*** Hours Play Kill Switch Triggered [{max_duration/3600}] Hours"
            )
            self.YT_MUSIC_TOOL_.switch_to_home_page(Config.YT_MUSIC_PACKAGE_NAME, Config.YT_MUSIC_ACTIVITY_NAME)
            time.sleep(1)
            return True
        else: return False 
        


    def check_kill_events(self):
        if self.cancel_event.is_set():
            raise Exception("CANCELLED: Task Cancelled By User")
        
        

    def start_stream_by_playlist(self, playlist_name, play_hours=10): 
        try:
            
            if not isinstance(play_hours, (int, float)):
                raise ValueError("play_hours must be an integer or float")

            start_time = time.monotonic() 
            max_duration = None 
            if play_hours is not None:  max_duration = play_hours * 3600
            screenWidth, screenHeight = get_screen_resolution(self.driver)

            self.check_kill_events()
            if self.checkPlayHours(max_duration, start_time): return

            if not self.is_youtube_premium:
                time.sleep(2)
                self.YT_MUSIC_TOOL_.startup_buy_premium_popup()
                update_task(self.user_id, self.task_id, progress=19, status="RUNNING", log=f"--> Looking For YouTube Premium Popup...")
                

            # STEP 1: Click Home Tab...
            try: 
                coordx, coordy, elem_obj = self.YT_MUSIC_TOOL_.perform_action("click_nav_home_button")
                update_task(self.user_id, self.task_id, progress=20, status="RUNNING", log=f"--> Clicking Home Tab [Coords: {coordx}, {coordy}]...")
            except: raise

            self.check_kill_events()
            if self.checkPlayHours(max_duration, start_time): return
            time.sleep(random.uniform(1, 3))
            


            # STEP 2: Clicking Search Icon...
            try: 
                coordx, coordy, elem_obj = self.YT_MUSIC_TOOL_.perform_action("click_home_page_search_button")
                update_task(self.user_id, progress=25, task_id=self.task_id, status="RUNNING", log=f"--> Clicking Search Icon [Coords: {coordx}, {coordy}]...") 
            except: raise
            
            self.check_kill_events()
            if self.checkPlayHours(max_duration, start_time): return
            time.sleep(random.uniform(1, 3))
                

            
            # STEP 3: Typing Artist Name...
            try:
                coordx, coordy, elem_obj = self.YT_MUSIC_TOOL_.perform_action("click_and_serach_yt_directory", playlist_name)
                update_task(self.user_id, progress=26, task_id=self.task_id, status="RUNNING", log=f"--> Clicking Search Box & Typing Search Input [{playlist_name}] [Coords {coordx}, {coordy}]...")
                # update_task(self.user_id, progress=27, task_id=self.task_id, status="RUNNING", log=f"--> Clicking Search Input Box [Coords {coordx}, {coordy}]......") 
                # self.YT_MUSIC_TOOL_.serach_yt_directory(elem_obj, artist_name)
            except: raise

            self.check_kill_events()
            if self.checkPlayHours(max_duration, start_time): return
            time.sleep(random.uniform(3, 8))



            # STEP 4: Selecting "Community Playlist" from filters...
            try:
                coordx, coordy, elem_obj = self.YT_MUSIC_TOOL_.perform_action("selecting_community_playlist_filter_SEARCH")
                update_task(self.user_id, self.task_id, progress=27, status="RUNNING", log=f"--> Selecting 'Community Playlist' from filters [Coord {coordx}, {coordy}]...")
            except: raise

            self.check_kill_events()
            if self.checkPlayHours(max_duration, start_time): return
            time.sleep(random.uniform(2, 5))



            # STEP 5: Finding Playlist...
            try:
                update_task(self.user_id, self.task_id, progress=29, status="RUNNING", log=f"--> Finding Playlist...")
                coordx, coordy, elem_obj = self.YT_MUSIC_TOOL_.perform_action("loop_through_results", playlist_name)
                update_task(self.user_id, self.task_id, progress=28, status="RUNNING", log=f"--> Clicking Playlist [{playlist_name}] [Coord {coordx}, {coordy}]...")
            except: raise

            self.check_kill_events()
            if self.checkPlayHours(max_duration, start_time): return
            time.sleep(random.uniform(1.5, 3.5))
            


            # STEP 6: Clicking Shuffle From Action Menu...
            try: 
                coordx, coordy, elem_obj = self.YT_MUSIC_TOOL_.perform_action("click_action_menu_button_SERACH")
                update_task(self.user_id, self.task_id, progress=32, status="RUNNING", log=f"--> Clicking Action Menu Button [Coord {coordx}, {coordy}]...")
                time.sleep(random.uniform(1.5, 3.5))

                coordx, coordy, elem_obj = self.YT_MUSIC_TOOL_.perform_action("click_shuffle_from_action_menu_SERACH")
                update_task(self.user_id, self.task_id, progress=32, status="RUNNING", log=f"--> Clicking Shuffle From Action Menu [Coord {coordx}, {coordy}]...")
            except: raise 
    
            self.check_kill_events()
            if self.checkPlayHours(max_duration, start_time): return
            time.sleep(random.uniform(1.5, 3.5))



            # STEP 4: Clicking 'Play' Button... 
            # try:
                # update_task(self.user_id, self.task_id, progress=35, status="RUNNING", log=f"--> Clicked 'Play' Button...")
                # WebDriverWait(self.driver, timeout=10).until(EC.presence_of_element_located((By.XPATH, LIBRARY_PLAYLIST_PLAY_BUTTON_XPATH))).click()
                # play_button = self.driver.find_element(By.XPATH, LIBRARY_PLAYLIST_PLAY_BUTTON_XPATH)
                # coords = tap_random_in_element(self.driver, play_button)
            # except Exception as e:
                # raise Exception("ERROR! Failed Clicking The Library PlayList 'Play' Button...")

            # self.check_kill_events()
            # if self.checkPlayHours(max_duration, start_time): return
            
            # Skip Ads
            if not self.is_youtube_premium: 
                self.YT_MUSIC_TOOL_.skip_ads()


            # STEP 7: Clicking Reat Button...
            try: 
                time.sleep(random.uniform(4,7))
                coordx, coordy, elem_obj, isShuffled = self.YT_MUSIC_TOOL_.perform_action("click_player_shuffle_button")
                temp = 'Already Shuffled' if isShuffled else f"Coords {coordx}, {coordy}"
                update_task(self.user_id, self.task_id, progress=40, status="RUNNING", log=f"--> Clicking Player 'Shuffle' button [{temp}]...") 
                if not isShuffled: time.sleep(random.uniform(2,5))
            except: raise

            self.check_kill_events()
            if self.checkPlayHours(max_duration, start_time): return

            try: 
                coordx, coordy, elem_obj = self.YT_MUSIC_TOOL_.perform_action("click_player_loop_button")
                update_task(self.user_id, self.task_id, progress=45, status="RUNNING", log=f"--> Clicking Player 'Loop' button [Coords {coordx}, {coordy}]...") 
                time.sleep(random.uniform(2,5))
            except: raise
            
            self.check_kill_events()
            if self.checkPlayHours(max_duration, start_time): return
            time.sleep(random.uniform(1.0, 2.5))
            


            # STEP 8: Generating Rates And Playing Musics...
            sets = 1
            while not self.checkPlayHours(max_duration, start_time):
                
                self.check_kill_events()
                if self.checkPlayHours(max_duration, start_time): return

                # -------- Generating Skipping Rates
                random_skipping_rates, rates_avg = self.YT_MUSIC_TOOL_.perform_action("generate_music_skipping_rates")
                update_task( self.user_id, self.task_id, progress=50, status="RUNNING", log=f"--> Generated Skipping Rates: {random_skipping_rates} Average: {rates_avg} Sets: [{sets}]...")
                
                # -------- Loop Through Generated Skipping Rates
                for rate_index, skip_time in enumerate(random_skipping_rates):
                    coordx, coordy, elem_obj = self.YT_MUSIC_TOOL_.perform_action("click_player_next_button")
                    isSongLiked = False

                    # -------- SKIP ADS
                    if not self.is_youtube_premium: 
                        self.YT_MUSIC_TOOL_.skip_ads()
                    
                    # -------- CONFIRM INAPPROPRIATE CONTENT
                    self.YT_MUSIC_TOOL_.inappropriate_content_popup()

                    # -------- AGE VERIFICATION POPUP
                    self.YT_MUSIC_TOOL_.age_verification_popup()

                    # -------- Change Volume
                    if random.choices([0,1], weights=[65,35])[0]: 
                        self.HumanVolumer_.random_volume_change_thread(do_mute=False)
                        update_task( self.user_id, self.task_id, progress=50, status="RUNNING", log=f"--> --> Changing Volume Randomly...")

                    # -------- Like Music
                    if random.choices([0,1], weights=[100 - Config.VIDEO_LIKE_PERCENTAGE, Config.VIDEO_LIKE_PERCENTAGE])[0]: 
                        try:
                            coordx, coordy, elem_obj = self.YT_MUSIC_TOOL_.perform_action("click_player_like_button")
                            update_task( self.user_id, self.task_id, progress=50, status="RUNNING", log=f"--> --> Liking The Songs [Coords {coordx}, {coordy}]...")
                            isSongLiked = True
                            time.sleep(2)
                            self.YT_MUSIC_TOOL_.like_content_popup()
                        except: pass


                    self.check_kill_events()
                    end = time.monotonic() + (skip_time - (6 if not self.is_youtube_premium else 3) - ( 2.5 if isSongLiked else 0))

                    # -------- Wait For Rate Time To Complete
                    while True:
                        remaining = end - time.monotonic()
                        if remaining <= 0: break
                        self.check_kill_events()
                        if self.checkPlayHours(max_duration, start_time): return
                        time.sleep(min(0.1, remaining))
                    
                    update_task( self.user_id,  self.task_id,  status="RUNNING", log=f"--> --> [{rate_index+1}] Click Next Button [{coordx}, {coordy}] Listened Song: [{skip_time}] Seconds")

                sets += 1
            
        except: raise
        finally: pass
