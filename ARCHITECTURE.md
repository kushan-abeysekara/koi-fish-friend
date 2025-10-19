# 🏗️ System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT SIDE                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              React Frontend (Port 5173)                 │ │
│  │                                                          │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │ │
│  │  │  Login Page  │  │  Dashboard   │  │   App.tsx    │ │ │
│  │  │   (Login.tsx)│  │(Dashboard.tsx)│  │ (React Router)│ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │ │
│  │         │                 │                 │          │ │
│  │         └────────┬────────┴─────────────────┘          │ │
│  │                  │                                      │ │
│  │         ┌────────▼────────┐                            │ │
│  │         │   API Service   │                            │ │
│  │         │    (api.ts)     │                            │ │
│  │         │  Axios Client   │                            │ │
│  │         └────────┬────────┘                            │ │
│  │                  │                                      │ │
│  └──────────────────┼──────────────────────────────────────┘ │
└────────────────────┼──────────────────────────────────────────┘
                     │
                     │ HTTP/JSON
                     │ CORS Enabled
                     │
┌────────────────────▼──────────────────────────────────────────┐
│                       SERVER SIDE                             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │         Spring Boot Backend (Port 8080)                │  │
│  │                                                         │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │           Controller Layer                        │ │  │
│  │  │  ┌─────────────────────────────────────────────┐ │ │  │
│  │  │  │       AuthController.java                   │ │ │  │
│  │  │  │  - POST /api/login                          │ │ │  │
│  │  │  │  - POST /api/update-credentials             │ │ │  │
│  │  │  └────────────────┬────────────────────────────┘ │ │  │
│  │  └─────────────────┬─┴─────────────────────────────┘ │  │
│  │                    │                                  │  │
│  │  ┌─────────────────▼──────────────────────────────┐  │  │
│  │  │              DTO Layer                          │  │  │
│  │  │  - LoginRequest.java                           │  │  │
│  │  │  - UpdateCredentialsRequest.java              │  │  │
│  │  │  - ApiResponse.java                           │  │  │
│  │  └─────────────────┬──────────────────────────────┘  │  │
│  │                    │                                  │  │
│  │  ┌─────────────────▼──────────────────────────────┐  │  │
│  │  │           Repository Layer                      │  │  │
│  │  │  ┌─────────────────────────────────────────┐  │  │  │
│  │  │  │     UserRepository.java                 │  │  │  │
│  │  │  │  (Spring Data JPA)                      │  │  │  │
│  │  │  └─────────────┬───────────────────────────┘  │  │  │
│  │  └────────────────┼──────────────────────────────┘  │  │
│  │                   │                                  │  │
│  │  ┌────────────────▼─────────────────────────────┐   │  │
│  │  │            Entity Layer                       │   │  │
│  │  │  ┌────────────────────────────────────────┐  │   │  │
│  │  │  │        User.java                       │  │   │  │
│  │  │  │  - id: Long                            │  │   │  │
│  │  │  │  - username: String                    │  │   │  │
│  │  │  │  - password: String (BCrypt)           │  │   │  │
│  │  │  └────────────────────────────────────────┘  │   │  │
│  │  └──────────────────────────────────────────────┘   │  │
│  │                                                      │  │
│  │  ┌──────────────────────────────────────────────┐   │  │
│  │  │          Configuration Layer                  │   │  │
│  │  │  - SecurityConfig.java (CORS, CSRF)          │   │  │
│  │  │  - DataInitializer.java (Demo User)          │   │  │
│  │  └──────────────────────────────────────────────┘   │  │
│  │                                                      │  │
│  └──────────────────────┬───────────────────────────────┘  │
└─────────────────────────┼──────────────────────────────────┘
                          │
                          │ JDBC
                          │ MySQL Connector
                          │
┌─────────────────────────▼──────────────────────────────────┐
│                   DATABASE LAYER                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        MySQL Database (Remote: 82.197.82.97)         │  │
│  │                                                       │  │
│  │  Database: u626686198_fishfeed                       │  │
│  │                                                       │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │              users table                        │  │  │
│  │  │  ┌────────────────────────────────────────┐   │  │  │
│  │  │  │ id         │ username  │ password      │   │  │  │
│  │  │  │ BIGINT     │ VARCHAR   │ VARCHAR       │   │  │  │
│  │  │  │ PK, AI     │ UNIQUE    │ BCrypt Hash   │   │  │  │
│  │  │  └────────────────────────────────────────┘   │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Request Flow Diagrams

