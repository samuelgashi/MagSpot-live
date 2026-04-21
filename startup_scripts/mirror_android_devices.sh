#!/bin/bash

PORT="5555"
TIMEOUT=0.6

# ============================================
# CHECK SCRCPY INSTALLATION
# ============================================

if ! command -v scrcpy &> /dev/null; then
    echo "❌ scrcpy is not installed!"
    echo "Please install it first. For Ubuntu/Debian run:"
    echo "sudo apt install scrcpy"
    exit 1
fi

# ============================================
# GET NETWORK PREFIXES FROM ALL INTERFACES
# ============================================

PREFIXES=$(ip -o -f inet addr show | awk '!/ lo / {print $4}' | cut -d/ -f1 | awk -F. '{print $1"."$2"."$3}' | sort -u)

echo "Detected Networks:"
echo "$PREFIXES"
echo ""

# ============================================
# FUNCTION TO CONNECT
# ============================================

connect_ip() {
    IP=$1
    timeout $TIMEOUT bash -c "</dev/tcp/$IP/$PORT" 2>/dev/null

    if [ $? -eq 0 ]; then
        RESULT=$(adb connect ${IP}:${PORT})
        if [[ $RESULT == *"connected"* ]] || [[ $RESULT == *"already"* ]]; then
            echo "✅ Connected: $IP"
        fi
    fi
}

export -f connect_ip
export PORT
export TIMEOUT

# ============================================
# SCAN ALL PREFIXES FAST
# ============================================

for PREFIX in $PREFIXES; do
    echo "Scanning ${PREFIX}.0/24 ..."
    seq 1 254 | xargs -P 80 -I {} bash -c "connect_ip ${PREFIX}.{}"
done

wait

# ============================================
# SHOW CONNECTED DEVICES
# ============================================

echo ""
adb devices
echo ""

# ============================================
# START SCRCPY FOR ALL CONNECTED DEVICES
# ============================================

for device in $(adb devices | awk 'NR>1 && $2=="device" {print $1}'); do
    echo "Launching scrcpy for device $device..."
    scrcpy -s "$device" &
done

echo "✅ All scrcpy sessions launched."