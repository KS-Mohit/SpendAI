# =============================================================================
# setup-native-libs.ps1
# Downloads, extracts, and copies RunAnywhere native .so files
# Run from project root: .\scripts\setup-native-libs.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

# =============================================================================
# Config
# =============================================================================
$VERSION = "0.19.4"
$BASE_URL = "https://github.com/RunanywhereAI/runanywhere-sdks/releases/download/v$VERSION"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_ROOT = Split-Path -Parent $SCRIPT_DIR
$TEMP_DIR = Join-Path $env:TEMP "runanywhere-setup"
$NODE_MODULES = Join-Path $PROJECT_ROOT "node_modules"

# Target directories
$CORE_DIR   = Join-Path $NODE_MODULES "@runanywhere\core\android\src\main\jniLibs\arm64-v8a"
$LLAMA_DIR  = Join-Path $NODE_MODULES "@runanywhere\llamacpp\android\src\main\jniLibs\arm64-v8a"
$ONNX_DIR   = Join-Path $NODE_MODULES "@runanywhere\onnx\android\src\main\jniLibs\arm64-v8a"

# Files to download
$DOWNLOADS = @(
    @{ Name = "RACommons";     Url = "$BASE_URL/RACommons-android-arm64-v8a-v$VERSION.zip" },
    @{ Name = "RABackendLLAMACPP"; Url = "$BASE_URL/RABackendLLAMACPP-android-arm64-v8a-v$VERSION.zip" },
    @{ Name = "RABackendONNX"; Url = "$BASE_URL/RABackendONNX-android-arm64-v8a-v$VERSION.zip" }
)

# =============================================================================
# Counters
# =============================================================================
$successCount = 0
$failCount = 0
$failures = @()

function Log-Success($msg) { Write-Host "  [OK] $msg" -ForegroundColor Green;   $script:successCount++ }
function Log-Fail($msg)    { Write-Host "  [FAIL] $msg" -ForegroundColor Red;   $script:failCount++;   $script:failures += $msg }
function Log-Info($msg)    { Write-Host "  $msg" -ForegroundColor Cyan }
function Log-Section($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Yellow }

# =============================================================================
# Step 1: Verify node_modules exist
# =============================================================================
Log-Section "Checking project structure"
if (-not (Test-Path $NODE_MODULES)) {
    Write-Host "[ERROR] node_modules not found at $NODE_MODULES" -ForegroundColor Red
    Write-Host "        Run 'npm install' first." -ForegroundColor Red
    exit 1
}
Log-Info "node_modules found at $NODE_MODULES"

# Create target dirs if missing
foreach ($dir in @($CORE_DIR, $LLAMA_DIR, $ONNX_DIR)) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Log-Info "Created directory: $dir"
    }
}

# =============================================================================
# Step 2: Create temp download directory
# =============================================================================
Log-Section "Preparing temp directory"
if (Test-Path $TEMP_DIR) {
    Remove-Item $TEMP_DIR -Recurse -Force
}
New-Item -ItemType Directory -Path $TEMP_DIR -Force | Out-Null
Log-Info "Temp dir: $TEMP_DIR"

# =============================================================================
# Step 3: Download zips
# =============================================================================
Log-Section "Downloading zips from GitHub (v$VERSION)"
$zipPaths = @{}

foreach ($dl in $DOWNLOADS) {
    $zipPath = Join-Path $TEMP_DIR "$($dl.Name).zip"
    Log-Info "Downloading $($dl.Name)..."
    Log-Info "  URL: $($dl.Url)"
    try {
        Invoke-WebRequest -Uri $dl.Url -OutFile $zipPath -UseBasicParsing
        $sizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
        Log-Success "Downloaded $($dl.Name) ($sizeMB MB)"
        $zipPaths[$dl.Name] = $zipPath
    } catch {
        Log-Fail "Failed to download $($dl.Name): $_"
    }
}

# =============================================================================
# Step 4: Extract zips
# =============================================================================
Log-Section "Extracting zips"
$extractPaths = @{}

foreach ($name in $zipPaths.Keys) {
    $extractTo = Join-Path $TEMP_DIR $name
    try {
        Expand-Archive -Path $zipPaths[$name] -DestinationPath $extractTo -Force
        Log-Success "Extracted $name"
        $extractPaths[$name] = $extractTo
    } catch {
        Log-Fail "Failed to extract $name : $_"
    }
}

# =============================================================================
# Helper: find .so files recursively under arm64-v8a
# =============================================================================
function Get-SoFiles($extractPath) {
    return Get-ChildItem -Path $extractPath -Recurse -Filter "*.so" |
           Where-Object { $_.FullName -match "arm64-v8a" }
}

