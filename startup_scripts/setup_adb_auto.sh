#!/bin/bash

# ============================================
# CONFIG
# ============================================

SERVICE_NAME="adb-auto"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"
SCRIPT_PATH="$(realpath "$0")"
USER_NAME=$(whoami)
PORT="5555"

# ============================================
# INSTALL MODE
# Run manually: ./setup_adb_auto.sh install
# ============================================

install_service() {

echo "Installing ADB Auto service..."

sudo bash -c "cat > $SERVICE_FILE" <<EOF
[Unit]
Description=ADB Auto Connect
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=$SCRIPT_PATH run
User=$USER_NAME

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME.service

echo ""
echo "✅ Installed successfully!"
echo "It will run automatically on startup."
echo ""
}

# ============================================
# RUNTIME MODE
# Called automatically by systemd
# ============================================

run_service() {

ADB_PATH=$(which adb)

echo "Starting ADB..."

$ADB_PATH start-server

PREFIXES=$(ip -o -f inet addr show | awk '!/ lo / {print $4}' | cut -d/ -f1 | awk -F. '{print $1"."$2"."$3}' | sort -u)

echo "Detected networks:"
echo "$PREFIXES"

connect_ip() {

timeout 0.5 bash -c "</dev/tcp/$1/$PORT" 2>/dev/null && adb connect $1:$PORT &

}

export -f connect_ip
export PORT

for PREFIX in $PREFIXES
do

echo "Scanning $PREFIX.0/24"

seq 2 254 | xargs -P 60 -I {} bash -c "connect_ip $PREFIX.{}"

done

wait

adb devices

echo "Done."

}

# ============================================
# MAIN
# ============================================

case "$1" in

install)
install_service
;;

run)
run_service
;;

*)
echo "Usage:"
echo ""
echo "Install service:"
echo "./setup_adb_auto.sh install"
echo ""
echo "Run manually:"
echo "./setup_adb_auto.sh run"
echo ""
;;

esac