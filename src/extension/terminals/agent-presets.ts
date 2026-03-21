import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { AgentPreset } from '../../shared/types.js';

export class AgentPresetManager {
  private getFilePath(): string | undefined {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) return undefined;
    return path.join(folder.uri.fsPath, '.vscode', 'vmux-agents.json');
  }

  private readPresets(): AgentPreset[] {
    const filePath = this.getFilePath();
    if (!filePath || !fs.existsSync(filePath)) return [];
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as AgentPreset[];
    } catch {
      return [];
    }
  }

  private writePresets(presets: AgentPreset[]): void {
    const filePath = this.getFilePath();
    if (!filePath) return;
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(presets, null, 2), 'utf-8');
  }

  save(preset: AgentPreset): void {
    const presets = this.readPresets().filter(p => p.name !== preset.name);
    presets.push(preset);
    this.writePresets(presets);
  }

  list(): AgentPreset[] {
    return this.readPresets();
  }

  get(name: string): AgentPreset | undefined {
    return this.readPresets().find(p => p.name === name);
  }

  delete(name: string): void {
    const presets = this.readPresets().filter(p => p.name !== name);
    this.writePresets(presets);
  }
}
