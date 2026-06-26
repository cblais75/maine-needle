@echo off
cd /d "C:\Users\colin\OneDrive\Desktop\Maine Election App\maine-needle"

set "PGIT_DIR=%LOCALAPPDATA%\PortableGit"
set "GIT_EXE=%PGIT_DIR%\bin\git.exe"
set "GH_EXE=C:\Program Files\GitHub CLI\gh.exe"
set "PATH=%PGIT_DIR%\bin;%PGIT_DIR%\usr\bin;%PATH%"
set "LOG=%~dp0update1-log.txt"

echo. > "%LOG%"
echo === git-update1.bat === >> "%LOG%"

:: Stage all changes
echo === Staging === >> "%LOG%"
"%GIT_EXE%" add -A >> "%LOG%" 2>&1
echo Add exit: %ERRORLEVEL% >> "%LOG%"

:: Commit
echo === Committing === >> "%LOG%"
"%GIT_EXE%" commit -m "Update 1: rename to The Needle Project, Maine probability fix, multi-state dashboard, North Carolina" >> "%LOG%" 2>&1
echo Commit exit: %ERRORLEVEL% >> "%LOG%"

:: Show log
echo === Log === >> "%LOG%"
"%GIT_EXE%" log --oneline -4 >> "%LOG%" 2>&1

:: Get full SHA of HEAD
for /f "delims=" %%s in ('"%GIT_EXE%" rev-parse HEAD') do set "SHA=%%s"
echo HEAD SHA: %SHA% >> "%LOG%"

:: Get gh token
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

:: Push via GitHub API (no credential dialog)
echo === Pushing via gh api === >> "%LOG%"
"%GH_EXE%" api repos/cblais75/maine-needle/git/refs/heads/main -X PATCH --field sha=%SHA% --field force=false >> "%LOG%" 2>&1
echo Push exit: %ERRORLEVEL% >> "%LOG%"

echo === Done === >> "%LOG%"
type "%LOG%"
pause
