@echo off
echo ========================================
echo Quick Start: Power Management Fix
echo ========================================
echo.

echo Step 1: Running Database Migration...
cd database
call run-power-management-migration.bat
cd ..
echo.

echo Step 2: Stopping Services...
docker-compose down
echo.

echo Step 3: Rebuilding Backend...
cd backend
call mvnw.cmd clean package -DskipTests
cd ..
echo.

echo Step 4: Starting Services...
docker-compose up -d
echo.

echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Your Power Management screen is now ready!
echo.
echo Next Steps:
echo 1. Wait 30 seconds for services to start
echo 2. Open http://localhost:3000
echo 3. Navigate to Power Management
echo 4. Select your pond
echo 5. Test the control buttons
echo.
echo Press any key to view logs...
pause > nul
docker-compose logs -f backend
