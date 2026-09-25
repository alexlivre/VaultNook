import { z } from 'zod';

export const Category = z.enum(['api', 'prompt', 'command', 'link', 'keypair']);
export type Category = z.infer<typeof Category>;

export const ItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Nome é obrigatório'),
  value: z.string().min(1, 'Valor é obrigatório'),
  publicKey: z.string().default(''),
  description: z.string().default(''),
  category: Category,
  tags: z.array(z.string()).default([]),
  favorite: z.boolean().default(false),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Item = z.infer<typeof ItemSchema>;

export const CreateItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  value: z.string().min(1, 'Valor é obrigatório'),
  publicKey: z.string().optional().default(''),
  description: z.string().max(500).default(''),
  category: Category,
  tags: z.array(z.string()).default([]),
});
export type CreateItem = z.infer<typeof CreateItemSchema>;

export const EditItemSchema = CreateItemSchema.extend({
  id: z.string(),
});
export type EditItem = z.infer<typeof EditItemSchema>;

export const CreatePasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Mínimo de 8 caracteres')
      .regex(/[A-Z]/, 'Deve conter letra maiúscula')
      .regex(/[a-z]/, 'Deve conter letra minúscula')
      .regex(/[0-9]/, 'Deve conter número')
      .regex(/[^A-Za-z0-9]/, 'Deve conter símbolo'),
    confirmPassword: z.string(),
    name: z.string().min(1, 'Nome do vault é obrigatório'),
    hint: z.string().optional().default(''),
    color: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Senhas não conferem',
    path: ['confirmPassword'],
  });
export type CreatePassword = z.infer<typeof CreatePasswordSchema>;

export const UnlockSchema = z.object({
  password: z.string().min(1, 'Senha é obrigatória'),
  vaultId: z.string().min(1),
});
export type Unlock = z.infer<typeof UnlockSchema>;

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
    newPassword: z
      .string()
      .min(8, 'Mínimo de 8 caracteres')
      .regex(/[A-Z]/, 'Deve conter letra maiúscula')
      .regex(/[a-z]/, 'Deve conter letra minúscula')
      .regex(/[0-9]/, 'Deve conter número')
      .regex(/[^A-Za-z0-9]/, 'Deve conter símbolo'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Senhas não conferem',
    path: ['confirmPassword'],
  });
export type ChangePassword = z.infer<typeof ChangePasswordSchema>;

// IPC payload schemas shared between preload and the main process.
export const CreatePasswordPayloadSchema = z.object({
  password: z.string().min(8),
  name: z.string().min(1, 'Nome é obrigatório'),
  hint: z.string().optional().default(''),
  color: z.string().optional(),
});
export type CreatePasswordPayload = z.infer<typeof CreatePasswordPayloadSchema>;

export const UnlockPayloadSchema = z.object({
  password: z.string().min(1),
  vaultId: z.string().min(1),
});
export type UnlockPayload = z.infer<typeof UnlockPayloadSchema>;

export const DeleteVaultEntryPayloadSchema = z.object({
  vaultId: z.string().min(1),
  password: z.string().min(1),
});
export type DeleteVaultEntryPayload = z.infer<typeof DeleteVaultEntryPayloadSchema>;

export const ToggleFavoritePayloadSchema = z.object({
  id: z.string(),
  favorite: z.boolean(),
});
export type ToggleFavoritePayload = z.infer<typeof ToggleFavoritePayloadSchema>;

export const SaveSettingsPayloadSchema = z.object({
  autoLockTimer: z.number().min(0).max(900),
});
export type SaveSettingsPayload = z.infer<typeof SaveSettingsPayloadSchema>;

export interface VaultInfo {
  createdAt: number;
  totalItems: number;
  itemsByCategory: Record<Category, number>;
  appVersion: string;
}

export interface ImportResult {
  imported: number;
  ignored: number;
  total: number;
}

export interface VaultEntry {
  id: string;
  name: string;
  createdAt: number;
  lastOpened: number;
  hidden: boolean;
  hasHint: boolean;
  itemCount: number;
  color?: string;
  icon?: string;
}

export type SortOption = 'recent' | 'updated' | 'name-asc' | 'name-desc' | 'favorites';
