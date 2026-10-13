import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { restrictPathAcl, sanitizeFileName } from '../main/services/fs-utils';

describe('fs-utils restrictPathAcl', () => {
  it('should keep a file readable and writable after restricting ACL', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dv-fs-file-'));
    const file = join(dir, 'test.json');
    writeFileSync(file, '{"a":1}');
    await restrictPathAcl(file);
    expect(readFileSync(file, 'utf-8')).toBe('{"a":1}');
    writeFileSync(file, '{"a":2}');
    expect(readFileSync(file, 'utf-8')).toBe('{"a":2}');
    rmSync(dir, { recursive: true, force: true });
  });

  it('should keep a directory traversable and its files accessible after restricting ACL', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dv-fs-dir-'));
    const sub = join(dir, 'sub.json');
    writeFileSync(sub, 'x');
    await restrictPathAcl(dir);
    expect(readFileSync(sub, 'utf-8')).toBe('x');
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('fs-utils sanitizeFileName', () => {
  it('should strip characters that are illegal in file names', () => {
    expect(sanitizeFileName('Tra:balho/Pessoal?')).toBe('TrabalhoPessoal');
    expect(sanitizeFileName('a<b>c:d"e|f?g*h\\i')).toBe('abcdefghi');
  });

  it('should collapse whitespace and trim', () => {
    expect(sanitizeFileName('  Meu   Cofre  ')).toBe('Meu Cofre');
  });

  it('should strip trailing dots and spaces (invalid on Windows)', () => {
    expect(sanitizeFileName('Meu Cofre...')).toBe('Meu Cofre');
    expect(sanitizeFileName('Meu Cofre. . ')).toBe('Meu Cofre');
  });

  it('should remove control characters', () => {
    expect(sanitizeFileName('a\u0000b\nc')).toBe('abc');
  });

  it('should preserve accents and unicode characters', () => {
    expect(sanitizeFileName('Finanças ✅')).toBe('Finanças ✅');
    expect(sanitizeFileName('Pessoal')).toBe('Pessoal');
  });

  it('should return an empty string when nothing remains', () => {
    expect(sanitizeFileName('***')).toBe('');
    expect(sanitizeFileName('///')).toBe('');
  });
});
