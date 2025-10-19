# Quick Start Guide

## 🚀 Start Backend (Terminal 1)

```powershell
cd e:\koi-fish-friend\backend
.\mvnw spring-boot:run
```

Wait for the message: `Started BackendApplication in X seconds`

## 🎨 Start Frontend (Terminal 2)

```powershell
cd e:\koi-fish-friend\frontend
npm run dev
```

Open browser at: `http://localhost:5173`

## 🔑 Login

- Username: `admin`
- Password: `admin123`

## ✅ Test the Application

1. **Login Test:**
   - Go to http://localhost:5173
   - Enter demo credentials
   - Click "Login"
   - Should redirect to Dashboard

2. **Update Credentials Test:**
   - On Dashboard, change username to `admin2`
   - Change password to `newpass123`
   - Confirm password
   - Click "Update Credentials"
   - You'll be logged out automatically
   - Login again with new credentials

## 📋 Endpoints

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8080/api
  - POST /api/login
  - POST /api/update-credentials

## 🛠️ Troubleshooting

### Backend Issues
```powershell
# If port 8080 is in use, change in application.properties:
server.port=8081
```

### Frontend Issues
```powershell
# If dependencies are missing:
cd frontend
npm install

# If Tailwind isn't working:
npm install -D tailwindcss postcss autoprefixer
```

### Database Connection Issues
- The database is hosted remotely at 82.197.82.97
- Ensure your internet connection is stable
- Check if your firewall allows MySQL connections

## 📝 Notes

- The demo user is created automatically on first backend startup
- Passwords are encrypted using BCrypt
- Session is stored in browser's sessionStorage
- After updating credentials, you'll need to login again with new credentials
