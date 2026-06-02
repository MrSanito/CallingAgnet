FROM videosdk/agent-runtime:py3.13

WORKDIR /app

# Copy only requirements first to leverage Docker layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

CMD ["python", "main.py"]
