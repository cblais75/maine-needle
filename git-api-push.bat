@echo off
cd /d "C:\Users\colin\OneDrive\Desktop\Maine Election App\maine-needle"

set "PGIT_DIR=%LOCALAPPDATA%\PortableGit"
set "GIT_EXE=%PGIT_DIR%\bin\git.exe"
set "PATH=%PGIT_DIR%\bin;%PGIT_DIR%\usr\bin;%PATH%"
set "GH_EXE=C:\Program Files\GitHub CLI\gh.exe"
set "LOG=%~dp0api-push-log.txt"

echo. > "%LOG%"
echo === git-api-push.bat starting === >> "%LOG%"

:: Get the full SHA of the latest commit
for /f "delims=" %%s in ('"%GIT_EXE%" rev-parse HEAD') do set "COMMIT_SHA=%%s"
echo Commit SHA: %COMMIT_SHA% >> "%LOG%"

if not defined COMMIT_SHA (
    echo ERROR: Could not get commit SHA >> "%LOG%"
    type "%LOG%"
    pause
    exit /b 1
)

:: Use gh api to update the main branch ref directly (no git push, no credential dialog)
echo Updating main branch via GitHub API... >> "%LOG%"
"%GH_EXE%" api repos/cblais75/maine-needle/git/refs/heads/main -X PATCH --field sha=%COMMIT_SHA% --field force=false >> "%LOG%" 2>&1
echo API exit code: %ERRORLEVEL% >> "%LOG%"

echo === Done === >> "%LOG%"
type "%LOG%"
pause
