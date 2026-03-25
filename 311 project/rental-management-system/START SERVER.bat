@echo off
title RentEasy Backend Server
color 0A
echo ================================================
echo   RentEasy Backend Server
echo   Running on http://localhost:5000
echo ================================================
echo.

:: Kill any existing process on port 5000
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5000 "') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo Keep this window open while using the website.
echo Close it to stop the server.
echo.

cd /d "%~dp0backend"
start /min cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5000"
node server.js
pause
