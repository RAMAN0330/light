export interface SourceAnalysis {
  layer: string;
  functions: unknown[];
  lines: number;
  actualIsCode: boolean;
}

let sequence = 0;
let worker: Worker | undefined;
const pending = new Map<number, { resolve: (value: SourceAnalysis) => void; reject: (error: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('../workers/sourceAnalysisWorker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id);
    if (data.error) request.reject(new Error(data.error));
    else request.resolve(data.result);
  };
  worker.onerror = () => {
    for (const request of pending.values()) request.reject(new Error('Source analysis worker failed'));
    pending.clear(); worker?.terminate(); worker = undefined;
  };
  return worker;
}

export function analyzeSource(path: string, content: string): Promise<SourceAnalysis> {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, path, content });
  });
}
