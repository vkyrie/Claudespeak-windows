@echo off
REM claudespeak-windows watcher auto-starter
REM Runs the watcher.py script from the claudespeak-windows folder

cd /d "C:\Users\haniy\OneDrive\Pictures\Claudespeak-windows"
echo Starting claudespeak-watcher...
python watcher.py

REM Keep window open if there's an error
if errorlevel 1 (
    echo.
    echo Watcher exited with error %errorlevel%
    pause
)