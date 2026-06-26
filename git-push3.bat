@echo off
cd /d "C:\Users\colin\OneDrive\Desktop\Maine Election App\maine-needle"

set "PGIT_DIR=%LOCALAPPDATA%\PortableGit"
set "GIT_EXE=%PGIT_DIR%\bin\git.exe"
set "LOG=%~dp0push-log3.txt"

echo. > "%LOG%"
echo === git-push3.bat starting === >> "%LOG%"

:: Set up git PATH
set "PATH=%PGIT_DIR%\bin;%PGIT_DIR%\usr\bin;%PATH%"

:: Refresh user PATH from registry (picks up winget-installed gh)
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v PATH 2^>nul') do set "USERPATH=%%b"
if defined USERPATH set "PATH=%PATH%;%USERPATH%"
echo PATH set >> "%LOG%"

:: Find gh via where (uses actual PATH)
set "GH_EXE="
for /f "delims=" %%p in ('where gh 2^>nul') do (
    if not defined GH_EXE set "GH_EXE=%%p"
)

:: If not found on PATH, search known winget locations
if not defined GH_EXE (
    for %%p in (
        "%LOCALAPPDATA%\Programs\GitHub CLI\gh.exe"
        "%LOCALAPPDATA%\Programs\gh\bin\gh.exe"
        "%LOCALAPPDATA%\Microsoft\WinGet\Packages\GitHub.cli_Microsoft.Winget.Source_8wekyb3d8bbwe\gh.exe"
    ) do (
        if not defined GH_EXE if exist "%%~p" set "GH_EXE=%%~p"
    )
)

:: Deep search excluding root-level stubs
if not defined GH_EXE (
    for /r "%LOCALAPPDATA%\Programs" %%f in (gh.exe) do (
        if not defined GH_EXE set "GH_EXE=%%f"
    )
)

echo GH_EXE: [%GH_EXE%] >> "%LOG%"

if not defined GH_EXE (
    echo ERROR: gh not found >> "%LOG%"
    type "%LOG%"
    pause
    exit /b 1
)

:: Verify gh works
"%GH_EXE%" --version >> "%LOG%" 2>&1
echo GH version check exit code: %ERRORLEVEL% >> "%LOG%"

:: Get token using temp file
"%GH_EXE%" auth token > "%~dp0token.tmp" 2>> "%LOG%"
set "TOKEN_EXIT=%ERRORLEVEL%"
set /p GH_TOKEN= < "%~dp0token.tmp"
del /q "%~dp0token.tmp" 2>nul
echo Token exit code: %TOKEN_EXIT% >> "%LOG%"
echo Token prefix: [%GH_TOKEN:~0,5%] >> "%LOG%"

if not defined GH_TOKEN (
    echo ERROR: Could not get gh auth token >> "%LOG%"
    type "%LOG%"
    pause
    exit /b 1
)

:: Embed token in remote URL and push
"%GIT_EXE%" remote set-url origin https://cblais75:%GH_TOKEN%@github.com/cblais75/maine-needle.git >> "%LOG%" 2>&1

echo === Git log === >> "%LOG%"
"%GIT_EXE%" log --oneline -3 >> "%LOG%" 2>&1

echo === Git status === >> "%LOG%"
"%GIT_EXE%" status --short >> "%LOG%" 2>&1

echo === Pushing === >> "%LOG%"
"%GIT_EXE%" push origin main >> "%LOG%" 2>&1
echo Push exit code: %ERRORLEVEL% >> "%LOG%"

:: Restore clean URL
"%GIT_EXE%" remote set-url origin https://github.com/cblais75/maine-needle.git

echo === Done === >> "%LOG%"
type "%LOG%"
pause
