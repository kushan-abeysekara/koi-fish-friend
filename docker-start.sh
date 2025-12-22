#!/bin/bash

echo "================================"
echo " KoiFish Friend - Docker Setup"
echo "================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed"
    echo "Please install Docker from https://www.docker.com/get-started"
    exit 1
fi

echo "Docker found!"
echo ""

echo "Starting all services..."
docker-compose up -d

echo ""
echo "================================"
echo " Services Starting..."
echo "================================"
echo ""
echo "Waiting for services to be ready..."
sleep 10

echo ""
echo "================================"
echo " Service Status"
echo "================================"
docker-compose ps

echo ""
echo "================================"
echo " Access URLs"
echo "================================"
echo "Frontend:  http://localhost:3000"
echo "Backend:   http://localhost:8080"
echo "MySQL:     localhost:3306"
echo "MQTT:      localhost:1883"
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop all:  docker-compose down"
echo ""
