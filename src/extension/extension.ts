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
import { TabGroupManager } from './tabgroups/manager.js';
import { TabGroupsTreeDataProvider } from './views/tabgroups-tree.js';
import { ClaudeHookManager } from './agents/claude-hook-manager.js';
import { CodexHookManager } from './agents/codex-hook-manager.js';
import { BasicAgentManager } from './agents/basic-agent-manager.js';

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
  function buildSharedEnv(): Record<string, string> {
    return {
      [`${envPrefix}_WORKSPACE`]: vscode.workspace.name ?? '',
      [`${envPrefix}_SESSION`]: '',
      [`${envPrefix}_SOCKET`]: ipcAddress,
      [`${envPrefix}_CWD`]: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '',
    };
  }

  function buildManagedEnv(terminalId: string, terminalName = terminalId): Record<string, string> {
    return {
      ...buildSharedEnv(),
      [`${envPrefix}_MANAGED`]: '1',
      [`${envPrefix}_TERMINAL_ID`]: terminalId,
      [`${envPrefix}_TERMINAL_NAME`]: terminalName,
    };
  }

  // ─── Managers ────────────────────────────────────────────────
  const notificationMgr = new NotificationManager();
  const sessionMgr = new SessionManager();
  const terminalMgr = new TerminalManager(buildManagedEnv);
  const metadataMgr = new MetadataManager();
  const activityMonitor = new ActivityMonitor();
  const agentGrid = new AgentGrid(buildManagedEnv);
  const agentPresets = new AgentPresetManager();
  const tabGroupMgr = new TabGroupManager();
  const claudeHookMgr = new ClaudeHookManager(notificationMgr, metadataMgr);
  const codexHookMgr = new CodexHookManager(notificationMgr, metadataMgr);
  const basicAgentMgr = new BasicAgentManager(notificationMgr, metadataMgr);

  // ─── TreeViews ───────────────────────────────────────────────
  const notifTree = new NotificationsTreeDataProvider(notificationMgr);
  const sessionsTree = new SessionsTreeDataProvider(sessionMgr);
  const terminalsTree = new TerminalsTreeDataProvider(terminalMgr, activityMonitor);
  const metadataTree = new MetadataTreeDataProvider(metadataMgr);
  const tabGroupsTree = new TabGroupsTreeDataProvider(tabGroupMgr);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('vmux.notifications', notifTree),
    vscode.window.registerTreeDataProvider('vmux.sessions', sessionsTree),
    vscode.window.registerTreeDataProvider('vmux.terminals', terminalsTree),
    vscode.window.registerTreeDataProvider('vmux.metadata', metadataTree),
    vscode.window.registerTreeDataProvider('vmux.tabgroups', tabGroupsTree),
  );

  // Wire change events → refresh TreeViews
  notificationMgr.onDidChange = () => { notifTree.refresh(); updateStatusBar(); };
  sessionMgr.onDidChange = () => sessionsTree.refresh();
  terminalMgr.onDidChange = () => terminalsTree.refresh();
  metadataMgr.onDidChange = () => metadataTree.refresh();
  activityMonitor.onDidChange = () => terminalsTree.refresh();
  tabGroupMgr.onDidChange = () => tabGroupsTree.refresh();

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
    for (const wrapper of ['claude', 'codex', 'gemini']) {
      const wrapperPath = path.join(binDir, wrapper);
      if (fs.existsSync(wrapperPath)) {
        fs.chmodSync(wrapperPath, 0o755);
      }
    }
  } catch {
    // Best effort — symlink may fail on some platforms
  }

  // ─── Global env injection (all terminals) ────────────────────
  const envCollection = context.environmentVariableCollection;
  envCollection.persistent = true;
  envCollection.description = 'vmux terminal context';

  envCollection.prepend('PATH', binDir + path.delimiter);

  const globalEnv = buildSharedEnv();
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
          env: buildManagedEnv(id, 'vmux'),
        });
      },
    }),
  );

  // ─── Commands ────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('vmux.notifications.focus', () => {
      vscode.commands.executeCommand('workbench.view.extension.vmux');
    }),

    // Fix: wire AgentGrid cleanup to terminal close events
    vscode.window.onDidCloseTerminal((t) => agentGrid.removeTerminal(t)),

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

    // ── Tab Group Commands ──
    vscode.commands.registerCommand('vmux.createTabGroup', async () => {
      const name = await vscode.window.showInputBox({ prompt: 'Tab group name' });
      if (name) {
        tabGroupMgr.create(name);
        vscode.window.showInformationMessage(`vmux: Tab group "${name}" created`);
      }
    }),

    vscode.commands.registerCommand('vmux.deleteTabGroup', (item: { name: string }) => {
      tabGroupMgr.delete(item.name);
    }),

    vscode.commands.registerCommand('vmux.renameTabGroup', async (item: { name: string }) => {
      const newName = await vscode.window.showInputBox({ prompt: 'New name', value: item.name });
      if (newName && newName !== item.name) {
        tabGroupMgr.rename(item.name, newName);
      }
    }),

    vscode.commands.registerCommand('vmux.addTerminalToTabGroup', async () => {
      const groups = tabGroupMgr.list();
      if (groups.length === 0) {
        vscode.window.showInformationMessage('vmux: No tab groups. Create one first.');
        return;
      }
      const terminals = terminalMgr.list();
      if (terminals.length === 0) {
        vscode.window.showInformationMessage('vmux: No terminals open.');
        return;
      }
      const groupPick = await vscode.window.showQuickPick(
        groups.map(g => ({ label: g.name, description: `${g.terminals.length} terminal(s)` })),
        { placeHolder: 'Select tab group' },
      );
      if (!groupPick) return;
      const termPick = await vscode.window.showQuickPick(
        terminals.map(t => ({ label: t.name })),
        { placeHolder: 'Select terminal to add' },
      );
      if (termPick) {
        tabGroupMgr.addTerminal(groupPick.label, termPick.label);
      }
    }),

    vscode.commands.registerCommand('vmux.removeTerminalFromTabGroup', (item: { terminalName: string; groupName: string }) => {
      tabGroupMgr.removeTerminal(item.groupName, item.terminalName);
    }),

    vscode.commands.registerCommand('vmux.broadcastToTabGroup', async (item: { name: string }) => {
      const text = await vscode.window.showInputBox({ prompt: 'Command to broadcast' });
      if (!text) return;
      const group = tabGroupMgr.get(item.name);
      if (!group) return;
      for (const t of group.terminals) {
        try { terminalMgr.send(t, text); } catch { /* terminal may be gone */ }
      }
      vscode.window.showInformationMessage(`vmux: Broadcast to ${group.terminals.length} terminal(s)`);
    }),

    vscode.commands.registerCommand('vmux.focusTabGroup', (item: { name: string }) => {
      const group = tabGroupMgr.get(item.name);
      if (!group || group.terminals.length === 0) return;
      try { terminalMgr.focus(group.terminals[0]!); } catch { /* terminal may be gone */ }
    }),
  );

  // ─── IPC Method Handlers ─────────────────────────────────────
  const showSystemNotif = config.get<boolean>('systemNotifications', true);

  router.register('ping', async () => 'PONG');
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
    const terminalId = params['terminalId'] as string | undefined;
    if (terminalId) {
      notificationMgr.clearByTerminal(terminalId);
    } else {
      notificationMgr.clear(params['id'] as string | undefined);
    }
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

  router.register('agent.claudeHook', async (params) => {
    const action = params['action'] as string | undefined;
    if (!action) throw new Error('Invalid params: action is required');
    return claudeHookMgr.handle({
      action,
      rawInput: params['rawInput'] as string | undefined,
      terminalKey: params['terminalKey'] as string | undefined,
      cwd: params['cwd'] as string | undefined,
    });
  });

  router.register('agent.codexHook', async (params) => codexHookMgr.handle({
    rawInput: params['rawInput'] as string | undefined,
    terminalKey: params['terminalKey'] as string | undefined,
  }));

  router.register('agent.lifecycle', async (params) => basicAgentMgr.handle({
    agent: params['agent'] as 'codex' | 'gemini',
    action: params['action'] as 'start' | 'stop',
    terminalKey: params['terminalKey'] as string | undefined,
    cwd: params['cwd'] as string | undefined,
    exitCode: params['exitCode'] as number | undefined,
  }));

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

  // ─── Tab Group IPC Handlers ──────────────────────────────────
  router.register('tabgroup.create', async (params) => {
    const name = params['name'] as string | undefined;
    if (!name) throw new Error('Invalid params: name is required');
    return tabGroupMgr.create(name, params['color'] as string | undefined);
  });

  router.register('tabgroup.delete', async (params) => {
    const name = params['name'] as string | undefined;
    if (!name) throw new Error('Invalid params: name is required');
    tabGroupMgr.delete(name);
    return { ok: true };
  });

  router.register('tabgroup.rename', async (params) => {
    const oldName = params['oldName'] as string | undefined;
    const newName = params['newName'] as string | undefined;
    if (!oldName || !newName) throw new Error('Invalid params: oldName and newName are required');
    return tabGroupMgr.rename(oldName, newName);
  });

  router.register('tabgroup.addTerminal', async (params) => {
    const group = params['group'] as string | undefined;
    const terminal = params['terminal'] as string | undefined;
    if (!group || !terminal) throw new Error('Invalid params: group and terminal are required');
    return tabGroupMgr.addTerminal(group, terminal);
  });

  router.register('tabgroup.removeTerminal', async (params) => {
    const group = params['group'] as string | undefined;
    const terminal = params['terminal'] as string | undefined;
    if (!group || !terminal) throw new Error('Invalid params: group and terminal are required');
    return tabGroupMgr.removeTerminal(group, terminal);
  });

  router.register('tabgroup.get', async (params) => {
    const name = params['name'] as string | undefined;
    if (!name) throw new Error('Invalid params: name is required');
    return tabGroupMgr.get(name) ?? null;
  });

  router.register('tabgroup.list', async () => tabGroupMgr.list());

  router.register('tabgroup.broadcast', async (params) => {
    const group = params['group'] as string | undefined;
    const text = params['text'] as string | undefined;
    if (!group || !text) throw new Error('Invalid params: group and text are required');
    const tabGroup = tabGroupMgr.get(group);
    if (!tabGroup) throw new Error(`Invalid params: Tab group not found: ${group}`);
    for (const t of tabGroup.terminals) {
      try { terminalMgr.send(t, text); } catch { /* terminal may be gone */ }
    }
    return { ok: true, count: tabGroup.terminals.length };
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
