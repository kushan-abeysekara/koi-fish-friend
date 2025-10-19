# 🚀 Deployment Guide

## Overview

This guide covers deploying the Koi Fish Friend application to production.

---

## Pre-Deployment Checklist

- [ ] All tests passing (see TESTING.md)
- [ ] Code reviewed and approved
- [ ] Dependencies up to date
- [ ] Security audit completed
- [ ] Database backup taken
- [ ] Environment variables configured
- [ ] SSL certificates obtained
- [ ] Domain name configured

---

## Production Environment Requirements

### Backend

- Java 21 JRE/JDK
- At least 512MB RAM
- MySQL 8.0+ database
- SSL/TLS enabled

### Frontend

- Static file hosting (Nginx, Apache, S3, Netlify, Vercel)
- CDN (optional but recommended)

### Database

- MySQL 8.0+
- Persistent storage
- Regular backups
- SSL connection enabled

---

## Deployment Options

### Option 1: Traditional Server Deployment

#### Backend (Spring Boot on Linux Server)

1. **Build the application:**

   ```bash
   cd backend
   ./mvnw clean package -DskipTests
   ```

2. **Transfer JAR file to server:**

   ```bash
   scp target/backend-0.0.1-SNAPSHOT.jar user@server:/opt/koi-fish-friend/
   ```

3. **Create systemd service:**

   ```bash
   sudo nano /etc/systemd/system/koi-fish-friend.service
   ```

   ```ini
   [Unit]
   Description=Koi Fish Friend Backend
   After=network.target

   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/opt/koi-fish-friend
   ExecStart=/usr/bin/java -jar /opt/koi-fish-friend/backend-0.0.1-SNAPSHOT.jar
   Restart=on-failure
   RestartSec=10
   StandardOutput=journal
   StandardError=journal

   [Install]
   WantedBy=multi-user.target
   ```

4. **Update application.properties for production:**

   ```properties
   # Update these with production values
   spring.datasource.url=jdbc:mysql://your-prod-db:3306/your_db_name
   spring.datasource.username=your_prod_user
   spring.datasource.password=your_prod_password

   # Important production settings
   spring.jpa.hibernate.ddl-auto=validate
   spring.jpa.show-sql=false
   server.port=8080

   # Enable HTTPS (if using)
   server.ssl.enabled=true
   server.ssl.key-store=classpath:keystore.p12
   server.ssl.key-store-password=your-password
   server.ssl.key-store-type=PKCS12
   ```

5. **Start the service:**
   ```bash
   sudo systemctl enable koi-fish-friend
   sudo systemctl start koi-fish-friend
   sudo systemctl status koi-fish-friend
   ```

#### Frontend (Nginx Static Hosting)

1. **Build the frontend:**

   ```bash
   cd frontend
   npm run build
   ```

2. **Update .env.production:**

   ```
   VITE_API_URL=https://api.yourdomain.com
   ```

3. **Transfer build files:**

   ```bash
   scp -r dist/* user@server:/var/www/koi-fish-friend/
   ```

4. **Configure Nginx:**

   ```bash
   sudo nano /etc/nginx/sites-available/koi-fish-friend
   ```

   ```nginx
   server {
       listen 80;
       server_name yourdomain.com www.yourdomain.com;

       # Redirect to HTTPS
       return 301 https://$server_name$request_uri;
   }

   server {
       listen 443 ssl http2;
       server_name yourdomain.com www.yourdomain.com;

       ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

       root /var/www/koi-fish-friend;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       # API proxy (optional if backend on same server)
       location /api {
           proxy_pass http://localhost:8080;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

5. **Enable and restart Nginx:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/koi-fish-friend /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

---

### Option 2: Docker Deployment

#### Backend Dockerfile

Create `backend/Dockerfile`:

```dockerfile
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY target/backend-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

#### Frontend Dockerfile

Create `frontend/Dockerfile`:

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### Docker Compose

Create `docker-compose.yml`:

