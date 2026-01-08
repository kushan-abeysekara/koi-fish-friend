@echo off
echo Installing socket.io-client...
cd /d "%~dp0"
npm install socket.io-client
echo.
echo Installation complete!
echo Press any key to close...
pause > nul
