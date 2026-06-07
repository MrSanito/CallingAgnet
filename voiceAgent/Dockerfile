ARG PYTHON_VERSION=3.12

FROM ghcr.io/astral-sh/uv:python${PYTHON_VERSION}-bookworm-slim AS builder

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    ca-certificates \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt ./requirements.txt

RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --python /opt/venv/bin/python -r requirements.txt psutil

RUN python -c "\
from videosdk.plugins.silero import pre_download_model; \
pre_download_model(); \
print('models downloaded')"


RUN pip uninstall -y \
    sphinx \
    sphinx-argparse \
    sphinx-rtd-theme \
    sphinxcontrib-applehelp \
    sphinxcontrib-devhelp \
    sphinxcontrib-htmlhelp \
    sphinxcontrib-jsmath \
    sphinxcontrib-qthelp \
    sphinxcontrib-serializinghtml \
    sphinxcontrib-jquery \
    alabaster \
    docutils \
    imagesize \
    snowballstemmer \
    roman-numerals \
    babel \
    pygments \
    || true

RUN set -eux; \
    \
    SITE="$(/opt/venv/bin/python -c 'import site; print(site.getsitepackages()[0])')"; \
    \
    echo 'BEFORE CLEANUP:'; \
    du -sh $SITE; \
    \
    find $SITE -type d -name '__pycache__' -exec rm -rf {} +; \
    find $SITE -type f -name '*.pyc' -delete; \
    find $SITE -type f -name '*.pyo' -delete; \
    \
    find $SITE -type d -name 'tests' -exec rm -rf {} + 2>/dev/null || true; \
    find $SITE -type d -name 'test' -exec rm -rf {} + 2>/dev/null || true; \
    find $SITE -type d -name 'docs' -exec rm -rf {} + 2>/dev/null || true; \
    find $SITE -type d -name 'examples' -exec rm -rf {} + 2>/dev/null || true; \
    find $SITE -type d -name 'benchmarks' -exec rm -rf {} + 2>/dev/null || true; \
    \
    find $SITE -type f -name '*.a' -delete; \
    find $SITE -type f -name '*.h' -delete; \
    find $SITE -type f -name '*.c' -delete; \
    find $SITE -type f -name '*.cpp' -delete; \
    find $SITE -type f -name '*.pyi' -delete; \
    \
    find $SITE -type f \( -name '*.so' -o -name '*.so.*' \) \
        -not -path '*.libs/*' \
        -exec strip --strip-debug {} + 2>/dev/null || true; \
    \
    rm -rf /root/.cache/pip; \
    rm -rf /tmp/*; \
    rm -rf /var/tmp/*; \
    \
    rm -rf $SITE/pip*; \
    rm -rf $SITE/wheel*; \
  
    \

    find $SITE -type d -name '*.dist-info' -exec sh -c '\
        for d in "$@"; do \
            rm -f "$d"/LICENSE* "$d"/NOTICE* "$d"/AUTHORS* "$d"/COPYING* 2>/dev/null || true; \
        done' _ {} + 2>/dev/null || true; \
    \
    echo 'AFTER CLEANUP:'; \
    du -sh $SITE

FROM python:${PYTHON_VERSION}-slim-bookworm AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOME=/app \
    PATH=/opt/venv/bin:$PATH

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

ARG UID=10001

RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/app" \
    --shell "/usr/sbin/nologin" \
    --uid "${UID}" \
    appuser

WORKDIR /app


COPY --from=builder --chown=appuser:appuser /opt/venv /opt/venv

COPY --from=builder --chown=appuser:appuser \
    /root/.cache/videosdk/silero \
    /app/.cache/videosdk/silero

COPY --chown=appuser:appuser main.py instructions.py tools.py ./
COPY --chown=appuser:appuser knowledge_base.json ./

USER appuser

CMD ["python", "main.py"]