```yaml
version: "3.8"

services:
  backend:
    build: ./backend
    ports:
      - "8080:8080"
    environment:
      - SPRING_DATASOURCE_URL=jdbc:mysql://db:3306/koi_fish_friend
      - SPRING_DATASOURCE_USERNAME=root
      - SPRING_DATASOURCE_PASSWORD=password
    depends_on:
      - db
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

  db:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=password
      - MYSQL_DATABASE=koi_fish_friend
    volumes:
      - mysql_data:/var/lib/mysql
    restart: unless-stopped

volumes:
  mysql_data:
```

**Deploy:**

```bash
docker-compose up -d
```

---

### Option 3: Cloud Platform Deployment

#### AWS Deployment

**Backend (Elastic Beanstalk):**

1. Install AWS CLI and EB CLI
2. Create `backend/.ebextensions/https.config`
3. Deploy:
   ```bash
   cd backend
   eb init
   eb create koi-fish-friend-env
   eb deploy
   ```

**Frontend (S3 + CloudFront):**

1. Build frontend: `npm run build`
2. Create S3 bucket
3. Upload dist folder to S3
4. Configure CloudFront distribution
5. Update DNS

**Database (RDS MySQL):**

1. Create RDS MySQL instance
2. Configure security groups
3. Update backend datasource URL

#### Heroku Deployment

**Backend:**

```bash
cd backend
heroku create koi-fish-friend-api
heroku addons:create cleardb:ignite
heroku config:set SPRING_DATASOURCE_URL=<cleardb-url>
git push heroku main
```

**Frontend (Netlify):**

1. Connect GitHub repo to Netlify
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Add environment variable: `VITE_API_URL`

#### Azure Deployment

**Backend (App Service):**

```bash
az webapp up --name koi-fish-friend-api --resource-group koi-rg --runtime "JAVA:21-java21"
```

**Frontend (Static Web Apps):**

```bash
az staticwebapp create --name koi-fish-friend --resource-group koi-rg
```

---

## Database Migration

### Update DDL Strategy for Production

Change in `application.properties`:

```properties
# Development
spring.jpa.hibernate.ddl-auto=update

# Production (recommended)
spring.jpa.hibernate.ddl-auto=validate
```

### Use Flyway for Migrations (Recommended)

1. **Add Flyway dependency to pom.xml:**

```xml
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-mysql</artifactId>
</dependency>
```

2. **Create migration file:**
   `backend/src/main/resources/db/migration/V1__initial_schema.sql`

```sql
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

-- Insert demo user
INSERT INTO users (username, password) VALUES
('admin', '$2a$10$...');  -- Use actual BCrypt hash
```

---

## Environment Variables

### Backend (.env or system environment)

```bash
export SPRING_DATASOURCE_URL=jdbc:mysql://host:3306/dbname
export SPRING_DATASOURCE_USERNAME=username
export SPRING_DATASOURCE_PASSWORD=password
export SERVER_PORT=8080
export SPRING_JPA_HIBERNATE_DDL_AUTO=validate
```

### Frontend (.env.production)

```bash
VITE_API_URL=https://api.yourdomain.com
```

---

## Security Hardening

### Backend

1. **Enable HTTPS:**

   - Obtain SSL certificate
   - Configure in application.properties

2. **Update CORS for production:**

   ```java
   @CrossOrigin(origins = "https://yourdomain.com")
   ```

3. **Add rate limiting:**

   - Use Spring Security rate limiting
   - Or use API Gateway

4. **Enable security headers:**

   ```java
   http.headers()
       .contentSecurityPolicy("default-src 'self'")
       .and()
       .frameOptions().deny();
   ```

5. **Use environment variables for secrets:**
   - Never hardcode passwords
   - Use AWS Secrets Manager, Azure Key Vault, etc.

### Frontend

1. **Use HTTPS only**
2. **Add CSP headers in Nginx/server config**
3. **Enable HSTS**
4. **Implement proper error handling**
5. **Sanitize user inputs**

