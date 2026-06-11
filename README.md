# Azure Data Engineering Practice Lab

A modular, lightweight, production-style local data engineering practice platform built with Docker Compose and tuned specifically for Apple Silicon MacBooks (M4/M3/M2/M1) with limited RAM (e.g., 8 GB).

It features resource-constrained configurations (staying below **5 GB total RAM**) and exposes a custom React Dashboard to start, stop, and monitor services.

---

## Technical Service Mapping

The platform simulates Azure Cloud Data services using their direct open-source counterparts:

| Azure Service | Local Equivalent | Exposed Port | Container Name | Profile |
| :--- | :--- | :--- | :--- | :--- |
| **Azure Data Factory** | Apache Airflow 2.9 (Sequential/SQLite) | `8085` | `airflow-webserver` | `profile-orchestration` |
| **Azure Databricks** | Apache Spark 3.5 + Delta Lake + JupyterLab | `8888` / `8080` | `spark-processing` | `profile-processing` |
| **ADLS Gen2** | MinIO S3-Compatible Object Store | `9000` / `9001` | `minio` | `profile-storage` |
| **Azure Synapse SQL** | PostgreSQL 16 (DW) + pgAdmin 4 | `5432` / `5050` | `postgres-dw` / `pgadmin` | `profile-warehouse` |
| **Azure Event Hub** | Redpanda + Redpanda Console | `9092` / `8081` | `redpanda` / `console` | `profile-streaming` |
| **Azure Service Bus** | RabbitMQ + Management Console | `5672` / `15672` | `rabbitmq` | `profile-streaming` |
| **Azure Monitor** | Grafana | `3000` | `grafana` | `profile-monitoring` |
| **Unified Portal** | FastAPI (Backend) + React Vite (Frontend) | `8000` / `5173` | `portal-backend` / `portal-frontend` | (Always On / Core) |

---

## Key Optimizations for 8 GB RAM Mac

To avoid system out-of-memory errors on Apple Silicon hosts, the following constraints are built-in:
1. **Lightweight Orchestration:** Apache Airflow uses a `SequentialExecutor` with an `SQLite` metadata database, eliminating the memory overhead of a separate metadata Postgres container.
2. **Spark Constraint:** Spark is run inside a single container with a Spark Master, worker, and executor. Memory is limited to **1 GB Driver** and **1 GB Executor**.
3. **Optimized Shuffle Partitions:** `spark.sql.shuffle.partitions` is set to `10` (down from default `200`) to prevent high thread count and memory overhead.
4. **Streaming Footprint:** Redpanda is configured in `--dev-overrides=true` developer mode with a hard threshold of `256 MB` memory limit.
5. **Postgres Footprint:** PostgreSQL is limited to a small shared buffers and memory size (max `256 MB` RAM limit).
6. **Container Profiles:** Docker Compose profiles are utilized, letting you run only the exact service profiles you need for your current practice session.

---

## Getting Started

### 1. Bootstrap the platform
Run the setup script from the root of the repository:
```bash
./init-lab.sh
```
This script will build the dashboard containers, boot the core portal, start MinIO, and create the storage buckets (`bronze`, `silver`, `gold`).

### 2. Access the UIs
- **Unified DE Portal Console:** [http://localhost:5173](http://localhost:5173) (Use this to monitor RAM/CPU usage and start/stop services dynamically)
- **Data Lake (MinIO) Console:** [http://localhost:9001](http://localhost:9001) (`admin` / `password`)

---

## Pre-Built Practice Projects

### Project 1: Batch ETL Ingestion & Medallion Pipeline
- **Flow:** Local TPC-H CSVs $\to$ MinIO Bronze $\to$ Spark Cleaning $\to$ MinIO Silver $\to$ Spark Aggregate $\to$ MinIO Gold $\to$ PostgreSQL Fact Table.
- **Practice:** Start `profile-orchestration` and `profile-warehouse`. Go to [Airflow](http://localhost:8085), search for `project1_adf_batch_pipeline`, and trigger it.

### Project 2: Structured Streaming
- **Flow:** Redpanda $\to$ Spark Structured Streaming $\to$ Delta Lake.
- **Practice:** Start `profile-processing` and `profile-streaming`. Open JupyterLab at [http://localhost:8888](http://localhost:8888) and open `project2_eventhub_streaming.ipynb`.

### Project 3: Incremental Ingestion & Watermarking
- **Flow:** API $\to$ Airflow $\to$ Delta Lake $\to$ Postgres Warehouse.
- **Practice:** Start `profile-orchestration` and `profile-warehouse`. Look up `project3_adf_incremental_load` in Airflow. It queries the mock transactions API and performs a `MERGE` into Postgres.

### Project 4: Change Data Capture (CDC)
- **Flow:** PostgreSQL Source $\to$ Redpanda $\to$ Spark Streaming $\to$ Target PostgreSQL DW.
- **Practice:** Start `profile-processing`, `profile-warehouse`, and `profile-streaming`. Run `project4_cdc_pipeline.ipynb` in JupyterLab.

---

## Local Feature Demonstrations
Open JupyterLab at [http://localhost:8888](http://localhost:8888) and run the following notebooks to practice specific cloud concepts:
1. **Azure Synapse Features:** [synapse_features_demo.ipynb](file:///home/iceberg/notebooks/notebooks/synapse_features_demo.ipynb)
   - Dedicated SQL Pool schemas, Serverless External Tables, PolyBase ingestion, and Materialized views.
2. **Databricks Features:** [databricks_features_demo.ipynb](file:///home/iceberg/notebooks/notebooks/databricks_features_demo.ipynb)
   - Delta Lake `MERGE`, versioned Time Travel, schema evolution, and Auto Loader simulation.
