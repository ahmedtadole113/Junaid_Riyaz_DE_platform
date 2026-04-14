# Local Data Platform

A lightweight, production-style local data engineering platform built with Docker Compose.
It fits into a < 8GB RAM footprint by focusing purely on Spark, Iceberg, and Minio, avoiding heavier orchestration engines entirely to maximize performance.

## Architecture

- **Spark Compute & Jupyter Environment**: `tabulario/spark-iceberg`
- **Data Lake Storage**: MinIO (S3-compatible)
- **Table Format**: Apache Iceberg
- **Catalog**: Iceberg REST Catalog (`apache/iceberg-rest-fixture`)

## Getting Started

1. **Start the environment:**
   ```bash
   cd local_data_platform
   docker-compose up -d
   ```

2. **Wait for startup:** Give it 5-10 seconds for MinIO to initialize and the `mc` container to automatically create your `warehouse` bucket.

3. **Access the user interfaces:**
   - **Jupyter Notebook**: [http://localhost:8888](http://localhost:8888)
   - **MinIO Console**: [http://localhost:9001](http://localhost:9001) (Credentials: `admin` / `password`)
   - **Spark UI (Master)**: [http://localhost:8080](http://localhost:8080)

## Running the Data Pipeline

1. Head over to **Jupyter Notebook**.
2. Open the `notebooks/Medallion_Architecture_TPCH.ipynb` file.
3. Run through the cells step-by-step. The notebook is annotated to explain how:
   - The TPC-H datasets are ingested into a **Bronze** layer.
   - Data types and schemas are refined in a **Silver** layer.
   - Business aggregations and insights are computed in a **Gold** layer.
   - Spark is configured to run efficiently on limited RAM (e.g., Shuffle partitions, Adaptive Query Execution).

**Happy Data Engineering!**
