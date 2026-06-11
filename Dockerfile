FROM tabulario/spark-iceberg

RUN pip install duckdb ipython-sql jupysql jupyterlab-git

# Create ipython profile and setup scripts
RUN mkdir -p /root/.ipython/profile_default/startup/
COPY ./startup/ /root/.ipython/profile_default/startup/

# Override Spark defaults to include S3 path-style access
COPY spark-defaults.conf /opt/spark/conf/spark-defaults.conf

# Allow framing in both classic Jupyter Notebook and JupyterLab configurations
RUN mkdir -p /root/.jupyter/ \
    && echo "c = get_config()" > /root/.jupyter/jupyter_server_config.py \
    && echo "c.ServerApp.tornado_settings = {'headers': {'Content-Security-Policy': \"frame-ancestors 'self' *\"}}" >> /root/.jupyter/jupyter_server_config.py \
    && echo "c.ServerApp.disable_check_xsrf = True" >> /root/.jupyter/jupyter_server_config.py \
    && echo "c.ServerApp.base_url = '/services/databricks/'" >> /root/.jupyter/jupyter_server_config.py \
    && echo "c.ServerApp.allow_origin = '*'" >> /root/.jupyter/jupyter_server_config.py \
    && echo "c = get_config()" > /root/.jupyter/jupyter_notebook_config.py \
    && echo "c.NotebookApp.tornado_settings = {'headers': {'Content-Security-Policy': \"frame-ancestors 'self' *\"}}" >> /root/.jupyter/jupyter_notebook_config.py \
    && echo "c.NotebookApp.disable_check_xsrf = True" >> /root/.jupyter/jupyter_notebook_config.py \
    && echo "c.NotebookApp.base_url = '/services/databricks/'" >> /root/.jupyter/jupyter_notebook_config.py \
    && echo "c.NotebookApp.allow_origin = '*'" >> /root/.jupyter/jupyter_notebook_config.py

