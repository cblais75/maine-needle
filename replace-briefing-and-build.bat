@echo off
setlocal enableextensions
cd /d "C:\Users\colin\OneDrive\Desktop\Maine Election App\maine-needle"

set "LOG=%~dp0briefing-osborn-log.txt"
set "ZIP=%USERPROFILE%\Downloads\the-needle-project_2026-07-18_update-22_briefing-osborn.zip"
set "TMP=%TEMP%\update22"
set "SRC=%TMP%\the-needle-project_2026-07-18_update-22_briefing-osborn"

echo === replace-briefing-and-build.bat === > "%LOG%"

set "MISSING="
if not exist "%ZIP%" set "MISSING=1"
if defined MISSING echo ERROR: Update 22 zip not found at "%ZIP%"
if defined MISSING echo ERROR: zip not found >> "%LOG%"
if defined MISSING pause
if defined MISSING exit /b 1

echo [1/3] Extracting package...
if exist "%TMP%" rmdir /s /q "%TMP%"
powershell -NoProfile -Command "Expand-Archive -LiteralPath '%ZIP%' -DestinationPath '%TMP%' -Force" >> "%LOG%" 2>&1
if not exist "%SRC%\public\briefing.json" if exist "%TMP%\public\briefing.json" set "SRC=%TMP%"

echo [2/3] Replacing public\briefing.json (and nothing else)...
copy /y "%SRC%\public\briefing.json" "public\briefing.json" >> "%LOG%" 2>&1
echo copy exit: %ERRORLEVEL% >> "%LOG%"

echo --- Posts now in briefing.json --- >> "%LOG%"
powershell -NoProfile -Command "(Get-Content 'public\briefing.json' -Raw | ConvertFrom-Json) | ForEach-Object { $_.date + ' | ' + $_.title }" >> "%LOG%" 2>&1

echo [3/3] npm run build...
call npm run build >> "%LOG%" 2>&1
echo build exit: %ERRORLEVEL% >> "%LOG%"

echo.
echo === Done. Nothing has been committed or pushed yet. ===
type "%LOG%"
pause
