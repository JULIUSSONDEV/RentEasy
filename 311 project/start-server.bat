@echo off
echo Starting RentEasy backend server...
cd /d "%~dp0rental-management-system\backend"
node server.js
pause
