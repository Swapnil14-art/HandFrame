import { BaseFilter } from '../filters/types/FilterTypes';
import { FilterRegistry } from '../filters/registry/FilterRegistry';

export class FilterSessionStore {
  private static instance: FilterSessionStore;
  private registry = FilterRegistry.getInstance();

  // Active filter IDs in the order they cycle
  private activeFilterIds: string[] = [];

  // Temporary session-only custom filter IDs
  private customFilterIds: string[] = [];
  
  // Current selected index
  private currentIndex: number = 0;

  // Event listeners for UI updates
  private listeners: Set<() => void> = new Set();

  private constructor() {
    this.resetToDefaults();
  }

  public static getInstance(): FilterSessionStore {
    if (!FilterSessionStore.instance) {
      FilterSessionStore.instance = new FilterSessionStore();
    }
    return FilterSessionStore.instance;
  }

  /**
   * Resets active filter cycle to default built-in filters order.
   * Discards any temporary session modifications and custom filters.
   */
  public resetToDefaults(): void {
    // Unregister all custom filters from registry
    this.customFilterIds.forEach((id) => this.registry.unregisterFilter(id));
    this.customFilterIds = [];
    this.activeFilterIds = this.registry.getDefaultFilterIds();
    this.currentIndex = 0;
    this.notifyListeners();
  }

  /**
   * Gets list of all registered built-in filters.
   */
  public getAllBuiltInFilters(): BaseFilter[] {
    return this.registry.getAllFilters().filter((f) => f.category !== 'Custom');
  }

  /**
   * Gets list of all temporary custom filters in this session.
   */
  public getCustomFilters(): BaseFilter[] {
    const list: BaseFilter[] = [];
    for (const id of this.customFilterIds) {
      const f = this.registry.getFilter(id);
      if (f) list.push(f);
    }
    return list;
  }

  /**
   * Adds a newly created custom filter to the temporary session.
   */
  public addCustomFilter(filter: BaseFilter): void {
    this.registry.registerFilter(filter);
    if (!this.customFilterIds.includes(filter.id)) {
      this.customFilterIds.push(filter.id);
    }
    // Automatically enable in active cycle when created
    if (!this.activeFilterIds.includes(filter.id)) {
      this.activeFilterIds.push(filter.id);
    }
    this.notifyListeners();
  }

  /**
   * Deletes a temporary custom filter from the session.
   */
  public deleteCustomFilter(id: string): void {
    this.customFilterIds = this.customFilterIds.filter((fId) => fId !== id);
    this.activeFilterIds = this.activeFilterIds.filter((fId) => fId !== id);
    this.registry.unregisterFilter(id);

    if (this.currentIndex >= this.activeFilterIds.length) {
      this.currentIndex = 0;
    }
    this.notifyListeners();
  }

  /**
   * Gets list of active filter modules in cycle order.
   */
  public getActiveFilters(): BaseFilter[] {
    const filters: BaseFilter[] = [];
    for (const id of this.activeFilterIds) {
      const f = this.registry.getFilter(id);
      if (f) filters.push(f);
    }
    return filters;
  }

  /**
   * Gets active filter IDs array.
   */
  public getActiveFilterIds(): string[] {
    return [...this.activeFilterIds];
  }

  /**
   * Gets current active filter instance.
   */
  public getCurrentFilter(): BaseFilter {
    if (this.activeFilterIds.length === 0) {
      return this.registry.getFilter('original') || this.registry.getAllFilters()[0];
    }

    const safeIndex = this.currentIndex % this.activeFilterIds.length;
    const currentId = this.activeFilterIds[safeIndex];
    return this.registry.getFilter(currentId) || this.registry.getAllFilters()[0];
  }

  /**
   * Advances to next enabled filter in active cycle.
   */
  public nextFilter(): BaseFilter {
    if (this.activeFilterIds.length <= 1) {
      return this.getCurrentFilter();
    }

    this.currentIndex = (this.currentIndex + 1) % this.activeFilterIds.length;
    this.notifyListeners();
    return this.getCurrentFilter();
  }

  /**
   * Selects a filter by ID directly if present in active list.
   */
  public selectFilterById(id: string): void {
    const idx = this.activeFilterIds.indexOf(id);
    if (idx !== -1) {
      this.currentIndex = idx;
      this.notifyListeners();
    }
  }

  /**
   * Temporarily enables or disables a filter for the local session.
   */
  public toggleFilter(id: string): void {
    const filter = this.registry.getFilter(id);
    if (!filter) return;

    const idx = this.activeFilterIds.indexOf(id);
    if (idx !== -1) {
      // Remove if more than 1 active
      if (this.activeFilterIds.length > 1) {
        this.activeFilterIds.splice(idx, 1);
        if (this.currentIndex >= this.activeFilterIds.length) {
          this.currentIndex = 0;
        }
      }
    } else {
      // Add filter
      this.activeFilterIds.push(id);
    }

    this.notifyListeners();
  }

  /**
   * Checks if a filter ID is currently active in session.
   */
  public isFilterActive(id: string): boolean {
    return this.activeFilterIds.includes(id);
  }

  /**
   * Move filter up in order
   */
  public moveFilterUp(id: string): void {
    const idx = this.activeFilterIds.indexOf(id);
    if (idx > 0) {
      const temp = this.activeFilterIds[idx];
      this.activeFilterIds[idx] = this.activeFilterIds[idx - 1];
      this.activeFilterIds[idx - 1] = temp;
      this.notifyListeners();
    }
  }

  /**
   * Move filter down in order
   */
  public moveFilterDown(id: string): void {
    const idx = this.activeFilterIds.indexOf(id);
    if (idx >= 0 && idx < this.activeFilterIds.length - 1) {
      const temp = this.activeFilterIds[idx];
      this.activeFilterIds[idx] = this.activeFilterIds[idx + 1];
      this.activeFilterIds[idx + 1] = temp;
      this.notifyListeners();
    }
  }

  /**
   * Subscribe to state changes.
   */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((fn) => fn());
  }
}
