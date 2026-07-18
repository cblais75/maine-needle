@echo off
setlocal enableextensions
cd /d "C:\Users\colin\OneDrive\Desktop\Maine Election App\maine-needle"

set "PGIT_DIR=%LOCALAPPDATA%\PortableGit"
set "GIT_EXE=%PGIT_DIR%\bin\git.exe"
set "PATH=%PGIT_DIR%\bin;%PGIT_DIR%\usr\bin;%PATH%"
set "LOG=%~dp0commit-briefing-osborn-log.txt"
set "MSG=%TEMP%\briefing-osborn-msg.txt"

echo === commit-briefing-osborn.bat === > "%LOG%"

if exist ".git\index.lock" del /q ".git\index.lock"
del /q "vite.config.js.timestamp-*.mjs" 2>nul

powershell -NoProfile -Command "[IO.File]::WriteAllText($env:TEMP + '\briefing-osborn-msg.txt', 'Briefing ' + [char]0x2014 + ' Osborn', (New-Object Text.UTF8Encoding($false)))"

"%GIT_EXE%" add -A >> "%LOG%" 2>&1
echo add exit: %ERRORLEVEL% >> "%LOG%"
"%GIT_EXE%" commit -F "%MSG%" >> "%LOG%" 2>&1
echo commit exit: %ERRORLEVEL% >> "%LOG%"
"%GIT_EXE%" log --oneline -3 >> "%LOG%" 2>&1
type "%LOG%"

echo Pushing via git-push-final.bat...
call "%~dp0git-push-final.bat"
