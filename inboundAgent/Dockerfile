FROM videosdk/agent-runtime:py3.13

# Platform explicitly set karo
ARG TARGETPLATFORM=linux/amd64

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Requirements pehle copy karo (layer cache ke liye)
COPY requirements.txt .

RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --no-deps -r requirements.txt || \
    pip install -r requirements.txt

# Source baad mein copy karo
COPY . .

CMD ["python", "main.py"]