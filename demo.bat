@echo off
cd /d "C:\Users\colin\OneDrive\Desktop\Maine Election App\maine-needle"
CALL "C:\Program Files\nodejs\npm.cmd" run results:demo > demo-log.txt 2>&1
echo Exit: %errorlevel% >> demo-log.txt
