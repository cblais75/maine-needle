@echo off
setlocal enableextensions
cd /d "C:\Users\colin\OneDrive\Desktop\Maine Election App\maine-needle"

set "PGIT_DIR=%LOCALAPPDATA%\PortableGit"
set "GIT_EXE=%PGIT_DIR%\bin\git.exe"
set "PATH=%PGIT_DIR%\bin;%PGIT_DIR%\usr\bin;%PATH%"
set "LOG=%~dp0commit-errorboundary-log.txt"

echo === commit-errorboundary.bat === > "%LOG%"

if exist ".git\index.lock" del /q ".git\index.lock"
del /q "__ebtest-src.jsx" 2>nul
del /q "vite.config.js.timestamp-*.mjs" 2>nul

"%GIT_EXE%" add src/ErrorBoundary.jsx src/MaineDashboard.jsx >> "%LOG%" 2>&1
echo add exit: %ERRORLEVEL% >> "%LOG%"
"%GIT_EXE%" commit -m "Error boundary" >> "%LOG%" 2>&1
echo commit exit: %ERRORLEVEL% >> "%LOG%"
"%GIT_EXE%" log --oneline -3 >> "%LOG%" 2>&1
type "%LOG%"

echo Pushing via git-push-final.bat...
call "%~dp0git-push-final.bat"
