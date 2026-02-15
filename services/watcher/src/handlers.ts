const DOCUMENT_PROCESSOR_URL =
  process.env.DOCUMENT_PROCESSOR_URL ??
  'http://localhost:8100/process-file';

const MAX_CONCURRENT = 3;

type QueueItem = {
  filePath: string;
  onComplete?: () => void;
};

const queue: QueueItem[] = [];
let inFlight = 0;

export function onFileAdded(filePath: string, onComplete?: () => void): void {
  enqueue(filePath, onComplete);
}

export function onFileChanged(filePath: string, onComplete?: () => void): void {
  enqueue(filePath, onComplete);
}

function enqueue(filePath: string, onComplete?: () => void): void {
  queue.push({ filePath, onComplete });
  void drainQueue();
}

async function drainQueue(): Promise<void> {
  while (queue.length > 0 && inFlight < MAX_CONCURRENT) {
    const item = queue.shift()!;
    inFlight++;
    sendToDocumentProcessor(item.filePath).finally(() => {
      inFlight--;
      item.onComplete?.();
      void drainQueue();
    });
  }
}

async function sendToDocumentProcessor(filePath: string): Promise<void> {
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
  } catch (error) {
    console.error('[watcher] Failed to send to document processor:', filePath, error);
  }
}
