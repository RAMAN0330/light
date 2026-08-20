FROM node:22-bookworm-slim

WORKDIR /orbital-runner-worker
COPY server/orbital_runner_requirements.txt ./requirements.txt
COPY server/orbital_runners-package.json ./package.json
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv build-essential && rm -rf /var/lib/apt/lists/* \
  && python3 -m venv /opt/orbital-venv \
  && /opt/orbital-venv/bin/pip install --no-cache-dir -r requirements.txt \
  && npm install --omit=dev
COPY server/app/orbital_runners /orbital/app/orbital_runners
COPY server/orbital_modules/upstream /orbital/modules/upstream
ENV PATH="/opt/orbital-venv/bin:/orbital-runner-worker/node_modules/.bin:${PATH}" \
    PYTHONPATH="/orbital/modules/upstream/document-ingestion/anydoc/python:/orbital/modules/upstream/context-optimization:/orbital/modules/upstream/web-research:/orbital/modules/upstream/code-intelligence:/orbital/modules/upstream/agent-workflows:/orbital" \
    NODE_PATH="/orbital/modules/upstream/code-context:/orbital-runner-worker/node_modules"
EXPOSE 8010
CMD ["uvicorn", "app.orbital_runners.main:app", "--host", "0.0.0.0", "--port", "8010"]