### 1. Login Flow

```
┌──────────┐                ┌──────────┐                ┌──────────┐
│  User    │                │ Frontend │                │ Backend  │
└────┬─────┘                └────┬─────┘                └────┬─────┘
     │                           │                           │
     │ 1. Enter credentials      │                           │
     │ ─────────────────────────>│                           │
     │                           │                           │
     │                           │ 2. POST /api/login        │
     │                           │ ─────────────────────────>│
     │                           │                           │
     │                           │    3. Check username      │
     │                           │    in UserRepository     │
     │                           │<─────────────────────────>│ DB
     │                           │                           │
     │                           │    4. Verify password     │
     │                           │    with BCrypt           │
     │                           │                           │
     │                           │ 5. Return ApiResponse     │
     │                           │<──────────────────────────│
     │                           │    {success: true}        │
     │                           │                           │
     │ 6. Store username in      │                           │
     │    sessionStorage         │                           │
     │<──────────────────────────│                           │
     │                           │                           │
     │ 7. Redirect to /dashboard │                           │
     │<──────────────────────────│                           │
     │                           │                           │
```

### 2. Update Credentials Flow

```
┌──────────┐                ┌──────────┐                ┌──────────┐
│  User    │                │ Frontend │                │ Backend  │
└────┬─────┘                └────┬─────┘                └────┬─────┘
     │                           │                           │
     │ 1. Enter new credentials  │                           │
     │ ─────────────────────────>│                           │
     │                           │                           │
     │                           │ 2. Validate passwords     │
     │                           │    match                  │
     │                           │                           │
     │                           │ 3. POST /api/update-      │
     │                           │    credentials            │
     │                           │ ─────────────────────────>│
     │                           │                           │
     │                           │    4. Find user by        │
     │                           │    currentUsername       │
     │                           │<─────────────────────────>│ DB
     │                           │                           │
     │                           │    5. Check new username  │
     │                           │    is unique (if changed) │
     │                           │<─────────────────────────>│ DB
     │                           │                           │
     │                           │    6. Encrypt password    │
     │                           │    with BCrypt           │
     │                           │                           │
     │                           │    7. Update user record  │
     │                           │<─────────────────────────>│ DB
     │                           │                           │
     │                           │ 8. Return ApiResponse     │
     │                           │<──────────────────────────│
     │                           │    {success: true}        │
     │                           │                           │
     │ 9. Update sessionStorage  │                           │
     │<──────────────────────────│                           │
     │                           │                           │
     │ 10. Auto-logout (2s)      │                           │
     │<──────────────────────────│                           │
     │                           │                           │
     │ 11. Redirect to /login    │                           │
     │<──────────────────────────│                           │
     │                           │                           │
```

---

## Technology Stack

### Frontend Stack

```
┌─────────────────────────────────────┐
│          React 19                   │
│  ┌───────────────────────────────┐ │
│  │     TypeScript                │ │
│  │  ┌─────────────────────────┐ │ │
│  │  │   Tailwind CSS          │ │ │
│  │  │  ┌───────────────────┐ │ │ │
│  │  │  │  React Router     │ │ │ │
│  │  │  │  ┌─────────────┐ │ │ │ │
│  │  │  │  │   Axios     │ │ │ │ │
│  │  │  │  └─────────────┘ │ │ │ │
│  │  │  └───────────────────┘ │ │ │
│  │  └─────────────────────────┘ │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
       Built with Vite
```

### Backend Stack

