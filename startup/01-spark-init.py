"""
Spark Session Auto-Initialization
Creates a Spark session with Iceberg support on startup
"""

import os
from pyspark.sql import SparkSession

# Check if Spark session already exists
spark = SparkSession.getActiveSession()

if spark is None:
    print("🔧 Initializing Spark with Iceberg support...")

    spark = SparkSession.builder.appName("JupyterNotebook") \
        .config("spark.sql.catalog.demo.s3.endpoint", "http://minio:9000") \
        .config("spark.sql.catalog.demo.s3.path-style-access", "true") \
        .config("spark.sql.catalog.demo.s3.region", "us-east-1") \
        .getOrCreate()

    # Set log level to reduce noise
    spark.sparkContext.setLogLevel("WARN")

    print(f"✅ Spark {spark.version} session created")
    print(f"📦 Default catalog: {spark.conf.get('spark.sql.defaultCatalog')}")
    print(
        f"💾 Warehouse location: {spark.conf.get('spark.sql.catalog.local.warehouse')}"
    )
else:
    print("✅ Spark session already active")

# Make spark available globally
globals()["spark"] = spark
