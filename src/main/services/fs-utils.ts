import { writeFile, rename, chmod } from 'fs/promises';
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
        await execFileAsync('icacls', [p, '/grant:r', `${user}:(OI)(CI)F`, '/inheritance:r', '/Q']);
      } else {
        await chmod(p, 0o600);
      }
    } catch {
      // best effort — file/dir may already be restricted or fs non-POSIX
    }
  }
}
