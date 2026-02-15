const DOCUMENT_PROCESSOR_URL =
  process.env.DOCUMENT_PROCESSOR_URL ??
  'http://localhost:8100/process-file';

const MAX_CONCURRENT = 3;
const queue: string[] = [];
let inFlight = 0;
let totalEnqueued = 0;
let totalCompleted = 0;

export type IndexingStatus = {
  isIndexing: boolean;
  filesRemaining: number;
  totalFiles: number;
  completedFiles: number;
};

type IndexingStatusListener = (status: IndexingStatus) => void;
const statusListeners: IndexingStatusListener[] = [];

export function onIndexingStatusChange(listener: IndexingStatusListener): () => void {
  statusListeners.push(listener);
  return () => {
    const idx = statusListeners.indexOf(listener);
    if (idx !== -1) statusListeners.splice(idx, 1);
  };
}

export function getIndexingStatus(): IndexingStatus {
  const filesRemaining = queue.length + inFlight;
  return {
    isIndexing: filesRemaining > 0,
    filesRemaining,
    totalFiles: totalEnqueued,
    completedFiles: totalCompleted,
  };
}

function notifyStatusListeners(): void {
  const status = getIndexingStatus();
  for (const listener of statusListeners) {
    listener(status);
  }
}

export function resetIndexingCounters(): void {
  totalEnqueued = 0;
  totalCompleted = 0;
  notifyStatusListeners();
}

export function onFileAdded(filePath: string): void {
  enqueue(filePath);
}

export function onFileChanged(filePath: string): void {
  enqueue(filePath);
}

function enqueue(filePath: string): void {
  queue.push(filePath);
  totalEnqueued++;
  notifyStatusListeners();
  void drainQueue();
}

async function drainQueue(): Promise<void> {
  while (queue.length > 0 && inFlight < MAX_CONCURRENT) {
    const filePath = queue.shift()!;
    inFlight++;
    sendToDocumentProcessor(filePath).finally(() => {
      inFlight--;
      totalCompleted++;
      notifyStatusListeners();
      void drainQueue();
    });
  }
}

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendToDocumentProcessor(filePath: string): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(DOCUMENT_PROCESSOR_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filePath }),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(
          `[watcher] Document processor failed for ${filePath}: ${response.status} ${body}`
        );
        return;
      }

      console.log('[watcher] Processed:', filePath);
      return;
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        console.warn(
          `[watcher] Backend unavailable (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_DELAY_MS}ms:`,
          filePath
        );
        await sleep(RETRY_DELAY_MS);
      } else {
        console.error('[watcher] Failed to send to document processor after all retries:', filePath, error);
      }
    }
  }
}
