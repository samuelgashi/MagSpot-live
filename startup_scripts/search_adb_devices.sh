#!/bin/bash

PORT="5555"
TIMEOUT=0.6

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

for PREFIX in $PREFIXES
do

echo "Scanning ${PREFIX}.0/24 ..."

seq 1 254 | xargs -P 80 -I {} bash -c "connect_ip ${PREFIX}.{}"

done

wait

echo ""
adb devices
echo ""
echo "Done."