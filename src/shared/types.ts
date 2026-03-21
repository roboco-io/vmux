export interface Notification {
  id: string;
  title: string;
  body?: string;
  level: 'info' | 'warning' | 'error';
  terminalId?: string;
  timestamp: number;
  read: boolean;
}

export interface SessionPreset {
  name: string;
  terminals: SessionTerminal[];
}

export interface SessionTerminal {
  name: string;
  cwd?: string;
  shellPath?: string;
  env?: Record<string, string>;
  group?: number;
}

export interface TerminalInfo {
  id: string;
  name: string;
  cwd?: string;
  isActive: boolean;
}
