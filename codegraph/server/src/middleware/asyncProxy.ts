import type { Request, Response } from 'express';

export function createJsonProxy(targetOrigin: string) {
  return async function jsonProxy(req: Request, res: Response): Promise<void> {
    try {
      const upstream = await fetch(`${targetOrigin}${req.originalUrl}`, {
        method: req.method,
        headers: { 'Content-Type': 'application/json' },
        body: ['POST', 'PUT', 'PATCH'].includes(req.method)
          ? JSON.stringify(req.body ?? {})
          : undefined,
      });
      const body = await upstream.text();
      res.status(upstream.status);
      try {
        res.json(JSON.parse(body));
      } catch {
        res.send(body);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      res.status(502).json({ error: 'Analysis service unreachable', detail });
    }
  };
}
