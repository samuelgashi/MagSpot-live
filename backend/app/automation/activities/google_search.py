import os
import random
import subprocess
from app.config import Config
from app.automation.utils.tools import *
from app.repositories.tasks_repo import *
from app.automation.utils.yt_xpaths import *
from app.automation.utils.driver_utils import *
from app.automation.utils.yt_music_tools import *
from app.automation.utils.HumanVolumer import HumanVolumer
# from configs import *
# from automation.handlers.tasks import *
# from api.channels.tools  import *

import hashlib
import random
from difflib import SequenceMatcher
from difflib import get_close_matches
from selenium.webdriver.common.by import By
from selenium.common.exceptions import StaleElementReferenceException



class ScrollLimitReached(Exception):
    """Raised when no more scrolling is possible."""
    pass


class GOOGLE_SEARCH:

    def __init__(self, driver: webdriver, user_id, android_id, task_id, site_scroll_limit, isOverrideResolution, cancel_event):
        self.driver = driver
        self.user_id = user_id
        self.device_id = android_id
        self.task_id = task_id
        self.SITE_SCROLL_LIMIT = site_scroll_limit
        self.cancel_event = cancel_event
        self.isOverrideResolution = isOverrideResolution
        self.HumanVolumer_ = HumanVolumer(android_id)
        self.YT_MUSIC_TOOL_ = YT_MUSIC_TOOL(driver, android_id, isOverrideResolution)
        self.current_path = os.path.dirname(os.path.abspath(__file__))



    def get_hash(self, text):
        return hashlib.md5(text.strip().encode()).hexdigest()



    def check_kill_events(self):
        if self.cancel_event.is_set():
            raise Exception("CANCELLED: Task Cancelled By User")
        


    def extract_text_from_element(self, element):
        try:
            sub_elements = element.find_elements(By.XPATH, ".//*[@text]")
            texts = []
            for sub in sub_elements:
                t = sub.get_attribute("text")
                if t and t.strip(): texts.append(t.strip())
            return " | ".join(sorted(set(texts)))
        except: return ""



    def best_text_match(self, query: str, texts: list, cutoff=0.6):
        """Returns the best matching text from a list based on similarity to query. [or None]"""
        matches = get_close_matches(query, texts, n=1, cutoff=cutoff)
        if matches: return matches[0]
        return None



    def best_text_similarity_match(self, query: str, texts: list):
        """Returns the best matching text and its similarity score (0 to 1)"""
        best_score = 0
        best_text = None

        for text in texts:
            text = text.lower()
            score = SequenceMatcher(None, query, text).ratio()  # 0 to 1
            if score > best_score:
                best_score = score
                best_text = text
        return best_text, best_score



    def _page_fingerprint(self, driver):
        return hashlib.md5(driver.page_source.encode("utf-8")).hexdigest()

    
    def scroll_down(self, driver, start_x_percent=50, start_y_percent=50, end_x_percent=None, end_y_percent=None, scroll_percent=40):
        """
        start_x_percent: starting X position (percentage of width)
        start_y_percent: starting Y position (percentage of height)

        end_x_percent: ending X position (percentage of width) [optional]
        end_y_percent: ending Y position (percentage of height) [optional]

        scroll_percent: used only if end_y_percent is None
        """

        size = driver.get_window_size()
        width = size['width']
        height = size['height']

        # Convert start positions
        start_x = int(width * (start_x_percent / 100))
        start_y = int(height * (start_y_percent / 100))

        # If explicit end provided → use it
        if end_x_percent is not None:
            end_x = int(width * (end_x_percent / 100))
        else:
            end_x = start_x

        if end_y_percent is not None:
            end_y = int(height * (end_y_percent / 100))
        else:
            # fallback to scroll_percent (vertical scroll)
            scroll_px = int(height * (scroll_percent / 100))
            end_y = start_y - scroll_px

        before = self._page_fingerprint(driver)

        try:
            actions = ActionBuilder(driver, mouse=PointerInput("touch", "finger"))
            finger = actions.pointer_action

            finger.move_to_location(start_x, start_y)
            finger.pointer_down()
            finger.move_to_location(end_x, end_y)
            finger.pointer_up()
            actions.perform()

            time.sleep(0.4)

            after = self._page_fingerprint(driver)
            if before == after:
                raise ScrollLimitReached("Scroll limit reached – no content movement detected")

        except ScrollLimitReached:
            raise Exception("SCROLL LIMIT: No more scroll possible")

        except Exception as e:
            raise RuntimeError(f"Scroll failed: {e}")
        


    def start_warmup(self, search_keyword, minimum_site_warmup_time=3, maximum_site_warmup_time=15, sites_limit=15):
        google_site_urls = set()
        time.sleep(5)

        # self.driver.get("https://www.google.com")
        # time.sleep(5)

        # Find the Google search box (HTML DOM element)
        # search_input = WebDriverWait(self.driver, 10).until(
        #     EC.presence_of_element_located((
        #         By.XPATH,
        #         "//textarea[@aria-label and @enterkeyhint]"
        #     ))
        # )

        # FIND GOOGLE SEARCH OBJECT & SEARCHING CONTENT
        search_input = None
        try: 
            update_task(self.user_id, self.task_id, progress=5, status="RUNNING", log=f"--> Searching For Google Search Button...")
            WebDriverWait(self.driver, 10).until(EC.presence_of_element_located((By.XPATH, """//*[@resource-id='com.android.chrome:id/url_bar']""")))
            search_input = self.driver.find_element(By.XPATH, """//*[@resource-id='com.android.chrome:id/url_bar']""")
        except:
            try: 
                WebDriverWait(self.driver, 10).until(EC.presence_of_element_located((By.XPATH, "//*[contains(@resource-id, 'id/search_box_text')]")))
                search_input = self.driver.find_element(By.XPATH, "//*[contains(@resource-id, 'id/search_box_text')]")
            except Exception as e:  print(e)

        if not search_input: 
            raise Exception("Chrome Search Input Not Found!")


        # SEARCHING KEYWORDS ON GOOGLE SEARCH
        update_task(self.user_id, self.task_id, progress=8, status="RUNNING", log=f"--> Entering Search Keyword [{search_keyword}]...")
        search_input.click()
        HumanTyper(self.driver).type_text(search_keyword)
        self.driver.execute_script("mobile: performEditorAction", {
            "action": "search"
        })


        # SWITCH TO WEBVIEW
        timeout, start , webview_context = 20, time.time(), None
        while time.time() - start < timeout:
            contexts = self.driver.contexts
            for context in contexts:
                if "WEBVIEW" in context:
                    webview_context = context
                    break
            if webview_context: break
            time.sleep(1)

        time.sleep(3)
        
        if not webview_context:
            raise Exception("WebView context not found")

        # print(self.driver.contexts)
        self.driver.switch_to.context("WEBVIEW_chrome")
        update_task(self.user_id, self.task_id, progress=10, status="RUNNING", log=f"--> Switching to WebView...")
        self.check_kill_events()


        # GET GOOGLE SEARCH RESULTS
        while len(google_site_urls) < sites_limit:
            results = self.driver.find_elements(By.XPATH, GOOGLE_RESULTS_WEBVIEW)
            update_task(self.user_id, self.task_id, progress=12, status="RUNNING", log=f"--> Total {len(google_site_urls)} Valid Sites Found...")
            for res in results:
                page_url = res.get_attribute('href')
                if page_url: 
                    if not any(site in page_url for site in Config.GOOGLE_SEARCH_BYPASS_SITES):  google_site_urls.add(page_url)
            
            try: 
                if len(google_site_urls) >= sites_limit: break
                for i in range(3): scroll_down(self.driver, percent=random.randint(25, 40))
                WebDriverWait(self.driver, 10).until(EC.presence_of_element_located((By.XPATH, MORE_SEARCH_RESULTS_WEBVIEW)))
                self.driver.find_element(By.XPATH, MORE_SEARCH_RESULTS_WEBVIEW).click()
                
            except Exception as e: 
                print(e)
                pass
            self.check_kill_events()


        # GENERATE PLAY TIME & FILTER GOOGLE SITES
        google_site_urls = list(google_site_urls)
        sites_play_hours = [round(random.uniform(minimum_site_warmup_time, maximum_site_warmup_time), 2) for x in range(sites_limit)]
        google_site_urls = google_site_urls[:len(sites_play_hours) if len(google_site_urls) > len(sites_play_hours) else len(google_site_urls)]
        update_task(self.user_id, self.task_id, progress=12, status="RUNNING", log=f"--> Total {len(google_site_urls)} Results Found! Total Play Time [{len(sites_play_hours)}]...")
        self.check_kill_events()
        

        # LOOP THROUGH EACH GOOGLE SITE
        for page_index, page_url in enumerate(google_site_urls):
            
            cookies_accepted = False
            total_play_time = sites_play_hours[page_index] * 60
            scrol_play_hours = int(total_play_time / self.SITE_SCROLL_LIMIT)

            try:
                update_task(self.user_id, self.task_id, progress=15, status="RUNNING", log=f"""{'-'*42}""")
                temp_log = f"### Visiting Webpage {page_index+1}/{len(google_site_urls)} Play Time: {sites_play_hours[page_index]}"
                update_task(self.user_id, self.task_id, progress=15, status="RUNNING", log=temp_log)
                update_task(self.user_id, self.task_id, progress=15, status="RUNNING", log=f"""{'-'*42}""")

                self.check_kill_events()
                self.driver.get(page_url)
                time.sleep(10)

                for _ in range(self.SITE_SCROLL_LIMIT):
                    self.check_kill_events()
                    if not cookies_accepted and page_index < 2:
                        try:
                            best_match_btn_index, best_match_text, best_match_val = None, "", 0
                            cookie_btns = self.driver.find_elements( By.XPATH, COOKIES_ACCEPT_BUTTON_WEBVIEW)

                            for index, x in enumerate(cookie_btns):
                                
                                try: 
                                    text = x.text.strip().lower()
                                    if not text:  continue

                                    text_similarity = self.best_text_similarity_match(text, COOKIE_ACCEPT_BUTTON_TEXTS)
                                except Exception as e:
                                    print(f"ERROR CHECKING SIMILARITY: {e}")
                                    continue 

                                if text_similarity[1] > best_match_val:
                                    best_match_btn_index = index
                                    best_match_text = text_similarity[0]
                                    best_match_val = text_similarity[1]

                            if best_match_val > 0.6:
                                update_task(self.user_id, self.task_id, progress=50, status="RUNNING", log=f"--> Accepting Cookies [{best_match_text}]")
                                try: cookie_btns[best_match_btn_index].click()
                                except: pass
                                cookies_accepted = True
                        except: pass

                    self.check_kill_events()
                    update_task(self.user_id, self.task_id, progress=50, status="RUNNING", log=f"--> Scrolling Webpage {_+1}/{self.SITE_SCROLL_LIMIT}")
                    try: self.scroll_down(
                        self.driver, 
                        start_x_percent=random.uniform(40.4, 55.0), 
                        start_y_percent=random.uniform(49.7, 60.0), 
                        end_x_percent=random.uniform(40.4, 55.0), 
                        end_y_percent=random.uniform(22.0, 28.51))
                    except Exception as e: 
                        print(e)
                    time.sleep(random.uniform(scrol_play_hours-(scrol_play_hours*0.1), scrol_play_hours+(scrol_play_hours*0.65)))


            except StaleElementReferenceException: continue
            except Exception as e: update_task(self.user_id, self.task_id, progress=50, status="RUNNING", log=f"--> ERROR! {e}")



 # f"""{keyword}" -site:youtube.com -site:twitter.com -site:instagram.com -site:x.com -site:facebook.com inurl:blog"""
 # driver.execute_script("window.scrollTo({top: 0, behavior: 'smooth'});")
 # driver.execute_script("window.scrollBy(0, window.innerHeight * 0.3);")