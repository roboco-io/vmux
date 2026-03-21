import * as vscode from 'vscode';

export interface GridConfig {
  name: string;
  rows: number;
  cols: number;
  cwd?: string;
  names?: string[];
}

export interface Grid {
  name: string;
  terminals: vscode.Terminal[];
}

export class AgentGrid {
  private grids = new Map<string, Grid>();
  private envBuilder: (id: string) => Record<string, string>;

  constructor(envBuilder: (id: string) => Record<string, string>) {
    this.envBuilder = envBuilder;
  }

  create(config: GridConfig): Grid {
    const terminals: vscode.Terminal[] = [];
    const total = config.rows * config.cols;

    for (let i = 0; i < total; i++) {
      const termName = config.names?.[i] ?? `${config.name}-${i + 1}`;
      const id = `grid-${config.name}-${i}`;
      const env = this.envBuilder(id);

      if (i === 0) {
        // First terminal in the grid
        terminals.push(vscode.window.createTerminal({
          name: termName,
          cwd: config.cwd ? vscode.Uri.file(config.cwd) : undefined,
          env,
        }));
      } else {
        // Split from the first terminal in same group
        terminals.push(vscode.window.createTerminal({
          name: termName,
          cwd: config.cwd ? vscode.Uri.file(config.cwd) : undefined,
          env,
          location: { parentTerminal: terminals[0]! },
        }));
      }
    }

    const grid: Grid = { name: config.name, terminals };
    this.grids.set(config.name, grid);

    // Show the first terminal
    if (terminals.length > 0) terminals[0]!.show();

    return grid;
  }

  broadcast(gridName: string, text: string): void {
    const grid = this.grids.get(gridName);
    if (!grid) throw new Error(`Invalid params: Grid not found: ${gridName}`);
    for (const t of grid.terminals) {
      t.sendText(text);
    }
  }

  getGrid(name: string): Grid | undefined {
    return this.grids.get(name);
  }

  listGrids(): { name: string; terminalCount: number }[] {
    return [...this.grids.entries()].map(([name, g]) => ({
      name,
      terminalCount: g.terminals.length,
    }));
  }

  removeTerminal(terminal: vscode.Terminal): void {
    for (const [, grid] of this.grids) {
      const idx = grid.terminals.indexOf(terminal);
      if (idx >= 0) {
        grid.terminals.splice(idx, 1);
        if (grid.terminals.length === 0) {
          this.grids.delete(grid.name);
        }
        break;
      }
    }
  }
}
