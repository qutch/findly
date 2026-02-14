const DOCUMENT_PROCESSOR_URL =
  process.env.DOCUMENT_PROCESSOR_URL ??
  'http://localhost:8100/process-file';

const MAX_CONCURRENT = 3;
const queue: string[] = [];
let inFlight = 0;

export function onFileAdded(filePath: string): void {
  enqueue(filePath);
}

export function onFileChanged(filePath: string): void {
  enqueue(filePath);
}

function enqueue(filePath: string): void {
  queue.push(filePath);
  void drainQueue();
}

async function drainQueue(): Promise<void> {
  while (queue.length > 0 && inFlight < MAX_CONCURRENT) {
    const filePath = queue.shift()!;
    inFlight++;
    sendToDocumentProcessor(filePath).finally(() => {
      inFlight--;
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
