@echo off
cd /d "C:\Users\colin\OneDrive\Desktop\Maine Election App\maine-needle"

set "PGIT_DIR=%LOCALAPPDATA%\PortableGit"
set "GIT_EXE=%PGIT_DIR%\bin\git.exe"
set "GH_EXE=C:\Program Files\GitHub CLI\gh.exe"
set "PATH=%PGIT_DIR%\bin;%PGIT_DIR%\usr\bin;%PATH%"
set "LOG=%~dp0deploy-update35-log.txt"

echo. > "%LOG%"
echo === deploy-update35.bat === >> "%LOG%"

echo Clearing dist... >> "%LOG%"
if exist "dist" (rd /s /q "dist" && echo dist cleared >> "%LOG%")

echo Running npm run polls... >> "%LOG%"
call npm run polls >> "%LOG%" 2>&1
echo Polls exit: %ERRORLEVEL% >> "%LOG%"

echo Running npm run build... >> "%LOG%"
call npm run build >> "%LOG%" 2>&1
echo Build exit: %ERRORLEVEL% >> "%LOG%"

if exist ".git\HEAD.lock" (del /q ".git\HEAD.lock" && echo Removed HEAD.lock >> "%LOG%")
if exist ".git\index.lock" (del /q ".git\index.lock" && echo Removed index.lock >> "%LOG%")

"%GIT_EXE%" add -A >> "%LOG%" 2>&1
echo Add exit: %ERRORLEVEL% >> "%LOG%"

"%GIT_EXE%" commit -m "Update 35" >> "%LOG%" 2>&1
echo Commit exit: %ERRORLEVEL% >> "%LOG%"

"%GIT_EXE%" log --oneline -4 >> "%LOG%" 2>&1

"%GH_EXE%" auth token > "%~dp0tok.tmp" 2>> "%LOG%"
set /p TOKEN= < "%~dp0tok.tmp"
del /q "%~dp0tok.tmp" 2>nul

"%GIT_EXE%" remote set-url origin https://cblais75:%TOKEN%@github.com/cblais75/maine-needle.git
"%GIT_EXE%" push origin main >> "%LOG%" 2>&1
set "PUSH_EXIT=%ERRORLEVEL%"
"%GIT_EXE%" remote set-url origin https://github.com/cblais75/maine-needle.git

echo Push exit: %PUSH_EXIT% >> "%LOG%"
echo === Done === >> "%LOG%"
type "%LOG%"
pause
