@echo off
echo ========================================
echo Setup Feeding Device - Java Method
echo ========================================
echo.
echo This will run a Java utility to:
echo 1. Check if sensor_devices table exists
echo 2. Create table or add missing columns
echo 3. Insert feed_device_001
echo.
echo Press any key to continue or Ctrl+C to cancel...
pause > nul
echo.

cd backend
echo Compiling Java utility...
javac -cp "target/classes;%USERPROFILE%\.m2\repository\mysql\mysql-connector-java\8.0.33\mysql-connector-java-8.0.33.jar" src/main/java/com/example/backend/util/SetupFeedDevice.java

if %errorlevel% neq 0 (
    echo.
    echo Compilation failed. Using Maven instead...
    echo.
    mvn exec:java -Dexec.mainClass="com.example.backend.util.SetupFeedDevice" -Dexec.cleanupDaemonThreads=false
) else (
    echo.
    echo Running utility...
    echo.
    java -cp "target/classes;src/main/java;%USERPROFILE%\.m2\repository\mysql\mysql-connector-java\8.0.33\mysql-connector-java-8.0.33.jar" com.example.backend.util.SetupFeedDevice
)

echo.
echo Press any key to exit...
pause > nul
