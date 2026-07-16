@echo off
cd /d "C:\Users\colin\OneDrive\Desktop\Maine Election App\maine-needle"

set "PGIT_DIR=%LOCALAPPDATA%\PortableGit"
set "GIT_EXE=%PGIT_DIR%\bin\git.exe"
set "PATH=%PGIT_DIR%\bin;%PGIT_DIR%\usr\bin;%PATH%"
set "LOG=%~dp0commit-polls-final-log.txt"

echo. > "%LOG%"
echo === commit-polls-final.bat === >> "%LOG%"

if exist ".git\index.lock" (
  del /q ".git\index.lock"
  echo Removed stale index.lock >> "%LOG%"
)
del /q "vite.config.js.timestamp-*.mjs" 2>nul

"%GIT_EXE%" add data/polls.json public/current.json >> "%LOG%" 2>&1
echo Add exit: %ERRORLEVEL% >> "%LOG%"

"%GIT_EXE%" commit -m "Polls" >> "%LOG%" 2>&1
echo Commit exit: %ERRORLEVEL% >> "%LOG%"

"%GIT_EXE%" log --oneline -3 >> "%LOG%" 2>&1
type "%LOG%"

echo Now pushing via git-push-final.bat...
call "%~dp0git-push-final.bat"
