import type { MetadataEntry, StatusPill, LogEntry } from '../../shared/types.js';

export class MetadataManager {
  private entries = new Map<string, MetadataEntry>();
  private _onDidChange: (() => void) | null = null;

  set onDidChange(handler: () => void) {
    this._onDidChange = handler;
  }

  private getOrCreate(terminalId: string): MetadataEntry {
    let entry = this.entries.get(terminalId);
    if (!entry) {
      entry = { terminalId, statuses: [], logs: [] };
      this.entries.set(terminalId, entry);
    }
    return entry;
  }

  setStatus(terminalId: string, key: string, value: string, icon?: string, color?: string): void {
    const entry = this.getOrCreate(terminalId);
    const existing = entry.statuses.findIndex(s => s.key === key);
    const pill: StatusPill = { key, value, icon, color };
    if (existing >= 0) {
      entry.statuses[existing] = pill;
    } else {
      entry.statuses.push(pill);
    }
    this._onDidChange?.();
  }

  setProgress(terminalId: string, value: number, label?: string): void {
    const entry = this.getOrCreate(terminalId);
    entry.progress = { value: Math.max(0, Math.min(1, value)), label };
    this._onDidChange?.();
  }

  addLog(terminalId: string, message: string, level: LogEntry['level'] = 'info'): void {
    const entry = this.getOrCreate(terminalId);
    entry.logs.push({ level, message, timestamp: Date.now() });
    this._onDidChange?.();
  }

  getMetadata(terminalId: string): MetadataEntry | undefined {
    return this.entries.get(terminalId);
  }

  listAll(): MetadataEntry[] {
    return [...this.entries.values()];
  }

  remove(terminalId: string): void {
    this.entries.delete(terminalId);
    this._onDidChange?.();
  }
}
