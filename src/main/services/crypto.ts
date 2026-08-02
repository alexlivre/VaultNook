import { randomBytes, pbkdf2Sync, createCipheriv, createDecipheriv, randomInt } from 'crypto';

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

export function deriveKey(password: string, salt: Buffer): VaultKey {
  const key = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  return {
    key,
    zeroize() {
      key.fill(0);
    },
  } as VaultKey;
}

export function hashPassword(password: string, salt: Buffer): Buffer {
  return pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
}

export function generateSalt(): Buffer {
  return randomBytes(SALT_LENGTH);
}

export function encrypt(value: string, vaultKey: VaultKey): EncryptedData {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, vaultKey.key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export function decrypt(data: EncryptedData, vaultKey: VaultKey): string {
  const iv = Buffer.from(data.iv, 'base64');
  const encrypted = Buffer.from(data.ciphertext, 'base64');
  const tag = Buffer.from(data.tag, 'base64');
  const decipher = createDecipheriv(ALGORITHM, vaultKey.key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function generateRecoveryPhrase(): string[] {
  // BIP39-like wordlist (simplified for demo - in production use actual BIP39)
  const words = [
    'abacate', 'abismo', 'acender', 'adeus', 'agulha', 'alegria',
    'amanhã', 'anel', 'anzol', 'aranha', 'árvore', 'astronauta',
    'atalho', 'avelã', 'azulejo', 'baile', 'banana', 'barro',
    'batata', 'beijo', 'bloco', 'boato', 'bobina', 'bosque',
    'brilho', 'cabelo', 'cacto', 'caderno', 'café', 'calma',
    'caminho', 'caneta', 'cantor', 'caracol', 'carne', 'carta',
    'castelo', 'cavalo', 'cedro', 'cenoura', 'chaleira', 'chapéu',
    'chave', 'chuva', 'ciclone', 'cidreira', 'cifra', 'cinza',
    'circo', 'claro', 'cliente', 'cobre', 'coelho', 'colher',
    'colina', 'cometa', 'corda', 'coroa', 'corpo', 'cortina',
    'costela', 'criança', 'cristal', 'cruzeiro', 'cubo', 'cuidado',
    'dado', 'dança', 'dente', 'deserto', 'destino', 'diário',
    'diamante', 'dinheiro', 'direito', 'disco', 'dívida', 'dólar',
    'domingo', 'dragão', 'duna', 'ecoar', 'elétron', 'embargo',
    'emoção', 'encontro', 'energia', 'enigma', 'entrada', 'envelope',
    'equipe', 'escala', 'escudo', 'esfera', 'espada', 'espelho',
    'esquina', 'estrela', 'eterno', 'evitar', 'exame', 'explosão',
    'fábula', 'facção', 'fada', 'falha', 'fama', 'fantasma',
    'faria', 'fase', 'fatal', 'favo', 'feira', 'feliz',
    'ferro', 'festa', 'fiar', 'figura', 'filme', 'fim',
    'fiscal', 'flama', 'flauta', 'flor', 'fluxo', 'foca',
    'fogo', 'folha', 'fome', 'fonte', 'forma', 'forte',
    'fóssil', 'fração', 'frango', 'frasco', 'frente', 'fresta',
    'frio', 'fronte', 'fruta', 'fuga', 'fundo', 'fúria',
    'gabinete', 'galáxia', 'galho', 'galo', 'gama', 'gancho',
    'garra', 'gato', 'gaveta', 'gelo', 'gema', 'general',
    'gênio', 'gesso', 'gesto', 'gigante', 'girino', 'giz',
    'globo', 'glória', 'goiaba', 'gole', 'golfinho', 'gomo',
    'gonzo', 'gorro', 'gosto', 'gota', 'governo', 'graça',
    'grade', 'grão', 'graxa', 'grifo', 'grito', 'gruta',
    'guarda', 'guerra', 'guia', 'guizo', 'gula', 'gume',
    'harpa', 'herói', 'hidra', 'hierro', 'hino', 'hoje',
    'homem', 'honra', 'horizonte', 'horta', 'hóspede', 'hotel',
    'ideal', 'igreja', 'ilha', 'ilusão', 'imagem', 'imã',
    'imune', 'índice', 'início', 'invasor', 'íris', 'iluminar',
  ];

  const selected: string[] = [];
  const used = new Set<number>();
  while (selected.length < 12) {
    const idx = randomInt(words.length);
    if (!used.has(idx)) {
      used.add(idx);
      selected.push(words[idx]);
    }
  }
  return selected;
}

export function validateRecoveryPhrase(words: string[]): boolean {
  return words.length === 12 && words.every((w) => w.length > 0);
}
