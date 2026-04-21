param()
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$outJson = Join-Path (Get-Location) "devices_chrome_versions.json"
$remoteUrl = "https://googlechromelabs.github.io/chrome-for-testing/latest-patch-versions-per-build-with-downloads.json"
$destDir = Join-Path $HOME "Documents\chromedriver"
$tempRoot = Join-Path $env:TEMP ("chromedriver_fetch_" + [guid]::NewGuid().ToString())
$remoteFile = Join-Path $tempRoot "remote.json"
$workRoot = Join-Path $tempRoot "work"

# prerequisites
foreach ($cmd in @("Invoke-RestMethod","Expand-Archive","Invoke-WebRequest")) {
    if (-not (Get-Command -Name $cmd -ErrorAction SilentlyContinue)) {
        Write-Error "Required PowerShell command '$cmd' not available. Use PowerShell 5+ or 7+."
        exit 1
    }
}

if (-not (Test-Path $outJson)) {
    Write-Error "$outJson not found in current directory."
    exit 1
}

New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
New-Item -ItemType Directory -Path $workRoot -Force | Out-Null
New-Item -ItemType Directory -Path $destDir -Force | Out-Null

try {
    Write-Output "Fetching remote index..."
    Invoke-WebRequest -Uri $remoteUrl -OutFile $remoteFile -UseBasicParsing
    $remoteJson = Get-Content $remoteFile -Raw | ConvertFrom-Json
    $remoteText = Get-Content $remoteFile -Raw

    $prefixes = (Get-Content $outJson | ConvertFrom-Json).chrome_versions
    $uniquePrefixes = [System.Collections.ArrayList]::new()
    foreach ($p in $prefixes) { if (-not $uniquePrefixes.Contains($p)) { $uniquePrefixes.Add($p) | Out-Null } }

    if ($uniquePrefixes.Count -eq 0) {
        Write-Output "No chrome_versions found in $outJson"
        exit 0
    }

    foreach ($prefix in $uniquePrefixes) {
        Write-Output ""
        Write-Output "Processing prefix: $prefix"

        # find full build candidate (prefix.N)
        $build = $null
        $stack = New-Object System.Collections.ArrayList
        $stack.Add($remoteJson) | Out-Null
        $candidates = @()
        while ($stack.Count -gt 0) {
            $item = $stack[0]; $stack.RemoveAt(0)
            if ($item -is [System.Collections.IDictionary]) {
                foreach ($k in $item.Keys) {
                    $v = $item[$k]
                    if ($v -is [string]) {
                        if ($v -match ("^" + [regex]::Escape($prefix) + "\.\d+$")) { $candidates += $v }
                    } elseif ($v -is [System.Collections.IEnumerable] -and -not ($v -is [string])) {
                        $stack.Add($v) | Out-Null
                    } elseif ($v -is [System.Collections.IDictionary]) {
                        $stack.Add($v) | Out-Null
                    }
                }
            } elseif ($item -is [System.Collections.IEnumerable] -and -not ($item -is [string])) {
                foreach ($sub in $item) { $stack.Add($sub) | Out-Null }
            }
        }
        if ($candidates.Count -gt 0) { $build = $candidates[0] }

        if (-not $build) {
            $m = [regex]::Match($remoteText, [regex]::Escape($prefix) + "\.\d+")
            if ($m.Success) { $build = $m.Value }
        }

        if (-not $build) {
            Write-Warning "  No full build found for prefix $prefix — skipping."
            continue
        }

        Write-Output "  Selected build: $build"

        # derive per-build name chromedriver_X_Y_Z
        $parts = $build -split '\.'
        if ($parts.Length -ge 3) {
            $p1 = $parts[0]; $p2 = $parts[1]; $p3 = $parts[2]
        } else {
            $parts2 = $prefix -split '\.'
            $p1 = $parts2[0]; $p2 = if ($parts2.Length -ge 2) { $parts2[1] } else { '0' }
            $p3 = if ($parts2.Length -ge 3) { $parts2[2] } else { '0' }
        }
        $perbuild_name = "chromedriver_{0}_{1}_{2}" -f $p1,$p2,$p3

        # find linux64 chromedriver URL
        $url = $null
        $stack = New-Object System.Collections.ArrayList
        $stack.Add($remoteJson) | Out-Null
        while ($stack.Count -gt 0 -and -not $url) {
            $item = $stack[0]; $stack.RemoveAt(0)
            if ($item -is [System.Collections.IDictionary]) {
                foreach ($k in $item.Keys) {
                    $v = $item[$k]
                    if ($v -is [string]) {
                        if ($v -match "/linux64/" -and $v -match "chromedriver" -and $v -match [regex]::Escape($build)) {
                            $url = $v; break
                        }
                    } elseif ($v -is [System.Collections.IEnumerable] -and -not ($v -is [string])) {
                        $stack.Add($v) | Out-Null
                    } elseif ($v -is [System.Collections.IDictionary]) {
                        $stack.Add($v) | Out-Null
                    }
                }
            } elseif ($item -is [System.Collections.IEnumerable] -and -not ($item -is [string])) {
                foreach ($sub in $item) { $stack.Add($sub) | Out-Null }
            }
        }

        if (-not $url) {
            $regex = [regex] 'https?://[^\s"\\]*/linux64/[^\s"\\]*'
            $matches = $regex.Matches($remoteText) | Where-Object { $_.Value -match [regex]::Escape($build) -and $_.Value -match "chromedriver" }
            if ($matches.Count -gt 0) { $url = $matches[0].Value }
        }

        if (-not $url) {
            $regex = [regex] 'https?://[^\s"\\]*/linux64/[^\s"\\]*'
            $m = $regex.Match($remoteText)
            if ($m.Success -and $m.Value -match "chromedriver") { $url = $m.Value }
        }

        if (-not $url) {
            Write-Warning "  Could not find linux64 chromedriver URL for build $build — skipping."
            continue
        }

        Write-Output "  Download URL: $url"

        # download into per-build workdir
        $zipName = [IO.Path]::GetFileName($url)
        $iterDir = Join-Path $workRoot $build
        New-Item -ItemType Directory -Path $iterDir -Force | Out-Null
        $zipPath = Join-Path $iterDir $zipName

        Write-Output "  Downloading $zipName..."
        Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing

        # extract
        $extractDir = Join-Path $iterDir ([IO.Path]::GetFileNameWithoutExtension($zipName))
        New-Item -ItemType Directory -Path $extractDir -Force | Out-Null
        Write-Output "  Extracting..."
        Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

        # find chromedriver binary
        $chromedriver = Get-ChildItem -Path $extractDir -Recurse -File -ErrorAction SilentlyContinue |
                       Where-Object { $_.Name -ieq "chromedriver" } | Select-Object -First 1

        if (-not $chromedriver) {
            Write-Warning "  chromedriver binary not found after extraction — cleaning and skipping."
            Remove-Item -Recurse -Force $iterDir
            continue
        }

        $perbuild = Join-Path $destDir $perbuild_name
        $final = Join-Path $destDir "chromedriver"

        Copy-Item -Path $chromedriver.FullName -Destination $perbuild -Force
        try { icacls $perbuild /grant "${env:USERNAME}:(RX)" | Out-Null } catch { }

        # update canonical copy by copying (do not remove per-build)
        Copy-Item -Path $perbuild -Destination $final -Force

        Write-Output "  Installed chromedriver for $build -> $final (per-build: $perbuild_name)"

        # cleanup iteration
        Remove-Item -Recurse -Force $iterDir
    }

    Write-Output ""
    Write-Output "Done. Per-build files are in: $destDir"
} finally {
    if (Test-Path $tempRoot) { Remove-Item -Recurse -Force $tempRoot -ErrorAction SilentlyContinue }
}
