import { BaseFilter } from '../filters/types/FilterTypes';
import { FilterRegistry } from '../filters/registry/FilterRegistry';

export class FilterSessionStore {
  private static instance: FilterSessionStore;
  private registry = FilterRegistry.getInstance();

  // Active filter IDs in the order they cycle
  private activeFilterIds: string[] = [];
  
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
   * Discards any temporary session modifications.
   */
  public resetToDefaults(): void {
    this.activeFilterIds = this.registry.getDefaultFilterIds();
    this.currentIndex = 0;
    this.notifyListeners();
  }

  /**
   * Gets list of all registered built-in filters.
   */
  public getAllBuiltInFilters(): BaseFilter[] {
    return this.registry.getAllFilters();
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
      // Fallback to original
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
   * Temporarily enables or disables a built-in filter for the local session.
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
   * Temporarily reorders active filter list for the local session.
   */
  public reorderFilters(newOrderIds: string[]): void {
    // Ensure all IDs exist in registry
    const valid = newOrderIds.filter((id) => this.registry.getFilter(id) !== undefined);
    if (valid.length > 0) {
      const currentId = this.activeFilterIds[this.currentIndex];
      this.activeFilterIds = valid;

      const newIdx = this.activeFilterIds.indexOf(currentId);
      this.currentIndex = newIdx !== -1 ? newIdx : 0;
      this.notifyListeners();
    }
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
