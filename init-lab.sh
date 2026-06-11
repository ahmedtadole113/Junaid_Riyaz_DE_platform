#!/bin/bash
set -e

# Display title
echo "=========================================================="
echo "  Azure Data Engineering Local Practice Lab (ARM64)"
echo "=========================================================="

echo "    Lightweight emulation optimized for Apple M4 Macs"
echo "=========================================================="
echo ""

# Check if Docker daemon is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi
echo "✅ Docker daemon is running."

# Create copy of environment variables if not exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
fi

# Ensure TPC-H data directory exists
if [ -d "data" ] && [ "$(ls -A data)" ]; then
    echo "✅ TPC-H datasets found in the data/ directory."
else
    echo "⚠️ TPC-H datasets not found or empty."
    echo "⏳ Running data generation script to bundle TPC-H..."
    python3 notebooks/generate_data.py --sf 0.05 --output ./data
    echo "✅ TPC-H datasets generated successfully."
fi

echo ""
echo "🏗️  Building portal backend and frontend containers..."
docker compose build portal-backend portal-frontend

echo ""
echo "🚀 Starting Core Unified Data Portal and Storage Layer..."
docker compose --profile profile-storage up -d portal-backend portal-frontend minio mc

echo ""
echo "⌛ Waiting 5 seconds for MinIO to initialize buckets..."
sleep 5

echo "=========================================================="
echo "🎉 Setup Completed Successfully!"
echo "=========================================================="
echo ""
echo "💻 Unified DE Portal: http://localhost:5173"
echo "📦 Data Lake UI (MinIO): http://localhost:9001"
echo ""
echo "To start modular layers manually, run:"
echo "----------------------------------------------------------"
echo "👉 Processing (Spark/Jupyter):"
echo "   docker compose --profile profile-processing up -d"
echo ""
echo "👉 Orchestration (Airflow):"
echo "   docker compose --profile profile-orchestration up -d"
echo ""
echo "👉 Warehouse (PostgreSQL/pgAdmin):"
echo "   docker compose --profile profile-warehouse up -d"
echo ""
echo "👉 Streaming (Redpanda/RabbitMQ):"
echo "   docker compose --profile profile-streaming up -d"
echo ""
echo "👉 Monitoring (Grafana):"
echo "   docker compose --profile profile-monitoring up -d"
echo ""
echo "👉 Start ALL Services (Requires ~4.5 GB RAM):"
echo "   docker compose --profile profile-storage --profile profile-processing --profile profile-orchestration --profile profile-warehouse --profile profile-streaming --profile profile-monitoring up -d"
echo "=========================================================="
