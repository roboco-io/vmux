import * as vscode from 'vscode';
import type { TerminalInfo } from '../../shared/types.js';

export class TerminalManager {
  private terminals = new Map<string, vscode.Terminal>();
  private _onDidChange: (() => void) | null = null;

  set onDidChange(handler: () => void) {
    this._onDidChange = handler;
  }

  constructor(private envBuilder: (terminalId: string) => Record<string, string>) {
    // Track existing terminals
    for (const t of vscode.window.terminals) {
      this.terminals.set(t.name, t);
    }
  }

  onDidOpenTerminal(terminal: vscode.Terminal): void {
    this.terminals.set(terminal.name, terminal);
    this._onDidChange?.();
  }

  onDidCloseTerminal(terminal: vscode.Terminal): void {
    this.terminals.delete(terminal.name);
    this._onDidChange?.();
  }

  create(name: string, cwd?: string, env?: Record<string, string>, shellPath?: string): TerminalInfo {
    const id = `${name}-${Date.now()}`;
    const cmuxEnv = this.envBuilder(id);
    const mergedEnv = { ...cmuxEnv, ...env };

    const terminal = vscode.window.createTerminal({
      name,
      cwd: cwd ? vscode.Uri.file(cwd) : undefined,
      shellPath,
      env: mergedEnv,
    });

    this.terminals.set(name, terminal);
    terminal.show();

    return { id, name, cwd, isActive: true };
  }

  list(): TerminalInfo[] {
    return [...this.terminals.entries()].map(([name, t]) => ({
      id: name,
      name: t.name,
      cwd: undefined,
      isActive: t.exitStatus === undefined,
    }));
  }

  focus(name: string): void {
    const t = this.terminals.get(name);
    if (!t) throw new Error(`Invalid params: Terminal not found: ${name}`);
    t.show();
  }

  close(name: string): void {
    const t = this.terminals.get(name);
    if (!t) throw new Error(`Invalid params: Terminal not found: ${name}`);
    t.dispose();
    this.terminals.delete(name);
  }

  send(name: string, text: string): void {
    const t = this.terminals.get(name);
    if (!t) throw new Error(`Invalid params: Terminal not found: ${name}`);
    t.sendText(text);
  }

  findByName(name: string): vscode.Terminal | undefined {
    return this.terminals.get(name);
  }
}
