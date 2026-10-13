import { describe, it, expect, beforeEach } from 'vitest';
import { useVaultStore } from '../renderer/stores/vault-store';
import type { Item, Project, SortOption, Category } from '../renderer/types';

const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: 'id',
  name: 'Item',
  value: 'value',
  publicKey: '',
  description: '',
  category: 'api',
  tags: [],
  projectId: '',
  rotationDueAt: 0,
  rotationIntervalDays: 0,
  rotationUrl: '',
  favorite: false,
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: 'project',
  name: 'Projeto',
  color: '',
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
});

interface StateOverrides {
  searchQuery?: string;
  activeCategory?: Category | 'all';
  activeProjectId?: string;
  projects?: Project[];
  favoritesFirst?: boolean;
  sortOption?: SortOption;
}

const setItems = (items: Item[], state: StateOverrides = {}) => {
  useVaultStore.setState({
    items,
    projects: [],
    activeProjectId: 'all',
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
      projects: [],
      activeProjectId: 'all',
      activeCategory: 'all',
      searchQuery: '',
      favoritesFirst: false,
      sortOption: 'recent',
      selectedItemIds: new Set(),
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

  describe('project filter', () => {
    it('filters items by active project scope', () => {
      setItems(
        [makeItem({ id: 'a', projectId: 'p1' }), makeItem({ id: 'b', projectId: '' })],
        { activeProjectId: 'p1' }
      );
      expect(ids()).toEqual(['a']);

      useVaultStore.setState({ activeProjectId: 'none' });
      expect(ids()).toEqual(['b']);

      useVaultStore.setState({ activeProjectId: 'all' });
      expect(ids().sort()).toEqual(['a', 'b']);
    });

    it('filters by proj: token matching the project name', () => {
      setItems(
        [
          makeItem({ id: 'cf', projectId: 'p1' }),
          makeItem({ id: 'gg', projectId: 'p2' }),
          makeItem({ id: 'unassigned' }),
        ],
        {
          searchQuery: 'proj:cloud',
          projects: [
            makeProject({ id: 'p1', name: 'Cloudflare' }),
            makeProject({ id: 'p2', name: 'Google' }),
          ],
        }
      );
      expect(ids()).toEqual(['cf']);

      useVaultStore.setState({ searchQuery: 'proj:none' });
      expect(ids()).toEqual(['unassigned']);

      useVaultStore.setState({ searchQuery: 'proj:unknown' });
      expect(ids()).toEqual([]);
    });

    it('moveProjectItems updates items and clears selection', () => {
      setItems([makeItem({ id: 'a' }), makeItem({ id: 'b' })], {
        projects: [makeProject({ id: 'p1' })],
      });
      useVaultStore.setState({ selectedItemIds: new Set(['a']) });

      useVaultStore.getState().moveProjectItems(['a'], 'p1');
      const state = useVaultStore.getState();
      expect(state.items.find((i) => i.id === 'a')?.projectId).toBe('p1');
      expect(state.items.find((i) => i.id === 'b')?.projectId).toBe('');
      expect(state.selectedItemIds.size).toBe(0);

      useVaultStore.getState().moveProjectItems(['a'], 'unknown');
      expect(useVaultStore.getState().items.find((i) => i.id === 'a')?.projectId).toBe('');
    });

    it('setActiveProject clears the search query', () => {
      setItems([], { searchQuery: 'stripe' });
      useVaultStore.getState().setActiveProject('none');
      expect(useVaultStore.getState().searchQuery).toBe('');
      expect(useVaultStore.getState().activeProjectId).toBe('none');
    });
  });

  describe('rotation filter', () => {
    it('filters by the is:due token (overdue rotation only)', () => {
      setItems([
        makeItem({ id: 'due', rotationDueAt: Date.now() - 1000 }),
        makeItem({ id: 'future', rotationDueAt: Date.now() + 100000 }),
        makeItem({ id: 'none', rotationDueAt: 0 }),
      ]);
      useVaultStore.setState({ searchQuery: 'is:due' });
      expect(ids()).toEqual(['due']);
    });
  });
});
