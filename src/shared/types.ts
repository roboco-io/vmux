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
  command?: string;
}

// Phase 3: Agent Presets

export interface AgentPreset {
  name: string;
  command?: string;
  cwd?: string;
  env?: Record<string, string>;
  shellPath?: string;
}

// Tab Groups

export interface TabGroup {
  name: string;
  terminals: string[];   // terminal names
  color?: string;        // ThemeIcon color
}

// Phase 2: Metadata

export interface LogEntry {
  level: 'info' | 'progress' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: number;
}

export interface StatusPill {
  key: string;
  value: string;
  icon?: string;
  color?: string;
}

export interface MetadataEntry {
  terminalId: string;
  statuses: StatusPill[];
  progress?: { value: number; label?: string };
  logs: LogEntry[];
}
