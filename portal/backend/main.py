import os
import json
import time
import logging
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import docker

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("portal-backend")

app = FastAPI(
    title="Azure Data Engineering Practice Platform - Portal Backend",
    description="Manages local equivalents of Azure services and provides user authentication.",
    version="1.1.0"
)

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Docker Client
try:
    docker_client = docker.from_env()
    logger.info("Connected to Docker daemon successfully")
except Exception as e:
    logger.error(f"Failed to connect to Docker daemon: {e}")
    docker_client = None

# Map of service names to their container names
SERVICE_CONTAINERS = {
    "datalake": "minio",
    "databricks": "spark-processing",
    "airflow": "airflow-webserver",
    "synapse": "postgres-dw",
    "eventhub": "redpanda",
    "servicebus": "rabbitmq",
    "monitoring": "grafana"
}

# UI URLs for services
SERVICE_URLS = {
    "datalake": "http://localhost:9001",
    "databricks": "http://localhost:8888",
    "airflow": "http://localhost:8085",
    "synapse": "http://localhost:5050",
    "eventhub": "http://localhost:8081",
    "servicebus": "http://localhost:15672",
    "monitoring": "http://localhost:3010"
}

# Persistent Users DB path (saved on host workspace for durability)
USERS_DB_PATH = "/home/iceberg/users.json"

# In-memory fallback if path not writable
_fallback_users = {
    "aariz": {"password": "aariz", "role": "admin"},
    "ariz": {"password": "aariz", "role": "admin"}
}

