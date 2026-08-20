FROM python:3.11-slim

WORKDIR /app
COPY server/infra_agent/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server/infra_agent ./infra_agent
EXPOSE 8020
CMD ["uvicorn", "infra_agent.main:app", "--host", "0.0.0.0", "--port", "8020"]
