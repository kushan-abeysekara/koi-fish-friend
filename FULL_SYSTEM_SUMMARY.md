# 🐟 Koi Fish Friend — Full System Summary

> **A comprehensive IoT-based smart koi fish farm management platform** combining embedded hardware, real-time communication, AI-powered predictions, live video streaming, and a full-stack web dashboard for complete pond monitoring, automated feeding, energy management, water quality analysis, boat navigation, and financial tracking.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Technology Stack Summary](#3-technology-stack-summary)
4. [Backend — Spring Boot](#4-backend--spring-boot)
5. [Frontend — React + TypeScript](#5-frontend--react--typescript)
6. [Databases](#6-databases)
7. [MQTT Messaging System](#7-mqtt-messaging-system)
8. [ESP32 Hardware Modules](#8-esp32-hardware-modules)
9. [Raspberry Pi — Camera & AI](#9-raspberry-pi--camera--ai)
10. [Docker & Deployment](#10-docker--deployment)
11. [External Services & APIs](#11-external-services--apis)
12. [Communication Protocols](#12-communication-protocols)
13. [Complete Hardware Bill of Materials](#13-complete-hardware-bill-of-materials)
14. [Software Libraries & Dependencies](#14-software-libraries--dependencies)
15. [System Features Overview](#15-system-features-overview)
16. [Network & Topics Map](#16-network--topics-map)

---

## 1. System Overview

**Koi Fish Friend** is an end-to-end smart aquaculture management system designed for koi fish farms. The platform integrates:

- **4 ESP32 IoT modules** — Boat navigation, automated feeding, energy monitoring, water quality sensing
- **Raspberry Pi** — Live camera streaming with YOLOv8 AI fish detection
- **Spring Boot backend** — REST API, MQTT integration, WebSocket real-time communication
- **React 19 frontend** — 32-component interactive dashboard with live data streaming
- **Dual database architecture** — MySQL (relational) + Supabase PostgreSQL (high-frequency time-series IoT data)
- **AI predictions** — Self-hosted Flowise LLM for intelligent feeding & management recommendations
- **Financial management** — Revenue, expenditures, profit/loss tracking, inventory, and budget forecasting

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLOUD / VPS SERVICES                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  EMQX Broker │  │  MediaMTX    │  │   Flowise    │  │  LiveKit  │  │
│  │  :1883 MQTT  │  │  :1935 RTMP  │  │  :3001 AI    │  │  WebRTC   │  │
│  │  :8083 WS    │  │  :8888 HLS   │  │  LLM Engine  │  │  Streams  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘  │
└─────────┼──────────────────┼──────────────────┼───────────────┼────────┘
          │                  │                  │               │
    ┌─────┴──────────────────┴──────────────────┴───────────────┴─────┐
    │                      NETWORK / INTERNET                         │
    └─────┬──────────────────┬──────────────────┬───────────────┬─────┘
          │                  │                  │               │
┌─────────┴─────────┐       │        ┌─────────┴─────────┐     │
│   SPRING BOOT     │       │        │   REACT FRONTEND  │     │
│   BACKEND :8081   │       │        │   (Vite + Nginx)  │     │
│                   │       │        │   :3000            │     │
│ • REST API        │◄──────┼────────┤ • Axios HTTP      │     │
│ • MQTT Client     │       │        │ • MQTT.js Direct   │     │
│ • WebSocket Server│───────┼────────┤ • WebSocket Client │     │
│ • JPA/Hibernate   │       │        │ • Supabase SDK     │     │
│ • Supabase Client │       │        │ • HLS.js Video     │     │
└─────────┬─────────┘       │        └───────────────────┘     │
          │                  │                                  │
┌─────────┴─────────┐       │        ┌─────────────────────────┴─────┐
│     DATABASES     │       │        │        RASPBERRY PI           │
│                   │       │        │                               │
│ ┌───────────────┐ │       │        │ • Pi Camera Module            │
│ │  MySQL 8.0    │ │       │        │ • YOLOv8 Fish Detection       │
│ │  (Relational) │ │       │        │ • Flask + Socket.IO Server    │
│ └───────────────┘ │       │        │ • FFmpeg → RTMP → MediaMTX   │
│ ┌───────────────┐ │       │        └───────────────────────────────┘
│ │  Supabase     │ │       │
│ │  (PostgreSQL) │ │       │
│ │  (Time-Series)│ │       │
│ └───────────────┘ │       │
└───────────────────┘       │
                            │
    ┌───────────────────────┴──────────────────────────────────┐
    │                     ESP32 DEVICES                         │
    │                                                           │
    │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐  │
    │  │ 🚤 Boat     │  │ 🍽️ Feeder  │  │ ⚡ Energy Monitor│  │
    │  │ Navigation  │  │ System      │  │                  │  │
    │  │             │  │             │  │ • ZMPT101B       │  │
    │  │ • MPU-6050  │  │ • HX711 x2  │  │ • ACS712         │  │
    │  │ • L298N     │  │ • NEMA 17   │  │ • Relay          │  │
    │  │ • HC-SR04x4 │  │ • ESC Motor │  │ • 20x4 LCD      │  │
    │  │ • SSD1306   │  │ • SSD1306   │  │                  │  │
    │  │ • Relay     │  │ • 4x5kg LC  │  │                  │  │
    │  └─────────────┘  └─────────────┘  └──────────────────┘  │
    │                                                           │
    │  ┌──────────────────┐                                     │
    │  │ 💧 Water Quality │                                     │
    │  │                  │                                     │
    │  │ • pH Sensor      │                                     │
    │  │ • MQ135 Gas      │                                     │
    │  │ • Turbidity      │                                     │
    │  └──────────────────┘                                     │
    └───────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| **Backend Framework** | Spring Boot | 3.5.8 |
| **Backend Language** | Java | 21 |
| **Build Tool** | Apache Maven | 3.9+ |
| **Frontend Framework** | React | 19.1.1 |
| **Frontend Language** | TypeScript | 5.9.3 |
| **Frontend Build** | Vite | 7.1.7 |
| **CSS Framework** | Tailwind CSS | 3.4.18 |
| **Primary Database** | MySQL | 8.0 |
| **Time-Series Database** | Supabase (PostgreSQL) | Self-hosted |
| **MQTT Broker** | EMQX / Eclipse Mosquitto | 2.x |
| **Microcontroller** | ESP32 DevKit (38-pin) | Multiple |
| **SBC** | Raspberry Pi | With Camera |
| **AI/ML** | YOLOv8 (fish detection), Flowise LLM | Latest |
| **Video Streaming** | MediaMTX + FFmpeg | RTMP/HLS |
| **Real-Time Video** | LiveKit | WebRTC |
| **Containerization** | Docker + Docker Compose | Latest |
| **Web Server** | Nginx | Alpine |
| **Embedded Framework** | Arduino (PlatformIO) | ESP32 |

---

## 4. Backend — Spring Boot

### Runtime & Build Configuration

| Property | Value |
|----------|-------|
| Java Version | 21 |
| Spring Boot Version | 3.5.8 |
| Server Port | 8081 (dev) / 8080 (Docker) |
| Build Tool | Maven with Maven Wrapper (`mvnw`) |
| Docker Build Stage | `maven:3.9-eclipse-temurin-21` |
| Docker Runtime | `eclipse-temurin:21-jre-alpine` |
| Production Deployment | Dokploy (separate `Dockerfile.dokploy`) |

### Maven Dependencies

| Dependency | Group | Version |
|-----------|-------|---------|
| `spring-boot-starter-web` | Spring Boot | Managed (3.5.8) |
| `spring-boot-starter-data-jpa` | Spring Boot | Managed |
| `spring-boot-starter-security` | Spring Boot | Managed |
| `spring-boot-starter-actuator` | Spring Boot | Managed |
| `spring-boot-starter-websocket` | Spring Boot | Managed |
| `spring-boot-starter-test` | Spring Boot | Managed (test) |
| `spring-integration-mqtt` | Spring Integration | Managed |
| `org.eclipse.paho.client.mqttv3` | Eclipse Paho | 1.2.5 |
| `mysql-connector-java` | MySQL | 8.0.33 |
| `jackson-databind` | Jackson | Managed |

### JPA Entities (Data Models)

| Entity | Key Fields | Purpose |
|--------|-----------|---------|
| `User` | id, username, password (BCrypt) | Authentication |
| `Pond` | id, name, details | Pond management |
| `SensorDevice` | device_id, device_type, pond_id, status, ip_address, rssi, energy_wh, relay_state, control_mode, hopper_level, motor_status | ESP32 device registry |
| `SensorData` | sensor readings, timestamps | Sensor data storage |
| `FeedingHistory` | feeding events, amounts | Feeding records |
| `FishCount` | pond_id, count | Fish population |
| `Expenditure` | amount, category, date | Expense tracking |
| `Revenue` | amount, source, date | Revenue tracking |
| `InventoryItem` | name, quantity, unit | Inventory management |
| `StockTransaction` | item, qty_in, qty_out | Stock movements |
| `PowerSchedule` | device_id, start_time, end_time, days_of_week | Power scheduling |
| `Task` | title, description, due_date | Task management |
| `TreatmentLog` | treatment details, date | Fish treatment records |

### REST API Controllers

| Controller | Endpoints | Purpose |
|-----------|----------|---------|
| `AuthController` | `/api/auth/**` | Login, credential management |
| `UserController` | `/api/users/**` | User CRUD, password reset |
| `PondController` | `/api/ponds/**` | Pond CRUD operations |
| `FishCountController` | `/api/fish-counts/**` | Fish population tracking |
| `SensorDeviceController` | `/api/sensor-devices/**` | ESP32 device management |
| `SensorDataController` | `/api/sensor-data/**` | Sensor data ingestion |
| `FeedingController` | `/api/feeding/**` | Feeding commands & history |
| `EnergyController` | `/api/energy/**` | Energy monitoring data |
| `BoatController` | `/api/boat/**` | Boat telemetry & commands |
| `PowerScheduleController` | `/api/power-schedules/**` | Power on/off scheduling |
| `InventoryItemController` | `/api/inventory/**` | Inventory CRUD |
| `StockTransactionController` | `/api/stock-transactions/**` | Stock in/out tracking |
| `ExpenditureController` | `/api/expenditures/**` | Expense management |
| `RevenueController` | `/api/revenue/**` | Revenue tracking |
| `ProfitLossController` | `/api/profit-loss/**` | Financial P&L reports |
| `TaskController` | `/api/tasks/**` | Task/calendar management |
| `TreatmentLogController` | `/api/treatment-logs/**` | Treatment records |
| `WeatherController` | `/api/weather/**` | Weather data proxy |
| `AIPredictionController` | `/api/ai-predictions/**` | Flowise AI predictions |
| `MqttStatusController` | `/api/mqtt-status/**` | MQTT connection health |
| `DeviceDataController` | `/api/device-data/**` | Device data queries |
| `TestController` | `/api/test/**` | Development/testing |

### Backend Services

| Service | Responsibility |
|---------|---------------|
| `MqttService` | Full MQTT integration — receives messages via Spring Integration, routes to database/WebSocket/Supabase |
| `SimpleMqttService` | Simplified MQTT publish/subscribe operations |
| `SupabaseService` | Supabase PostgreSQL integration — auto-creates tables (`energydb`, `energy_history`, `sensor_live`, `sensor_history`, `boat_telemetry`, `feeddb`, `feeding_history`, `weight_history`), full CRUD |
| `FlowiseService` | AI prediction integration with self-hosted Flowise LLM |
| `PondService` | Pond business logic |
| `FishCountService` | Fish population management |
| `ExpenditureService` | Expense calculations |
| `RevenueService` | Revenue tracking |
| `ProfitLossService` | Profit & loss report generation |
| `InventoryItemService` | Inventory management |
| `StockTransactionService` | Stock movement logic |

### WebSocket Endpoints

| Endpoint | Handler | Purpose |
|----------|---------|---------|
| `/ws/feeding` | `FeedingWebSocketHandler` | Real-time feeding & boat data broadcast |
| `/ws/power` | `PowerWebSocketHandler` | Real-time power management data broadcast |

### Security Configuration

- Spring Security with CORS enabled (all origins allowed for development)
- BCrypt password hashing
- Default admin user auto-created on startup: `admin / admin123`

---

## 5. Frontend — React + TypeScript

### Core Framework & Build

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.1.1 | UI framework |
| React DOM | 19.1.1 | DOM rendering |
| TypeScript | 5.9.3 | Type safety |
| Vite | 7.1.7 | Build tool & dev server |
| `@vitejs/plugin-react` | 5.0.4 | React + Vite integration |

### UI & Styling

| Library | Version | Purpose |
|---------|---------|---------|
| Tailwind CSS | 3.4.18 | Utility-first CSS framework |
| PostCSS | 8.5.6 | CSS processing |
| Autoprefixer | 10.4.21 | CSS vendor prefixes |
| Lucide React | 0.562.0 | Modern icon library |
| Font Awesome | 7.1.0 | Extended icon set |

### Data & Communication

| Library | Version | Purpose |
|---------|---------|---------|
| Axios | 1.12.2 | HTTP REST client |
| MQTT.js | 5.14.1 | Direct browser MQTT connection |
| Socket.IO Client | 4.8.3 | Socket.IO communication |
| `@supabase/supabase-js` | 2.98.0 | Direct Supabase database access |
| React Router DOM | 7.9.4 | Client-side routing & navigation |

### Charts & Visualization

| Library | Version | Purpose |
|---------|---------|---------|
| Recharts | 3.6.0 | Data visualization & charting |

### Video Streaming

| Library | Version | Purpose |
|---------|---------|---------|
| HLS.js | 1.6.15 | HLS video stream playback |

### Code Quality

| Tool | Version |
|------|---------|
| ESLint | 9.36.0 |
| `eslint-plugin-react-hooks` | 5.2.0 |
| `eslint-plugin-react-refresh` | 0.4.22 |
| `typescript-eslint` | 8.45.0 |

### Type Definitions

| Package | Version |
|---------|---------|
| `@types/react` | 19.1.16 |
| `@types/react-dom` | 19.1.9 |
| `@types/node` | 24.6.0 |

### Frontend Pages

| Page | File | Purpose |
|------|------|---------|
| Login | `Login.tsx` | User authentication |
| Dashboard | `DashboardLayout.tsx` | Main layout with sidebar navigation |
| Info | `InfoPage.tsx` | System information display |
| Boat Navigation | `BoatNavigation.tsx` | Boat control interface |

### Frontend Components (32 Total)

| Component | Purpose |
|-----------|---------|
| `DashboardHome` | Main dashboard overview with system status |
| `Sidebar` | Navigation sidebar with all section links |
| **Feeding System** | |
| `FeedingDashboard` | Feeding system real-time monitoring |
| `ManualFeeding` | Manual feed trigger controls |
| `FeedingSchedule` | Scheduled feeding management |
| `FeedTankHistory` | Feed tank weight history charts |
| `FeedUsageLogs` | Feed usage log viewer |
| `FeederHealthSafety` | Feeder device health monitoring |
| **Water Quality** | |
| `WaterQualityDashboard` | Real-time water quality monitoring |
| `WaterQualityTrends` | Water quality trend analysis charts |
| **Energy** | |
| `EnergyMonitor` | Energy consumption dashboard |
| `PowerManagement` | Power relay control + schedule management |
| **Boat** | |
| `BoatNavigation` | Boat remote control via MQTT |
| `BoatTilt3D` | 3D boat tilt orientation visualization |
| **Camera** | |
| `MediaMTXCameraFeed` | HLS camera feed from MediaMTX |
| `PondCamera` | Pond camera viewer |
| **Pond & Fish** | |
| `FishCount` | Fish population tracking |
| `SensorCareCalibration` | Sensor calibration tools |
| **Devices** | |
| `DeviceManagement` | ESP32 device management |
| `SystemStatus` | System-wide status overview |
| **Finance** | |
| `Inventory` | Inventory management |
| `Expenditures` | Expense tracking |
| `ProfitLoss` | Profit & loss dashboard |
| `PondProfitLoss` | Per-pond financial analysis |
| `BudgetForecasting` | Budget forecasting tools |
| **Management** | |
| `TaskCalendar` | Task & calendar management |
| `TreatmentDosingLog` | Fish treatment records |
| **AI & Weather** | |
| `AIPredictionPanel` | Flowise AI predictions display |
| `WeatherWidget` | Weather forecast widget |
| **System** | |
| `AlertsCenter` | Alerts & notification center |
| `Settings` | Application settings |
| `UpdateCredentials` | Change password/username |

### Frontend Service Layer

| Service File | Lines | Purpose |
|-------------|-------|---------|
| `api.ts` | ~1,256 | Axios-based REST API client with full typed interfaces for all backend endpoints |
| `supabase.ts` | ~517 | Direct Supabase PostgreSQL client for high-frequency IoT data (feeding, energy, water quality) |

### Docker Deployment
- **Build stage**: `node:20-alpine`
- **Runtime**: `nginx:alpine` serving static build output

---

## 6. Databases

### Primary Database — MySQL 8.0

| Property | Value |
|----------|-------|
| Engine | MySQL 8.0 |
| Production Host | `82.197.82.97:3306` |
| Database Name | `u626686198_fishfeed` |
| Docker Database | `fishfeed` (local development) |
| ORM | Hibernate via Spring Data JPA |
| DDL Strategy | `ddl-auto=update` (auto-migration) |

**MySQL Tables:**

| Table | Purpose |
|-------|---------|
| `users` | User authentication (BCrypt passwords) |
| `ponds` | Pond information |
| `sensor_devices` | ESP32 device registry with full status fields |
| `sensor_data` | Sensor reading storage |
| `feeding_histories` | Feeding event records |
| `fish_counts` | Fish population per pond |
| `expenditures` | Expense records |
| `revenues` | Revenue records |
| `inventory_items` | Inventory stock |
| `stock_transactions` | Stock movement history |
| `power_schedules` | Power on/off schedules with day-of-week |
| `tasks` | Task/calendar entries |
| `treatment_logs` | Fish treatment records |

### Secondary Database — Supabase (Self-Hosted PostgreSQL)

| Property | Value |
|----------|-------|
| Type | PostgreSQL (Supabase) |
| URL | `https://superbase.koifishfriend.online` |
| Access Method | pg/query endpoint (raw SQL) + REST API |
| Purpose | High-frequency IoT time-series data |
| Write Frequency | Every 2 seconds (ESP32 direct writes) |

**Supabase Tables (Auto-Created):**

| Table | Data Type | Write Source |
|-------|-----------|-------------|
| `feeddb` | Real-time feed device status (weight, tank level, motor status) | ESP32 + Backend |
| `feeding_history` | Feeding events (start/stop, duration, feed amounts, tank before/after) | ESP32 |
| `weight_history` | Continuous weight sensor readings (every 10s) | ESP32 |
| `energydb` | Real-time energy status (voltage, current, power, energy_wh) | Backend |
| `energy_history` | Historical energy readings | Backend |
| `sensor_live` | Real-time water quality (pH, turbidity, water quality status) | Backend |
| `sensor_history` | Historical water quality readings | Backend |
| `boat_telemetry` | Live boat data (voltage, distances, angles, motor speeds, command, mode) | Backend |

### SQL Migration Scripts

| Script | Purpose |
|--------|---------|
| `setup.sql` | Base schema (users, sensor_devices) |
| `add_power_management_columns.sql` | relay_state, control_mode, schedule_count columns |
| `add_feeding_device_columns.sql` | hopper_level, hopper_capacity, motor_status, feeding_active |
| `create_power_schedules.sql` | Power schedules table |
| `supabase_feeding_history.sql` | Supabase feeding_history DDL |
| `setup_feed_device.sql` | Feed device initialization |
| `create_feed_device.sql` | Feed device creation |
| `assign_wq_device.sql` | Water quality device assignment |

---

## 7. MQTT Messaging System

### Broker Configuration

| Environment | Broker | Host | Ports |
|-------------|--------|------|-------|
| Development | Eclipse Mosquitto 2 | Docker | 1883 (MQTT), 9001 (WebSocket) |
| Production | EMQX | `187.77.189.5` | 1883 (MQTT), 8083 (WebSocket) |

- **Protocol**: MQTT v3.1.1
- **Client Library**: Eclipse Paho (Java), MQTT.js (JavaScript/Browser)
- **QoS Levels**: 0–1
- **Authentication**: Anonymous allowed
- **Persistence**: Enabled with file storage

### MQTT Topic Architecture

#### Sensor Data Topics
| Topic | Direction | Data |
|-------|-----------|------|
| `koi/sensors/{deviceId}/data` | ESP32 → Backend | Sensor readings (pH, turbidity, voltage, etc.) |
| `koi/sensors/{deviceId}/status` | ESP32 → Backend | Device online/offline status |
| `koi/sensors/{deviceId}/command` | Backend → ESP32 | Commands: assign, unassign, reset, power control |

#### Feeding System Topics
| Topic | Direction | Data |
|-------|-----------|------|
| `koi/devices/{deviceId}/feeding/command` | Backend → ESP32 | start, stop, schedule feeding |
| `koi/devices/{deviceId}/feeding/status` | ESP32 → Backend | Feeding progress updates |
| `koi/devices/{deviceId}/feeding/schedule` | Backend → ESP32 | Schedule synchronization |

#### Boat Navigation Topics
| Topic | Direction | Data |
|-------|-----------|------|
| `koifish/boat/command` | Backend → ESP32 | FORWARD, BACKWARD, LEFT, RIGHT, STOP, AUTO, MANUAL |
| `koifish/boat/status` | ESP32 → Backend | Heartbeat, connection status |
| `koifish/boat/sensor` | ESP32 → Backend | Full sensor telemetry (voltage, IMU, distances) |

---

## 8. ESP32 Hardware Modules

### Module 1: Boat Navigation System

**Source**: `Kushanesp32/Kushanesp32.ino` (~890 lines)
**Board**: ZY-ESP32 WiFi BT 38-Pin DevKit

| Component | Model | Interface | Pins |
|-----------|-------|-----------|------|
| Gyroscope / IMU | **MPU-6050** (6-axis) | I2C | SDA=21, SCL=22 |
| Motor Driver | **L298N** (dual H-bridge) | GPIO | IN1=26, IN2=4, ENA=27, IN3=2, IN4=32, ENB=33 |
| Ultrasonic Sensor (Front) | **HC-SR04** | Digital | Trig=18, Echo=19 |
| Ultrasonic Sensor (Back) | **HC-SR04** | Digital | Trig=0, Echo=35 |
| Ultrasonic Sensor (Left) | **HC-SR04** | Digital | Trig=25, Echo=39 |
| Ultrasonic Sensor (Right) | **HC-SR04** | Digital | Trig=15, Echo=12 |
| OLED Display | **SSD1306** 0.96" 128x64 | SPI | MOSI=17, CLK=16, DC=5, CS=23 |
| Voltage Sensor | Analog divider (7:1 ratio) | ADC | GPIO 34 |
| Relay Module | Single channel | Digital | GPIO 13 |
| Motors | 2x DC motors | Via L298N | — |

**Arduino Libraries:**
- `Wire.h` — I2C communication
- `MPU6050.h` — Gyroscope/accelerometer driver
- `Adafruit_GFX.h` — Graphics primitives
- `Adafruit_SSD1306.h` — OLED display driver
- `WiFi.h` — WiFi connectivity
- `PubSubClient.h` — MQTT client
- `ArduinoJson.h` — JSON serialization

**PlatformIO Configuration:**
- Platform: `espressif32`
- Board: `esp32dev`
- Framework: `arduino`
- Library Dependencies: `Adafruit GFX @^1.11.9`, `Adafruit SSD1306 @^2.5.9`, `MPU6050 @^1.0.0`

**Key Features:**
- Manual MQTT-controlled navigation (forward, backward, left, right, stop)
- Autonomous obstacle avoidance mode using 4 ultrasonic sensors
- IMU-based balance control and tilt compensation
- Battery voltage monitoring with relay safety cutoff
- Real-time OLED HUD display (mode, voltage, distances)
- Periodic sensor telemetry MQTT publishing

---

### Module 2: Automated Feeding System

**Source**: `Kushanesp32feedcode/Kushanesp32feedcode.ino` (~1,537 lines)
**Board**: ESP32 DevKit

| Component | Model | Interface | Pins |
|-----------|-------|-----------|------|
| ESC Motor | Brushless ESC (feed plate spinner) | PWM (50Hz) | GPIO 25 |
| Stepper Motor | **NEMA 17** | Step/Dir | STEP=26, DIR=27, RESET+SLEEP=12 |
| Stepper Driver | **A4988** | Digital | Via NEMA 17 pins |
| Load Cell (Feed Output) | **HX711** + 1kg load cell | Digital | DT=39, SCK=16 |
| Load Cell (Tank) | **HX711** + 4x **5kg** load cells (20kg total) | Digital | DT=34, SCK=17 |
| OLED Display | **SSD1306** 128x64 | I2C (0x3C) | SDA=21, SCL=22 |
| Potentiometer | Variable resistor (ESC speed) | ADC | GPIO 36 |

**Arduino Libraries:**
- `Wire.h` — I2C communication
- `Adafruit_GFX.h` — Graphics primitives
- `Adafruit_SSD1306.h` — OLED display driver
- `HX711.h` — Load cell amplifier driver
- `WiFi.h` — WiFi connectivity
- `WiFiClientSecure.h` — HTTPS for Supabase
- `PubSubClient.h` — MQTT client
- `ArduinoJson.h` — JSON serialization
- `HTTPClient.h` — HTTP REST client
- `time.h` — NTP time synchronization

**Key Features:**
- Weight-based automated feeding with precise measurement
- ESC motor vibration + ramp phases for feed dispensing
- Stepper motor smooth acceleration with hardware timer ISR
- Homing sequence for stepper motor calibration
- NTP time synchronization for scheduled feedings
- Up to 10 programmable feeding schedules
- Direct Supabase HTTPS writes (feeddb, feeding_history, weight_history)
- MQTT remote control (start, stop, schedule sync)
- 5-minute safety timeout for feeding operations
- ESC wind-down phase for motor protection
- Real-time OLED status display

---

### Module 3: Energy Monitoring System

**Source**: `ESP32 CODE/currnet_voltage/currnet_voltage.ino` (~765 lines)
**Device Type**: `BUDGET_MANAGEMENT`

| Component | Model | Interface | Pins |
|-----------|-------|-----------|------|
| AC Voltage Sensor | **ZMPT101B** (transformer) | ADC | GPIO 34 |
| Current Sensor | **ACS712** (Hall-effect) | ADC | GPIO 35 |
| Relay Module | Single channel | Digital | GPIO 17 |
| LCD Display | **20x4 I2C LCD** | I2C (0x27) | SDA=21, SCL=23 |

**Arduino Libraries:**
- `Wire.h` — I2C communication
- `LiquidCrystal_I2C.h` — I2C LCD driver
- `WiFi.h` — WiFi connectivity
- `PubSubClient.h` — MQTT client
- `ArduinoJson.h` — JSON serialization
- `Preferences.h` — Non-volatile flash storage
- `time.h` — NTP time synchronization

**Key Features:**
- AC voltage measurement (ZMPT101B, calibrated for 210–250V range)
- AC current measurement (ACS712 Hall-effect sensor)
- Real-time power (W) and energy (Wh) calculation
- Voltage safety range monitoring with auto-relay cutoff
- Three control modes: Manual, Auto, Schedule
- Up to 10 power schedules with day-of-week configuration
- Persistent state storage in ESP32 flash (Preferences)
- NTP time synchronization
- 20x4 LCD real-time status display
- MQTT commands: `power_on`, `power_off`, `auto_mode`, `schedule_mode`, `sync_schedules`, `assign`, `unassign`, `reset_energy`

---

### Module 4: Water Quality Monitoring

**Source**: `ESP32 CODE/water_quality/water_quality.ino` (~789 lines)
**Device Type**: `WATER_QUALITY`

| Component | Model | Interface | Pins |
|-----------|-------|-----------|------|
| pH Sensor | Analog pH probe | ADC (ADC1_CH4) | GPIO 32 |
| Gas Sensor | **MQ135** (CO2 + NH3) | ADC (ADC1_CH5) | GPIO 33 |
| Turbidity Sensor | Analog turbidity probe | ADC (ADC1_CH6) | GPIO 34 |

**Arduino Libraries:**
- `WiFi.h` — WiFi connectivity
- `PubSubClient.h` — MQTT client
- `ArduinoJson.h` — JSON serialization

**Key Features:**
- pH measurement with calibration support
- Turbidity measurement in NTU (Nephelometric Turbidity Units)
- CO2 concentration in PPM
- Ammonia (NH3) concentration in PPM
- Automatic water quality evaluation: Normal / Warning / Critical
- Static IP configuration (192.168.8.102)
- MQTT sensor data publishing every 2 seconds
- Pond assign/unassign capability
- Standalone operation mode (auto-assigns to Pond 3)

---

## 9. Raspberry Pi — Camera & AI

### Hardware
- **Raspberry Pi** (with camera module)
- **IP Address**: 192.168.8.101

### Software Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Camera Server | Flask + Socket.IO | Serves camera frames with YOLOv8 annotations |
| AI Model | **YOLOv8** | Fish detection and counting |
| Stream Relay | `mediamtx_streamer.py` (313 lines) | Pipes video frames to FFmpeg |
| Video Encoder | **FFmpeg** | x264 encoding, RTMP output |
| Stream Server | **MediaMTX** (on VPS) | RTMP ingest → HLS delivery |
| Service Manager | systemd | Auto-start on boot |

### Python Dependencies

| Package | Purpose |
|---------|---------|
| `python-socketio[client]` | Socket.IO client for Flask bridge |
| `opencv-python-headless` | OpenCV for image processing |
| `Pillow` | Image manipulation |
| `numpy` | Numerical operations |
| `ffmpeg` (system) | Video encoding |

### Streaming Configuration

| Parameter | Value |
|-----------|-------|
| Resolution | 640 x 360 |
| Frame Rate | 15 FPS |
| Codec | x264 (ultrafast preset) |
| Bitrate | 800 kbps |
| Protocol | RTMP → MediaMTX → HLS |
| RTMP URL | `rtmp://187.77.189.5:1935/live/camera` |
| HLS URL | `http://187.77.189.5:8888/live/camera/index.m3u8` |

### Operating Modes

1. **Flask Bridge Mode** (default): Connects to Flask camera server via Socket.IO → receives YOLOv8-annotated frames → pipes to FFmpeg → RTMP to MediaMTX
2. **Direct Mode** (`--direct` flag): OpenCV direct camera capture → FFmpeg → RTMP (no AI processing, lower latency)

### Files

| File | Purpose |
|------|---------|
| `mediamtx_streamer.py` | Main streaming script (313 lines) |
| `mediamtx_setup.sh` | Automated environment setup |
| `mediamtx-camera.service` | systemd service definition for auto-start |

---

## 10. Docker & Deployment

### Docker Compose Services

| Service | Image | Ports | Purpose |
|---------|-------|-------|---------|
| `mysql` | `mysql:8.0` | 3306:3306 | Primary relational database |
| `mqtt` | `eclipse-mosquitto:2` | 1883:1883, 9001:9001 | MQTT broker (TCP + WebSocket) |
| `backend` | Custom (Spring Boot) | 8080:8080 | REST API + MQTT + WebSocket server |
| `frontend` | Custom (React + Nginx) | 3000:80 | Web dashboard UI |

### Docker Network
- **Network**: `koifish-network` (bridge mode)
- **Volumes**: `mysql_data`, `mqtt_data`, `mqtt_logs`

### Container Build Details

| Service | Build Stage | Runtime |
|---------|------------|---------|
| Backend | `maven:3.9-eclipse-temurin-21` | `eclipse-temurin:21-jre-alpine` |
| Frontend | `node:20-alpine` | `nginx:alpine` |

### Deployment Options

| Method | Description |
|--------|-------------|
| Docker Compose | Local development (`docker-compose up`) |
| Dokploy | Production deployment (separate Dockerfile) |
| Manual | `start.bat` / `start.ps1` scripts |

---

## 11. External Services & APIs

| Service | URL | Purpose |
|---------|-----|---------|
| **EMQX MQTT Broker** | `tcp://187.77.189.5:1883` | Production IoT message broker |
| **Supabase (Self-Hosted)** | `https://superbase.koifishfriend.online` | PostgreSQL time-series database |
| **Flowise AI** | `http://187.77.189.5:3001` | Self-hosted LLM for AI predictions |
| **MediaMTX** | `rtmp://187.77.189.5:1935` | RTMP → HLS video streaming server |
| **LiveKit** | `wss://livekit.koifishfriend.online` | WebRTC real-time video platform |
| **Open-Meteo** | `api.open-meteo.com` | Free weather forecast API |
| **Remote MySQL** | `82.197.82.97:3306` | Production MySQL database hosting |

---

## 12. Communication Protocols

| Protocol | Usage | Direction |
|----------|-------|-----------|
| **HTTP/REST** | Frontend ↔ Backend API, Backend ↔ Supabase, Backend ↔ Flowise | Bidirectional |
| **MQTT v3.1.1** | ESP32 ↔ EMQX ↔ Backend, Frontend direct MQTT subscription | Pub/Sub |
| **WebSocket** | Backend → Frontend (feeding/power real-time updates) | Server → Client |
| **Socket.IO** | Flask Camera Server → Streamer Script | Server → Client |
| **RTMP** | Raspberry Pi → MediaMTX video ingest | Unidirectional |
| **HLS** | MediaMTX → Browser video playback | Server → Client |
| **WebRTC** | LiveKit real-time video streaming | Bidirectional |
| **WHIP** | LiveKit video ingest protocol | Unidirectional |
| **JDBC** | Backend → MySQL database | Bidirectional |
| **HTTPS** | ESP32 → Supabase direct IoT data writes | Client → Server |
| **I2C** | ESP32 ↔ MPU-6050, OLED (feed), LCD (energy) | Bus |
| **SPI** | ESP32 ↔ OLED (boat) | Bus |
| **PWM / LEDC** | ESP32 → Motor control, ESC control | Output |
| **NTP** | ESP32 time synchronization | Client → Server |
| **ADC** | ESP32 ← Analog sensors (pH, turbidity, voltage, current) | Input |

---

## 13. Complete Hardware Bill of Materials

| Qty | Component | Model / Specification | Used In |
|-----|-----------|----------------------|---------|
| 3+ | Microcontroller | **ESP32 DevKit** (38-pin, WiFi + BT) | Boat, Feed, Energy, Water Quality |
| 1 | Single Board Computer | **Raspberry Pi** (with Camera Module) | Video Streaming + AI |
| 1 | IMU / Gyroscope | **MPU-6050** (6-axis accelerometer + gyro) | Boat |
| 1 | Motor Driver | **L298N** (dual H-bridge, 2A per channel) | Boat |
| 2 | DC Motors | Standard DC motors | Boat (left/right propulsion) |
| 4 | Ultrasonic Sensors | **HC-SR04** (2cm–400cm range) | Boat (front, back, left, right) |
| 2 | OLED Displays | **SSD1306** 0.96" 128x64 pixels | Boat (SPI), Feed (I2C) |
| 1 | LCD Display | **20x4 I2C LCD** (HD44780, address 0x27) | Energy Monitor |
| 1 | AC Voltage Sensor | **ZMPT101B** (transformer-based) | Energy Monitor |
| 1 | Current Sensor | **ACS712** (Hall-effect, 5A/20A/30A) | Energy Monitor |
| 3 | Relay Modules | Single channel relay (5V coil) | Boat, Energy, Feed |
| 1 | ESC | Brushless Electronic Speed Controller | Feed System (plate spinner) |
| 1 | Brushless Motor | DC brushless motor | Feed System |
| 1 | Stepper Motor | **NEMA 17** (1.8° step angle) | Feed System (hopper gate) |
| 1 | Stepper Driver | **A4988** (micro-stepping) | Feed System |
| 2 | Load Cell Amplifiers | **HX711** (24-bit ADC) | Feed System |
| 1 | Load Cell | 1kg single-point load cell | Feed System (output weighing) |
| 4 | Load Cells | **5kg** single-point (parallel wired = 20kg total) | Feed System (tank weighing) |
| 1 | Potentiometer | Variable resistor | Feed System (ESC speed adjust) |
| 1 | pH Sensor | Analog pH probe with BNC connector | Water Quality |
| 1 | Gas Sensor | **MQ135** (CO2, NH3, benzene detection) | Water Quality |
| 1 | Turbidity Sensor | Analog turbidity probe | Water Quality |
| 1 | Voltage Divider | Resistor divider circuit (7:1 ratio) | Boat (battery monitoring) |
| — | Breadboards / PCBs | Various | All modules |
| — | Jumper Wires | Male-to-male, male-to-female | All modules |
| — | Power Supply | 5V / 12V adapters, batteries | All modules |

---

## 14. Software Libraries & Dependencies

### Backend (Java / Spring Boot)

| Library | Version | Purpose |
|---------|---------|---------|
| Spring Boot Starter Web | 3.5.8 | REST API framework |
| Spring Boot Starter Data JPA | 3.5.8 | ORM / database access |
| Spring Boot Starter Security | 3.5.8 | Authentication & authorization |
| Spring Boot Starter Actuator | 3.5.8 | Health monitoring endpoints |
| Spring Boot Starter WebSocket | 3.5.8 | WebSocket server |
| Spring Integration MQTT | Managed | MQTT channel integration |
| Eclipse Paho MQTT Client | 1.2.5 | MQTT v3.1.1 client |
| MySQL Connector/J | 8.0.33 | MySQL JDBC driver |
| Jackson Databind | Managed | JSON serialization |
| Hibernate | Managed | JPA implementation / ORM |

### Frontend (TypeScript / React)

| Library | Version | Purpose |
|---------|---------|---------|
| React | 19.1.1 | UI framework |
| React DOM | 19.1.1 | DOM rendering |
| React Router DOM | 7.9.4 | Client-side routing |
| TypeScript | 5.9.3 | Type-safe JavaScript |
| Vite | 7.1.7 | Build tool & dev server |
| Tailwind CSS | 3.4.18 | Utility-first CSS |
| Axios | 1.12.2 | HTTP client |
| MQTT.js | 5.14.1 | Browser MQTT client |
| Socket.IO Client | 4.8.3 | Real-time communication |
| Recharts | 3.6.0 | Charting library |
| HLS.js | 1.6.15 | HLS video playback |
| Supabase JS | 2.98.0 | Supabase database SDK |
| Lucide React | 0.562.0 | Icon library |
| Font Awesome | 7.1.0 | Icon set |
| PostCSS | 8.5.6 | CSS processor |
| Autoprefixer | 10.4.21 | CSS vendor prefixes |
| ESLint | 9.36.0 | Code linting |

### ESP32 / Arduino Libraries

| Library | Used In | Purpose |
|---------|---------|---------|
| `WiFi.h` | All modules | WiFi connectivity |
| `PubSubClient.h` | All modules | MQTT client |
| `ArduinoJson.h` | All modules | JSON parsing/serialization |
| `Wire.h` | Boat, Feed, Energy | I2C communication |
| `Adafruit_GFX.h` | Boat, Feed | Graphics primitives |
| `Adafruit_SSD1306.h` | Boat, Feed | SSD1306 OLED driver |
| `MPU6050.h` | Boat | 6-axis IMU driver |
| `HX711.h` | Feed | Load cell amplifier driver |
| `WiFiClientSecure.h` | Feed | HTTPS for Supabase writes |
| `HTTPClient.h` | Feed | HTTP REST client |
| `LiquidCrystal_I2C.h` | Energy | I2C LCD driver |
| `Preferences.h` | Energy | Non-volatile flash storage |
| `time.h` | Feed, Energy | NTP time synchronization |

### Raspberry Pi / Python

| Library | Purpose |
|---------|---------|
| `python-socketio[client]` | Socket.IO client |
| `opencv-python-headless` | Image processing (OpenCV) |
| `Pillow` | Image manipulation |
| `numpy` | Numerical computation |
| `Flask` | Camera web server |
| `YOLOv8` (Ultralytics) | Fish detection AI model |
| `ffmpeg` (system) | Video encoding |

### Infrastructure

| Tool | Version | Purpose |
|------|---------|---------|
| Docker | Latest | Containerization |
| Docker Compose | Latest | Multi-container orchestration |
| Nginx | Alpine | Frontend static file serving |
| Eclipse Mosquitto | 2.x | MQTT broker (development) |
| EMQX | Latest | MQTT broker (production) |
| MediaMTX | Latest | RTMP/HLS streaming server |
| LiveKit | Latest | WebRTC streaming platform |
| Flowise | Latest | Self-hosted AI/LLM platform |
| MySQL | 8.0 | Relational database |
| PostgreSQL (Supabase) | Latest | Time-series IoT database |

---

## 15. System Features Overview

### Core IoT Features
- **Real-time sensor monitoring** — pH, turbidity, CO2, ammonia, voltage, current, power, energy
- **Automated fish feeding** — Weight-based feeding with scheduling, MQTT remote control
- **Boat navigation** — Manual MQTT control + autonomous obstacle avoidance
- **Energy management** — AC power monitoring, relay control, scheduled power on/off
- **Water quality analysis** — Multi-parameter monitoring with automatic status evaluation

### AI & Camera Features
- **YOLOv8 fish detection** — Real-time AI fish counting on Raspberry Pi
- **Live video streaming** — RTMP → HLS via MediaMTX, WebRTC via LiveKit
- **AI predictions** — Flowise LLM-powered feeding and management recommendations

### Dashboard Features
- **32-component React dashboard** — Comprehensive monitoring and control interface
- **Real-time data streaming** — MQTT direct, WebSocket, Supabase real-time subscriptions
- **Interactive charts** — Recharts-based trend analysis and historical data visualization
- **Device management** — Register, assign, monitor, and control ESP32 devices remotely
- **Weather integration** — Open-Meteo weather forecast widget

### Financial Management
- **Expense tracking** — Category-based expenditure recording
- **Revenue tracking** — Income source management
- **Profit & loss reports** — Per-pond and overall financial analysis
- **Inventory management** — Stock tracking with transaction history
- **Budget forecasting** — Financial planning tools

### System Management
- **Task calendar** — Task scheduling and management
- **Treatment logging** — Fish treatment and dosing records
- **Alert system** — Notification center for system events
- **User authentication** — Secure login with BCrypt password hashing
- **Sensor calibration** — In-dashboard sensor calibration tools

---

## 16. Network & Topics Map

### Local Network (WiFi)

```
Router (192.168.8.x)
  ├── ESP32 Water Quality  → 192.168.8.102 (static)
  ├── ESP32 Boat           → DHCP
  ├── ESP32 Feed           → DHCP
  ├── ESP32 Energy         → DHCP
  ├── Raspberry Pi         → 192.168.8.101
  └── Development PC       → DHCP
```

### Cloud/VPS Services

```
VPS (187.77.189.5)
  ├── EMQX MQTT Broker     → :1883 (TCP), :8083 (WebSocket)
  ├── MediaMTX             → :1935 (RTMP ingest), :8888 (HLS output)
  ├── Flowise AI           → :3001 (HTTP API)
  └── LiveKit              → wss://livekit.koifishfriend.online

Supabase (superbase.koifishfriend.online)
  └── PostgreSQL           → HTTPS (pg/query)

MySQL Production (82.197.82.97)
  └── MySQL 8.0            → :3306
```

### Data Flow Summary

```
ESP32 Sensors ──MQTT──→ EMQX Broker ──MQTT──→ Spring Boot Backend
                                                    │
                                                    ├──→ MySQL (relational data)
                                                    ├──→ Supabase (time-series)
                                                    ├──→ WebSocket → React Frontend
                                                    └──→ Flowise (AI predictions)

ESP32 Feed ──HTTPS──→ Supabase (direct writes every 10s)

Raspberry Pi ──RTMP──→ MediaMTX ──HLS──→ React Frontend (HLS.js)

React Frontend ──MQTT.js──→ EMQX Broker (direct sensor subscriptions)
React Frontend ──Supabase SDK──→ Supabase (direct IoT data queries)
React Frontend ──Axios──→ Spring Boot Backend (REST API)
React Frontend ──WebSocket──→ Spring Boot (feeding/power updates)
```

---

## Version Information

| Component | Current Version |
|-----------|----------------|
| Java | 21 |
| Spring Boot | 3.5.8 |
| React | 19.1.1 |
| TypeScript | 5.9.3 |
| Vite | 7.1.7 |
| Tailwind CSS | 3.4.18 |
| MySQL | 8.0 |
| Node.js (build) | 20 |
| Docker Mosquitto | 2.x |
| Eclipse Paho MQTT | 1.2.5 |
| MQTT.js | 5.14.1 |
| Supabase JS | 2.98.0 |
| HLS.js | 1.6.15 |

---

> **Last Updated**: March 2026
>
> **Project**: Koi Fish Friend — Smart Koi Fish Farm Management System
