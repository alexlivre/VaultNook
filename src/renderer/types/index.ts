import type { Category } from '../../shared/schemas';

export * from '../../shared/schemas';

export const CategoryLabel: Record<Category, string> = {
  api: 'APIs',
  prompt: 'Prompts',
  command: 'Commands',
  link: 'Links',
  keypair: 'Chaves',
};

export const CategoryColorName: Record<Category, string> = {
  api: 'category-api',
  prompt: 'category-prompt',
  command: 'category-command',
  link: 'category-link',
  keypair: 'category-keypair',
};
