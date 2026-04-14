FROM tabulario/spark-iceberg

RUN pip install duckdb ipython-sql jupysql jupyterlab-git

# Create ipython profile and setup scripts
RUN mkdir -p /root/.ipython/profile_default/startup/
COPY ./startup/ /root/.ipython/profile_default/startup/

# Override Spark defaults to include S3 path-style access
COPY spark-defaults.conf /opt/spark/conf/spark-defaults.conf
