FROM apache/airflow:2.9.2-python3.11

USER root
# Install basic build tools if needed
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential libpq-dev \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

USER airflow
# Install python packages required for ADF equivalent operators
RUN pip install --no-cache-dir \
    apache-airflow-providers-postgres==5.11.0 \
    apache-airflow-providers-http==4.10.1 \
    psycopg2-binary==2.9.9 \
    requests==2.31.0 \
    boto3==1.34.100
