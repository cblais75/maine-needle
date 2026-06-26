@echo off
cd /d "C:\Users\colin\OneDrive\Desktop\Maine Election App\maine-needle"

set "LOG=%~dp0nc-baseline-log.txt"
set "TMPDIR=%TEMP%\nc2024"
set "URL=https://s3.amazonaws.com/dl.ncsbe.gov/ENRS/2024_11_05/results_pct_20241105.zip"
set "ZIPFILE=%TMPDIR%\results.zip"
set "CSVFILE=%TMPDIR%\results.csv"

echo. > "%LOG%"
echo === build-nc-baseline.bat === >> "%LOG%"
mkdir "%TMPDIR%" 2>nul

:: Download the 2024 NC precinct results (tab-delimited inside zip, ~15MB)
echo Downloading NC 2024 results... >> "%LOG%"
powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%URL%' -OutFile '%ZIPFILE%' -UseBasicParsing; Write-Host 'Download done'" >> "%LOG%" 2>&1

if not exist "%ZIPFILE%" (
    echo ERROR: Download failed >> "%LOG%"
    type "%LOG%"
    pause
    exit /b 1
)

echo Extracting zip... >> "%LOG%"
powershell -NoProfile -Command "Expand-Archive -Path '%ZIPFILE%' -DestinationPath '%TMPDIR%' -Force; Get-ChildItem '%TMPDIR%' | Where-Object { -not $_.PSIsContainer } | ForEach-Object { Write-Host $_.Name $_.Length }" >> "%LOG%" 2>&1

:: Find the extracted results txt file (not the zip itself)
set "TXTFILE="
for /r "%TMPDIR%" %%f in (*.txt) do (
    if not defined TXTFILE set "TXTFILE=%%f"
)
echo Found results file: %TXTFILE% >> "%LOG%"

if not defined TXTFILE (
    echo ERROR: no .txt file found in extracted zip >> "%LOG%"
    type "%LOG%"
    pause
    exit /b 1
)

:: Show first 2 lines (header + one data row) for sanity check
echo === File header + sample row: === >> "%LOG%"
powershell -NoProfile -Command "Get-Content '%TXTFILE%' -TotalCount 2" >> "%LOG%" 2>&1
echo === End sample === >> "%LOG%"

:: Convert tab-delimited to CSV
echo Converting TSV to CSV... >> "%LOG%"
node scripts/convert-tsv-to-csv.mjs "%TXTFILE%" "%CSVFILE%" >> "%LOG%" 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: TSV conversion failed >> "%LOG%"
    type "%LOG%"
    pause
    exit /b 1
)

:: Run the baseline builder (presidential contest, no blend needed here)
echo Building NC county baseline... >> "%LOG%"
node scripts/build-baseline-nc.mjs --file "%CSVFILE%" >> "%LOG%" 2>&1
echo Build exit: %ERRORLEVEL% >> "%LOG%"

echo === Done === >> "%LOG%"
type "%LOG%"
pause
