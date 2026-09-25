import { describe, it, expect, beforeEach } from 'vitest';
import { useVaultStore } from '../renderer/stores/vault-store';
import type { Item, SortOption, Category } from '../renderer/types';

const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: 'id',
  name: 'Item',
  value: 'value',
  publicKey: '',
  description: '',
  category: 'api',
  tags: [],
  favorite: false,
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

interface StateOverrides {
  searchQuery?: string;
  activeCategory?: Category | 'all';
  favoritesFirst?: boolean;
  sortOption?: SortOption;
}

const setItems = (items: Item[], state: StateOverrides = {}) => {
  useVaultStore.setState({
    items,
    activeCategory: 'all',
    searchQuery: '',
    favoritesFirst: false,
    sortOption: 'recent',
    ...state,
  });
};

const ids = () => useVaultStore.getState().filteredItems().map((i) => i.id);

describe('vault store filteredItems', () => {
  beforeEach(() => {
    useVaultStore.setState({
      items: [],
      activeCategory: 'all',
      searchQuery: '',
      favoritesFirst: false,
      sortOption: 'recent',
    });
  });

  describe('search syntax', () => {
    it('filters by cat: prefix', () => {
      setItems(
        [makeItem({ id: 'a', category: 'api' }), makeItem({ id: 'p', category: 'prompt' })],
        { searchQuery: 'cat:prompt' }
      );
      expect(ids()).toEqual(['p']);
    });

    it('filters by tag: prefix', () => {
      setItems([makeItem({ id: 'a', tags: ['prod'] }), makeItem({ id: 'b', tags: ['dev'] })], {
        searchQuery: 'tag:prod',
      });
      expect(ids()).toEqual(['a']);
    });

    it('filters by is:fav', () => {
      setItems([makeItem({ id: 'a', favorite: true }), makeItem({ id: 'b' })], {
        searchQuery: 'is:fav',
      });
      expect(ids()).toEqual(['a']);
    });

    it('filters by is:favorite', () => {
      setItems([makeItem({ id: 'a', favorite: true }), makeItem({ id: 'b' })], {
        searchQuery: 'is:favorite',
      });
      expect(ids()).toEqual(['a']);
    });

    it('matches name, description and tags for plain text', () => {
      setItems([
        makeItem({ id: 'name', name: 'Stripe Live' }),
        makeItem({ id: 'desc', description: 'conta principal' }),
        makeItem({ id: 'tag', tags: ['finance'] }),
      ]);

      useVaultStore.setState({ searchQuery: 'stripe' });
      expect(ids()).toEqual(['name']);
      useVaultStore.setState({ searchQuery: 'principal' });
      expect(ids()).toEqual(['desc']);
      useVaultStore.setState({ searchQuery: 'finance' });
      expect(ids()).toEqual(['tag']);
    });
  });

  describe('sorting', () => {
    it('sorts by name ascending and descending', () => {
      setItems([makeItem({ id: 'b', name: 'Beta' }), makeItem({ id: 'a', name: 'Alpha' })], {
        sortOption: 'name-asc',
      });
      expect(ids()).toEqual(['a', 'b']);
      useVaultStore.setState({ sortOption: 'name-desc' });
      expect(ids()).toEqual(['b', 'a']);
    });

    it('sorts by createdAt descending for recent', () => {
      setItems(
        [makeItem({ id: 'old', createdAt: 1000 }), makeItem({ id: 'new', createdAt: 2000 })],
        { sortOption: 'recent' }
      );
      expect(ids()).toEqual(['new', 'old']);
    });

    it('sorts by updatedAt descending for updated', () => {
      setItems(
        [makeItem({ id: 'old', updatedAt: 1000 }), makeItem({ id: 'new', updatedAt: 3000 })],
        { sortOption: 'updated' }
      );
      expect(ids()).toEqual(['new', 'old']);
    });

    it('prioritizes favorites when favoritesFirst is on', () => {
      setItems(
        [makeItem({ id: 'plain', createdAt: 3000 }), makeItem({ id: 'fav', favorite: true, createdAt: 1000 })],
        { favoritesFirst: true }
      );
      expect(ids()[0]).toBe('fav');
    });
  });

  describe('category filter', () => {
    it('filters items by active category', () => {
      setItems([makeItem({ id: 'a', category: 'api' }), makeItem({ id: 'l', category: 'link' })], {
        activeCategory: 'link',
      });
      expect(ids()).toEqual(['l']);
    });
  });
});