def load_users() -> dict:
    if os.path.exists(USERS_DB_PATH):
        try:
            with open(USERS_DB_PATH, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load users from {USERS_DB_PATH}: {e}")
    
    # Write initial defaults if file does not exist
    try:
        os.makedirs(os.path.dirname(USERS_DB_PATH), exist_ok=True)
        with open(USERS_DB_PATH, "w") as f:
            json.dump(_fallback_users, f, indent=4)
        return _fallback_users
    except Exception as e:
        logger.error(f"Failed to write default users to {USERS_DB_PATH}: {e}")
        return _fallback_users

def save_users(users: dict):
    try:
        with open(USERS_DB_PATH, "w") as f:
            json.dump(users, f, indent=4)
    except Exception as e:
        logger.error(f"Failed to save users to {USERS_DB_PATH}: {e}")

# Models for Auth
class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreateRequest(BaseModel):
    username: str
    password: str
    role: str  # 'admin' or 'user'

# Initialize users
users_db = load_users()

def get_container_stats(container) -> Dict:
    try:
        stats = container.stats(stream=False)
        cpu_stats = stats.get("cpu_stats", {})
        precpu_stats = stats.get("precpu_stats", {})
        cpu_usage = cpu_stats.get("cpu_usage", {}).get("total_usage", 0)
        precpu_usage = precpu_stats.get("cpu_usage", {}).get("total_usage", 0)
        system_cpu = cpu_stats.get("system_cpu_usage", 0)
        presystem_cpu = precpu_stats.get("system_cpu_usage", 0)
        online_cpus = cpu_stats.get("online_cpus", 1)
        
        cpu_percent = 0.0
        if system_cpu - presystem_cpu > 0.0:
            cpu_percent = ((cpu_usage - precpu_usage) / (system_cpu - presystem_cpu)) * online_cpus * 100.0
            
        mem_stats = stats.get("memory_stats", {})
        mem_usage = mem_stats.get("usage", 0)
        inactive_file = mem_stats.get("stats", {}).get("inactive_file", 0)
        net_mem_usage = max(0, mem_usage - inactive_file)
        mem_limit = mem_stats.get("limit", 1)
        mem_percent = (net_mem_usage / mem_limit) * 100.0 if mem_limit > 0 else 0.0
        
        return {
            "cpu_percent": round(cpu_percent, 2),
            "memory_usage_bytes": net_mem_usage,
            "memory_limit_bytes": mem_limit,
            "memory_percent": round(mem_percent, 2)
        }
    except Exception as e:
        return {
            "cpu_percent": 0.0,
            "memory_usage_bytes": 0,
            "memory_limit_bytes": 0,
            "memory_percent": 0.0
        }

@app.post("/api/auth/login")
def login(req: LoginRequest):
    users = load_users()
    u = req.username.strip()
    p = req.password.strip()
    
    if u in users and users[u]["password"] == p:
        return {"status": "success", "username": u, "role": users[u]["role"]}
    
    raise HTTPException(status_code=401, detail="Invalid username or password")

@app.get("/api/auth/users")
def list_users(x_user_role: Optional[str] = Header(None)):
    if x_user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin permissions required")
    
    users = load_users()
    user_list = []
    for uname, info in users.items():
        user_list.append({"username": uname, "role": info["role"]})
    return user_list

@app.post("/api/auth/users")
def create_user(req: UserCreateRequest, x_user_role: Optional[str] = Header(None)):
    if x_user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin permissions required")
        
    users = load_users()
    
    # Check 20 limited users limit (excluding the admins 'aariz' and 'ariz')
    non_admin_users = [u for u, info in users.items() if info["role"] != "admin"]
    if req.role != "admin" and len(non_admin_users) >= 20:
        raise HTTPException(status_code=400, detail="Limit of 20 limited access users reached")
        
    u = req.username.strip()
    if u in users:
        raise HTTPException(status_code=400, detail="User already exists")
        
    users[u] = {"password": req.password.strip(), "role": req.role}
    save_users(users)
    return {"status": "success", "message": f"User {u} created successfully"}

@app.delete("/api/auth/users/{username}")
def delete_user(username: str, x_user_role: Optional[str] = Header(None)):
    if x_user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin permissions required")
        
    users = load_users()
    u = username.strip()
    
    if u not in users:
        raise HTTPException(status_code=404, detail="User not found")
        
    if u in ["aariz", "ariz"]:
        raise HTTPException(status_code=400, detail="Cannot delete bootstrap admin users")
        
    del users[u]
    save_users(users)
    return {"status": "success", "message": f"User {u} deleted successfully"}

@app.get("/api/services")
def list_services():
    if docker_client is None:
        raise HTTPException(status_code=503, detail="Docker daemon connection unavailable")
        
    services_status = {}
    for service_key, container_name in SERVICE_CONTAINERS.items():
        try:
            container = docker_client.containers.get(container_name)
            state = container.status
            stats = {
                "cpu_percent": 0.0,
                "memory_usage_bytes": 0,
                "memory_limit_bytes": 0,
                "memory_percent": 0.0
            }
            if state == "running":
                stats = get_container_stats(container)
                
            services_status[service_key] = {
                "name": service_key.replace("data", "Data ").replace("hub", " Hub").replace("bus", " Bus").title(),
                "container_name": container_name,
                "status": "online" if state == "running" else "offline",
                "cpu_usage": f"{stats['cpu_percent']}%",
                "memory_usage": f"{round(stats['memory_usage_bytes'] / (1024 * 1024), 1)} MB",
                "memory_limit": f"{round(stats['memory_limit_bytes'] / (1024 * 1024), 1)} MB",
                "memory_percent": f"{stats['memory_percent']}%",
                "ui_url": SERVICE_URLS.get(service_key),
            }
        except docker.errors.NotFound:
            services_status[service_key] = {
                "name": service_key.title(),
                "container_name": container_name,
                "status": "not_created",
                "cpu_usage": "0%",
                "memory_usage": "0 MB",
                "memory_limit": "0 MB",
                "memory_percent": "0%",
                "ui_url": SERVICE_URLS.get(service_key),
            }
        except Exception as e:
            services_status[service_key] = {
                "name": service_key.title(),
                "container_name": container_name,
                "status": "error",
                "cpu_usage": "0%",
                "memory_usage": "0 MB",
                "memory_limit": "0 MB",
                "memory_percent": "0%",
                "ui_url": SERVICE_URLS.get(service_key),
            }
    return services_status

@app.post("/api/services/{service_name}/start")
def start_service(service_name: str, x_user_role: Optional[str] = Header(None)):
    if x_user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin permissions required to modify services")
        
    if docker_client is None:
        raise HTTPException(status_code=503, detail="Docker daemon connection unavailable")
        
    container_name = SERVICE_CONTAINERS.get(service_name.lower())
    if not container_name:
        raise HTTPException(status_code=404, detail="Service not mapped to any container")
        
    try:
        container = docker_client.containers.get(container_name)
        if container.status != "running":
            container.start()
            return {"status": "success", "message": f"Service {service_name} started"}
        return {"status": "success", "message": f"Service {service_name} was already running"}
    except docker.errors.NotFound:
        raise HTTPException(status_code=404, detail=f"Container {container_name} not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/services/{service_name}/stop")
def stop_service(service_name: str, x_user_role: Optional[str] = Header(None)):
    if x_user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin permissions required to modify services")
        
    if docker_client is None:
        raise HTTPException(status_code=503, detail="Docker daemon connection unavailable")
        
    container_name = SERVICE_CONTAINERS.get(service_name.lower())
    if not container_name:
        raise HTTPException(status_code=404, detail="Service not mapped to any container")
        
    try:
        container = docker_client.containers.get(container_name)
        if container.status == "running":
            container.stop(timeout=5)
            return {"status": "success", "message": f"Service {service_name} stopped"}
        return {"status": "success", "message": f"Service {service_name} was already stopped"}
    except docker.errors.NotFound:
        raise HTTPException(status_code=404, detail=f"Container {container_name} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/mock-api/transactions")
def get_mock_transactions(
    last_id: int = Query(0, description="Retrieve transactions with ID greater than this value"),
    limit: int = Query(10, description="Number of transaction records to fetch")
):
    current_time = int(time.time())
    transactions = []
    merchant_list = ["Walmart", "Target", "Starbucks", "Amazon", "Netflix", "Costco", "McDonalds", "Apple"]
    category_list = ["Grocery", "Shopping", "Food", "Shopping", "Subscription", "Wholesale", "Food", "Electronics"]
    
    start_id = max(last_id + 1, 1000)
    for idx in range(limit):
        tx_id = start_id + idx
        merchant_idx = tx_id % len(merchant_list)
        amount = round((15.5 * (tx_id % 7) + 4.99) * (1.2 if tx_id % 3 == 0 else 1.0), 2)
        
        transactions.append({
            "transaction_id": tx_id,
            "timestamp": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(current_time - (limit - idx) * 60)),
            "customer_id": 10000 + (tx_id % 123),
            "amount": amount,
            "merchant": merchant_list[merchant_idx],
            "category": category_list[merchant_idx],
            "status": "COMPLETED" if tx_id % 15 != 0 else "REFUNDED"
        })
        
    return {
        "count": len(transactions),
        "last_id": start_id + limit - 1 if transactions else last_id,
        "data": transactions
    }

