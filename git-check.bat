@echo off
cd /d "C:\Users\colin\OneDrive\Desktop\Maine Election App\maine-needle"
set "PGIT_DIR=%LOCALAPPDATA%\PortableGit"
set "GIT_EXE=%PGIT_DIR%\bin\git.exe"
set "PATH=%PGIT_DIR%\bin;%PGIT_DIR%\usr\bin;%PATH%"
"%GIT_EXE%" log --oneline -5 > "%~dp0git-log.txt" 2>&1
"%GIT_EXE%" status --short >> "%~dp0git-log.txt" 2>&1
echo Remote: >> "%~dp0git-log.txt"
"%GIT_EXE%" remote -v >> "%~dp0git-log.txt" 2>&1
