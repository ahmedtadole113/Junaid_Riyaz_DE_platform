FROM tabulario/spark-iceberg

RUN pip install duckdb ipython-sql jupysql

# Create ipython profile and setup scripts
RUN mkdir -p /root/.ipython/profile_default/startup/
COPY ./startup/ /root/.ipython/profile_default/startup/
