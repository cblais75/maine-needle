@echo off
cd /d "C:\Users\colin\OneDrive\Desktop\Maine Election App\maine-needle"

set "PGIT_DIR=%LOCALAPPDATA%\PortableGit"
set "GIT_EXE=%PGIT_DIR%\bin\git.exe"
set "PATH=%PGIT_DIR%\bin;%PGIT_DIR%\usr\bin;%PATH%"
set "LOG=%~dp0push-log.txt"

echo. > "%LOG%"
echo === git-push2.bat starting === >> "%LOG%"

:: Refresh user PATH from registry (picks up gh)
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v PATH 2^>nul') do set "USERPATH=%%b"
if defined USERPATH set "PATH=%PATH%;%USERPATH%"

:: Find gh.exe
set "GH_EXE="
for /r "%LOCALAPPDATA%" %%f in (gh.exe) do (
    if not defined GH_EXE set "GH_EXE=%%f"
)
echo GH_EXE: %GH_EXE% >> "%LOG%"

if not defined GH_EXE (
    echo ERROR: gh not found >> "%LOG%"
    type "%LOG%"
    pause
    exit /b 1
)

:: Get token
"%GH_EXE%" auth token > "%~dp0token.tmp" 2>> "%LOG%"
set /p GH_TOKEN= < "%~dp0token.tmp"
del /q "%~dp0token.tmp" 2>nul

echo GH_TOKEN length check: [%GH_TOKEN:~0,4%...] >> "%LOG%"

if not defined GH_TOKEN (
    echo ERROR: Could not get gh auth token >> "%LOG%"
    type "%LOG%"
    pause
    exit /b 1
)

:: Embed token in URL
"%GIT_EXE%" remote set-url origin https://cblais75:%GH_TOKEN%@github.com/cblais75/maine-needle.git >> "%LOG%" 2>&1

echo === Git status === >> "%LOG%"
"%GIT_EXE%" status --short >> "%LOG%" 2>&1

echo === Git log (last 3) === >> "%LOG%"
"%GIT_EXE%" log --oneline -3 >> "%LOG%" 2>&1

echo === Pushing === >> "%LOG%"
"%GIT_EXE%" push origin main >> "%LOG%" 2>&1
echo Push exit code: %ERRORLEVEL% >> "%LOG%"

:: Restore clean URL
"%GIT_EXE%" remote set-url origin https://github.com/cblais75/maine-needle.git >> "%LOG%" 2>&1

echo === Done === >> "%LOG%"
type "%LOG%"
pause
