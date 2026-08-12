# Azure Data Engineering Practice Studio — Spark 4.2 Pro Edition

A modular, high-performance, production-grade local data engineering practice studio with an Apple-refined design aesthetic, powered by **Apache Spark 4.2**, **Delta Lake 4.0**, and **Apache Iceberg**.

Tuned specifically for Apple Silicon MacBooks (M4/M3/M2/M1) and constrained RAM machines (staying strictly below **5 GB total RAM**), offering a unified Apple-inspired web console to monitor resources, launch interactive practice labs, and access Apple Intelligence AI Copilot guidance.

---

## Technical Service Mapping

The platform simulates Azure Cloud Data services using their direct modern counterparts:

| Azure Service | Local Equivalent | Exposed Port | Container / Process | Profile |
| :--- | :--- | :--- | :--- | :--- |
| **Azure Databricks** | **Apache Spark 4.2** + Delta Lake 4.0 + JupyterLab | `8888` / `8080` | `spark-processing` | `profile-processing` |
| **ADLS Gen2** | MinIO S3 Object Store (Bronze / Silver / Gold) | `9000` / `9001` | `minio` | `profile-storage` |
| **Azure Data Factory** | Apache Airflow 2.9 (PySpark 4.2 Integrated) | `8085` | `airflow-webserver` | `profile-orchestration` |
| **Azure Synapse SQL** | PostgreSQL 16 (DW) + pgAdmin 4 | `5432` / `5050` | `postgres-dw` / `pgadmin` | `profile-warehouse` |
| **Azure Event Hub** | Redpanda + Redpanda Console (Kafka) | `9092` / `8081` | `redpanda` / `console` | `profile-streaming` |
| **Azure Service Bus** | RabbitMQ + Management Console (AMQP) | `5672` / `15672` | `rabbitmq` | `profile-streaming` |
| **Azure Monitor** | Grafana Metrics | `3010` / `3000` | `grafana` | `profile-monitoring` |
| **Studio Console** | Apple-Refined React UI + FastAPI | `5173` / `8000` | `portal-frontend` / `backend` | (Core / Default) |

---

## Key Apache Spark 4.2 Features Enabled

1. **ANSI SQL Mode by Default:** Strict standards-compliant SQL query parsing and error validation.
2. **Delta Lake 4.0 & Iceberg v2 Extensions:** Multi-table ACID support, `MERGE INTO`, time-travel, and schema evolution.
3. **Structured Streaming 4.2:** Ultra-fast streaming integration from Redpanda (Event Hub) to Delta tables.
4. **Memory Efficient Shuffles:** `spark.sql.shuffle.partitions=10` and adaptive query execution enabled for 8 GB RAM machines.

---

## Getting Started

### 1. Bootstrap the Studio
Run the setup script from the root of the repository:
```bash
./init-lab.sh
```
This script initializes the environment, starts MinIO, creates the lakehouse buckets (`bronze`, `silver`, `gold`, `warehouse`), and launches the Apple-styled Studio Console.

### 2. Access the Studio
- **Apple Pro Studio Console:** [http://localhost:5173](http://localhost:5173) (Passwordless / default admin: `aariz` / `aariz`)
- **Data Lake (MinIO) Console:** [http://localhost:9001](http://localhost:9001) (`admin` / `password`)

---

## Pre-Configured Hands-On Practice Labs

1. **Project 1: Batch ETL & Medallion Pipeline**
   - **Flow:** Raw CSVs $\to$ MinIO Bronze $\to$ PySpark 4.2 Cleaning $\to$ MinIO Silver $\to$ Spark Aggregations $\to$ MinIO Gold $\to$ PostgreSQL Fact Table.
   - **Practice:** Open [Medallion Architecture Notebook](file:///home/iceberg/notebooks/notebooks/Medallion_Architecture_TPCH.ipynb).

2. **Project 2: Structured Streaming**
   - **Flow:** Redpanda (Event Hub) $\to$ PySpark Structured Streaming $\to$ Delta Lake 4.0.
   - **Practice:** Open [Streaming Lab Notebook](file:///home/iceberg/notebooks/notebooks/project2_eventhub_streaming.ipynb).

3. **Project 3: Incremental Ingestion & Watermarking**
   - **Flow:** REST API $\to$ Airflow 2.9 $\to$ Delta MERGE Upsert $\to$ Postgres Warehouse.
   - **Practice:** Open `project3_adf_incremental_load` in Airflow.

4. **Project 4: Change Data Capture (CDC)**
   - **Flow:** PostgreSQL Source $\to$ Redpanda $\to$ Spark Streaming $\to$ Target Lakehouse Tables.
   - **Practice:** Open [CDC Pipeline Notebook](file:///home/iceberg/notebooks/notebooks/project4_cdc_pipeline.ipynb).
