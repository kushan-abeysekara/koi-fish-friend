@echo off
echo ================================
echo  KoiFish Friend - Docker Setup
echo ================================
echo.

echo Checking Docker installation...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not installed or not in PATH
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo Docker found!
echo.

echo Starting all services...
docker-compose up -d

echo.
echo ================================
echo  Services Starting...
echo ================================
echo.
echo Waiting for services to be ready...
timeout /t 10 /nobreak >nul

echo.
echo ================================
echo  Service Status
echo ================================
docker-compose ps

echo.
echo ================================
echo  Access URLs
echo ================================
echo Frontend:  http://localhost:3000
echo Backend:   http://localhost:8080
echo MySQL:     localhost:3306
echo MQTT:      localhost:1883
echo.
echo To view logs: docker-compose logs -f
echo To stop all:  docker-compose down
echo.
pause
