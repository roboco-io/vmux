import * as crypto from 'node:crypto';
import type { Notification } from '../../shared/types.js';

export class NotificationManager {
  private notifications = new Map<string, Notification>();
  private _onDidChange: (() => void) | null = null;

  set onDidChange(handler: () => void) {
    this._onDidChange = handler;
  }

  create(title: string, body?: string, level: 'info' | 'warning' | 'error' = 'info', terminalId?: string): Notification {
    const id = crypto.randomUUID().substring(0, 8);
    const notification: Notification = {
      id,
      title,
      body,
      level,
      terminalId,
      timestamp: Date.now(),
      read: false,
    };
    this.notifications.set(id, notification);
    this._onDidChange?.();
    return notification;
  }

  list(): Notification[] {
    return [...this.notifications.values()].sort((a, b) => b.timestamp - a.timestamp);
  }

  clear(id?: string): void {
    if (id) {
      this.notifications.delete(id);
    } else {
      this.notifications.clear();
    }
    this._onDidChange?.();
  }

  markRead(id: string): void {
    const n = this.notifications.get(id);
    if (n) {
      n.read = true;
      this._onDidChange?.();
    }
  }

  getLatestUnread(): Notification | undefined {
    return this.list().find(n => !n.read);
  }

  get unreadCount(): number {
    let count = 0;
    for (const n of this.notifications.values()) {
      if (!n.read) count++;
    }
    return count;
  }
}
