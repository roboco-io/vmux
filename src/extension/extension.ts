import * as vscode from 'vscode';
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

let ipcServer: IpcServer | null = null;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration('cmux');
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
    console.log(`[cmux] IPC server started: ${ipcAddress}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`cmux: Failed to start IPC server: ${msg}`);
  }

  // ─── Env Builder ─────────────────────────────────────────────
  const envPrefix = config.get<string>('envPrefix', 'VSCODE_CMUX');
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

  // ─── TreeViews ───────────────────────────────────────────────
  const notifTree = new NotificationsTreeDataProvider(notificationMgr);
  const sessionsTree = new SessionsTreeDataProvider(sessionMgr);
  const terminalsTree = new TerminalsTreeDataProvider(terminalMgr);

  vscode.window.registerTreeDataProvider('cmux.notifications', notifTree);
  vscode.window.registerTreeDataProvider('cmux.sessions', sessionsTree);
  vscode.window.registerTreeDataProvider('cmux.terminals', terminalsTree);

  // Wire change events → refresh TreeViews
  notificationMgr.onDidChange = () => { notifTree.refresh(); updateStatusBar(); };
  sessionMgr.onDidChange = () => sessionsTree.refresh();
  terminalMgr.onDidChange = () => terminalsTree.refresh();

  // ─── StatusBar ───────────────────────────────────────────────
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = 'cmux.notifications.focus';
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

  // ─── TerminalProfileProvider ─────────────────────────────────
  context.subscriptions.push(
    vscode.window.registerTerminalProfileProvider('cmux.terminalProfile', {
      provideTerminalProfile(): vscode.TerminalProfile {
        const id = `cmux-${Date.now()}`;
        return new vscode.TerminalProfile({
          name: 'cmux',
          env: buildEnv(id),
        });
      },
    }),
  );

  // ─── Commands ────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('cmux.notifications.focus', () => {
      vscode.commands.executeCommand('cmux.notifications.focus');
    }),

    vscode.commands.registerCommand('cmux.onNotificationClick', (n: { id: string; terminalId?: string }) => {
      notificationMgr.markRead(n.id);
      if (n.terminalId) {
        try { terminalMgr.focus(n.terminalId); } catch { /* terminal may be gone */ }
      }
    }),

    vscode.commands.registerCommand('cmux.onTerminalClick', (t: { name: string }) => {
      try { terminalMgr.focus(t.name); } catch { /* terminal may be gone */ }
    }),

    vscode.commands.registerCommand('cmux.jumpToNotification', () => {
      const n = notificationMgr.getLatestUnread();
      if (!n) {
        vscode.window.showInformationMessage('cmux: No unread notifications');
        return;
      }
      notificationMgr.markRead(n.id);
      if (n.terminalId) {
        try { terminalMgr.focus(n.terminalId); } catch { /* terminal may be gone */ }
      }
    }),

    vscode.commands.registerCommand('cmux.clearNotifications', () => {
      notificationMgr.clear();
    }),

    vscode.commands.registerCommand('cmux.createTerminal', async () => {
      const name = await vscode.window.showInputBox({ prompt: 'Terminal name' });
      if (name) terminalMgr.create(name);
    }),

    vscode.commands.registerCommand('cmux.saveSession', async () => {
      const name = await vscode.window.showInputBox({ prompt: 'Session name' });
      if (name) {
        sessionMgr.save(name);
        vscode.window.showInformationMessage(`cmux: Session "${name}" saved`);
      }
    }),

    vscode.commands.registerCommand('cmux.restoreSession', async () => {
      const sessions = sessionMgr.list();
      if (sessions.length === 0) {
        vscode.window.showInformationMessage('cmux: No saved sessions');
        return;
      }
      const pick = await vscode.window.showQuickPick(
        sessions.map(s => ({ label: s.name, description: `${s.terminals.length} terminal(s)` })),
        { placeHolder: 'Select session to restore' },
      );
      if (pick) {
        await sessionMgr.restore(pick.label);
        vscode.window.showInformationMessage(`cmux: Session "${pick.label}" restored`);
      }
    }),

    vscode.commands.registerCommand('cmux.deleteSession', (item: { name: string }) => {
      sessionMgr.delete(item.name);
    }),

    vscode.commands.registerCommand('cmux.restoreSessionFromTree', async (item: { name: string }) => {
      await sessionMgr.restore(item.name);
      vscode.window.showInformationMessage(`cmux: Session "${item.name}" restored`);
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