# ==========================================
# AI COPILOT SERVICE
# ==========================================
import csv
import io
import requests

class AICopilotRequest(BaseModel):
    service: str
    action: str
    content: str
    api_key: Optional[str] = None

def run_local_fallback(service: str, action: str, content: str) -> str:
    content_stripped = content.strip()
    
    if action == "validate_data":
        if not content_stripped:
            return "### Data Validation Report\n\n❌ Error: Provided dataset is empty."
        
        # Try JSON parsing
        try:
            parsed_json = json.loads(content_stripped)
            if isinstance(parsed_json, list):
                row_count = len(parsed_json)
                keys_set = set()
                null_counts = {}
                for idx, item in enumerate(parsed_json):
                    if isinstance(item, dict):
                        keys_set.update(item.keys())
                        for k, v in item.items():
                            if v is None or v == "":
                                null_counts[k] = null_counts.get(k, 0) + 1
                    else:
                        return f"### Data Validation Report\n\n❌ Error: JSON list contains non-object at index {idx}."
                
                null_report = "\n".join([f"- `{k}`: {v} null/empty cells" for k, v in null_counts.items()])
                return (
                    f"### Data Validation Report (JSON Mode)\n\n"
                    f"✅ **Format**: Valid JSON array of objects.\n"
                    f"📊 **Total Records**: {row_count}\n"
                    f"🔑 **Fields Detected**: {', '.join([f'`{k}`' for k in keys_set])}\n"
                    f"⚠️ **Null/Empty Values**:\n{null_report or '- None'}\n\n"
                    f"💡 *Tip: Provide a Google Gemini API key in settings for advanced schema generation and statistical outlier analysis.*"
                )
            elif isinstance(parsed_json, dict):
                return (
                    f"### Data Validation Report (JSON Mode)\n\n"
                    f"✅ **Format**: Valid single JSON object.\n"
                    f"🔑 **Fields Detected**: {', '.join([f'`{k}`' for k in parsed_json.keys()])}\n\n"
                    f"💡 *Tip: Provide a Google Gemini API key in settings for advanced schema mapping.*"
                )
        except Exception:
            pass
            
        # Try CSV parsing
        try:
            f = io.StringIO(content_stripped)
            reader = csv.reader(f)
            rows = list(reader)
            if len(rows) > 0:
                header = rows[0]
                row_count = len(rows) - 1
                col_count = len(header)
                mismatched_rows = []
                null_counts = {col: 0 for col in header}
                
                for idx, r in enumerate(rows[1:]):
                    if len(r) != col_count:
                        mismatched_rows.append(idx + 1)
                    else:
                        for col_idx, cell in enumerate(r):
                            if cell.strip() == "":
                                null_counts[header[col_idx]] += 1
                                
                mismatch_report = f"❌ **Schema Mismatch**: Mismatched column count at rows {mismatched_rows[:5]}..." if mismatched_rows else "✅ **Schema Consistency**: All rows have consistent column counts."
                null_report = "\n".join([f"- `{k}`: {v} empty cells" for k, v in null_counts.items() if v > 0])
                
                return (
                    f"### Data Validation Report (CSV Mode)\n\n"
                    f"✅ **Format**: Valid CSV text.\n"
                    f"📊 **Rows Detected**: {row_count} records\n"
                    f"📐 **Columns Count**: {col_count}\n"
                    f"📋 **Header Schema**: {', '.join([f'`{c}`' for c in header])}\n"
                    f"🔍 {mismatch_report}\n"
                    f"⚠️ **Null/Empty cells**:\n{null_report or '- None'}\n\n"
                    f"💡 *Tip: Provide a Google Gemini API key in settings for statistical insights, data type inference, and value profiling.*"
                )
        except Exception as csv_err:
            return f"### Data Validation Report\n\n❌ Error: Failed to parse content as JSON or CSV. Raw details: {str(csv_err)}"
            
        return "### Data Validation Report\n\n❌ Error: Unable to detect structured data format (JSON/CSV)."

    elif action == "validate_code":
        if not content_stripped:
            return "### Syntax Check Result\n\n❌ Error: Provided script is empty."
            
        braces = {'(': ')', '[': ']', '{': '}'}
        stack = []
        errors = []
        for i, char in enumerate(content_stripped):
            if char in braces.keys():
                stack.append((char, i))
            elif char in braces.values():
                if not stack:
                    errors.append(f"Unexpected closing token `{char}` at position {i}")
                else:
                    top, pos = stack.pop()
                    if braces[top] != char:
                        errors.append(f"Mismatched closing token `{char}` at position {i} (expected `{braces[top]}` for opening `{top}` at position {pos})")
        while stack:
            top, pos = stack.pop()
            errors.append(f"Unclosed opening token `{top}` at position {pos}")
            
        if errors:
            errors_str = "\n".join([f"- {err}" for err in errors[:5]])
            return (
                f"### Syntax Check Result (Heuristic Engine)\n\n"
                f"⚠️ **Syntax Warning**: Mismatched or unclosed brackets detected:\n{errors_str}\n\n"
                f"💡 *Tip: Set a Google Gemini API key for intelligent Python, PySpark, PostgreSQL SQL, and Apache Airflow syntax corrections.*"
            )
            
        return (
            f"### Syntax Check Result (Heuristic Engine)\n\n"
            f"✅ **Bracket Integrity**: All brackets (`()`, `[]`, `{{}}`) are correctly matched and closed.\n"
            f"🔍 No other static errors could be detected by the local engine.\n\n"
            f"💡 *Tip: Provide a Google Gemini API key in settings to run real LLM-based syntax validation and logical bug fixing.*"
        )

    templates = {
        "databricks": (
            "### Pre-Configured PySpark & Delta Lake Templates\n\n"
            "Here is a template for reading from MinIO ADLS and writing as a partitioned Delta Lake table:\n\n"
            "```python\n"
            "from pyspark.sql import SparkSession\n\n"
            "# Read raw data from ADLS raw stage\n"
            "df = spark.read.format(\"csv\") \\\n"
            "    .option(\"header\", \"true\") \\\n"
            "    .option(\"inferSchema\", \"true\") \\\n"
            "    .load(\"s3://bronze/sample_data.csv\")\n\n"
            "# Perform cleaning transformations\n"
            "df_cleaned = df.filter(df[\"amount\"] > 0).dropDuplicates([\"transaction_id\"])\n\n"
            "# Write out as a Delta Lake table partitioned by category\n"
            "df_cleaned.write.format(\"delta\") \\\n"
            "    .mode(\"overwrite\") \\\n"
            "    .partitionBy(\"category\") \\\n"
            "    .save(\"s3://silver/transactions_delta\")\n"
            "```\n\n"
            "💡 *Tip: Add your Google Gemini API key in settings to ask custom programming questions or request auto-corrections!*"
        ),
        "airflow": (
            "### Pre-Configured Airflow DAG Templates\n\n"
            "Here is a template for a clean, sequential Airflow pipeline in local environment:\n\n"
            "```python\n"
            "from datetime import datetime, timedelta\n"
            "from airflow import DAG\n"
            "from airflow.operators.bash import BashOperator\n\n"
            "default_args = {\n"
            "    'owner': 'airflow',\n"
            "    'start_date': datetime(2026, 6, 1),\n"
            "    'retries': 1,\n"
            "    'retry_delay': timedelta(minutes=5),\n"
            "}\n\n"
            "with DAG(\n"
            "    'practice_etl_dag',\n"
            "    default_args=default_args,\n"
            "    schedule_interval='@daily',\n"
            "    catchup=False,\n"
            ") as dag:\n\n"
            "    task_start = BashOperator(\n"
            "        task_id='start_pipeline',\n"
            "        bash_command='echo \"Pipeline started!\"'\n"
            "    )\n\n"
            "    task_run_spark = BashOperator(\n"
            "        task_id='run_spark_job',\n"
            "        bash_command='echo \"Running spark-submit...\"'\n"
            "    )\n\n"
            "    task_start >> task_run_spark\n"
            "```\n\n"
            "💡 *Tip: Add your Google Gemini API key in settings to auto-generate custom pipelines!*"
        ),
        "synapse": (
            "### Star Schema DDL Template\n\n"
            "Here is a PostgreSQL warehouse Star Schema layout template:\n\n"
            "```sql\n"
            "-- Create dimensions schema\n"
            "CREATE SCHEMA IF NOT EXISTS dw;\n\n"
            "-- Customers Dimension\n"
            "CREATE TABLE IF NOT EXISTS dw.dim_customers (\n"
            "    customer_key SERIAL PRIMARY KEY,\n"
            "    customer_id INT UNIQUE,\n"
            "    customer_name VARCHAR(100),\n"
            "    email VARCHAR(100),\n"
            "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n"
            ");\n\n"
            "-- Orders Fact\n"
            "CREATE TABLE IF NOT EXISTS dw.fact_orders (\n"
            "    order_key SERIAL PRIMARY KEY,\n"
            "    order_id INT,\n"
            "    customer_id INT REFERENCES dw.dim_customers(customer_id),\n"
            "    order_amount DECIMAL(12,2),\n"
            "    order_date DATE,\n"
            "    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n"
            ");\n"
            "```\n\n"
            "💡 *Tip: Add your Google Gemini API key to optimize complex Postgres query performance or generate custom schema designs!*"
        )
    }
    
    return templates.get(service.lower(), (
        f"### Local AI Helper (Local Fallback Mode)\n\n"
        f"Greetings! You are currently using the local fallback engine for **{service.upper()}**.\n\n"
        f"To activate the full LLM-based AI Copilot, please enter a valid Google Gemini API Key in the settings input box in the header.\n\n"
        f"Prompt received: *\"{content}\"*"
    ))

