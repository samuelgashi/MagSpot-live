# Save as get_chrome_versions.ps1 and run:
# powershell -ExecutionPolicy Bypass -File .\get_chrome_versions.ps1

$outFile = ".\devices_chrome_versions.json"

# Get authorized devices
$devices = adb devices | ForEach-Object {
    if ($_ -match '^\s*([^\s]+)\s+device\s*$') { $matches[1] }
} | Where-Object { $_ -ne $null }

$versions = @()
foreach ($device in $devices) {
    $line = adb -s $device shell dumpsys package com.android.chrome 2>$null | Select-String -Pattern "versionName=" -SimpleMatch
    if ($line) {
        $versionFull = ($line -split "=")[-1].Trim()
        if ($versionFull) {
            $parts = $versionFull -split '\.'
            if ($parts.Length -ge 3) {
                $trim = "$($parts[0]).$($parts[1]).$($parts[2])"
            } elseif ($parts.Length -eq 2) {
                $trim = "$($parts[0]).$($parts[1])"
            } else {
                $trim = $parts[0]
            }
            $versions += $trim
        }
    }
}

# Remove duplicates while preserving order
$uniqueVersions = @()
foreach ($v in $versions) {
    if (-not ($uniqueVersions -contains $v)) { $uniqueVersions += $v }
}

# Build JSON and save
$object = @{ chrome_versions = $uniqueVersions }
$object | ConvertTo-Json -Depth 2 | Set-Content -Path $outFile -Encoding UTF8