```
┌───────────────────────────────────┐
│     Spring Boot 3.5.6             │
│  ┌─────────────────────────────┐ │
│  │   Spring Data JPA           │ │
│  │  ┌───────────────────────┐ │ │
│  │  │  Spring Security      │ │ │
│  │  │  ┌─────────────────┐ │ │ │
│  │  │  │  BCrypt         │ │ │ │
│  │  │  └─────────────────┘ │ │ │
│  │  └───────────────────────┘ │ │
│  └─────────────────────────────┘ │
└───────────────────────────────────┘
    MySQL Connector + Maven
```

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Security Layers                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. CORS Protection                                      │
│     └─ Only allow: http://localhost:5173                │
│                                                          │
│  2. Password Encryption                                  │
│     └─ BCrypt with salt (Spring Security)               │
│                                                          │
│  3. Input Validation                                     │
│     ├─ Frontend: Required fields, password match        │
│     └─ Backend: JPA validation, unique constraints      │
│                                                          │
│  4. Session Management                                   │
│     └─ SessionStorage for username only                 │
│        (No sensitive data)                               │
│                                                          │
│  5. Database Security                                    │
│     ├─ JPA prevents SQL injection                       │
│     ├─ Unique username constraint                       │
│     └─ Password stored as hash only                     │
│                                                          │
│  6. CSRF Protection                                      │
│     └─ Disabled (stateless API)                         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Deployment Architecture

```
Development Environment:
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Frontend    │     │   Backend    │     │  Database    │
│              │     │              │     │              │
│ localhost    │────>│ localhost    │────>│  Remote      │
│ :5173        │     │ :8080        │     │  MySQL       │
│              │     │              │     │  82.197...   │
└──────────────┘     └──────────────┘     └──────────────┘

Production (Future):
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Frontend    │     │   Backend    │     │  Database    │
│              │     │              │     │              │
│ CDN/S3       │────>│ EC2/Docker   │────>│  RDS MySQL   │
│ Static       │     │ Container    │     │  or Cloud    │
│ Hosting      │     │              │     │  MySQL       │
└──────────────┘     └──────────────┘     └──────────────┘
```

---

## Data Flow

```
Login Flow:
User Input → Frontend Validation → API Request → Backend Validation
→ Database Query → Password Verification → Response → Session Store
→ Navigation

Update Flow:
User Input → Frontend Validation → API Request → Backend Validation
→ Database Query (check existing) → Uniqueness Check → Password Encryption
→ Database Update → Response → Session Update → Auto Logout
```

---

## Component Dependencies

```
Frontend Dependencies:
react (19.1.1)
react-dom (19.1.1)
react-router-dom (latest)
axios (latest)
tailwindcss (latest)
typescript (5.9.3)
vite (7.1.7)

Backend Dependencies:
spring-boot-starter-web (3.5.6)
spring-boot-starter-data-jpa (3.5.6)
spring-boot-starter-security (3.5.6)
mysql-connector-java (8.0.33)
```

---

## File Structure

```
koi-fish-friend/
├── backend/                      (Spring Boot)
│   ├── src/
│   │   └── main/
│   │       ├── java/
│   │       │   └── com/example/backend/
│   │       │       ├── config/           [Configuration]
│   │       │       ├── controller/       [REST APIs]
│   │       │       ├── dto/             [Data Transfer]
│   │       │       ├── entity/          [JPA Entities]
│   │       │       └── repository/      [Data Access]
│   │       └── resources/
│   │           └── application.properties
│   └── pom.xml                   [Maven Dependencies]
│
├── frontend/                     (React + TypeScript)
│   ├── src/
│   │   ├── pages/               [React Components]
│   │   ├── services/            [API Client]
│   │   ├── App.tsx              [Router Setup]
│   │   └── main.tsx             [Entry Point]
│   ├── package.json             [NPM Dependencies]
│   ├── tailwind.config.js       [Tailwind Setup]
│   └── .env                     [Environment Vars]
│
└── docs/                         (Documentation)
    ├── README.md
    ├── QUICKSTART.md
    ├── TESTING.md
    ├── ARCHITECTURE.md          [This File]
    └── SUMMARY.md
```

---

## API Contract

### POST /api/login

```json
Request:
{
  "username": "string",
  "password": "string"
}

Response (Success):
{
  "success": true,
  "message": "Login successful"
}

Response (Failure):
{
  "success": false,
  "message": "Invalid username or password"
}
```

### POST /api/update-credentials

```json
Request:
{
  "currentUsername": "string",
  "newUsername": "string",      // optional
  "newPassword": "string"        // optional
}

Response (Success):
{
  "success": true,
  "message": "Credentials updated successfully"
}

Response (Failure):
{
  "success": false,
  "message": "Username already exists"
}
```

---

This architecture is designed for:
✅ Scalability
✅ Maintainability
✅ Security
✅ Performance
✅ Ease of Testing
