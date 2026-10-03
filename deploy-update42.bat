@echo off
cd /d "C:\Users\colin\OneDrive\Desktop\Maine Election App\maine-needle"

set "PGIT_DIR=%LOCALAPPDATA%\PortableGit"
set "GIT_EXE=%PGIT_DIR%\bin\git.exe"
set "GH_EXE=C:\Program Files\GitHub CLI\gh.exe"
set "PATH=%PGIT_DIR%\bin;%PGIT_DIR%\usr\bin;%PATH%"
set "LOG=%~dp0deploy-update42-log.txt"

echo. > "%LOG%"
echo === deploy-update42.bat === >> "%LOG%"
echo %date% %time% >> "%LOG%"

REM Clear dist/ so Windows doesn't EPERM the build
if exist "dist" (
    echo Clearing dist\ ... >> "%LOG%"
    rd /s /q dist
    echo dist cleared. >> "%LOG%"
)

REM Build
echo Running npm run build ... >> "%LOG%"
call npm run build >> "%LOG%" 2>&1
set "BUILD_EXIT=%ERRORLEVEL%"
echo Build exit: %BUILD_EXIT% >> "%LOG%"

if %BUILD_EXIT% NEQ 0 (
    echo BUILD FAILED - aborting commit and push >> "%LOG%"
    type "%LOG%"
    pause
    exit /b %BUILD_EXIT%
)

REM Git commit
if exist ".git\HEAD.lock" (del /q ".git\HEAD.lock" && echo Removed HEAD.lock >> "%LOG%")
if exist ".git\index.lock" (del /q ".git\index.lock" && echo Removed index.lock >> "%LOG%")

"%GIT_EXE%" add -A >> "%LOG%" 2>&1
echo Add exit: %ERRORLEVEL% >> "%LOG%"

"%GIT_EXE%" commit -m "Update 42: newspaper look" >> "%LOG%" 2>&1
echo Commit exit: %ERRORLEVEL% >> "%LOG%"

"%GIT_EXE%" log --oneline -4 >> "%LOG%" 2>&1

REM Push via gh auth token
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
