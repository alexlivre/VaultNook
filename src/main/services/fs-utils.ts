import { writeFile, rename, chmod, stat } from 'fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function atomicWriteFile(filePath: string, data: string): Promise<void> {
  const tmpPath = `${filePath}.tmp`;
  await writeFile(tmpPath, data, 'utf-8');
  await rename(tmpPath, filePath);
}

export async function restrictPathAcl(...paths: string[]): Promise<void> {
  for (const p of paths) {
    try {
      if (process.platform === 'win32') {
        const user = process.env.USERNAME || process.env.USER || '';
        if (!user) continue;
        const isDir = (await stat(p)).isDirectory();
        const perm = isDir ? `${user}:(OI)(CI)F` : `${user}:F`;
        await execFileAsync('icacls', [p, '/grant:r', perm, '/inheritance:r', '/Q']);
      } else {
        await chmod(p, 0o600);
      }
    } catch {
      // best effort — file/dir may already be restricted or fs non-POSIX
    }
  }
}

const restrictedPaths = new Set<string>();

export async function restrictPathAclOnce(...paths: string[]): Promise<void> {
  const pending = paths.filter((p) => !restrictedPaths.has(p));
  if (pending.length === 0) return;
  await restrictPathAcl(...pending);
  pending.forEach((p) => restrictedPaths.add(p));
}
