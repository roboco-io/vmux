import * as vscode from 'vscode';
import type { SessionPreset, SessionTerminal } from '../../shared/types.js';
import type { SessionManager } from '../sessions/manager.js';

type TreeItem = SessionPreset | SessionTerminal;

export class SessionsTreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private manager: SessionManager) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    if ('terminals' in element) {
      // SessionPreset
      const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.Collapsed);
      item.description = `${element.terminals.length} terminal(s)`;
      item.iconPath = new vscode.ThemeIcon('window');
      item.contextValue = 'session';
      return item;
    } else {
      // SessionTerminal
      const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
      item.description = element.cwd ?? '';
      item.iconPath = new vscode.ThemeIcon('terminal');
      return item;
    }
  }

  getChildren(element?: TreeItem): TreeItem[] {
    if (!element) {
      return this.manager.list();
    }
    if ('terminals' in element) {
      return element.terminals;
    }
    return [];
  }
}
