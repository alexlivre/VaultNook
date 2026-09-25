import { create } from 'zustand';
import type { Item, Category, VaultEntry, SortOption } from '../types';

export type AppScreen = 'loading' | 'vault-manager' | 'create-password' | 'unlock' | 'recovery' | 'vault';
export type AutoLockOption = 30 | 60 | 300 | 900 | 0;

interface VaultState {
  // Auth
  screen: AppScreen;
  isLocked: boolean;

  // Vaults
  vaults: VaultEntry[];
  activeVaultId: string | null;
  activeVaultName: string;
  unlockTarget: { id: string; name: string; hint: string } | null;

  // Data
  items: Item[];
  activeCategory: Category | 'all';
  searchQuery: string;
  favoritesFirst: boolean;
  sortOption: SortOption;

  // UI
  isSearching: boolean;
  selectedItemIds: Set<string>;
  revealedItemIds: Set<string>;

  // Session
  autoLockTimer: AutoLockOption;

  // Actions
  setScreen: (screen: AppScreen) => void;
  setIsLocked: (locked: boolean) => void;
  setVaults: (vaults: VaultEntry[]) => void;
  setActiveVaultId: (id: string | null) => void;
  setActiveVaultName: (name: string) => void;
  setUnlockTarget: (target: { id: string; name: string; hint: string } | null) => void;
  setItems: (items: Item[]) => void;
  addItem: (item: Item) => void;
  updateItem: (item: Item) => void;
  removeItem: (id: string) => void;
  removeItems: (ids: string[]) => void;
  moveCategoryItems: (ids: string[], category: Category) => void;
  setActiveCategory: (category: Category | 'all') => void;
  setSearchQuery: (query: string) => void;
  setFavoritesFirst: (value: boolean) => void;
  setSortOption: (sort: SortOption) => void;
  toggleFavorite: (id: string) => void;
  toggleReveal: (id: string) => void;
  toggleItemSelection: (id: string) => void;
  selectAllItems: () => void;
  clearSelection: () => void;
  setAutoLockTimer: (timer: AutoLockOption) => void;

  // Computed
  filteredItems: () => Item[];
}

export const useVaultStore = create<VaultState>((set, get) => ({
  // Auth
  screen: 'loading',
  isLocked: true,

  // Vaults
  vaults: [],
  activeVaultId: null,
  activeVaultName: '',
  unlockTarget: null,

  // Data
  items: [],
  activeCategory: 'all',
  searchQuery: '',
  favoritesFirst: false,
  sortOption: 'recent',

  // UI
  isSearching: false,
  selectedItemIds: new Set(),
  revealedItemIds: new Set(),

  // Session
  autoLockTimer: 60,

  // Actions
  setScreen: (screen) => set({ screen }),
  setIsLocked: (locked) => set({ isLocked: locked }),
  setVaults: (vaults) => set({ vaults }),
  setActiveVaultId: (id) => set({ activeVaultId: id }),
  setActiveVaultName: (name) => set({ activeVaultName: name }),
  setUnlockTarget: (target) => set({ unlockTarget: target }),
  setItems: (items) => set({ items }),
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  updateItem: (item) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === item.id ? item : i)),
    })),
  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
      selectedItemIds: new Set([...state.selectedItemIds].filter((sid) => sid !== id)),
    })),
  removeItems: (ids) => {
    const idSet = new Set(ids);
    set((state) => ({
      items: state.items.filter((i) => !idSet.has(i.id)),
      selectedItemIds: new Set([...state.selectedItemIds].filter((sid) => !idSet.has(sid))),
    }));
  },
  moveCategoryItems: (ids, category) => {
    const idSet = new Set(ids);
    set((state) => ({
      items: state.items.map((i) => (idSet.has(i.id) ? { ...i, category, updatedAt: Date.now() } : i)),
      selectedItemIds: new Set(),
    }));
  },
  setActiveCategory: (category) => set({ activeCategory: category, searchQuery: '' }),
  setSearchQuery: (query) => set({ searchQuery: query, isSearching: query.length > 0 }),
  setFavoritesFirst: (value) => set({ favoritesFirst: value }),
  setSortOption: (sort) => set({ sortOption: sort }),
  toggleFavorite: (id) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id ? { ...i, favorite: !i.favorite } : i
      ),
    })),
  toggleReveal: (id) =>
    set((state) => {
      const newSet = new Set(state.revealedItemIds);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return { revealedItemIds: newSet };
    }),
  toggleItemSelection: (id) =>
    set((state) => {
      const newSet = new Set(state.selectedItemIds);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return { selectedItemIds: newSet };
    }),
  selectAllItems: () => {
    const { filteredItems } = get();
    const allIds = new Set(filteredItems().map((i) => i.id));
    set({ selectedItemIds: allIds });
  },
  clearSelection: () => set({ selectedItemIds: new Set() }),
  setAutoLockTimer: (timer) => set({ autoLockTimer: timer }),

  // Computed
  filteredItems: () => {
    const { items, activeCategory, searchQuery, favoritesFirst, sortOption } = get();
    let filtered = items;

    if (activeCategory !== 'all') {
      filtered = filtered.filter((item) => item.category === activeCategory);
    }

    if (searchQuery.trim()) {
      let query = searchQuery.toLowerCase().trim();
      let catFilter: string | null = null;
      let tagFilter: string | null = null;
      let onlyFavs = false;

      // Extract cat:<category>
      const catMatch = query.match(/cat:(\w+)/);
      if (catMatch) {
        catFilter = catMatch[1];
        query = query.replace(/cat:\w+/, '').trim();
      }

      // Extract tag:<tag>
      const tagMatch = query.match(/tag:([^\s]+)/);
      if (tagMatch) {
        tagFilter = tagMatch[1];
        query = query.replace(/tag:[^\s]+/, '').trim();
      }

      // Extract is:fav or is:favorite
      if (query.includes('is:fav') || query.includes('is:favorite')) {
        onlyFavs = true;
        query = query.replace(/is:fav(orite)?/, '').trim();
      }

      filtered = filtered.filter((item) => {
        if (catFilter && item.category !== catFilter) return false;
        if (onlyFavs && !item.favorite) return false;
        if (tagFilter) {
          const hasTag = (item.tags || []).some((t) => t.toLowerCase().includes(tagFilter!));
          if (!hasTag) return false;
        }
        if (!query) return true;

        const nameMatch = item.name.toLowerCase().includes(query);
        const descMatch = (item.description || '').toLowerCase().includes(query);
        const tagMatchFound = (item.tags || []).some((t) => t.toLowerCase().includes(query));
        return nameMatch || descMatch || tagMatchFound;
      });
    }

    // Sort items
    filtered = [...filtered].sort((a, b) => {
      if (favoritesFirst) {
        if (a.favorite && !b.favorite) return -1;
        if (!a.favorite && b.favorite) return 1;
      }

      switch (sortOption) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'updated':
          return (b.updatedAt || 0) - (a.updatedAt || 0);
        case 'favorites':
          if (a.favorite && !b.favorite) return -1;
          if (!a.favorite && b.favorite) return 1;
          return (b.updatedAt || 0) - (a.updatedAt || 0);
        case 'recent':
        default:
          return (b.createdAt || 0) - (a.createdAt || 0);
      }
    });

    return filtered;
  },
}));

