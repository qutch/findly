import chokidar, { type FSWatcher } from 'chokidar';
import { stat } from 'node:fs/promises';
import { onFileAdded, onFileChanged } from './handlers.js';

export interface FileWatcherOptions {
  paths: string[];
  metadataCheckIntervalMs?: number;
}

type FileMetadata = {
  mtimeMs: number;
  size: number;
};

export class FileWatcherService {
  private readonly paths: string[];
  private readonly metadataCheckIntervalMs: number;
  private readonly knownFiles = new Map<string, FileMetadata>();
  private watcher: FSWatcher | null = null;
  private metadataTimer: ReturnType<typeof setInterval> | null = null;
  private metadataCheckInFlight = false;

  constructor(options: FileWatcherOptions) {
    this.paths = options.paths;
    this.metadataCheckIntervalMs =
      options.metadataCheckIntervalMs ??
      Number(process.env.WATCH_METADATA_INTERVAL_MS ?? 1000);
  }

  start(): void {
    if (this.watcher) return;

    this.watcher = chokidar.watch(this.paths, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100,
      },
    });

    this.watcher
      .on('add', (filePath: string) => void this.handleAdd(filePath))
      .on('change', (filePath: string) => void this.handleChange(filePath))
      .on('unlink', (filePath: string) => {
        this.knownFiles.delete(filePath);
        console.log('[watcher] File removed:', filePath);
      })
      .on('error', (error: unknown) => {
        console.error('[watcher] Watcher error:', error);
      });

    this.metadataTimer = setInterval(
      () => void this.runMetadataCheck(),
      this.metadataCheckIntervalMs
    );
    this.metadataTimer.unref();

    console.log('[watcher] Watching paths:', this.paths);
    console.log(
      '[watcher] Metadata check interval (ms):',
      this.metadataCheckIntervalMs
    );
  }

  async stop(): Promise<void> {
    if (this.metadataTimer) {
      clearInterval(this.metadataTimer);
      this.metadataTimer = null;
    }

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  private async handleAdd(filePath: string): Promise<void> {
    try {
      const metadata = await this.readMetadata(filePath);
      if (!metadata) return;

      this.knownFiles.set(filePath, metadata);
      console.log('[watcher] File added:', filePath);
      await onFileAdded(filePath);
    } catch (error) {
      console.error('[watcher] Failed to process added file:', filePath, error);
    }
  }

  private async handleChange(filePath: string): Promise<void> {
    try {
      const metadata = await this.readMetadata(filePath);
      if (!metadata) return;

      this.knownFiles.set(filePath, metadata);
      console.log('[watcher] File changed:', filePath);
      await onFileChanged(filePath);
    } catch (error) {
      console.error('[watcher] Failed to process changed file:', filePath, error);
    }
  }

  private async runMetadataCheck(): Promise<void> {
    if (this.metadataCheckInFlight || this.knownFiles.size === 0) return;

    this.metadataCheckInFlight = true;

    try {
      const entries = [...this.knownFiles.entries()];

      for (const [filePath, previousMetadata] of entries) {
        const currentMetadata = await this.readMetadata(filePath);

        if (!currentMetadata) {
          this.knownFiles.delete(filePath);
          continue;
        }

        const changed =
          currentMetadata.mtimeMs !== previousMetadata.mtimeMs ||
          currentMetadata.size !== previousMetadata.size;

        if (!changed) continue;

        this.knownFiles.set(filePath, currentMetadata);
        console.log('[watcher] Metadata changed, reprocessing file:', filePath);
        await onFileChanged(filePath);
      }
    } catch (error) {
      console.error('[watcher] Metadata check failed:', error);
    } finally {
      this.metadataCheckInFlight = false;
    }
  }

  private async readMetadata(filePath: string): Promise<FileMetadata | null> {
    try {
      const stats = await stat(filePath);
      if (!stats.isFile()) return null;

      return {
        mtimeMs: stats.mtimeMs,
        size: stats.size,
      };
    } catch {
      return null;
    }
  }
}
