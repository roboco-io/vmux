import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createMethodRouter, type IpcServer } from './ipc/server.js';
import { UnixSocketServer } from './ipc/unix-socket-server.js';
import { HttpServer } from './ipc/http-server.js';
import { getSocketPath, isUnixPlatform } from './ipc/socket-path.js';
import { NotificationManager } from './notifications/manager.js';
import { SessionManager } from './sessions/manager.js';
import { TerminalManager } from './terminals/manager.js';
import { NotificationsTreeDataProvider } from './views/notifications-tree.js';
import { SessionsTreeDataProvider } from './views/sessions-tree.js';
import { TerminalsTreeDataProvider } from './views/terminals-tree.js';
import { MetadataManager } from './metadata/manager.js';
import { MetadataTreeDataProvider } from './views/metadata-tree.js';
import { ActivityMonitor } from './terminals/activity-monitor.js';
import { AgentGrid } from './terminals/agent-grid.js';
import { AgentPresetManager } from './terminals/agent-presets.js';

let ipcServer: IpcServer | null = null;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration('vmux');
  const router = createMethodRouter();

  // ─── IPC Server ──────────────────────────────────────────────
  const useUnix = config.get<string>('ipc.type', 'unix') === 'unix' && isUnixPlatform();
  let ipcAddress = '';

  if (useUnix) {
    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri.toString() ?? 'default';
    const socketPath = getSocketPath(workspaceUri);
    ipcServer = new UnixSocketServer(socketPath, (raw) => router.handleRaw(raw));
  } else {
    const port = config.get<number>('ipc.port', 0);
    ipcServer = new HttpServer(port, (raw) => router.handleRaw(raw));
  }

  try {
    ipcAddress = await ipcServer.start();
    console.log(`[vmux] IPC server started: ${ipcAddress}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`vmux: Failed to start IPC server: ${msg}`);
  }

  // ─── Env Builder ─────────────────────────────────────────────
  const envPrefix = config.get<string>('envPrefix', 'VMUX');
  function buildEnv(terminalId: string): Record<string, string> {
    return {
      [`${envPrefix}_TERMINAL_ID`]: terminalId,
      [`${envPrefix}_WORKSPACE`]: vscode.workspace.name ?? '',
      [`${envPrefix}_SESSION`]: '',
      [`${envPrefix}_SOCKET`]: ipcAddress,
      [`${envPrefix}_CWD`]: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '',
    };
  }

  // ─── Managers ────────────────────────────────────────────────
  const notificationMgr = new NotificationManager();
  const sessionMgr = new SessionManager();
  const terminalMgr = new TerminalManager(buildEnv);
  const metadataMgr = new MetadataManager();
  const activityMonitor = new ActivityMonitor();
  const agentGrid = new AgentGrid(buildEnv);
  const agentPresets = new AgentPresetManager();

  // ─── TreeViews ───────────────────────────────────────────────
  const notifTree = new NotificationsTreeDataProvider(notificationMgr);
  const sessionsTree = new SessionsTreeDataProvider(sessionMgr);
  const terminalsTree = new TerminalsTreeDataProvider(terminalMgr);
  const metadataTree = new MetadataTreeDataProvider(metadataMgr);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('vmux.notifications', notifTree),
    vscode.window.registerTreeDataProvider('vmux.sessions', sessionsTree),
    vscode.window.registerTreeDataProvider('vmux.terminals', terminalsTree),
    vscode.window.registerTreeDataProvider('vmux.metadata', metadataTree),
  );

  // Wire change events → refresh TreeViews
  notificationMgr.onDidChange = () => { notifTree.refresh(); updateStatusBar(); };
  sessionMgr.onDidChange = () => sessionsTree.refresh();
  terminalMgr.onDidChange = () => terminalsTree.refresh();
  metadataMgr.onDidChange = () => metadataTree.refresh();
  activityMonitor.onDidChange = () => terminalsTree.refresh();

  // ─── StatusBar ───────────────────────────────────────────────
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = 'vmux.notifications.focus';
  context.subscriptions.push(statusBar);

  function updateStatusBar(): void {
    const count = notificationMgr.unreadCount;
    if (count > 0) {
      statusBar.text = `$(bell) ${count}`;
      statusBar.tooltip = `${count} unread notification(s)`;
      statusBar.show();
    } else {
      statusBar.hide();
    }
  }
  updateStatusBar();

  // ─── Terminal lifecycle ──────────────────────────────────────
  context.subscriptions.push(
    vscode.window.onDidOpenTerminal((t) => terminalMgr.onDidOpenTerminal(t)),
    vscode.window.onDidCloseTerminal((t) => terminalMgr.onDidCloseTerminal(t)),
  );

  // ─── Activity Monitor ─────────────────────────────────────────
  activityMonitor.registerEvents(context);

  // ─── CLI PATH injection ─────────────────────────────────────
  const binDir = path.join(context.extensionPath, 'bin');
  const cliSource = path.join(context.extensionPath, 'dist', 'cli.js');
  const cliLink = path.join(binDir, 'vmux');

  try {
    if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });
    if (!fs.existsSync(cliLink) && fs.existsSync(cliSource)) {
      fs.symlinkSync(cliSource, cliLink);
      fs.chmodSync(cliSource, 0o755);
    }
  } catch {
    // Best effort — symlink may fail on some platforms
  }

  // ─── Global env injection (all terminals) ────────────────────
  const envCollection = context.environmentVariableCollection;
  envCollection.persistent = true;
  envCollection.description = 'vmux terminal context';

  envCollection.prepend('PATH', binDir + path.delimiter);

  const globalEnv = buildEnv(`vmux-${Date.now()}`);
  for (const [key, value] of Object.entries(globalEnv)) {
    envCollection.replace(key, value);
  }

  // ─── TerminalProfileProvider ─────────────────────────────────
  context.subscriptions.push(
    vscode.window.registerTerminalProfileProvider('vmux.terminalProfile', {
      provideTerminalProfile(): vscode.TerminalProfile {
        const id = `vmux-${Date.now()}`;
        return new vscode.TerminalProfile({
          name: 'vmux',
          env: buildEnv(id),
        });
      },
    }),
  );

  // ─── Commands ────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('vmux.notifications.focus', () => {
      vscode.commands.executeCommand('vmux.notifications.focus');
    }),

    vscode.commands.registerCommand('vmux.onNotificationClick', (n: { id: string; terminalId?: string }) => {
      notificationMgr.markRead(n.id);
      if (n.terminalId) {
        try { terminalMgr.focus(n.terminalId); } catch { /* terminal may be gone */ }
      }
    }),

    vscode.commands.registerCommand('vmux.onTerminalClick', (t: { name: string }) => {
      try { terminalMgr.focus(t.name); } catch { /* terminal may be gone */ }
    }),

    vscode.commands.registerCommand('vmux.jumpToNotification', () => {
      const n = notificationMgr.getLatestUnread();
      if (!n) {
        vscode.window.showInformationMessage('vmux: No unread notifications');
        return;
      }
      notificationMgr.markRead(n.id);
      if (n.terminalId) {
        try { terminalMgr.focus(n.terminalId); } catch { /* terminal may be gone */ }
      }
    }),

    vscode.commands.registerCommand('vmux.clearNotifications', () => {
      notificationMgr.clear();
    }),

    vscode.commands.registerCommand('vmux.createTerminal', async () => {
      const name = await vscode.window.showInputBox({ prompt: 'Terminal name' });
      if (name) terminalMgr.create(name);
    }),

    vscode.commands.registerCommand('vmux.saveSession', async () => {
      const name = await vscode.window.showInputBox({ prompt: 'Session name' });
      if (name) {
        sessionMgr.save(name);
        vscode.window.showInformationMessage(`vmux: Session "${name}" saved`);
      }
    }),

    vscode.commands.registerCommand('vmux.restoreSession', async () => {
      const sessions = sessionMgr.list();
      if (sessions.length === 0) {
        vscode.window.showInformationMessage('vmux: No saved sessions');
        return;
      }
      const pick = await vscode.window.showQuickPick(
        sessions.map(s => ({ label: s.name, description: `${s.terminals.length} terminal(s)` })),
        { placeHolder: 'Select session to restore' },
      );
      if (pick) {
        await sessionMgr.restore(pick.label);
        vscode.window.showInformationMessage(`vmux: Session "${pick.label}" restored`);
      }
    }),

    vscode.commands.registerCommand('vmux.deleteSession', (item: { name: string }) => {
      sessionMgr.delete(item.name);
    }),

    vscode.commands.registerCommand('vmux.restoreSessionFromTree', async (item: { name: string }) => {
      await sessionMgr.restore(item.name);
      vscode.window.showInformationMessage(`vmux: Session "${item.name}" restored`);
    }),

    vscode.commands.registerCommand('vmux.launchAgentGrid', async () => {
      const name = await vscode.window.showInputBox({ prompt: 'Grid name' });
      if (!name) return;
      const rowsStr = await vscode.window.showInputBox({ prompt: 'Rows', value: '2' });
      const colsStr = await vscode.window.showInputBox({ prompt: 'Columns', value: '2' });
      const rows = parseInt(rowsStr ?? '2', 10);
      const cols = parseInt(colsStr ?? '2', 10);
      agentGrid.create({ name, rows, cols });
      vscode.window.showInformationMessage(`vmux: ${rows}x${cols} agent grid "${name}" created`);
    }),
  );

  // ─── IPC Method Handlers ─────────────────────────────────────
  const showSystemNotif = config.get<boolean>('systemNotifications', true);

  router.register('notification.create', async (params) => {
    const title = params['title'] as string | undefined;
    if (!title) throw new Error('Invalid params: title is required');
    const n = notificationMgr.create(
      title,
      params['body'] as string | undefined,
      (params['level'] as 'info' | 'warning' | 'error') ?? 'info',
      params['terminalId'] as string | undefined,
    );
    if (showSystemNotif) {
      const show = n.level === 'error' ? vscode.window.showErrorMessage
        : n.level === 'warning' ? vscode.window.showWarningMessage
        : vscode.window.showInformationMessage;
      show(`${n.title}${n.body ? `: ${n.body}` : ''}`);
    }
    return { id: n.id };
  });

  router.register('notification.list', async () => notificationMgr.list());
  router.register('notification.clear', async (params) => {
    notificationMgr.clear(params['id'] as string | undefined);
    return { ok: true };
  });

  router.register('terminal.create', async (params) => {
    const name = params['name'] as string | undefined;
    if (!name) throw new Error('Invalid params: name is required');
    return terminalMgr.create(
      name,
      params['cwd'] as string | undefined,
      params['env'] as Record<string, string> | undefined,
      params['shellPath'] as string | undefined,
    );
  });

  router.register('terminal.list', async () => terminalMgr.list());
  router.register('terminal.focus', async (params) => {
    const name = params['name'] as string | undefined;
    if (!name) throw new Error('Invalid params: name is required');
    terminalMgr.focus(name);
    return { ok: true };
  });
  router.register('terminal.close', async (params) => {
    const name = params['name'] as string | undefined;
    if (!name) throw new Error('Invalid params: name is required');
    terminalMgr.close(name);
    return { ok: true };
  });
  router.register('terminal.send', async (params) => {
    const name = params['name'] as string | undefined;
    const text = params['text'] as string | undefined;
    if (!name || !text) throw new Error('Invalid params: name and text are required');
    terminalMgr.send(name, text);
    return { ok: true };
  });

  router.register('session.save', async (params) => {
    const name = params['name'] as string | undefined;
    if (!name) throw new Error('Invalid params: name is required');
    return sessionMgr.save(name);
  });
  router.register('session.restore', async (params) => {
    const name = params['name'] as string | undefined;
    if (!name) throw new Error('Invalid params: name is required');
    await sessionMgr.restore(name);
    return { ok: true };
  });
  router.register('session.list', async () => sessionMgr.list());

  // ─── Metadata IPC Handlers ──────────────────────────────────
  router.register('metadata.set', async (params) => {
    const terminalId = params['terminalId'] as string | undefined;
    const key = params['key'] as string | undefined;
    const value = params['value'] as string | undefined;
    if (terminalId === undefined || key === undefined || value === undefined) throw new Error('Invalid params: terminalId, key, value are required');
    metadataMgr.setStatus(terminalId, key, value, params['icon'] as string | undefined, params['color'] as string | undefined);
    return { ok: true };
  });

  router.register('metadata.get', async (params) => {
    const terminalId = params['terminalId'] as string | undefined;
    if (!terminalId) throw new Error('Invalid params: terminalId is required');
    return metadataMgr.getMetadata(terminalId) ?? null;
  });

  router.register('metadata.progress', async (params) => {
    const terminalId = params['terminalId'] as string | undefined;
    const value = params['value'] as number | undefined;
    if (!terminalId || value === undefined) throw new Error('Invalid params: terminalId and value are required');
    metadataMgr.setProgress(terminalId, value, params['label'] as string | undefined);
    return { ok: true };
  });

  router.register('metadata.log', async (params) => {
    const terminalId = params['terminalId'] as string | undefined;
    const message = params['message'] as string | undefined;
    if (!terminalId || !message) throw new Error('Invalid params: terminalId and message are required');
    metadataMgr.addLog(terminalId, message, (params['level'] as 'info' | 'progress' | 'success' | 'warning' | 'error') ?? 'info');
    return { ok: true };
  });

  // ─── Agent Grid IPC Handlers ─────────────────────────────────
  router.register('agent.grid', async (params) => {
    const name = params['name'] as string | undefined;
    const rows = params['rows'] as number | undefined;
    const cols = params['cols'] as number | undefined;
    if (!name || !rows || !cols) throw new Error('Invalid params: name, rows, cols are required');
    agentGrid.create({
      name, rows, cols,
      cwd: params['cwd'] as string | undefined,
      names: params['names'] as string[] | undefined,
    });
    return { ok: true, terminals: rows * cols };
  });

  router.register('agent.broadcast', async (params) => {
    const grid = params['grid'] as string | undefined;
    const text = params['text'] as string | undefined;
    if (!grid || !text) throw new Error('Invalid params: grid and text are required');
    agentGrid.broadcast(grid, text);
    return { ok: true };
  });

  router.register('agent.grids', async () => agentGrid.listGrids());

  // ─── Agent Preset IPC Handlers ──────────────────────────────
  router.register('agent.preset.save', async (params) => {
    const name = params['name'] as string | undefined;
    if (!name) throw new Error('Invalid params: name is required');
    agentPresets.save({
      name,
      command: params['command'] as string | undefined,
      cwd: params['cwd'] as string | undefined,
      shellPath: params['shellPath'] as string | undefined,
      env: params['env'] as Record<string, string> | undefined,
    });
    return { ok: true };
  });

  router.register('agent.preset.list', async () => agentPresets.list());

  router.register('agent.preset.launch', async (params) => {
    const name = params['name'] as string | undefined;
    if (!name) throw new Error('Invalid params: name is required');
    const preset = agentPresets.get(name);
    if (!preset) throw new Error(`Invalid params: Agent preset not found: ${name}`);
    const info = terminalMgr.create(preset.name, preset.cwd, preset.env, preset.shellPath);
    if (preset.command) {
      terminalMgr.send(preset.name, preset.command);
    }
    return info;
  });

  // ─── Auto Restore ────────────────────────────────────────────
  if (config.get<boolean>('autoRestore', false)) {
    const sessions = sessionMgr.list();
    const last = sessions[sessions.length - 1];
    if (last) {
      await sessionMgr.restore(last.name);
    }
  }
}

export async function deactivate(): Promise<void> {
  if (ipcServer) {
    await ipcServer.stop();
    ipcServer = null;
  }
}
