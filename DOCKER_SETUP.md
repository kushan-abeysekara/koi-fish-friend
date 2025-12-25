# 🐳 Docker Setup Guide

Run the entire KoiFish Friend application anywhere with Docker - no need to install Node.js, Java, MySQL, or MQTT separately!

## 📋 Prerequisites

**Only Docker is required!**

- **Windows**: [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)
- **Mac**: [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop)
- **Linux**: [Docker Engine](https://docs.docker.com/engine/install/)

That's it! Everything else (Node.js, Java, MySQL, MQTT) runs inside containers.

## 🚀 Quick Start

### Option 1: Use the Start Script (Easiest)

**Windows:**

```bash
docker-start.bat
```

**Mac/Linux:**

```bash
chmod +x docker-start.sh
./docker-start.sh
```

### Option 2: Manual Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Rebuild after code changes
docker-compose up -d --build
```

## 📦 What Gets Installed?

The Docker setup includes:

1. **Frontend (React + Vite)** - Port 3000
2. **Backend (Spring Boot)** - Port 8080
3. **MySQL Database** - Port 3306
4. **MQTT Broker (Mosquitto)** - Ports 1883, 9001

## 🌐 Access URLs

After starting:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **MySQL**: localhost:3306
  - Database: `fishfeed`
  - Username: `fishfeeduser`
  - Password: `fishfeedpass`
- **MQTT**: localhost:1883

## 🔧 Common Commands

```bash
# View running containers
docker-compose ps

# View logs for specific service
docker-compose logs -f frontend
docker-compose logs -f backend
docker-compose logs -f mysql
docker-compose logs -f mqtt

# Restart a specific service
docker-compose restart backend

# Stop all services
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v

# Rebuild after code changes
docker-compose up -d --build

# Scale services (run multiple instances)
docker-compose up -d --scale backend=2
```

## 🛠️ Development Workflow

### Making Code Changes

1. **Edit your code** in the project files
2. **Rebuild the container**:
   ```bash
   docker-compose up -d --build backend  # For backend changes
   docker-compose up -d --build frontend # For frontend changes
   ```

### Live Development (Alternative)

For faster development, you can mount volumes:

Edit `docker-compose.yml` to add volume mounts:

```yaml
# For frontend live reload
frontend:
  volumes:
    - ./frontend/src:/app/src

# For backend hot reload (requires spring-boot-devtools)
backend:
  volumes:
    - ./backend/src:/app/src
```

## 📊 Monitoring

### Check Service Health

```bash
docker-compose ps
```

### View Resource Usage

```bash
docker stats
```

### Access Container Shell

```bash
docker exec -it koifish-backend sh
docker exec -it koifish-frontend sh
docker exec -it koifish-mysql mysql -u root -p
```

## 🐛 Troubleshooting

### Services Won't Start

1. **Check if ports are already in use:**

   ```bash
   # Windows
   netstat -ano | findstr :3000
   netstat -ano | findstr :8080

   # Mac/Linux
   lsof -i :3000
   lsof -i :8080
   ```

2. **View detailed logs:**

   ```bash
   docker-compose logs
   ```

3. **Clean start:**
   ```bash
   docker-compose down -v
   docker-compose up -d --build
   ```

### Database Connection Issues

```bash
# Check MySQL is healthy
docker-compose ps

# Access MySQL directly
docker exec -it koifish-mysql mysql -u fishfeeduser -pfishfeedpass fishfeed

# Check database logs
docker-compose logs mysql
```

### Frontend Can't Connect to Backend

1. Check if backend is running:

   ```bash
   curl http://localhost:8080/api/login
   ```

2. Verify environment variables in `docker-compose.yml`

3. Check CORS settings in backend

## 🔒 Production Deployment

For production, update:

1. **MySQL credentials** in `docker-compose.yml`
2. **MQTT authentication** in `mqtt/mosquitto.conf`
3. **Enable HTTPS** with reverse proxy (Nginx/Traefik)
4. **Set environment** to production:
   ```yaml
   environment:
     - NODE_ENV=production
     - SPRING_PROFILES_ACTIVE=prod
   ```

## 📁 File Structure

```
koi-fish-friend/
├── docker-compose.yml          # Orchestrates all services
├── docker-start.bat            # Windows start script
├── docker-start.sh             # Mac/Linux start script
├── .dockerignore               # Files to exclude from builds
├── frontend/
│   ├── Dockerfile              # Frontend container definition
│   ├── nginx.conf              # Nginx configuration
│   └── .dockerignore
├── backend/
│   ├── Dockerfile              # Backend container definition
│   └── .dockerignore
├── mqtt/
│   └── mosquitto.conf          # MQTT broker configuration
└── database/
    └── setup.sql               # Database initialization
```

## 🎯 Benefits of Docker Setup

✅ **Portable**: Run anywhere Docker is installed  
✅ **Consistent**: Same environment for all developers  
✅ **Isolated**: No conflicts with other projects  
✅ **Easy Cleanup**: Remove everything with one command  
✅ **Production-Ready**: Use same setup in production  
✅ **No Installation**: No need for Node.js, Java, MySQL locally

## 🆘 Getting Help

- View logs: `docker-compose logs -f`
- Check status: `docker-compose ps`
- Restart: `docker-compose restart`
- Clean slate: `docker-compose down -v && docker-compose up -d --build`

---

**Need help?** Check the logs first: `docker-compose logs -f`
