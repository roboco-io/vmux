import * as vscode from 'vscode';
import type { TerminalInfo } from '../../shared/types.js';
import type { TerminalManager } from '../terminals/manager.js';

export class TerminalsTreeDataProvider implements vscode.TreeDataProvider<TerminalInfo> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TerminalInfo | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private manager: TerminalManager) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TerminalInfo): vscode.TreeItem {
    const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
    item.description = element.cwd ?? '';
    item.iconPath = new vscode.ThemeIcon(element.isActive ? 'terminal' : 'circle-slash');

    item.command = {
      command: 'vmux.onTerminalClick',
      title: 'Focus Terminal',
      arguments: [element],
    };

    item.contextValue = 'terminal';
    return item;
  }

  getChildren(): TerminalInfo[] {
    return this.manager.list();
  }
}
