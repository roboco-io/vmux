import * as vscode from 'vscode';
import type { MetadataEntry, StatusPill, LogEntry } from '../../shared/types.js';
import type { MetadataManager } from '../metadata/manager.js';

type TreeItem = MetadataEntry | StatusPill | LogEntry | { type: 'progress'; value: number; label?: string; terminalId: string };

export class MetadataTreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private manager: MetadataManager) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    // MetadataEntry (terminal root)
    if ('terminalId' in element && 'statuses' in element) {
      const entry = element as MetadataEntry;
      const item = new vscode.TreeItem(entry.terminalId, vscode.TreeItemCollapsibleState.Expanded);
      item.iconPath = new vscode.ThemeIcon('terminal');
      const parts: string[] = [];
      if (entry.progress) parts.push(`${Math.round(entry.progress.value * 100)}%`);
      if (entry.statuses.length > 0) parts.push(`${entry.statuses.length} status(es)`);
      parts.push(`${entry.logs.length} log(s)`);
      item.description = parts.join(' · ');
      return item;
    }

    // Progress item
    if ('type' in element && (element as { type: string }).type === 'progress') {
      const p = element as { value: number; label?: string };
      const pct = Math.round(p.value * 100);
      const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
      const item = new vscode.TreeItem(
        `${bar} ${pct}%${p.label ? ` — ${p.label}` : ''}`,
        vscode.TreeItemCollapsibleState.None,
      );
      item.iconPath = new vscode.ThemeIcon('loading~spin');
      return item;
    }

    // StatusPill
    if ('key' in element && 'value' in element && !('message' in element)) {
      const pill = element as StatusPill;
      const item = new vscode.TreeItem(`${pill.key}: ${pill.value}`, vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon(pill.icon ?? 'circle-filled');
      return item;
    }

    // LogEntry
    if ('message' in element && 'level' in element) {
      const log = element as LogEntry;
      const time = new Date(log.timestamp).toLocaleTimeString();
      const item = new vscode.TreeItem(`${log.message}`, vscode.TreeItemCollapsibleState.None);
      item.description = time;
      const iconMap: Record<string, string> = {
        info: 'info',
        progress: 'loading~spin',
        success: 'pass',
        warning: 'warning',
        error: 'error',
      };
      item.iconPath = new vscode.ThemeIcon(iconMap[log.level] ?? 'info');
      return item;
    }

    return new vscode.TreeItem('Unknown');
  }

  getChildren(element?: TreeItem): TreeItem[] {
    if (!element) {
      return this.manager.listAll();
    }

    if ('terminalId' in element && 'statuses' in element) {
      const entry = element as MetadataEntry;
      const children: TreeItem[] = [];

      for (const s of entry.statuses) {
        children.push(s);
      }

      if (entry.progress) {
        children.push({ type: 'progress', value: entry.progress.value, label: entry.progress.label, terminalId: entry.terminalId });
      }

      // Show last 20 logs, newest first
      const recentLogs = entry.logs.slice(-20).reverse();
      children.push(...recentLogs);

      return children;
    }

    return [];
  }
}
