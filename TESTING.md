# 🧪 Testing Checklist

## Pre-requisites
- [ ] Java 21 installed (`java -version`)
- [ ] Maven installed (`mvn -version`)
- [ ] Node.js 18+ installed (`node -version`)
- [ ] Internet connection (for remote MySQL database)

---

## Backend Testing

### 1. Build Test
```powershell
cd e:\koi-fish-friend\backend
.\mvnw clean compile
```
- [ ] Build succeeds without errors
- [ ] All 9 Java files compile successfully

### 2. Start Backend
```powershell
.\mvnw spring-boot:run
```
- [ ] Application starts on port 8080
- [ ] Demo user created message appears in logs
- [ ] No connection errors to MySQL database
- [ ] Message: "Started BackendApplication in X seconds"

### 3. Test Database Connection
- [ ] Check logs for successful JPA connection
- [ ] No "Access denied" or "Unknown database" errors
- [ ] Table `users` is auto-created

### 4. Test API Endpoints

#### Test Login Endpoint
```powershell
# Using curl or Postman
curl -X POST http://localhost:8080/api/login `
-H "Content-Type: application/json" `
-d '{\"username\":\"admin\",\"password\":\"admin123\"}'
```
- [ ] Returns 200 OK
- [ ] Response: `{"success": true, "message": "Login successful"}`

#### Test Invalid Login
```powershell
curl -X POST http://localhost:8080/api/login `
-H "Content-Type: application/json" `
-d '{\"username\":\"admin\",\"password\":\"wrong\"}'
```
- [ ] Returns 401 Unauthorized
- [ ] Response: `{"success": false, "message": "Invalid username or password"}`

#### Test Update Credentials
```powershell
curl -X POST http://localhost:8080/api/update-credentials `
-H "Content-Type: application/json" `
-d '{\"currentUsername\":\"admin\",\"newUsername\":\"testuser\",\"newPassword\":\"test123\"}'
```
- [ ] Returns 200 OK
- [ ] Response: `{"success": true, "message": "Credentials updated successfully"}`

---

## Frontend Testing

### 1. Install Dependencies
```powershell
cd e:\koi-fish-friend\frontend
npm install
```
- [ ] All packages installed successfully
- [ ] No critical vulnerabilities
- [ ] `node_modules` folder created

### 2. Start Frontend
```powershell
npm run dev
```
- [ ] Vite server starts on port 5173
- [ ] No compilation errors
- [ ] Browser opens automatically (or open manually)

### 3. Build Test (Optional)
```powershell
npm run build
```
- [ ] Build succeeds
- [ ] `dist` folder created
- [ ] No TypeScript errors

---

## UI/UX Testing

### Login Page Tests

#### Visual Tests
- [ ] Page loads at http://localhost:5173
- [ ] Gradient background displays correctly
- [ ] White card centered on screen
- [ ] "Koi Fish Friend" title visible
- [ ] Two input fields (username, password)
- [ ] Login button present
- [ ] Demo credentials displayed in gray box

#### Functionality Tests
- [ ] Username field accepts input
- [ ] Password field masks input (shows dots)
- [ ] Both fields show focus state (blue ring)
- [ ] Hover effects work on login button

#### Form Validation
- [ ] Empty form shows browser validation
- [ ] Required fields marked with *
- [ ] Can submit form with Enter key

#### Login Success
```
Input: admin / admin123
```
- [ ] Loading state shows ("Logging in...")
- [ ] Button disabled during submission
- [ ] Success → Redirects to /dashboard
- [ ] Dashboard loads immediately

#### Login Failure
```
Input: admin / wrongpassword
```
- [ ] Red error message appears
- [ ] Message: "Invalid username or password"
- [ ] Form stays on login page
- [ ] Can try again

#### Login Error Handling
- [ ] Backend offline → Shows error message
- [ ] Network error → Shows user-friendly message
- [ ] CORS error → Check console (should not happen)

---

### Dashboard Tests

#### Visual Tests
- [ ] Navigation bar at top
- [ ] "Koi Fish Friend Dashboard" title
- [ ] Red "Logout" button on right
- [ ] White card with form
- [ ] Current username displayed in blue box
- [ ] Three input fields visible
- [ ] Update button present

#### Functionality Tests

##### Update Username Only
```
Steps:
1. Login as admin/admin123
2. Enter new username: "testuser"
3. Leave passwords empty
4. Click Update Credentials
```
- [ ] Success message appears (green)
- [ ] Auto-logout after 2 seconds
- [ ] Redirected to login
- [ ] Can login with testuser/admin123
- [ ] Current username box shows new username

