import os
import random
import subprocess
from app.config import Config
from app.automation.utils.tools import *
from app.repositories.tasks_repo import *
from app.automation.utils.yt_xpaths import *
from app.automation.utils.driver_utils import *
from app.automation.utils.youtube_tools import *
from app.automation.utils.HumanVolumer import HumanVolumer
# from configs import *
# from automation.handlers.tasks import *
# from api.channels.tools  import *


class YOUTUBE_SHORTS:

    def __init__(self, driver, user_id, android_id, task_id, is_youtube_premium, isOverrideResolution, cancel_event):
        self.driver = driver
        self.user_id = user_id
        self.device_id = android_id
        self.task_id = task_id
        self.is_youtube_premium = is_youtube_premium
        self.cancel_event = cancel_event
        self.isOverrideResolution = isOverrideResolution
        self.HumanVolumer_ = HumanVolumer(android_id)
        self.YOUTUBE_APP_TOOL_ = YOUTUBE_APP(driver, android_id, isOverrideResolution, is_youtube_premium=is_youtube_premium)
        self.current_path = os.path.dirname(os.path.abspath(__file__))
        

    def checkPlayHours(self, max_duration, start_time):
        if max_duration is not None and (time.monotonic() - start_time) >= max_duration: 
            update_task(
                self.user_id, 
                self.task_id, progress=99, 
                status="COMPLETED", 
                log=f"*** Hours Play Kill Switch Triggered [{max_duration/3600}] Hours"
            )
            time.sleep(1)
            return True
        else: return False 
        


    def check_kill_events(self):
        if self.cancel_event.is_set():
            raise Exception("CANCELLED: Task Cancelled By User")
        
        

    def start_shorts_stream(self, play_hours=10): 
        try:
            

            start_time = time.monotonic() 
            max_duration = None 
            if play_hours is not None:  max_duration = play_hours * 3600
            screenWidth, screenHeight = get_screen_resolution(self.driver)

            self.check_kill_events()
            if self.checkPlayHours(max_duration, start_time): return


            # STEP 1: Click Home Tab...
            try: 
                coordx, coordy, elem_obj = self.YOUTUBE_APP_TOOL_.perform_action("click_nav_home_button")
                update_task(self.user_id, self.task_id, progress=20, status="RUNNING", log=f"--> Clicking Home Tab [Coords: {coordx}, {coordy}]...")
            except: raise

            self.check_kill_events()
            if self.checkPlayHours(max_duration, start_time): return
            time.sleep(random.uniform(1, 3))
            
            
            # STEP 2: Clicking Shorst Button Icon...
            try: 
                coordx, coordy, elem_obj = self.YOUTUBE_APP_TOOL_.perform_action("click_nav_shorts_button")
                update_task(self.user_id, progress=25, task_id=self.task_id, status="RUNNING", log=f"--> Clicking Shorts Icon [Coords: {coordx}, {coordy}]...") 
            except: raise
            
            self.check_kill_events()
            if self.checkPlayHours(max_duration, start_time): return
            time.sleep(random.uniform(1, 3))
            

            # STEP 6: Watching Shorts Videos
            shorts_count = 0
            while not self.checkPlayHours(max_duration, start_time):
                
                self.check_kill_events()
                if self.checkPlayHours(max_duration, start_time): return

                # -------- Generating Skipping Rates
                watch_video_timeout = random.randint(15, 30)
                update_task( self.user_id, self.task_id, progress=50, status="RUNNING", log=f"""--> Watching Short For {watch_video_timeout} seconds! Shorts #{shorts_count+1}...""")                   

                # -------- Change Volume
                if random.choices([0,1], weights=[65,35])[0]: 
                    self.HumanVolumer_.random_volume_change_thread(do_mute=False)
                    update_task( self.user_id, self.task_id, progress=50, status="RUNNING", log=f"--> --> Changing Volume Randomly...")

                # -------- Like Short
                if random.choices([0,1], weights=[85,15])[0]: 
                    try: 
                        coordx, coordy, elem_obj = self.YOUTUBE_APP_TOOL_.perform_action("click_player_like_button")
                        update_task( self.user_id, self.task_id, progress=50, status="RUNNING", log=f"--> --> Liking Short Video [Coords {coordx}, {coordy}]...")
                    except: pass


                self.check_kill_events()
                end = time.monotonic() + (watch_video_timeout)

                # -------- Wait For Video Time To Complete
                while True:
                    remaining = end - time.monotonic()
                    if remaining <= 0: break
                    self.check_kill_events()
                    if self.checkPlayHours(max_duration, start_time): return
                    time.sleep(min(0.1, remaining))


                try: scroll_down(self.driver, percent=70)
                except Exception as e: 
                    print("Failed Scrolling Video! ", e)          

                shorts_count += 1

        except: raise
        finally: pass