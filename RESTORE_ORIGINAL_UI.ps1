$ErrorActionPreference = 'Stop'

Write-Host 'DatscoGo - Restore Original UI' -ForegroundColor Cyan
Write-Host 'This restores ONLY the UI files changed by the routing patch.' -ForegroundColor DarkGray
Write-Host 'Server/data/routing helper files are left untouched.' -ForegroundColor DarkGray
Write-Host ''

$root = (Get-Location).Path
if (-not (Test-Path (Join-Path $root '.git'))) {
    throw 'Run this from the root of your DatscoGo Git repository (the folder containing .git and package.json).'
}
if (-not (Test-Path (Join-Path $root 'package.json'))) {
    throw 'package.json was not found. Run this from the DatscoGo project root.'
}

# These are the files from the earlier patch that altered the visible UI.
# We intentionally DO NOT restore server/, data/, lib/api.ts, lib/routing.ts,
# types/datsco.ts, vite.config.ts, or the DatscoGo sidebar.
$uiPaths = @(
    'client/src/App.tsx',
    'client/src/main.tsx',
    'client/src/index.css',
    'client/src/pages/UserDashboard.tsx',
    'client/src/pages/AdminDashboard.tsx',
    'client/src/pages/DriverDashboard.tsx',
    'client/src/components/DatscoMap.tsx'
)

# Backup the currently modified UI first.
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $root ("backup-ui-before-restore-$stamp")
New-Item -ItemType Directory -Force -Path $backup | Out-Null
foreach ($relative in $uiPaths) {
    $source = Join-Path $root $relative
    if (Test-Path $source) {
        $dest = Join-Path $backup $relative
        New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null
        Copy-Item $source $dest -Force
    }
}

function Get-CommitChangedFiles([string]$commit) {
    $output = git diff-tree --no-commit-id --name-only -r $commit 2>$null
    if ($LASTEXITCODE -ne 0) { return @() }
    return @($output)
}

# First try the commit message that was recommended when the patch was pushed.
$patchCommit = (git log --all --format='%H' --grep='Add admin routes, accurate road routing and live driver GPS' -n 1 2>$null | Select-Object -First 1)

# If the message was changed, locate the patch by the distinctive set of files it changed.
if (-not $patchCommit) {
    $candidateCommits = @(git log --all --format='%H' -- 'client/src/pages/UserDashboard.tsx' 2>$null)
    foreach ($commit in $candidateCommits) {
        $changed = Get-CommitChangedFiles $commit
        $hasUser = $changed -contains 'client/src/pages/UserDashboard.tsx'
        $hasCss = $changed -contains 'client/src/index.css'
        $hasServer = ($changed -contains 'server/datscoStore.ts') -or ($changed -contains 'server/index.ts')
        if ($hasUser -and $hasCss -and $hasServer) {
            $patchCommit = $commit
            break
        }
    }
}

if (-not $patchCommit) {
    Write-Host ''
    Write-Host 'I could not automatically identify the UI-changing patch commit.' -ForegroundColor Yellow
    Write-Host 'Recent commits:' -ForegroundColor Yellow
    git --no-pager log --oneline -10
    throw "No files were changed. Find the commit that added the routing/live-GPS patch, then run: .\RESTORE_ORIGINAL_UI.ps1 -PatchCommit <commit>"
}

# The original UI is the parent of the patch commit.
$originalCommit = (git rev-parse "$patchCommit^" 2>$null).Trim()
if (-not $originalCommit) {
    throw 'Could not find the parent commit containing the original UI.'
}

Write-Host "Routing patch commit: $patchCommit" -ForegroundColor DarkGray
Write-Host "Original UI source:    $originalCommit" -ForegroundColor Green
Write-Host "Backup folder:         $backup" -ForegroundColor Yellow
Write-Host ''

foreach ($relative in $uiPaths) {
    git cat-file -e "$originalCommit`:$relative" 2>$null
    $existedBefore = ($LASTEXITCODE -eq 0)

    if ($existedBefore) {
        Write-Host "Restoring $relative" -ForegroundColor Green
        git restore --source=$originalCommit --staged --worktree -- $relative
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to restore $relative"
        }
    } else {
        # If the patch introduced a brand-new UI file, remove it only if tracked now.
        git ls-files --error-unmatch -- $relative 1>$null 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Removing patch-only UI file $relative" -ForegroundColor Yellow
            git rm -f --ignore-unmatch -- $relative | Out-Null
        } elseif (Test-Path (Join-Path $root $relative)) {
            Write-Host "Removing untracked patch-only UI file $relative" -ForegroundColor Yellow
            Remove-Item (Join-Path $root $relative) -Force
        }
    }
}

Write-Host ''
Write-Host 'Original UI restored.' -ForegroundColor Green
Write-Host 'The following were intentionally NOT rolled back:' -ForegroundColor Cyan
Write-Host '  - server/datscoStore.ts'
Write-Host '  - server/index.ts'
Write-Host '  - data/datscogo.json'
Write-Host '  - client/src/lib/api.ts'
Write-Host '  - client/src/lib/routing.ts'
Write-Host '  - client/src/types/datsco.ts'
Write-Host '  - DatscoGo sidebar / PWA configuration'
Write-Host ''
Write-Host 'Review the result:' -ForegroundColor Cyan
Write-Host '  git status'
Write-Host '  npm run build'
Write-Host ''
Write-Host 'If it looks correct, commit it:' -ForegroundColor Cyan
Write-Host '  git add .'
Write-Host '  git commit -m "Restore original DatscoGo UI"'
Write-Host '  git push origin main'
