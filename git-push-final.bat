@echo off
cd /d "C:\Users\colin\OneDrive\Desktop\Maine Election App\maine-needle"

set "PGIT_DIR=%LOCALAPPDATA%\PortableGit"
set "GIT_EXE=%PGIT_DIR%\bin\git.exe"
set "GH_EXE=C:\Program Files\GitHub CLI\gh.exe"
set "PATH=%PGIT_DIR%\bin;%PGIT_DIR%\usr\bin;%PATH%"
set "LOG=%~dp0push-final-log.txt"

echo. > "%LOG%"
echo === git-push-final.bat === >> "%LOG%"

:: Get gh token (real gh.exe, not stub)
"%GH_EXE%" auth token > "%~dp0tok.tmp" 2>> "%LOG%"
set /p TOKEN= < "%~dp0tok.tmp"
del /q "%~dp0tok.tmp" 2>nul

echo Token prefix: [%TOKEN:~0,5%] >> "%LOG%"

if not defined TOKEN (
    echo ERROR: no token >> "%LOG%"
    type "%LOG%"
    pause
    exit /b 1
)

:: Show current log
echo === Git log === >> "%LOG%"
"%GIT_EXE%" log --oneline -4 >> "%LOG%" 2>&1

:: Embed token in URL and push
"%GIT_EXE%" remote set-url origin https://cblais75:%TOKEN%@github.com/cblais75/maine-needle.git

echo === Pushing === >> "%LOG%"
"%GIT_EXE%" push origin main >> "%LOG%" 2>&1
set "PUSH_EXIT=%ERRORLEVEL%"
echo Push exit: %PUSH_EXIT% >> "%LOG%"

:: Always restore clean URL
"%GIT_EXE%" remote set-url origin https://github.com/cblais75/maine-needle.git

echo === Done === >> "%LOG%"
type "%LOG%"
pause
