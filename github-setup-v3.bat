@echo off
cd /d "C:\Users\colin\OneDrive\Desktop\Maine Election App\maine-needle"

echo ============================================================
echo  maine-needle GitHub Setup v3
echo ============================================================
echo.

:: Clean up any incomplete .git
if exist ".git" (
    echo Removing previous .git folder...
    rmdir /s /q .git 2>nul
)

:: -------------------------------------------------------
:: STEP 1: Locate git (Portable Git already downloaded)
:: -------------------------------------------------------
set "GIT_EXE="
set "PGIT_DIR=%LOCALAPPDATA%\PortableGit"

:: Add Portable Git to PATH for this session
if exist "%PGIT_DIR%\bin\git.exe" (
    set "GIT_EXE=%PGIT_DIR%\bin\git.exe"
    set "PATH=%PGIT_DIR%\bin;%PGIT_DIR%\usr\bin;%PATH%"
    echo Found Portable Git.
    goto :git_found
)

:: Check system git
where git >nul 2>&1
if not errorlevel 1 (
    set "GIT_EXE=git"
    echo Found git on PATH.
    goto :git_found
)

echo ERROR: git not found. Run github-setup-v2.bat first.
pause
exit /b 1

:git_found
"%GIT_EXE%" --version
echo.

:: -------------------------------------------------------
:: STEP 2: Locate gh CLI (just installed via winget)
:: -------------------------------------------------------
:: First refresh PATH from Windows registry (picks up winget installs)
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v PATH 2^>nul') do (
    set "USERPATH=%%b"
)
if defined USERPATH (
    set "PATH=%PATH%;%USERPATH%"
)

set "GH_EXE="

:: Check PATH first
where gh >nul 2>&1
if not errorlevel 1 (
    set "GH_EXE=gh"
    echo Found gh on PATH.
    goto :gh_found
)

:: Check known winget user-scope install locations
for %%p in (
    "%LOCALAPPDATA%\Programs\gh\bin\gh.exe"
    "%LOCALAPPDATA%\Programs\GitHub CLI\gh.exe"
    "%APPDATA%\gh\bin\gh.exe"
    "%USERPROFILE%\AppData\Local\Programs\gh\bin\gh.exe"
    "C:\Program Files\GitHub CLI\gh.exe"
) do (
    if exist "%%~p" (
        set "GH_EXE=%%~p"
        echo Found gh at: %%~p
        goto :gh_found
    )
)

:: Deep search in LOCALAPPDATA for gh.exe
echo Searching for gh.exe...
for /r "%LOCALAPPDATA%" %%f in (gh.exe) do (
    set "GH_EXE=%%f"
    echo Found gh at: %%f
    goto :gh_found
)

echo ERROR: gh CLI not found. Please re-run github-setup-v2.bat.
pause
exit /b 1

:gh_found
"%GH_EXE%" --version
echo.

:: -------------------------------------------------------
:: STEP 3: Init git repo and commit
:: -------------------------------------------------------
echo Initializing git repo...
"%GIT_EXE%" init -b main
"%GIT_EXE%" config user.email "cblais75@gmail.com"
"%GIT_EXE%" config user.name "cblais75"

echo.
echo .gitignore check:
findstr /i "node_modules" .gitignore >nul && echo   [OK] node_modules gitignored || echo   [WARN] add node_modules
findstr /i "dist" .gitignore >nul && echo   [OK] dist gitignored || echo   [WARN] add dist

echo.
echo Staging all files...
"%GIT_EXE%" add .
"%GIT_EXE%" status --short
echo.
echo Committing...
"%GIT_EXE%" commit -m "Initial commit: maine-needle 2026 election dashboard"
echo.

:: -------------------------------------------------------
:: STEP 4: Browser auth
:: -------------------------------------------------------
echo ============================================================
echo  BROWSER AUTH STEP
echo  A one-time code and URL will appear below.
echo  1. Open the URL in your browser (or it may open auto)
echo  2. Enter the code shown
echo  3. Click "Authorize GitHub CLI"
echo ============================================================
echo.
"%GH_EXE%" auth login --hostname github.com --git-protocol https --web
echo.

:: -------------------------------------------------------
:: STEP 5: Create repo and push
:: -------------------------------------------------------
echo Creating public repo "maine-needle" and pushing...
"%GH_EXE%" repo create maine-needle --public --source=. --remote=origin --push
echo.

echo ============================================================
echo  Done! Your repo URL:
"%GH_EXE%" repo view --json url -q .url
echo ============================================================
echo.
pause