# =============================================================================
# Helper: copy a single .so file to destination, skip librac_commons from backends
# =============================================================================
function Copy-SoFile($soFile, $destDir, $skipCommons = $false) {
    if ($skipCommons -and $soFile.Name -eq "librac_commons.so") {
        Log-Info "  Skipped $($soFile.Name) (core is authoritative source)"
        return
    }
    $dest = Join-Path $destDir $soFile.Name
    try {
        Copy-Item -Path $soFile.FullName -Destination $dest -Force
        Log-Success "Copied $($soFile.Name) -> $destDir"
    } catch {
        Log-Fail "Failed to copy $($soFile.Name): $_"
    }
}

# =============================================================================
# Step 5: Copy RACommons -> core jniLibs
# =============================================================================
Log-Section "Copying RACommons -> @runanywhere/core"
if ($extractPaths.ContainsKey("RACommons")) {
    $soFiles = Get-SoFiles $extractPaths["RACommons"]
    if ($soFiles.Count -eq 0) {
        Log-Fail "No .so files found in RACommons extract"
    } else {
        foreach ($so in $soFiles) {
            Copy-SoFile $so $CORE_DIR
        }
    }
} else {
    Log-Fail "RACommons was not downloaded/extracted, skipping"
}

# =============================================================================
# Step 6: Copy RABackendLLAMACPP -> llamacpp jniLibs
# =============================================================================
Log-Section "Copying RABackendLLAMACPP -> @runanywhere/llamacpp"
if ($extractPaths.ContainsKey("RABackendLLAMACPP")) {
    $soFiles = Get-SoFiles $extractPaths["RABackendLLAMACPP"]
    if ($soFiles.Count -eq 0) {
        Log-Fail "No .so files found in RABackendLLAMACPP extract"
    } else {
        foreach ($so in $soFiles) {
            Copy-SoFile $so $LLAMA_DIR -skipCommons $true
        }
    }
} else {
    Log-Fail "RABackendLLAMACPP was not downloaded/extracted, skipping"
}

# =============================================================================
# Step 7: Copy RABackendONNX -> onnx jniLibs
# =============================================================================
Log-Section "Copying RABackendONNX -> @runanywhere/onnx"
if ($extractPaths.ContainsKey("RABackendONNX")) {
    $soFiles = Get-SoFiles $extractPaths["RABackendONNX"]
    if ($soFiles.Count -eq 0) {
        Log-Fail "No .so files found in RABackendONNX extract"
    } else {
        foreach ($so in $soFiles) {
            Copy-SoFile $so $ONNX_DIR -skipCommons $true
        }
    }
} else {
    Log-Fail "RABackendONNX was not downloaded/extracted, skipping"
}

# =============================================================================
# Step 8: Remove x86_64 folders (not needed for physical devices)
# =============================================================================
Log-Section "Removing x86_64 folders"
foreach ($pkg in @("llamacpp", "onnx")) {
    $x86Dir = Join-Path $NODE_MODULES "@runanywhere\$pkg\android\src\main\jniLibs\x86_64"
    if (Test-Path $x86Dir) {
        try {
            Remove-Item $x86Dir -Recurse -Force
            Log-Success "Removed x86_64 from $pkg"
        } catch {
            Log-Fail "Failed to remove x86_64 from $pkg : $_"
        }
    } else {
        Log-Info "x86_64 folder not found in $pkg (already removed)"
    }
}

# =============================================================================
# Step 9: Cleanup temp
# =============================================================================
Log-Section "Cleaning up"
try {
    Remove-Item $TEMP_DIR -Recurse -Force
    Log-Info "Temp directory removed"
} catch {
    Log-Info "Could not remove temp dir (non-critical)"
}

# =============================================================================
# Summary
# =============================================================================
Write-Host "`n=============================================" -ForegroundColor White
Write-Host "  SUMMARY" -ForegroundColor White
Write-Host "=============================================" -ForegroundColor White
Write-Host "  Successful: $successCount" -ForegroundColor Green
Write-Host "  Failed:     $failCount" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })

if ($failures.Count -gt 0) {
    Write-Host "`n  Failed operations:" -ForegroundColor Red
    foreach ($f in $failures) {
        Write-Host "    - $f" -ForegroundColor Red
    }
    Write-Host "`n[RESULT] Setup completed with errors. Fix failures before building." -ForegroundColor Red
    exit 1
} else {
    Write-Host "`n[RESULT] All native libraries set up successfully!" -ForegroundColor Green
    Write-Host "  You can now run: npx expo run:android" -ForegroundColor Cyan
    exit 0
}