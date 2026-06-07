import { create } from 'zustand';
import type { Item, Category, VaultInfo, ExportData, ImportResult, CreateItem, EditItem, ChangePassword } from '../types';

export type AppScreen = 'loading' | 'create-password' | 'unlock' | 'vault';
export type AutoLockOption = 30 | 60 | 300 | 900 | 0;

interface VaultState {
  // Auth
  screen: AppScreen;
  isLocked: boolean;
  isFirstRun: boolean;

  // Data
  items: Item[];
  activeCategory: Category | 'all';
  searchQuery: string;
  favoritesFirst: boolean;

  // UI
  isSearching: boolean;
  selectedItemIds: Set<string>;
  revealedItemIds: Set<string>;

  // Session
  autoLockTimer: AutoLockOption;
  lastActivity: number;

  // Actions
  setScreen: (screen: AppScreen) => void;
  setIsLocked: (locked: boolean) => void;
  setIsFirstRun: (first: boolean) => void;
  setItems: (items: Item[]) => void;
  addItem: (item: Item) => void;
  updateItem: (item: Item) => void;
  removeItem: (id: string) => void;
  setActiveCategory: (category: Category | 'all') => void;
  setSearchQuery: (query: string) => void;
  setFavoritesFirst: (value: boolean) => void;
  toggleFavorite: (id: string) => void;
  toggleReveal: (id: string) => void;
  toggleItemSelection: (id: string) => void;
  selectAllItems: () => void;
  clearSelection: () => void;
  setAutoLockTimer: (timer: AutoLockOption) => void;
  resetActivity: () => void;

  // Computed
  filteredItems: () => Item[];
}

export const useVaultStore = create<VaultState>((set, get) => ({
  // Auth
  screen: 'loading',
  isLocked: true,
  isFirstRun: false,

  // Data
  items: [],
  activeCategory: 'all',
  searchQuery: '',
  favoritesFirst: false,

  // UI
  isSearching: false,
  selectedItemIds: new Set(),
  revealedItemIds: new Set(),

  // Session
  autoLockTimer: 60,
  lastActivity: Date.now(),

  // Actions
  setScreen: (screen) => set({ screen }),
  setIsLocked: (locked) => set({ isLocked: locked }),
  setIsFirstRun: (first) => set({ isFirstRun: first }),
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
  setActiveCategory: (category) => set({ activeCategory: category, searchQuery: '' }),
  setSearchQuery: (query) => set({ searchQuery: query, isSearching: query.length > 0 }),
  setFavoritesFirst: (value) => set({ favoritesFirst: value }),
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
  resetActivity: () => set({ lastActivity: Date.now() }),

  // Computed
  filteredItems: () => {
    const { items, activeCategory, searchQuery, favoritesFirst } = get();
    let filtered = items;

    if (activeCategory !== 'all') {
      filtered = filtered.filter((item) => item.category === activeCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      // Parse category filter syntax: cat:api query
      const catMatch = query.match(/^cat:(\w+)\s+(.*)/);
      if (catMatch) {
        const catFilter = catMatch[1] as Category;
        const searchTerm = catMatch[2];
        filtered = filtered.filter(
          (item) =>
            item.category === catFilter &&
            item.name.toLowerCase().includes(searchTerm)
        );
      } else {
        filtered = filtered.filter((item) =>
          item.name.toLowerCase().includes(query)
        );
      }
    }

    if (favoritesFirst) {
      filtered.sort((a, b) => {
        if (a.favorite && !b.favorite) return -1;
        if (!a.favorite && b.favorite) return 1;
        return b.updatedAt - a.updatedAt;
      });
    } else {
      filtered.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    return filtered;
  },
}));
