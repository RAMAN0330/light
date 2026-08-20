import { diffLines } from 'diff';

self.onmessage = (e) => {
    const { base, head, filename } = e.data;
    try {
        const changes = diffLines(base, head);
        self.postMessage({ filename, changes });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        self.postMessage({ filename, error: message });
    }
};
