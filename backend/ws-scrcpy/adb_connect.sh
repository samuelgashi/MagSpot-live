#!/bin/bash

# Usage: ./adb_monitor.sh "192.168.1.10,192.168.1.20-192.168.1.30,192.168.1.50"

ALLOWED="$1"

expand_ips() {
  local input="$1"
  local ips=()
  IFS=',' read -ra parts <<< "$input"
  for part in "${parts[@]}"; do
    if [[ "$part" == *"-"* ]]; then
      local start=${part%-*}
      local end=${part#*-}
      local base=${start%.*}
      local s=${start##*.}
      local e=${end##*.}
      for ((i=s; i<=e; i++)); do
        ips+=("$base.$i")
      done
    else
      ips+=("$part")
    fi
  done
  echo "${ips[@]}"
}

ALLOWED_IPS=($(expand_ips "$ALLOWED"))

echo "Allowed IPs: ${ALLOWED_IPS[*]}"

while true; do
  for ip in "${ALLOWED_IPS[@]}"; do
    # quick TCP probe to port 5555
    if nc -z -w1 "$ip" 5555 2>/dev/null; then
      # check if already connected
      if ! adb devices | grep -q "^$ip:5555"; then
        echo "Connecting to $ip:5555"
        adb connect "$ip:5555" >/dev/null 2>&1
      # else
      #   echo "Already connected: $ip:5555"
      fi
    else
      # if device is not reachable but adb shows it, disconnect
      if adb devices | grep -q "^$ip:5555"; then
        echo "Disconnecting unreachable device: $ip:5555"
        adb disconnect "$ip:5555" >/dev/null 2>&1
      fi
    fi
  done
  sleep 15   # increased from 2 to 15 seconds
done
