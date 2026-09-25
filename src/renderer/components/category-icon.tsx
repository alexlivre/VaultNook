import { KeyRound, KeySquare, MessageSquareText, Terminal, Link, type LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { CategoryLabel, type Category } from '../types';

interface CategoryMeta {
  icon: LucideIcon;
  label: string;
  colorName: string;
  cssVar: string;
}

export const categoryMeta: Record<Category, CategoryMeta> = {
  api: { icon: KeyRound, label: CategoryLabel.api, colorName: 'category-api', cssVar: 'var(--color-category-api)' },
  prompt: { icon: MessageSquareText, label: CategoryLabel.prompt, colorName: 'category-prompt', cssVar: 'var(--color-category-prompt)' },
  command: { icon: Terminal, label: CategoryLabel.command, colorName: 'category-command', cssVar: 'var(--color-category-command)' },
  link: { icon: Link, label: CategoryLabel.link, colorName: 'category-link', cssVar: 'var(--color-category-link)' },
  keypair: { icon: KeySquare, label: CategoryLabel.keypair, colorName: 'category-keypair', cssVar: 'var(--color-category-keypair)' },
};

export function CategoryIcon({ category, className }: { category: Category; className?: string }) {
  const Icon = categoryMeta[category].icon;
  return <Icon className={cn('h-4 w-4', `text-${categoryMeta[category].colorName}`, className)} />;
}
