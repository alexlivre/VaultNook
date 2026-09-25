import { z } from 'zod';
import {
  Category,
  CreateItemSchema,
  EditItemSchema,
  ChangePasswordSchema,
  CreatePasswordPayloadSchema,
  UnlockPayloadSchema,
  DeleteVaultEntryPayloadSchema,
  ToggleFavoritePayloadSchema,
  SaveSettingsPayloadSchema,
} from '../../shared/schemas';

export {
  Category,
  CreateItemSchema,
  EditItemSchema,
  ChangePasswordSchema,
  CreatePasswordPayloadSchema,
  UnlockPayloadSchema,
  DeleteVaultEntryPayloadSchema,
  ToggleFavoritePayloadSchema,
  SaveSettingsPayloadSchema,
};

export const DeleteVaultSchema = z.object({
  password: z.string().min(1),
});

export const RecoverSchema = z.object({
  vaultId: z.string().min(1),
  phrase: z.string().min(1),
  newPassword: z.string().min(8),
});

export const RegeneratePhraseSchema = z.object({
  password: z.string().min(1),
});

export const SaveRecoveryPhraseSchema = z.object({
  phrase: z.string().min(1),
});

export const ClearClipboardSchema = z.object({
  expected: z.string().optional(),
});

export const RenameVaultSchema = z.object({
  vaultId: z.string().min(1),
  name: z.string().min(1, 'Nome é obrigatório'),
  color: z.string().optional(),
});

export const MoveCategorySchema = z.object({
  ids: z.array(z.string()),
  category: Category,
});

export const IdsSchema = z.array(z.string());
export const IdSchema = z.string().min(1);
export const RawStringSchema = z.string();

const EncryptedFieldSchema = z.object({
  iv: z.string(),
  ciphertext: z.string(),
  tag: z.string(),
});

const ImportedItemSchema = z.object({
  id: z.string().optional(),
  category: Category,
  value: z.union([z.string(), EncryptedFieldSchema]),
  name: z.union([z.string(), EncryptedFieldSchema]).optional(),
  publicKey: z.union([z.string(), EncryptedFieldSchema]).nullish(),
  description: z.union([z.string(), EncryptedFieldSchema]).nullish(),
  tags: z.union([z.array(z.string()), EncryptedFieldSchema]).nullish(),
  favorite: z.boolean().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

export const ImportedVaultSchema = z.object({
  version: z.string().optional(),
  formatVersion: z.number().optional(),
  createdAt: z.number().optional(),
  passwordHash: z.string(),
  salt: z.string(),
  recoveryHash: z.string().optional(),
  masterKeyWrap: EncryptedFieldSchema.optional(),
  recoveryKeyWrap: EncryptedFieldSchema.optional(),
  hint: z.string().optional(),
  settings: z.object({ autoLockTimer: z.number() }).optional(),
  items: z.array(ImportedItemSchema),
});
