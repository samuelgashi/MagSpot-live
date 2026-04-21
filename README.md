



## Pre-Setup:
- ### Step 1: Setup ADB
  
  This step will make sure to use a static adb keys so that it won't distrub the devices later on, some devices keep pushing "Accept ADB request" on android devices if not using backup keys.
  
  - Setup ADB binary
  - Connect To Devices in Network using `search_adb_devices.sh` script.
  - Accept ADB authentications request on all devices **popup on devices**.
  - Save the keys in `~/adb_keys_backup`
  ```bash
  # Setup ADB
  # command -v adb || (mkdir -p ~/android-tools && cd ~/android-tools && wget -q https://dl.google.com/android/repository/platform-tools-latest-linux.zip && unzip -o platform-tools-latest-linux.zip && rm platform-tools-latest-linux.zip && sudo ln -sf ~/android-tools/platform-tools/adb /usr/bin/adb)
  # hash -r
  sudo apt install adb
  source ~/.bashrc

  # Backup adb keys
  ls /home/$USER/.android                                            # Check adb keys exists [adbkey, adbkey.pub]
  mkdir ~/adb_keys_backup                                            # Create Backup folder
  cp /home/$USER/.android/adbkey ~/adb_keys_backup/adbkey            # Copy the adb private key
  cp /home/$USER/.android/adbkey.pub ~/adb_keys_backup/adbkey.pub    # Copy the adb public key
  chmod -R 755 ~/adb_keys_backup                                     # Change Permission of ADB Keys

  # Add Variables to Global Enviroments
  echo "ADB_PATH=\"$(which adb)\"" | sudo tee -a /etc/environment
  echo "ADB_VENDOR_KEYS=\"$HOME/adb_keys_backup\"" | sudo tee -a /etc/environment
  echo "ANDROID_ADB_KEY_PATH=\"$HOME/adb_keys_backup\"" | sudo tee -a /etc/environment
  source ~/.bashrc
  source /etc/environment

  # Connect Devices In Current Network
  # Accept Authorization popup request on devices
  adb start-server
  chmod a+x ./startup_scripts/search_adb_devices.sh
  ./startup_scripts/search_adb_devices.sh
  adb devices
  
  # Stop Adb server and restart after authentication approved
  adb kill-server
  adb start-server
  ```

- ### Step 2: Setup Python ADB Service.
  
  This step will run python script on host to make sure devices keep connected, it will keep checking for device in current network. 
  
  ```bash
  cp ./startup_scripts/adb_service.py /home/$USER/adb_auto_service.py

  sudo tee /etc/systemd/system/adb_auto_service.service > /dev/null <<EOF  # Create the systemd service file
  [Unit]
  Description=ADB Auto Service
  After=network.target

  [Service]
  Type=simple
  User=$USER
  Group=$USER
  Environment=ADB_PATH=/usr/bin/adb
  Environment=ADB_VENDOR_KEYS=$HOME/adb_keys_backup
  Environment=ANDROID_ADB_KEY_PATH=$HOME/adb_keys_backup
  Environment=ADB_POLL_INTERVAL=3
  Environment=ADB_API_PORT=8999
  Environment=ADB_SERVICE_LOG=/var/log/adb_auto_service.log
  Environment=RUN_AS_USER=$USER
  WorkingDirectory=$HOME
  ExecStart=/usr/bin/env python3 $HOME/adb_auto_service.py
  Restart=always
  RestartSec=5
  StandardOutput=append:/var/log/adb_auto_service.log
  StandardError=append:/var/log/adb_auto_service.log

  [Install]
  WantedBy=multi-user.target
  EOF

  sudo systemctl daemon-reload                    # Reload systemd
  sudo systemctl enable adb_auto_service.service  # Enable service on boot
  sudo systemctl start adb_auto_service.service   # Start service now
  sudo systemctl status adb_auto_service.service  # Check status
  tail -f /var/log/adb_auto_service.log           # Tail logs
  # sudo systemctl stop adb_auto_service.service    # Optional: Start/Stop manually
  # sudo systemctl restart adb_auto_service.service # Optional: Start/Stop manually
  ```

- ### Step 3: Setup Docker

  Install Docker and its docker images to be used in Automation

  ```bash

  # Installation: Install Docker [Ubuntu] if not installed
  sudo apt remove $(dpkg --get-selections docker.io docker-compose docker-compose-v2 docker-doc podman-docker containerd runc | cut -f1)
  
  # Add Docker's official GPG key:
  sudo apt update
  sudo apt install ca-certificates curl
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc

  # Add the repository to Apt sources:
  sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
  Types: deb
  URIs: https://download.docker.com/linux/ubuntu
  Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
  Components: stable
  Signed-By: /etc/apt/keyrings/docker.asc
  EOF

  sudo apt update
  sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  sudo systemctl start docker
  sudo usermod -aG docker ${USER}
  newgrp docker

  # Step 1: SAVE DOCKER GROUP ID IN GLOBAL ENVIROMENT
  echo "DOCKER_GID=\"$(getent group docker | cut -d: -f3)\"" | sudo tee -a /etc/environment

  # Step 2: Update Session, Enviroment, & Terminal
  source ~/.bashrc
  source /etc/environment

  # Step 3: Pull Appium Docker Image
  docker pull appium/appium:latest
  ```