@app.post("/api/ai/copilot")
def ai_copilot(req: AICopilotRequest):
    api_key = req.api_key or os.environ.get("GEMINI_API_KEY")
    
    if api_key:
        api_key = api_key.strip()
        
    if not api_key:
        local_response = run_local_fallback(req.service, req.action, req.content)
        return {"status": "success", "response": local_response, "is_mock": True}
        
    sys_instruction = (
        "You are an expert Azure Data Engineering AI Copilot inside a local Practice Lab environment. "
        "The environment emulates Azure Data Services: MinIO (ADLS Gen2 storage), Apache Spark 3.5 with Delta Lake and JupyterLab (Azure Databricks), "
        "Apache Airflow 2.9 (Azure Data Factory), PostgreSQL 16 (Azure Synapse DW), Redpanda (Azure Event Hub), and RabbitMQ (Azure Service Bus). "
        "Format all code outputs using standard markdown code blocks with correct language identifiers. "
        "Keep answers concise, actionable, and focus on correct code structure, syntax verification, and explanations."
    )
    
    user_prompt = f"Service context: {req.service.upper()}\nAction: {req.action.upper()}\nContent:\n{req.content}\n\n"
    if req.action == "validate_code":
        user_prompt += "Check the code for syntax or logical errors. If there are errors, return the corrected version in a markdown code block and explain what you fixed in a bulleted list. If there are no errors, confirm that the code is valid."
    elif req.action == "generate_code":
        user_prompt += "Generate clean, production-ready code based on the instructions above. Ensure it uses the appropriate library/flavor (e.g. PySpark, Airflow DAG API, Postgres SQL DDL)."
    elif req.action == "validate_data":
        user_prompt += "Analyze the data provided. Check for anomalies, missing fields, schema inconsistencies, or incorrect data types. Return a clear assessment report with any recommendations."
    elif req.action == "troubleshoot":
        user_prompt += "Troubleshoot the error message or stack trace provided. Explain what is causing the error and how to fix it, providing the corrected code snippet."
    else:
        user_prompt += "Answer the prompt in the context of the data engineering lab service."
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": f"{sys_instruction}\n\nUser Request:\n{user_prompt}"
                    }
                ]
            }
        ]
    }
    
    try:
        res = requests.post(url, headers=headers, json=payload, timeout=30)
        if res.status_code == 200:
            data = res.json()
            candidates = data.get("candidates", [])
            if candidates:
                text_content = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                if text_content:
                    return {"status": "success", "response": text_content, "is_mock": False}
            return {"status": "error", "response": "Gemini API returned an empty or invalid response layout.", "is_mock": False}
        else:
            err_msg = res.json().get("error", {}).get("message", "Unknown error")
            return {
                "status": "error", 
                "response": f"Gemini API returned HTTP {res.status_code}: {err_msg}. Falling back to local helper:\n\n" + run_local_fallback(req.service, req.action, req.content),
                "is_mock": True
            }
    except Exception as e:
        return {
            "status": "error",
            "response": f"Connection to Gemini API failed: {str(e)}. Falling back to local helper:\n\n" + run_local_fallback(req.service, req.action, req.content),
            "is_mock": True
        }

