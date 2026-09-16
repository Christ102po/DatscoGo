$ErrorActionPreference = "Stop"

Write-Host "DatscoGo - Full Live Sync + Trip Tracking + Background GPS Update" -ForegroundColor Cyan
$root = (Get-Location).Path
$patchRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$packagePath = Join-Path $root "package.json"
if (-not (Test-Path $packagePath)) { throw "Run this from your DatscoGo project root (the folder containing package.json)." }

$backup = Join-Path $root ("backup-before-datscogo-full-update-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Force -Path $backup | Out-Null

$copyFiles = @(
  "server/datscoStore.ts",
  "server/index.ts",
  "client/src/types/datsco.ts",
  "client/src/lib/api.ts",
  "client/src/lib/routing.ts",
  "client/src/lib/placeSearch.ts",
  "client/src/lib/driverTracking.ts",
  "client/src/components/DatscoMap.tsx",
  "client/src/pages/UserDashboard.tsx",
  "client/src/pages/DriverDashboard.tsx",
  "client/src/pages/AdminDashboard.tsx",
  "data/datscogo.json"
)

foreach ($relative in $copyFiles) {
  $existing = Join-Path $root $relative
  if (Test-Path $existing) {
    $backupTarget = Join-Path $backup $relative
    New-Item -ItemType Directory -Force -Path (Split-Path $backupTarget -Parent) | Out-Null
    Copy-Item $existing $backupTarget -Force
  }
}

foreach ($extra in @("package.json", "capacitor.config.ts", "android/app/src/main/AndroidManifest.xml", "android/app/src/main/res/values/strings.xml")) {
  $existing = Join-Path $root $extra
  if (Test-Path $existing) {
    $backupTarget = Join-Path $backup $extra
    New-Item -ItemType Directory -Force -Path (Split-Path $backupTarget -Parent) | Out-Null
    Copy-Item $existing $backupTarget -Force
  }
}

foreach ($relative in $copyFiles) {
  $source = Join-Path $patchRoot $relative
  if (-not (Test-Path $source)) { continue }
  $destination = Join-Path $root $relative
  New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
  Copy-Item $source $destination -Force
}

# Add the native background tracking dependencies without deleting existing package entries.
$pkg = Get-Content $packagePath -Raw | ConvertFrom-Json
if (-not $pkg.dependencies) { $pkg | Add-Member -MemberType NoteProperty -Name dependencies -Value ([pscustomobject]@{}) }
$deps = $pkg.dependencies
$deps | Add-Member -MemberType NoteProperty -Name "@capacitor-community/background-geolocation" -Value "^1.2.26" -Force

$coreVersion = [string]$deps."@capacitor/core"
$major = 7
if ($coreVersion -match '(\d+)') { $major = [int]$Matches[1] }
$deps | Add-Member -MemberType NoteProperty -Name "@capacitor/local-notifications" -Value "^$major.0.0" -Force

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($packagePath, ($pkg | ConvertTo-Json -Depth 100), $utf8NoBom)

# Patch Capacitor config with android.useLegacyBridge=true when possible.
$capPath = Join-Path $root "capacitor.config.ts"
if (Test-Path $capPath) {
  $cap = Get-Content $capPath -Raw
  if ($cap -notmatch 'useLegacyBridge\s*:\s*true') {
    if ($cap -match 'android\s*:\s*\{') {
      $cap = [regex]::Replace($cap, 'android\s*:\s*\{', "android: {`r`n    useLegacyBridge: true,", 1)
    } elseif ($cap -match 'webDir\s*:\s*[^,]+,') {
      $cap = [regex]::Replace($cap, '(webDir\s*:\s*[^,]+,)', '$1' + "`r`n  android: { useLegacyBridge: true },", 1)
    }
    [System.IO.File]::WriteAllText($capPath, $cap, $utf8NoBom)
  }
}

# Patch AndroidManifest permissions if Android has already been added.
$manifestPath = Join-Path $root "android/app/src/main/AndroidManifest.xml"
if (Test-Path $manifestPath) {
  $manifest = Get-Content $manifestPath -Raw
  $permissions = @(
    '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
    '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
    '<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />',
    '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
    '<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
    '<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />'
  )
  $insert = ""
  foreach ($line in $permissions) {
    $permName = [regex]::Match($line, 'android\.permission\.[A-Z_]+').Value
    if ($manifest -notmatch [regex]::Escape($permName)) { $insert += "    $line`r`n" }
  }
  if ($insert) {
    $manifest = $manifest -replace '(\s*<application)', ("`r`n" + $insert + '$1')
    [System.IO.File]::WriteAllText($manifestPath, $manifest, $utf8NoBom)
  }
}

# Add the background notification channel label if strings.xml is available.
$stringsPath = Join-Path $root "android/app/src/main/res/values/strings.xml"
if (Test-Path $stringsPath) {
  $strings = Get-Content $stringsPath -Raw
  if ($strings -notmatch 'capacitor_background_geolocation_notification_channel_name') {
    $addition = @"
    <string name="capacitor_background_geolocation_notification_channel_name">DatscoGo Live Trip</string>
    <string name="capacitor_background_geolocation_notification_icon">mipmap/ic_launcher</string>
"@
    $strings = $strings -replace '</resources>', ($addition + "`r`n</resources>")
    [System.IO.File]::WriteAllText($stringsPath, $strings, $utf8NoBom)
  }
}

Write-Host ""
Write-Host "Update files copied successfully." -ForegroundColor Green
Write-Host "Backup created at: $backup" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next commands (pnpm project):" -ForegroundColor Cyan
Write-Host "  pnpm install"
Write-Host "  pnpm run build"
Write-Host "  pnpm exec cap sync android"
Write-Host "  pnpm exec cap open android"
Write-Host ""
Write-Host "Before Android build, set VITE_API_BASE_URL to your real Render HTTPS URL." -ForegroundColor Yellow
