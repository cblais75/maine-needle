@echo off
cd /d "C:\Users\colin\OneDrive\Desktop\Maine Election App\maine-needle"

echo ============================================================
echo  maine-needle GitHub Setup v2
echo ============================================================
echo.

:: --- Clean up any broken .git from previous attempt ---
if exist ".git" (
    echo Removing incomplete .git folder...
    rmdir /s /q .git 2>nul
)

:: -------------------------------------------------------
:: STEP 1: Find or install git (no admin needed)
:: -------------------------------------------------------
set "GIT_EXE="

:: Check common installed locations
for %%p in (
    "C:\Program Files\Git\cmd\git.exe"
    "C:\Program Files\Git\bin\git.exe"
    "%LOCALAPPDATA%\Programs\Git\cmd\git.exe"
    "%LOCALAPPDATA%\PortableGit\bin\git.exe"
    "%USERPROFILE%\PortableGit\bin\git.exe"
) do (
    if exist %%p (
        set "GIT_EXE=%%~p"
        echo Found git at: %%~p
        goto :git_found
    )
)

:: Check if git is on PATH
where git >nul 2>&1
if not errorlevel 1 (
    set "GIT_EXE=git"
    echo Found git on PATH
    goto :git_found
)

:: Download Portable Git via PowerShell (no admin needed)
echo Git not found. Downloading Portable Git...
set "PGIT_DIR=%LOCALAPPDATA%\PortableGit"
set "PGIT_EXE=%TEMP%\PortableGit.exe"
powershell -Command "& { [Net.ServicePointManager]::SecurityProtocol = 'Tls12'; Invoke-WebRequest -Uri 'https://github.com/git-for-windows/git/releases/download/v2.45.2.windows.1/PortableGit-2.45.2-64-bit.7z.exe' -OutFile '%PGIT_EXE%' -UseBasicParsing }"
if not exist "%PGIT_EXE%" (
    echo ERROR: Failed to download Portable Git.
    pause
    exit /b 1
)
echo Extracting Portable Git...
"%PGIT_EXE%" -o "%PGIT_DIR%" -y
set "GIT_EXE=%PGIT_DIR%\bin\git.exe"
if not exist "%GIT_EXE%" (
    echo ERROR: Portable Git extraction failed.
    pause
    exit /b 1
)
echo Portable Git ready.

:git_found
"%GIT_EXE%" --version
echo.

:: -------------------------------------------------------
:: STEP 2: Find gh CLI
:: -------------------------------------------------------
set "GH_EXE="

where gh >nul 2>&1
if not errorlevel 1 (
    set "GH_EXE=gh"
    echo Found gh on PATH
    goto :gh_found
)

for %%p in (
    "%LOCALAPPDATA%\Programs\gh\bin\gh.exe"
    "C:\Program Files\GitHub CLI\gh.exe"
    "%ProgramFiles(x86)%\GitHub CLI\gh.exe"
) do (
    if exist %%p (
        set "GH_EXE=%%~p"
        echo Found gh at: %%~p
        goto :gh_found
    )
)

echo GitHub CLI not found. Installing via winget (user scope)...
winget install --id GitHub.cli -e --source winget --scope user --accept-package-agreements --accept-source-agreements
:: Refresh PATH for this session
set "PATH=%PATH%;%LOCALAPPDATA%\Programs\gh\bin"
where gh >nul 2>&1
if not errorlevel 1 (
    set "GH_EXE=gh"
) else (
    echo ERROR: gh CLI installation failed.
    pause
    exit /b 1
)

:gh_found
"%GH_EXE%" --version
echo.

:: -------------------------------------------------------
:: STEP 3: Init git repo
:: -------------------------------------------------------
echo Initializing git repo...
"%GIT_EXE%" init -b main
"%GIT_EXE%" config user.email "cblais75@gmail.com"
"%GIT_EXE%" config user.name "cblais75"

:: Verify .gitignore
echo.
echo .gitignore check:
findstr /i "node_modules" .gitignore >nul && echo   [OK] node_modules gitignored || echo   [WARN] add node_modules to .gitignore
findstr /i "dist" .gitignore >nul && echo   [OK] dist gitignored || echo   [WARN] add dist to .gitignore

:: Stage and commit
echo.
echo Staging files (node_modules and dist excluded by .gitignore)...
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
echo  A one-time code + URL will appear. Open the URL in your
echo  browser, paste the code, and click Authorize.
echo ============================================================
echo.
"%GH_EXE%" auth login --hostname github.com --git-protocol https --web
echo.

:: -------------------------------------------------------
:: STEP 5: Create repo and push
:: -------------------------------------------------------
echo Creating public GitHub repo "maine-needle" and pushing...
"%GH_EXE%" repo create maine-needle --public --source=. --remote=origin --push
echo.

:: Done
echo ============================================================
echo  Your repo URL:
"%GH_EXE%" repo view --json url -q .url
echo ============================================================
echo.
pause
