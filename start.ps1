# Koi Fish Friend - Start Script
# This PowerShell script starts both backend and frontend

Write-Host "🐟 Starting Koi Fish Friend..." -ForegroundColor Cyan
Write-Host ""

# Check if backend directory exists
if (-Not (Test-Path ".\backend")) {
    Write-Host "❌ Backend directory not found!" -ForegroundColor Red
    Write-Host "Please run this script from the project root directory." -ForegroundColor Yellow
    exit 1
}

# Check if frontend directory exists
if (-Not (Test-Path ".\frontend")) {
    Write-Host "❌ Frontend directory not found!" -ForegroundColor Red
    Write-Host "Please run this script from the project root directory." -ForegroundColor Yellow
    exit 1
}

Write-Host "📋 Prerequisites Check..." -ForegroundColor Yellow
Write-Host ""

# Check Java
Write-Host "Checking Java..." -NoNewline
try {
    $javaVersion = java -version 2>&1 | Select-Object -First 1
    Write-Host " ✅ $javaVersion" -ForegroundColor Green
} catch {
    Write-Host " ❌ Java not found!" -ForegroundColor Red
    Write-Host "Please install Java 21 or higher." -ForegroundColor Yellow
    exit 1
}

# Check Maven
Write-Host "Checking Maven..." -NoNewline
try {
    $mavenVersion = mvn -version 2>&1 | Select-Object -First 1
    Write-Host " ✅" -ForegroundColor Green
} catch {
    Write-Host " ⚠️ Maven not found, will use wrapper" -ForegroundColor Yellow
}

# Check Node.js
Write-Host "Checking Node.js..." -NoNewline
try {
    $nodeVersion = node -v
    Write-Host " ✅ $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host " ❌ Node.js not found!" -ForegroundColor Red
    Write-Host "Please install Node.js 18 or higher." -ForegroundColor Yellow
    exit 1
}

# Check npm
Write-Host "Checking npm..." -NoNewline
try {
    $npmVersion = npm -v
    Write-Host " ✅ v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host " ❌ npm not found!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🚀 Starting Backend..." -ForegroundColor Cyan
Write-Host ""

# Start backend in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; Write-Host '🔧 Starting Spring Boot Backend...' -ForegroundColor Green; .\mvnw.cmd spring-boot:run"

Write-Host "⏳ Waiting for backend to start (15 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

Write-Host ""
Write-Host "🎨 Starting Frontend..." -ForegroundColor Cyan
Write-Host ""

# Check if node_modules exists
if (-Not (Test-Path ".\frontend\node_modules")) {
    Write-Host "📦 Installing frontend dependencies..." -ForegroundColor Yellow
    cd frontend
    npm install
    cd ..
    Write-Host "✅ Dependencies installed!" -ForegroundColor Green
    Write-Host ""
}

# Start frontend in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; Write-Host '🎨 Starting React Frontend...' -ForegroundColor Green; npm run dev"

Write-Host ""
Write-Host "✅ Both services are starting!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Access Points:" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "   Backend:  http://localhost:8080" -ForegroundColor White
Write-Host ""
Write-Host " Documentation:" -ForegroundColor Cyan
Write-Host "   README.md      - Complete documentation" -ForegroundColor White
Write-Host "   QUICKSTART.md  - Quick start guide" -ForegroundColor White
Write-Host "   TESTING.md     - Testing checklist" -ForegroundColor White
Write-Host ""
Write-Host "💡 Tip: Wait for both services to fully start before accessing the app" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to exit this window..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
