import * as crypto from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';

export function getSocketPath(workspaceUri: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(workspaceUri)
    .digest('hex')
    .substring(0, 8);

  const dir = process.env['XDG_RUNTIME_DIR'] ?? os.tmpdir();
  return path.join(dir, `vmux-${hash}.sock`);
}

export function isUnixPlatform(): boolean {
  return process.platform === 'darwin' || process.platform === 'linux';
}
