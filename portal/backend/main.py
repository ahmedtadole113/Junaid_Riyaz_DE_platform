import os
import json
import time
import logging
import subprocess
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("portal-backend")

app = FastAPI(
    title="Azure Data Engineering Practice Platform - Portal Backend",
    description="Manages local equivalents of Azure services and provides user authentication.",
    version="2.0.0"
)

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Map of service keys to their docker compose services
COMPOSE_SERVICES = {
    "datalake": ["minio", "mc"],
    "databricks": ["spark-processing", "rest"],
    "airflow": ["airflow-webserver", "airflow-scheduler"],
    "synapse": ["postgres-dw", "pgadmin"],
    "eventhub": ["redpanda", "redpanda-console"],
    "servicebus": ["rabbitmq"],
    "monitoring": ["grafana"]
}

# Map of service keys to their primary container names for status checks
SERVICE_CONTAINERS = {
    "datalake": "minio",
    "databricks": "spark-processing",
    "airflow": "airflow-webserver",
    "synapse": "pgadmin",
    "eventhub": "redpanda-console",
    "servicebus": "rabbitmq",
    "monitoring": "grafana"
}

# Human-readable service names
SERVICE_NAMES = {
    "datalake": "Data Lake",
    "databricks": "Data Bricks",
    "airflow": "Airflow",
    "synapse": "Synapse",
    "eventhub": "Event Hub",
    "servicebus": "Service Bus",
    "monitoring": "Monitoring"
}

# UI URLs for services (localhost since single container)
SERVICE_URLS = {
    "datalake": "http://localhost:9001",
    "databricks": "http://localhost:8888",
    "airflow": "http://localhost:8085",
    "synapse": "http://localhost:5050",
    "eventhub": "http://localhost:8081",
    "servicebus": "http://localhost:15672",
    "monitoring": "http://localhost:3010"
}

# Persistent Users DB path
USERS_DB_PATH = "/data/users.json"

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

# ==========================================
# SUPERVISOR-BASED SERVICE MANAGEMENT
# ==========================================

def get_docker_status(container_name: str) -> dict:
    """Get status of a docker container."""
    try:
        result = subprocess.run(
            ["docker", "inspect", "-f", "{{.State.Status}},{{.State.Pid}}", container_name],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            status_str, pid_str = result.stdout.strip().split(",")
            pid = int(pid_str) if pid_str != "0" else None
            return {"status": status_str.lower(), "pid": pid}
        else:
            return {"status": "stopped", "pid": None}
    except Exception as e:
        logger.error(f"Failed to get status for {container_name}: {e}")
        return {"status": "error", "pid": None}


def get_container_stats(container_name: str) -> Dict:
    """Get CPU and memory stats for a docker container."""
    try:
        result = subprocess.run(
            ["docker", "stats", "--no-stream", "--format", "{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}", container_name],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            parts = result.stdout.strip().split("|")
            if len(parts) == 3:
                mem_parts = parts[1].split(" / ")
                mem_usage = mem_parts[0] if len(mem_parts) > 0 else "0 MB"
                mem_limit = mem_parts[1] if len(mem_parts) > 1 else "0 MB"
                return {
                    "cpu_usage": parts[0],
                    "memory_usage": mem_usage,
                    "memory_limit": mem_limit,
                    "memory_percent": parts[2]
                }
    except Exception as e:
        logger.error(f"Failed to get stats for {container_name}: {e}")
        pass
    return {
        "cpu_usage": "0.0%",
        "memory_usage": "0 MB",
        "memory_limit": "0 MB",
        "memory_percent": "0.0%"
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
    services_status = {}
    for service_key, container_name in SERVICE_CONTAINERS.items():
        try:
            sup_status = get_docker_status(container_name)
            state = sup_status["status"]
            pid = sup_status["pid"]
            
            stats = {
                "cpu_usage": "0.0%",
                "memory_usage": "0 MB",
                "memory_limit": "0 MB",
                "memory_percent": "0.0%"
            }
            if state == "running" and pid:
                stats = get_container_stats(container_name)
                
            services_status[service_key] = {
                "name": SERVICE_NAMES.get(service_key, service_key.title()),
                "container_name": container_name,
                "status": "online" if state == "running" else "offline",
                "cpu_usage": stats.get("cpu_usage", "0.0%"),
                "memory_usage": stats.get("memory_usage", "0 MB"),
                "memory_limit": stats.get("memory_limit", "0 MB"),
                "memory_percent": stats.get("memory_percent", "0.0%"),
                "ui_url": SERVICE_URLS.get(service_key),
            }
        except Exception as e:
            services_status[service_key] = {
                "name": SERVICE_NAMES.get(service_key, service_key.title()),
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
        
    services_to_start = COMPOSE_SERVICES.get(service_name.lower())
    if not services_to_start:
        raise HTTPException(status_code=404, detail="Service not mapped to any process")
        
    try:
        cmd = ["docker", "compose", "up", "-d"] + services_to_start
        result = subprocess.run(
            cmd,
            cwd="/home/iceberg",
            capture_output=True, text=True, timeout=60
        )
        if result.returncode == 0:
            return {"status": "success", "message": f"Service {service_name} started"}
        else:
            raise HTTPException(status_code=500, detail=f"Failed to start: {result.stderr or result.stdout}")
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Timeout while starting service")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/services/{service_name}/stop")
def stop_service(service_name: str, x_user_role: Optional[str] = Header(None)):
    if x_user_role != "admin":
        raise HTTPException(status_code=403, detail="Admin permissions required to modify services")
        
    services_to_stop = COMPOSE_SERVICES.get(service_name.lower())
    if not services_to_stop:
        raise HTTPException(status_code=404, detail="Service not mapped to any process")
        
    try:
        cmd = ["docker", "compose", "stop"] + services_to_stop
        result = subprocess.run(
            cmd,
            cwd="/home/iceberg",
            capture_output=True, text=True, timeout=60
        )
        if result.returncode == 0:
            return {"status": "success", "message": f"Service {service_name} stopped"}
        else:
            raise HTTPException(status_code=500, detail=f"Failed to stop: {result.stderr or result.stdout}")
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Timeout while stopping service")
    except HTTPException:
        raise
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
