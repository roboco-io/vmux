import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SessionPreset, SessionTerminal } from '../../shared/types.js';

export class SessionManager {
  private _onDidChange: (() => void) | null = null;

  set onDidChange(handler: () => void) {
    this._onDidChange = handler;
  }

  private getSessionFilePath(): string | undefined {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) return undefined;
    return path.join(folder.uri.fsPath, '.vscode', 'vmux-sessions.json');
  }

  private readSessions(): SessionPreset[] {
    const filePath = this.getSessionFilePath();
    if (!filePath || !fs.existsSync(filePath)) return [];
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as SessionPreset[];
    } catch {
      return [];
    }
  }

  private writeSessions(sessions: SessionPreset[]): void {
    const filePath = this.getSessionFilePath();
    if (!filePath) return;
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(sessions, null, 2), 'utf-8');
  }

  save(name: string): SessionPreset {
    const terminals: SessionTerminal[] = vscode.window.terminals.map((t) => ({
      name: t.name,
      cwd: undefined, // CWD not reliably accessible from VS Code API
    }));

    const preset: SessionPreset = { name, terminals };

    const sessions = this.readSessions().filter(s => s.name !== name);
    sessions.push(preset);
    this.writeSessions(sessions);
    this._onDidChange?.();
    return preset;
  }

  async restore(name: string): Promise<void> {
    const preset = this.readSessions().find(s => s.name === name);
    if (!preset) throw new Error(`Session not found: ${name}`);

    // Group terminals by group number for split layout
    const groups = new Map<number, SessionTerminal[]>();
    const ungrouped: SessionTerminal[] = [];

    for (const t of preset.terminals) {
      if (t.group !== undefined) {
        const list = groups.get(t.group) ?? [];
        list.push(t);
        groups.set(t.group, list);
      } else {
        ungrouped.push(t);
      }
    }

    // Create ungrouped terminals
    for (const t of ungrouped) {
      vscode.window.createTerminal({
        name: t.name,
        cwd: t.cwd ? vscode.Uri.file(t.cwd) : undefined,
        shellPath: t.shellPath,
        env: t.env,
      });
    }

    // Create grouped (split) terminals
    for (const [, group] of groups) {
      let firstTerminal: vscode.Terminal | undefined;
      for (const t of group) {
        if (!firstTerminal) {
          firstTerminal = vscode.window.createTerminal({
            name: t.name,
            cwd: t.cwd ? vscode.Uri.file(t.cwd) : undefined,
            shellPath: t.shellPath,
            env: t.env,
          });
        } else {
          vscode.window.createTerminal({
            name: t.name,
            cwd: t.cwd ? vscode.Uri.file(t.cwd) : undefined,
            shellPath: t.shellPath,
            env: t.env,
            location: { parentTerminal: firstTerminal },
          });
        }
      }
    }
  }

  list(): SessionPreset[] {
    return this.readSessions();
  }

  delete(name: string): void {
    const sessions = this.readSessions().filter(s => s.name !== name);
    this.writeSessions(sessions);
    this._onDidChange?.();
  }
}
