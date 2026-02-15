import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve relative to THIS FILE, not process.cwd()
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load repo root .env
dotenv.config({
  path: path.resolve(__dirname, '../../../.env'),
});

// ✅ Base URL from env
const DOCPROC_BASE_URL =
  process.env.DOCPROC_URL || 'http://127.0.0.1:8100';
console.log('[watcher] Document processor base URL =', DOCPROC_BASE_URL);

// ✅ Final endpoint
const DOCUMENT_PROCESSOR_URL = `${DOCPROC_BASE_URL}/process-file`;

export async function onFileAdded(filePath: string): Promise<void> {
  await sendToDocumentProcessor(filePath);
}

export async function onFileChanged(filePath: string): Promise<void> {
  await sendToDocumentProcessor(filePath);
}

async function sendToDocumentProcessor(filePath: string): Promise<void> {
  const startedAt = Date.now();
  console.log('[watcher] -> docproc start:', filePath);

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
      '[watcher] -> docproc failed:',
      filePath,
      `status=${response.status}`,
      `ms=${Date.now() - startedAt}`
    );
    throw new Error(
      `Document processor failed: ${response.status} ${response.statusText} ${body}`
    );
  }

  console.log(
    '[watcher] -> docproc success:',
    filePath,
    `ms=${Date.now() - startedAt}`
  );
}
