# Multi-stage build for Spring Boot backend

# Stage 1: Build the application
FROM maven:3.9-eclipse-temurin-21 AS builder

WORKDIR /app

# Copy pom.xml and download dependencies (cached layer)
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source code
COPY src ./src

# Build the application (skip tests for faster builds)
RUN mvn clean package -DskipTests

# Stage 2: Run the application
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# Copy the built JAR from builder stage
COPY --from=builder /app/target/*.jar app.jar

# Expose port 8081 (matches server.port in application.properties)
EXPOSE 8081

# Set Java options for container environment
ENV JAVA_OPTS="-Xmx512m -Xms256m"

# Health check (app runs on port 8081 per application.properties)
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8081/actuator/health || exit 1

# Run the application with startup banner
ENTRYPOINT ["sh", "-c", "IP=$(hostname -i 2>/dev/null || echo '0.0.0.0'); \
  echo '=========================================='; \
  echo \" Backend running at http://${IP}:8081\"; \
  echo '=========================================='; \
  java $JAVA_OPTS -jar app.jar"]
