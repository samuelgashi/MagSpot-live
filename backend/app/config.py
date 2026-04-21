import os
import json
from dotenv import load_dotenv
import platform

# Load .env file relative to this config.py
current_path = os.getcwd()
ENV_PATH = os.path.join(current_path, ".env")
load_dotenv(dotenv_path=ENV_PATH, override=True)

class Config:
    
    config_env = os.environ.copy()
        
    # --- Environment Configuration ---
    ENV = os.getenv("ENV", "production")
    PORT = int(os.getenv("PORT", 5001))
    BACKEND_PORT = int(os.environ.get("BACKEND_PORT", 9786))
    
    system_os = platform.system().lower()
    if "windows" in system_os: system_os = "Windows"
    elif "linux" in system_os: system_os = "Linux"
    else: system_os = "Mac"

    ADMIN_KEY = os.getenv("BACKEND_ADMIN_KEY")
    TOKEN_EXPIRE_LIMIT = int(os.getenv("ADMIN_TOKEN_EXPIRE_LIMIT", 1))
    DEV_API_KEY = os.getenv("BACKEND_DEV_API_KEY")
    SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "a_default_secret_key_if_not_set")

    WS_SCRCPY_PATH = os.path.join(current_path, "backend", "ws-scrcpy")
    WS_SCRCPY_PORT = int(os.getenv("WS_SCRCPY_PORT", 5001))
    
    POSTGRES_USER = os.getenv('POSTGRES_USER')
    POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD')
    POSTGRES_HOST = os.getenv('POSTGRES_HOST')
    POSTGRES_PORT = os.getenv('POSTGRES_PORT')
    POSTGRES_DB = os.getenv('POSTGRES_DB')
    
    # --- Database (Postgres) ---
    SQLALCHEMY_DATABASE_URI = (
        f"postgresql://{os.getenv('POSTGRES_USER')}:{os.getenv('POSTGRES_PASSWORD')}"
        f"@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/{os.getenv('POSTGRES_DB')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # --- CORS Configuration ---
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "").split(",")

    # --- Clerk Authentication ---
    CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")
    CLERK_ISSUER = os.getenv("CLERK_ISSUER")
    CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL")

    # --- Paths ---
    BIN_FOLDER = os.path.join(current_path, "bin")
    JSON_FOLDER = os.path.join(BIN_FOLDER, "files")
    DATABASE_DIR = os.path.join(BIN_FOLDER, "database")
    ADB_SCRIPTS_PATH = os.path.join(current_path, "scripts")
    FILE_UPLOAD_FOLDER = os.path.join(current_path, "uploads")

    # Ensure directories exist
    for folder in [BIN_FOLDER, JSON_FOLDER, DATABASE_DIR, FILE_UPLOAD_FOLDER]:
        if not os.path.exists(folder): os.makedirs(folder)

    # --- JSON Databases ---
    FILES_JSON_PATH = os.path.join(JSON_FOLDER, "files.json")
    if os.path.exists(FILES_JSON_PATH):
        with open(FILES_JSON_PATH, "r") as f:
            UPLOADED_FILES_DATABASE = json.load(f)
    else:
        UPLOADED_FILES_DATABASE = {}

    APPIUM_CONTAINERS_DATABASE = os.path.join(JSON_FOLDER, "running_containers.json")

    # --- Server Configuration ---
    FLASK_RUN_PORT = int(os.getenv("BACKEND_PORT", 5000))

    # --- Cloudflare Tunnels ---
    CLOUDFLARED_TUNNEL_TOKEN = os.getenv("CLOUDFLARED_TUNNEL_TOKEN")

    # --- YT Music App Package & Activities ---
    YT_MUSIC_PACKAGE_NAME = os.getenv('YT_MUSIC_PACKAGE_NAME')
    YT_MUSIC_ACTIVITY_NAME = os.getenv('YT_MUSIC_ACTIVITY_NAME')

     # --- Youtube App Package & Activities ---
    YOUTUBE_PACKAGE_NAME = os.getenv('YOUTUBE_PACKAGE_NAME', "com.google.android.youtube" ) 
    YOUTUBE_ACTIVITY_NAME = os.getenv('YOUTUBE_ACTIVITY_NAME', "com.google.android.youtube.HomeActivity") 


    # --- Google Chrome App Package & Activities ---
    CHROME_PACKAGE_NAME = os.getenv('CHROME_PACKAGE_NAME', 'com.android.chrome')
    CHROME_ACTIVITY_NAME = os.getenv('CHROME_ACTIVITY_NAME', 'com.google.android.apps.chrome.Main')
    GOOGLE_SEARCH_BYPASS_SITES = [ "youtube.com", "instagram.com", "x.com", "facebook.com", "dailymotion.com", "twitter.com", "tiktok.com" ]
    GOOGLE_CHROME_DRIVER_HOST_PATH = os.getenv('GOOGLE_CHROME_DRIVER_HOST_PATH', None)
    GOOGLE_CHROME_DRIVER_CONTAINER_PATH = os.getenv('GOOGLE_CHROME_DRIVER_CONTAINER_PATH', "")

    GOOGLE_PACKAGE_NAME = os.getenv('GOOGLE_PACKAGE_NAME', 'com.google.android.googlequicksearchbox')
    GOOGLE_ACTIVITY_NAME = os.getenv('GOOGLE_ACTIVITY_NAME', 'com.google.android.googlequicksearchbox.SearchActivity')

    # Skipping Rates
    SKIPPING_RATES_COUNT = 8
    SKIPPING_HIGH_COUNT  = 1
    SKIPPING_LOW_RANGE   = [42,  58]
    SKIPPING_HIGH_RANGE  = [100, 120]
    SKIPPING_AVG_RANGE   = [55,  60]

    FREE_YOUTUBE_SKIPPING_RATES_COUNT = 8
    FREE_YOUTUBE_SKIPPING_HIGH_COUNT  = 1
    FREE_YOUTUBE_SKIPPING_LOW_RANGE   = [70,  90]
    FREE_YOUTUBE_SKIPPING_HIGH_RANGE  = [130, 160]
    FREE_YOUTUBE_SKIPPING_AVG_RANGE   = [80,  105]

    BASE_WIDTH = int(os.getenv('isOverrideResolution', 1080))
    BASE_HEIGHT = int(os.getenv('isOverrideResolution', 2280))
    BUTTONS_CENTERS =  os.getenv('button_centers', None)
    if BUTTONS_CENTERS:
        if os.path.exists(BUTTONS_CENTERS):
            try: 
                with open(BUTTONS_CENTERS, "r") as f: BUTTONS_CENTERS = json.loads(f)
            except: BUTTONS_CENTERS = None
        else: BUTTONS_CENTERS = None

    if not BUTTONS_CENTERS: BUTTONS_CENTERS = {
        "shuffle": {
            "base":    (75, 1760),
            "physical": (75, 1270),
            "radius": 60
        },
        "loop": {
            "base":    (990, 1760),
            "physical": (645, 1270),
            "radius": 60
        },
        "next": {
            "base":    (785, 1760),
            "physical": (520, 1270),
            "radius": 70
        },
        "back": {
            "base":    (280, 1760),
            "radius": 70
        },
        "play": {
            "base":    (535, 1770),
            "physical": (355, 1270),
            "radius": 90
        },
        "like": {
            "base":    (130, 1465),
            "physical": (115, 1050),
            "radius": 40
        },
        "dislike": {
            "base":    (290, 1465),
            "physical": (214, 1050),
            "radius": 40
        }
    }
    isOverrideResolution = os.getenv("IS_OVERRIDE_RESOLUTION", "true").lower() in ("1", "true", "yes")


    SCROLL_DOWN_LIMIT = int(os.getenv('SCROLL_DOWN_LIMIT', 20))
    SUBNET_BASE = os.getenv('SUBNET_BASE', '192.168.9')
    ADB_PATH = os.getenv('ADB_PATH', "/usr/bin/adb")
    ANDROID_PLATFORM_TOOL_PATH = os.getenv("ANDROID_PLATFORM_TOOL_PATH", "")
    ADB_PORT = int(os.getenv('ANDROID_ADB_SERVER_PORT', 5555))

    APPIUM_PATH = os.getenv('APPIUM_PATH', "appium")
    ANDROID_HOME = os.getenv('ANDROID_HOME', "")
    ANDROID_SDK_ROOT = os.getenv('ANDROID_SDK_ROOT', "")

    CONCURRENCY = int(os.getenv('CONCURRENCY', 200))
    SCAN_TIMEOUT_MS = int(os.getenv('SCAN_TIMEOUT_MS', 1000))

    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', "None")
    IMAGE_PHYSICAL_RESOLUTION = "1440x3040"
    IMAGE_OVERRIDE_RESOLUTION = "1080x2280"
    GEMINI_IMAGE_ANALYZE_MODEL = "gemini-3-flash-preview"
    GEMINI_IMAGE_ANALYZE_PROMPT = lambda PHYSICAL_RESOLUTION, OVERRIDE_RESOLUTION: f"""
I am building an object detection tool for video player interface elements. The detection focuses on identifying buttons/icons positions.
I want you to return the positions of buttons/icons such as:

- "Like button", 
- "Dislike button",
- "Message button",
- "Save button",
- "Circle Slider Icon",
- "Shuffle button",
- "Previous Play Button",
- "Play Button",
- "Next Play Button",
- "Loop Button"

If you don't get any button position, return None for that specific one.
Make sure to put max focus on finding the location of "Circle Slider Icon" which is important for sliding the music player.

I physical resolution of screen is {PHYSICAL_RESOLUTION} which is also image dimensions, while the override resolution of screen is {OVERRIDE_RESOLUTION}.
You have to make sure to extract the position based on physical resolution or image dimensions but calculate them according to the override resolution.
Return the calculated position according to override resolution.

**Output requirement**:  
Only return the dictionary results without any suggestions, comments, or explanations.
Return the processed results strictly in dictionary format with the following structure:

```python
{{
  "community": {{
    "Like":   [x1, y1, x2, y2],
    "Dislike":[x1, y1, x2, y2],
    "Message":[x1, y1, x2, y2],
    "Save":   [x1, y1, x2, y2],
    "Share":  [x1, y1, x2, y2]
  }},
  "controller": {{
    "circle":   [x1, y1, x2, y2],
    "line":     [x1, y1, x2, y2],
    "Shuffle":  [x1, y1, x2, y2],
    "Previous": [x1, y1, x2, y2],
    "Play":     [x1, y1, x2, y2],
    "Next":     [x1, y1, x2, y2],
    "Repeat":   [x1, y1, x2, y2]
  }},
}}
```  
"""

    DEFAULT_MAX_STREAMERS=int(os.getenv('DEFAULT_MAX_STREAMERS', 10))
    DEFAULT_PLAY_HOURS=int(os.getenv('DEFAULT_PLAY_HOURS', 10))
    MAX_PLAY_HOURS=round(float(os.getenv('MAX_PLAY_HOURS', 1.50)), 2)
    MIN_PLAY_MINUTES=int(os.getenv('MIN_PLAY_MINUTES', 20))

    APPIUM_POOL_SIZE = int(os.getenv('APPIUM_POOL_SIZE', 20))
    APPIUM_BATCH_PERCENT = int(os.getenv('APPIUM_BATCH_PERCENT', 20))
    APPIUM_BATCH_WAIT = int(os.getenv('APPIUM_BATCH_WAIT', 60))
    APPIUM_BUSY_DB_TIMEOUT = int(os.getenv('APPIUM_BUSY_DB_TIMEOUT', 600))
    APPIUM_POOL_CONFIG_FILE = os.path.join(JSON_FOLDER, "appium_pool.json")

    NETWORK_ADDRESS = os.getenv('NETWORK_ADDRESS', '127.0.0.1')
    VIDEO_LIKE_PERCENTAGE = int(os.getenv('VIDEO_LIKE_PERCENTAGE', 1))

    # ADB COMMANDS
    HOST_USER = os.getenv('HOST_USER', "testuser")
    ADB_VENDOR_KEYS = os.getenv('ADB_VENDOR_KEYS', "")
    ADB_VENDOR_KEYS_HOST = os.getenv('ADB_VENDOR_KEYS_HOST', "")
    ANDROID_ADB_SERVER_ADDRESS = os.getenv('ANDROID_ADB_SERVER_ADDRESS', NETWORK_ADDRESS)
    ADB_SERVER_SOCKET = os.getenv('ADB_SERVER_SOCKET', f"tcp:{ANDROID_ADB_SERVER_ADDRESS}:{ADB_PORT}")


    config_env["ADB_PATH"] = ADB_PATH
    config_env["ADB_PORT"] = ADB_PORT
    config_env["ADB_SERVER_SOCKET"] = ADB_SERVER_SOCKET
    config_env["ADB_SERVER_PORT"] = ADB_PORT
    config_env["ANDROID_ADB_SERVER_PORT"] = ADB_PORT

    for x in config_env.keys():
        config_env[x] = str(config_env[x])
    
