import * as vscode from 'vscode';

export interface TerminalActivity {
  name: string;
  state: 'active' | 'idle';
  lastCommandTime?: number;
  cwd?: string;
  exitCode?: number;
}

export class ActivityMonitor {
  private activities = new Map<string, TerminalActivity>();
  private _onDidChange: (() => void) | null = null;

  set onDidChange(handler: () => void) {
    this._onDidChange = handler;
  }

  registerEvents(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.window.onDidStartTerminalShellExecution((e) => {
        const name = e.terminal.name;
        const activity = this.getOrCreate(name);
        activity.state = 'active';

        // Capture CWD if shell integration available
        const si = e.terminal.shellIntegration;
        if (si?.cwd) {
          activity.cwd = si.cwd.fsPath;
        }

        this._onDidChange?.();
      }),

      vscode.window.onDidEndTerminalShellExecution((e) => {
        const name = e.terminal.name;
        const activity = this.getOrCreate(name);
        activity.state = 'idle';
        activity.lastCommandTime = Date.now();
        activity.exitCode = e.exitCode;

        // Update CWD after command
        const si = e.terminal.shellIntegration;
        if (si?.cwd) {
          activity.cwd = si.cwd.fsPath;
        }

        this._onDidChange?.();
      }),

      vscode.window.onDidCloseTerminal((t) => {
        const activity = this.activities.get(t.name);
        if (activity) {
          activity.state = 'idle';
          activity.exitCode = t.exitStatus?.code;
          this._onDidChange?.();
        }
      }),
    );
  }

  private getOrCreate(name: string): TerminalActivity {
    let activity = this.activities.get(name);
    if (!activity) {
      activity = { name, state: 'idle' };
      this.activities.set(name, activity);
    }
    return activity;
  }

  getActivity(name: string): TerminalActivity | undefined {
    return this.activities.get(name);
  }

  listAll(): TerminalActivity[] {
    return [...this.activities.values()];
  }

  remove(name: string): void {
    this.activities.delete(name);
  }
}
