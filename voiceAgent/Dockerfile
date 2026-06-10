FROM videosdk/agent-runtime:py3.13

# Install git to allow pip to install dependencies from git repositories
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/* || (apk update && apk add --no-cache git)

WORKDIR /app

RUN pip install uv


# Copy only requirements first to leverage Docker layer caching
COPY requirements.txt .

RUN uv pip install --system --no-cache -r requirements.txt

# Copy application code
COPY . .

CMD ["python", "main.py"]