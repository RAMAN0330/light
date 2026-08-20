/// <reference lib="webworker" />
import { Parser } from '../services/parser';

interface Request { id: number; path: string; content: string }

self.onmessage = ({ data }: MessageEvent<Request>) => {
  try {
    const actualIsCode = !Parser.isScriptContainer(data.path) || Parser.hasEmbeddedCode(data.content, data.path);
    self.postMessage({
      id: data.id,
      result: {
        layer: Parser.detectLayer(data.path),
        functions: actualIsCode ? Parser.extract(data.content, data.path) : [],
        lines: data.content.split('\n').length,
        actualIsCode,
      },
    });
  } catch (error) {
    self.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) });
  }
};
