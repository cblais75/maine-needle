@echo off
cd /d "C:\Users\colin\OneDrive\Desktop\Maine Election App\maine-needle"

echo ============================================================
echo  maine-needle GitHub Setup
echo ============================================================
echo.

:: --- Clean up any broken .git from previous attempt ---
if exist ".git" (
    echo Removing incomplete .git folder...
    rmdir /s /q .git
)

:: --- Check for git ---
where git >nul 2>&1
if errorlevel 1 (
    echo Git not found. Installing via winget...
    winget install --id Git.Git -e --source winget --silent
    :: Refresh PATH
    set "PATH=%PATH%;C:\Program Files\Git\bin;C:\Program Files\Git\cmd"
)
git --version
echo.

:: --- Check for GitHub CLI ---
where gh >nul 2>&1
if errorlevel 1 (
    echo GitHub CLI not found. Installing via winget...
    winget install --id GitHub.cli -e --source winget --silent
    :: Refresh PATH
    set "PATH=%PATH%;C:\Program Files\GitHub CLI"
)
gh --version
echo.

:: --- Initialize git repo ---
echo Initializing git repo...
git init -b main
git config user.email "cblais75@gmail.com"
git config user.name "cblais75"

:: --- Verify .gitignore covers node_modules and dist ---
echo.
echo Checking .gitignore...
findstr /i "node_modules" .gitignore >nul && echo   [OK] node_modules is gitignored || echo   [WARN] node_modules not in .gitignore
findstr /i "dist" .gitignore >nul && echo   [OK] dist is gitignored || echo   [WARN] dist not in .gitignore

:: --- Stage and commit ---
echo.
echo Staging files...
git add .
git status --short
echo.
echo Committing...
git commit -m "Initial commit: maine-needle 2026 election dashboard"
echo.

:: --- GitHub auth (browser flow) ---
echo ============================================================
echo  BROWSER AUTH STEP
echo  A one-time code and URL will appear below.
echo  Open the URL, enter the code, and authorize the app.
echo ============================================================
echo.
CALL gh auth login --hostname github.com --git-protocol https --web
echo.

:: --- Create public repo and push ---
echo Creating public GitHub repo "maine-needle"...
CALL gh repo create maine-needle --public --source=. --remote=origin --push
echo.

:: --- Done ---
echo ============================================================
echo  Done! Your repo URL:
CALL gh repo view --json url -q .url
echo ============================================================
echo.
pause
