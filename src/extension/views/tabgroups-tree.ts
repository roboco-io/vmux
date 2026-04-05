import * as vscode from 'vscode';
import type { TabGroup } from '../../shared/types.js';
import type { TabGroupManager } from '../tabgroups/manager.js';

interface TabGroupTerminalItem {
  terminalName: string;
  groupName: string;
}

type TreeItem = TabGroup | TabGroupTerminalItem;

export class TabGroupsTreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private manager: TabGroupManager) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    if ('terminals' in element) {
      // TabGroup
      const item = new vscode.TreeItem(
        element.name,
        element.terminals.length > 0
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
      );
      item.description = `${element.terminals.length} terminal(s)`;
      item.iconPath = new vscode.ThemeIcon('list-tree', element.color ? new vscode.ThemeColor(element.color) : undefined);
      item.contextValue = 'tabgroup';
      return item;
    } else {
      // TabGroupTerminalItem
      const item = new vscode.TreeItem(element.terminalName, vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon('terminal');
      item.contextValue = 'tabgroup-terminal';
      item.command = {
        command: 'vmux.onTerminalClick',
        title: 'Focus Terminal',
        arguments: [{ name: element.terminalName }],
      };
      return item;
    }
  }

  getChildren(element?: TreeItem): TreeItem[] {
    if (!element) {
      return this.manager.list();
    }
    if ('terminals' in element) {
      return element.terminals.map(t => ({ terminalName: t, groupName: element.name }));
    }
    return [];
  }
}