##### Update Password Only
```
Steps:
1. Login with current credentials
2. Leave new username empty
3. Enter new password: "newpass123"
4. Confirm password: "newpass123"
5. Click Update Credentials
```
- [ ] Success message appears
- [ ] Auto-logout after 2 seconds
- [ ] Can login with current username + new password

##### Update Both Username and Password
```
Steps:
1. Login with current credentials
2. Enter new username: "admin2"
3. Enter new password: "admin456"
4. Confirm password: "admin456"
5. Click Update Credentials
```
- [ ] Success message appears
- [ ] Auto-logout after 2 seconds
- [ ] Can login with admin2/admin456

##### Validation Tests
```
Test 1: Password mismatch
- New password: "test123"
- Confirm: "test456"
```
- [ ] Error message: "Passwords do not match"
- [ ] Form not submitted

```
Test 2: Empty form submission
- All fields empty
```
- [ ] Error message: "Please provide a new username or password"
- [ ] Form not submitted

```
Test 3: Password field disabled
- No new password entered
```
- [ ] Confirm password field is disabled
- [ ] Visual indication (grayed out)

#### Logout Test
- [ ] Click Logout button
- [ ] Redirected to /login immediately
- [ ] Session cleared
- [ ] Cannot access /dashboard without login

---

## Integration Tests

### Full User Flow
```
Complete Scenario:
1. Start with fresh demo user (admin/admin123)
2. Login
3. Update to user1/pass1
4. Logout
5. Login with user1/pass1
6. Update to user2/pass2
7. Login with user2/pass2
```
- [ ] All steps work without errors
- [ ] Each update persists in database
- [ ] Previous credentials no longer work

### Browser Tests
- [ ] Chrome/Edge - All features work
- [ ] Firefox - All features work
- [ ] Safari - All features work (if available)
- [ ] Mobile browser - Responsive design works

### Session Management
- [ ] Login → Refresh page → Still logged in
- [ ] Logout → Refresh → Still logged out
- [ ] Close tab → Reopen → Session persists
- [ ] Different tab → Same session

---

## Error Scenario Tests

### Backend Down
```
Steps:
1. Stop backend server
2. Try to login from frontend
```
- [ ] Graceful error message
- [ ] No console errors breaking UI
- [ ] Can retry after backend restart

### Database Issues
```
Simulate by changing DB credentials
```
- [ ] Backend fails to start with clear error
- [ ] Error logged in console

### Network Issues
```
Disconnect internet
```
- [ ] Timeout error handled gracefully
- [ ] User sees connection error message

---

## Performance Tests

- [ ] Login response < 2 seconds
- [ ] Update credentials < 2 seconds
- [ ] Page loads < 1 second
- [ ] No memory leaks after multiple operations
- [ ] Backend handles concurrent requests

---

## Security Tests

### Password Encryption
```
Check database directly:
SELECT * FROM users;
```
- [ ] Password is BCrypt hash (starts with $2a$)
- [ ] Not plain text
- [ ] Different users have different hashes

### CORS
```
Try from different origin (e.g., http://localhost:3000)
```
- [ ] Request blocked by CORS policy
- [ ] Only localhost:5173 allowed

### Session Security
- [ ] Session cleared on logout
- [ ] No sensitive data in localStorage
- [ ] Username-only in sessionStorage (not password)

### SQL Injection
```
Try malicious input:
Username: admin' OR '1'='1
Password: anything
```
- [ ] Login fails
- [ ] No SQL error exposed
- [ ] JPA prevents injection

---

## Accessibility Tests

- [ ] Tab navigation works
- [ ] Focus indicators visible
- [ ] Form labels present
- [ ] Error messages announced
- [ ] Button states clear

---

## Mobile Responsive Tests

- [ ] Login page responsive on mobile
- [ ] Dashboard responsive on mobile
- [ ] Touch-friendly buttons (min 44px)
- [ ] No horizontal scroll
- [ ] Text readable without zoom

---

## Documentation Tests

- [ ] README.md accurate
- [ ] QUICKSTART.md works step-by-step
- [ ] API endpoints documented correctly
- [ ] Database credentials work
- [ ] Code comments helpful

---

## Final Checklist

- [ ] All tests passed
- [ ] No console errors
- [ ] No lint warnings
- [ ] Code formatted consistently
- [ ] Git repo clean
- [ ] .gitignore working
- [ ] Ready for production

---

## Test Results

**Date:** _____________

**Tester:** _____________

**Backend Version:** Spring Boot 3.5.6

**Frontend Version:** React 19

**Overall Status:** ⬜ Pass / ⬜ Fail

**Notes:**
___________________________________
___________________________________
___________________________________

---

## Known Issues

(Document any issues found during testing)

1. _______________________________
2. _______________________________
3. _______________________________

---

## Sign-off

✅ **Testing Complete**

**Signed:** _____________ 

**Date:** _____________
