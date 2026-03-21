import * as vscode from 'vscode';
import type { Notification } from '../../shared/types.js';
import type { NotificationManager } from '../notifications/manager.js';

export class NotificationsTreeDataProvider implements vscode.TreeDataProvider<Notification> {
  private _onDidChangeTreeData = new vscode.EventEmitter<Notification | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private manager: NotificationManager) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: Notification): vscode.TreeItem {
    const item = new vscode.TreeItem(element.title, vscode.TreeItemCollapsibleState.None);

    // Description: body + timestamp
    const time = new Date(element.timestamp).toLocaleTimeString();
    item.description = element.body ? `${element.body} — ${time}` : time;

    // Icon by level
    const iconId = element.level === 'error' ? 'error'
      : element.level === 'warning' ? 'warning'
      : 'info';
    item.iconPath = new vscode.ThemeIcon(iconId);

    // Dim read notifications
    if (element.read) {
      item.description = `(read) ${item.description}`;
    }

    // Click command
    item.command = {
      command: 'cmux.onNotificationClick',
      title: 'Open Notification',
      arguments: [element],
    };

    item.contextValue = 'notification';
    return item;
  }

  getChildren(): Notification[] {
    return this.manager.list();
  }
}
