@echo off
cd /d "C:\Users\colin\OneDrive\Desktop\Maine Election App\maine-needle"

set "PGIT_DIR=%LOCALAPPDATA%\PortableGit"
set "GIT_EXE=%PGIT_DIR%\bin\git.exe"
set "PATH=%PGIT_DIR%\bin;%PGIT_DIR%\usr\bin;%PATH%"

:: Refresh user PATH from registry (picks up gh)
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v PATH 2^>nul') do set "USERPATH=%%b"
if defined USERPATH set "PATH=%PATH%;%USERPATH%"

:: Find gh.exe
set "GH_EXE="
for /r "%LOCALAPPDATA%" %%f in (gh.exe) do (
    if not defined GH_EXE set "GH_EXE=%%f"
)
if not defined GH_EXE (
    echo ERROR: gh not found.
    pause
    exit /b 1
)

:: Get gh token and embed in remote URL (avoids credential dialog)
for /f "delims=" %%t in ('"%GH_EXE%" auth token 2^>nul') do set "GH_TOKEN=%%t"
if not defined GH_TOKEN (
    echo ERROR: Could not get gh auth token. Run gh auth login first.
    pause
    exit /b 1
)
"%GIT_EXE%" remote set-url origin https://cblais75:%GH_TOKEN%@github.com/cblais75/maine-needle.git

echo === Status ===
"%GIT_EXE%" status --short
echo.
echo === Staging ===
"%GIT_EXE%" add src/MaineDashboard.jsx
echo.
echo === Committing ===
"%GIT_EXE%" commit -m "add intro line"
echo.
echo === Pushing ===
"%GIT_EXE%" push origin main

:: Restore URL without token
"%GIT_EXE%" remote set-url origin https://github.com/cblais75/maine-needle.git

echo.
echo === Done ===
pause
