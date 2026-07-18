@echo off
setlocal enableextensions
cd /d "C:\Users\colin\OneDrive\Desktop\Maine Election App\maine-needle"

set "LOG=%~dp0update23-log.txt"
set "ZIP=%USERPROFILE%\Downloads\the-needle-project_2026-07-18_update-23_stress-test-infra.zip"
set "TMP=%TEMP%\update23"
set "SRC=%TMP%\the-needle-project_2026-07-18_update-23_stress-test-infra"

echo === update23-copy-and-build.bat === > "%LOG%"

set "MISSING="
if not exist "%ZIP%" set "MISSING=1"
if defined MISSING echo ERROR: Update 23 zip not found at "%ZIP%"
if defined MISSING echo ERROR: zip not found >> "%LOG%"
if defined MISSING pause
if defined MISSING exit /b 1

echo [1/5] Extracting package...
if exist "%TMP%" rmdir /s /q "%TMP%"
powershell -NoProfile -Command "Expand-Archive -LiteralPath '%ZIP%' -DestinationPath '%TMP%' -Force" >> "%LOG%" 2>&1
if not exist "%SRC%\package.json" if exist "%TMP%\package.json" set "SRC=%TMP%"

echo [2/5] Backing up data\polls.json, then copying (polls.json protected)...
copy /y "data\polls.json" "%TEMP%\polls-backup-u23.json" >> "%LOG%" 2>&1
robocopy "%SRC%" "%CD%" /E /XF "%SRC%\data\polls.json" >> "%LOG%" 2>&1
copy /y "%TEMP%\polls-backup-u23.json" "data\polls.json" >> "%LOG%" 2>&1
del /q "vite.config.js.timestamp-*.mjs" 2>nul

echo --- Key files present after copy --- >> "%LOG%"
for %%F in ("PROJECT_CONTEXT.md" "api\results.js" "scripts\test-night.mjs" "data\ga-baseline.json" "data\ne-baseline.json" "data\polls.json") do if exist "%%~F" (echo PRESENT: %%~F >> "%LOG%") else (echo MISSING: %%~F >> "%LOG%")

echo [3/5] Guardrail check on public\results.json...
echo --- results.json check --- >> "%LOG%"
powershell -NoProfile -Command "$r=Get-Content 'public\results.json' -Raw; Write-Output ('RAW: ' + $r.Trim()); try { $j=$r | ConvertFrom-Json; if ($j.updated -eq $null -and $j.source -eq 'simulation' -and ($j.races.PSObject.Properties.Count -eq 0)) { Write-Output 'GUARDRAIL: PASS' } else { Write-Output 'GUARDRAIL: FAIL' } } catch { Write-Output 'GUARDRAIL: FAIL (parse error)' }" >> "%LOG%" 2>&1

echo [4/5] npm run polls...
call npm run polls >> "%LOG%" 2>&1
echo polls exit: %ERRORLEVEL% >> "%LOG%"

echo [5/5] npm run build...
call npm run build >> "%LOG%" 2>&1
echo build exit: %ERRORLEVEL% >> "%LOG%"

echo.
echo === Done. NOTHING committed or pushed yet. Full details below and in update23-log.txt ===
type "%LOG%"
pause
