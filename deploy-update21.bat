@echo off
setlocal enableextensions
cd /d "C:\Users\colin\OneDrive\Desktop\Maine Election App\maine-needle"

set "PGIT_DIR=%LOCALAPPDATA%\PortableGit"
set "GIT_EXE=%PGIT_DIR%\bin\git.exe"
set "PATH=%PGIT_DIR%\bin;%PGIT_DIR%\usr\bin;%PATH%"
set "LOG=%~dp0deploy-update21-log.txt"
set "ZIP=%USERPROFILE%\Downloads\the-needle-project_2026-07-16_update-21_analytics.zip"
set "TMP=%TEMP%\update21"
set "SRC=%TMP%\the-needle-project_2026-07-16_update-21_analytics"

echo === deploy-update21.bat === > "%LOG%"
echo Log file: "%LOG%"

set "MISSING="
if not exist "%ZIP%" set "MISSING=1"
if defined MISSING echo ERROR: Update 21 zip not found at "%ZIP%"
if defined MISSING echo ERROR: zip not found >> "%LOG%"
if defined MISSING pause
if defined MISSING exit /b 1

echo [1/6] Extracting package...
if exist "%TMP%" rmdir /s /q "%TMP%"
powershell -NoProfile -Command "Expand-Archive -LiteralPath '%ZIP%' -DestinationPath '%TMP%' -Force" >> "%LOG%" 2>&1
if not exist "%SRC%\package.json" if exist "%TMP%\package.json" set "SRC=%TMP%"

echo [2/6] Copying files (excluding data\)...
robocopy "%SRC%" "%CD%" /E /XD data >> "%LOG%" 2>&1
del /q "vite.config.js.timestamp-*.mjs" 2>nul

echo [3/6] npm install (new dependency: @vercel/analytics)...
call npm install >> "%LOG%" 2>&1
echo npm install exit: %ERRORLEVEL% >> "%LOG%"

echo [4/6] npm run polls...
call npm run polls >> "%LOG%" 2>&1
echo polls exit: %ERRORLEVEL% >> "%LOG%"

echo [5/6] npm run build...
call npm run build >> "%LOG%" 2>&1
echo build exit: %ERRORLEVEL% >> "%LOG%"

echo [6/6] Commit and push...
if exist ".git\index.lock" del /q ".git\index.lock"
"%GIT_EXE%" add -A >> "%LOG%" 2>&1
echo add exit: %ERRORLEVEL% >> "%LOG%"
"%GIT_EXE%" commit -m "Update 21" >> "%LOG%" 2>&1
echo commit exit: %ERRORLEVEL% >> "%LOG%"
"%GIT_EXE%" log --oneline -3 >> "%LOG%" 2>&1

echo Pushing via git-push-final.bat...
call "%~dp0git-push-final.bat"

echo === Done. Full details in deploy-update21-log.txt ===
pause
