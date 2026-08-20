import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const upstream = process.env.API_URL || "http://api:8000";
const port = Number(process.env.PORT || 3000);
const allowedOrigins = new Set((process.env.GATEWAY_CORS_ORIGINS || "http://localhost:5173,http://localhost:8080").split(","));

function setCors(request: IncomingMessage, response: ServerResponse) {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
}

async function body(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

createServer(async (request, response) => {
  setCors(request, response);
  if (request.method === "OPTIONS") return response.writeHead(204).end();
  try {
    const upstreamResponse = await fetch(`${upstream}${request.url || "/"}`, {
      method: request.method,
      headers: Object.fromEntries(Object.entries(request.headers).filter(([, value]) => value !== undefined)) as HeadersInit,
      body: ["GET", "HEAD"].includes(request.method || "") ? undefined : await body(request),
    });
    upstreamResponse.headers.forEach((value, name) => {
      if (!["connection", "keep-alive", "transfer-encoding", "access-control-allow-origin", "vary"].includes(name)) response.setHeader(name, value);
    });
    response.writeHead(upstreamResponse.status);
    if (!upstreamResponse.body) return response.end();
    for await (const chunk of upstreamResponse.body) response.write(chunk);
    response.end();
  } catch {
    response.writeHead(502, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ detail: "Gateway could not reach the API." }));
  }
}).listen(port, () => console.log(`Gateway listening on :${port}`));
