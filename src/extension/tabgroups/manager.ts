import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { TabGroup } from '../../shared/types.js';

export class TabGroupManager {
  private _onDidChange: (() => void) | null = null;

  set onDidChange(handler: () => void) {
    this._onDidChange = handler;
  }

  private getFilePath(): string | undefined {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) return undefined;
    return path.join(folder.uri.fsPath, '.vscode', 'vmux-tabgroups.json');
  }

  private readGroups(): TabGroup[] {
    const filePath = this.getFilePath();
    if (!filePath || !fs.existsSync(filePath)) return [];
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as TabGroup[];
    } catch {
      return [];
    }
  }

  private writeGroups(groups: TabGroup[]): void {
    const filePath = this.getFilePath();
    if (!filePath) return;
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(groups, null, 2), 'utf-8');
  }

  create(name: string, color?: string): TabGroup {
    const groups = this.readGroups().filter(g => g.name !== name);
    const group: TabGroup = { name, terminals: [], color };
    groups.push(group);
    this.writeGroups(groups);
    this._onDidChange?.();
    return group;
  }

  delete(name: string): void {
    const groups = this.readGroups().filter(g => g.name !== name);
    this.writeGroups(groups);
    this._onDidChange?.();
  }

  rename(oldName: string, newName: string): TabGroup {
    const groups = this.readGroups();
    const group = groups.find(g => g.name === oldName);
    if (!group) throw new Error(`Tab group not found: ${oldName}`);
    group.name = newName;
    this.writeGroups(groups);
    this._onDidChange?.();
    return group;
  }

  addTerminal(groupName: string, terminalName: string): TabGroup {
    const groups = this.readGroups();
    const group = groups.find(g => g.name === groupName);
    if (!group) throw new Error(`Tab group not found: ${groupName}`);
    if (!group.terminals.includes(terminalName)) {
      group.terminals.push(terminalName);
      this.writeGroups(groups);
      this._onDidChange?.();
    }
    return group;
  }

  removeTerminal(groupName: string, terminalName: string): TabGroup {
    const groups = this.readGroups();
    const group = groups.find(g => g.name === groupName);
    if (!group) throw new Error(`Tab group not found: ${groupName}`);
    group.terminals = group.terminals.filter(t => t !== terminalName);
    this.writeGroups(groups);
    this._onDidChange?.();
    return group;
  }

  get(name: string): TabGroup | undefined {
    return this.readGroups().find(g => g.name === name);
  }

  list(): TabGroup[] {
    return this.readGroups();
  }
}
