import { randomBytes, pbkdf2, createCipheriv, createDecipheriv } from 'crypto';
import { promisify } from 'node:util';
import { generateMnemonic, validateMnemonic } from 'bip39';

const pbkdf2Async = promisify(pbkdf2);

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 32;
const ITERATIONS = 600000;
const DIGEST = 'sha256';

export interface EncryptedData {
  iv: string;
  ciphertext: string;
  tag: string;
}

export interface VaultKey {
  key: Buffer;
  zeroize(): void;
}

export async function deriveKey(password: string, salt: Buffer): Promise<VaultKey> {
  const key = (await pbkdf2Async(password, salt, ITERATIONS, KEY_LENGTH, DIGEST)) as Buffer;
  return {
    key,
    zeroize() {
      key.fill(0);
    },
  } as VaultKey;
}

export async function hashPassword(password: string, salt: Buffer): Promise<Buffer> {
  return (await pbkdf2Async(password, salt, ITERATIONS, KEY_LENGTH, DIGEST)) as Buffer;
}

export function generateSalt(): Buffer {
  return randomBytes(SALT_LENGTH);
}

export function generateMasterKey(): Buffer {
  return randomBytes(KEY_LENGTH);
}

function encryptBuffer(plaintext: Buffer, key: Buffer): EncryptedData {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export function encrypt(value: string, vaultKey: VaultKey): EncryptedData {
  return encryptBuffer(Buffer.from(value, 'utf8'), vaultKey.key);
}

export function encryptKey(secret: Buffer, wrappingKey: Buffer): EncryptedData {
  return encryptBuffer(secret, wrappingKey);
}

function decryptBuffer(data: EncryptedData, key: Buffer): Buffer {
  const iv = Buffer.from(data.iv, 'base64');
  const encrypted = Buffer.from(data.ciphertext, 'base64');
  const tag = Buffer.from(data.tag, 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export function decrypt(data: EncryptedData, vaultKey: VaultKey): string {
  return decryptBuffer(data, vaultKey.key).toString('utf8');
}

export function decryptKey(data: EncryptedData, wrappingKey: Buffer): Buffer {
  return decryptBuffer(data, wrappingKey);
}

export function generateRecoveryPhrase(): string {
  return generateMnemonic(128);
}

export function validateRecoveryPhrase(phrase: string): boolean {
  return validateMnemonic(phrase.trim().toLowerCase());
}