## Database:
- ### Initialize the database
  ```bash
  flask db init
  flask db migrate -m "Initial tables"
  flask db upgrade
  ```

- ### Delete Database
  ```
  psql -h localhost -p 5433 -U maguser -d postgres

  -- Terminate active connections
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = 'magspot' AND pid <> pg_backend_pid();

  -- Drop the database
  DROP DATABASE magspot;

  -- Recreate it
  CREATE DATABASE magspot OWNER maguser;

  ```

## Run Backend Locally:

- ### Installation
  ```bash
  # Install Python Requirements
  pip install -r requirements.txt
  ```

- ### Run the Flask app
  ```bash
  python run.py
  ```
- ### Run the Flask app
  ```bash
  gunicorn -w 4 -b 0.0.0.0:9786 wsgi:app
  ```

## Appium Inspector
```bash
appium plugin install --source=npm appium-inspector-plugin
appium --use-plugins=inspector

# OR
appium \
  --relaxed-security \
  --log-level warn \
  --use-plugins=inspector \
  --allow-cors \
  --allow-insecure chromedriver_autodownload 

# Appium Caps
{
  "platformName": "Android",
  "automationName": "UiAutomator2",
  "deviceName": "AndroidDevice",
  "udid": "emulator-5554",
  "appPackage": "com.google.android.apps.youtube.music",
  "appActivity": "com.google.android.apps.youtube.music.activities.MusicActivity",
  "noReset": true,
  "fullReset": false,
  "dontStopAppOnReset": true
}
```

### Install ChromeDriver:
- [`Chromedriver Github URL`](https://googlechromelabs.github.io/chrome-for-testing/latest-patch-versions-per-build-with-downloads.json)
```bash

sudo apt-get update 
sudo apt-get install -y jq

# Make a folder in documents
mkdir -p $HOME/Documents/chromedriver
chmod 755 $HOME/Documents/chromedriver
chown $USER:$USER $HOME/Documents/chromedriver

# run scripts to check chrome versions in devcoces and download
cd startup_scripts/install_chromedrivers
chmod +x get_chrome_versions.sh download_install_chromedrivers.sh
bash get_chrome_versions.sh
bash download_install_chromedrivers.sh

# WORKING EXAMPLE:
wget https://storage.googleapis.com/chrome-for-testing-public/145.0.7632.117/linux64/chromedriver-linux64.zip
unzip chromedriver-linux64.zip
cd chromedriver-linux64
chmod 755 chromedriver
mkdir ~/Documents/chromedriver
sudo mv chromedriver ~/Documents/chromedriver
rm chromedriver-linux64
rm chromedriver-linux64.zip

# [OPTIONAL] CHECK WEBVIEW ENABLE OR NOT [FOCUS Null]
shell settings get global webview_provider

# [OPTIONAL] IF CHROME -> DISBALE, SET TO DEFAULT:
shell pm disable-user --user 0 com.android.chrome
shell cmd webviewupdate set-webview-implementation com.google.android.webview

# [OPTIONAL] ENABLE CHRME BACK ON
shell pm enable com.android.chrome
```

### RED PONITS:
- *SKIPPNG RATES*:
  - Be careful: using strict average constraints with random sampling can cause the loop to run indefinitely or take a very long time if the ranges make the target average unlikely.
  
### Youtube Streaming:
- Like any song from each device and click the popup [OK]

### 1.1 Authenticate Admin
- **POST** `/authenticate_admin` Generates an admin JWT.

  ```bash
  curl -X POST {{baseUrl}}/authenticate_admin \
    -H "Content-Type: application/json" \
    -d '{"admin_key": "{{admin_secret_key}}"}'
  ```

### 1.2 Create API Key
- **POST** `/api_keys`  Creates a new API key.
  ```bash
  curl -X POST {{baseUrl}}/api_keys \
  -H "Content-Type: application/json" \
  -H "x-access-token: {{admin_token}}" \
  -d '{"life_time": {{life_time}}, "authorized_endpoints": "*"}'
  ```
- **GET** `/api_keys` Retrieves a list of all API keys.
  ```bash
  curl -X GET {{baseUrl}}/api_keys \
    -H "x-access-token: {{admin_token}}"
  ```

- **GET** `/api_keys/<key_id>` Get Specific API Key Using Key ID
  ```bash
  curl -X GET {{baseUrl}}/api_keys/{{key_id}} \
    -H "x-access-token: {{admin_token}}"
  ```
- **DELETE** `/api_keys/<key_id>` Deletes a specific API key by its unique ID.
  ```bash
  curl -X DELETE {{baseUrl}}/api_keys/{{key_id}} \
    -H "x-access-token: {{admin_token}}"
  ```

### 1.3 Users Managements:
*All endpoints in this section require an Admin JWT in the `x-access-token` header.*
- **Get All Users** `/admin/users` Retrieves a list of all users in the database.

  ```bash
  curl -X GET {{baseUrl}}/admin/users \
  -H "x-access-token: {{admin_token}}"
  ```
- **Delete User** `/admin/users` Retrieves a list of all users in the database.

  ```bash
  curl -X DELETE {{baseUrl}}/admin/users \
  -H "x-access-token: {{admin_token}}" \
  -d '{"user_id":"{{user_id}}"}' \
  -H "Content-Type: application/json"
  ```