### Database

1. **Enable SSL connections**
2. **Use strong passwords**
3. **Restrict IP access**
4. **Regular backups**
5. **Enable audit logging**

---

## Monitoring & Logging

### Backend Monitoring

1. **Add Spring Boot Actuator:**

   ```xml
   <dependency>
       <groupId>org.springframework.boot</groupId>
       <artifactId>spring-boot-starter-actuator</artifactId>
   </dependency>
   ```

2. **Configure endpoints:**

   ```properties
   management.endpoints.web.exposure.include=health,info,metrics
   management.endpoint.health.show-details=always
   ```

3. **Use Application Performance Monitoring (APM):**
   - New Relic
   - Datadog
   - AWS CloudWatch
   - Azure Monitor

### Frontend Monitoring

1. **Google Analytics**
2. **Sentry for error tracking**
3. **Logrocket for session replay**

### Log Aggregation

- ELK Stack (Elasticsearch, Logstash, Kibana)
- Splunk
- AWS CloudWatch Logs
- Azure Log Analytics

---

## Backup Strategy

### Database Backups

**Automated daily backups:**

```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -h hostname -u username -p'password' dbname > backup_$DATE.sql
# Upload to S3
aws s3 cp backup_$DATE.sql s3://your-backup-bucket/
```

**Cron job:**

```bash
0 2 * * * /path/to/backup.sh
```

### Application Backups

- Version control (Git)
- Docker images
- Server snapshots

---

## Rollback Plan

1. **Keep previous version:**

   ```bash
   cp backend-0.0.1-SNAPSHOT.jar backend-0.0.1-SNAPSHOT.jar.backup
   ```

2. **Database rollback:**

   - Keep database backups
   - Test rollback procedure

3. **Quick rollback:**
   ```bash
   sudo systemctl stop koi-fish-friend
   cp backend-0.0.1-SNAPSHOT.jar.backup backend-0.0.1-SNAPSHOT.jar
   sudo systemctl start koi-fish-friend
   ```

---

## Health Checks

### Backend Health Endpoint

```bash
curl http://localhost:8080/actuator/health
```

### Frontend Health Check

```bash
curl -I https://yourdomain.com
```

### Database Health

```bash
mysql -h host -u user -p -e "SELECT 1"
```

---

## Performance Optimization

### Backend

- Enable connection pooling (HikariCP)
- Add caching (Redis)
- Enable compression
- Optimize database queries

### Frontend

- Enable gzip compression
- Use CDN
- Optimize images
- Code splitting
- Lazy loading

### Database

- Add indexes
- Optimize queries
- Regular maintenance

---

## Post-Deployment

- [ ] Verify all endpoints working
- [ ] Test login functionality
- [ ] Test credential update
- [ ] Check logs for errors
- [ ] Monitor performance
- [ ] Test from different locations
- [ ] Verify SSL certificate
- [ ] Test mobile responsiveness
- [ ] Update DNS if needed
- [ ] Document deployment

---

## Support & Maintenance

### Regular Tasks

- Update dependencies monthly
- Review logs weekly
- Database maintenance weekly
- Security audits quarterly
- Performance reviews quarterly

### Monitoring Alerts

- Set up alerts for:
  - High CPU usage
  - High memory usage
  - Failed logins
  - Database errors
  - Slow response times

---

## Troubleshooting

### Backend won't start

- Check Java version
- Verify database connection
- Check port availability
- Review application logs

### Frontend not loading

- Check build output
- Verify API URL
- Check server configuration
- Review browser console

### Database connection fails

- Verify credentials
- Check network connectivity
- Ensure database is running
- Check firewall rules

---

## Contact & Support

For deployment issues:

1. Check logs first
2. Review this guide
3. Check documentation
4. Contact DevOps team

---

**Deployment Checklist Complete! ✅**

Good luck with your deployment! 🚀
