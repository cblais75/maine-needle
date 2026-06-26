@echo off
cd /d "C:\Users\colin\OneDrive\Desktop\Maine Election App\maine-needle"

:: Clean up any temp/diagnostic files
del /q diag.bat diag.txt port.bat port.txt npm-log.txt check-port.bat port-check.txt 2>nul

:: Kill any existing Vite on port 5173
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: Install / sync dependencies
echo Running npm install...
CALL "C:\Program Files\nodejs\npm.cmd" install

:: Start dev server
echo Starting Vite...
CALL "C:\Program Files\nodejs\npm.cmd" run dev
pause
