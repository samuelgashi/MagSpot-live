#!/usr/bin/env bash
# Save as get_chrome_versions.sh and run: bash get_chrome_versions.sh

out_file="devices_chrome_versions.json"
declare -a versions

# Read all authorized device ids into an array
mapfile -t devices < <(adb devices | awk 'NR>1 && $2=="device" {print $1}')

for device in "${devices[@]}"; do
  # get the first matching versionName value
  version_full=$(adb -s "$device" shell dumpsys package com.android.chrome 2>/dev/null | awk -F= '/versionName=/ {print $2; exit}')
  if [[ -n "$version_full" ]]; then
    # keep only first three dot-separated components: X.Y.Z (drop the 4th and beyond)
    IFS='.' read -r a b c _ <<< "$version_full"
    if [[ -n "$c" ]]; then
      version_trim="$a.$b.$c"
    elif [[ -n "$b" ]]; then
      version_trim="$a.$b"
    else
      version_trim="$a"
    fi
    versions+=("$version_trim")
  fi
done

# Remove duplicates while preserving order
if [ "${#versions[@]}" -eq 0 ]; then
  echo '{ "chrome_versions": [] }' > "$out_file"
  exit 0
fi

unique_list=()
declare -A seen
for v in "${versions[@]}"; do
  if [[ -z "${seen[$v]}" ]]; then
    seen[$v]=1
    unique_list+=("$v")
  fi
done

# Build JSON array string
json_array=""
for v in "${unique_list[@]}"; do
  # escape any double quotes just in case (versions normally won't have them)
  esc=${v//\"/\\\"}
  if [ -z "$json_array" ]; then
    json_array="\"$esc\""
  else
    json_array="$json_array, \"$esc\""
  fi
done

printf '{ "chrome_versions": [%s] }\n' "$json_array" > "$out_file"
