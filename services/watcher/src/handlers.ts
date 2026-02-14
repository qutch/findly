const DOCUMENT_PROCESSOR_URL =
  process.env.DOCUMENT_PROCESSOR_URL ??
  'http://localhost:8100/process-file';

export async function onFileAdded(filePath: string): Promise<void> {
  await sendToDocumentProcessor(filePath);
}

export async function onFileChanged(filePath: string): Promise<void> {
  await sendToDocumentProcessor(filePath);
}

async function sendToDocumentProcessor(filePath: string): Promise<void> {
  const response = await fetch(DOCUMENT_PROCESSOR_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filePath }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Document processor failed: ${response.status} ${response.statusText} ${body}`
    );
  }
}
