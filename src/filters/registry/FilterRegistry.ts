import { BaseFilter } from '../types/FilterTypes';
import { createDefaultFilters } from '../presets/DefaultFilters';

export class FilterRegistry {
  private static instance: FilterRegistry;
  private registeredFilters: Map<string, BaseFilter> = new Map();

  private constructor() {
    // Populate default built-in filters
    const defaults = createDefaultFilters();
    defaults.forEach((f) => this.registeredFilters.set(f.id, f));
  }

  public static getInstance(): FilterRegistry {
    if (!FilterRegistry.instance) {
      FilterRegistry.instance = new FilterRegistry();
    }
    return FilterRegistry.instance;
  }

  /**
   * Registers a built-in filter module.
   */
  public registerFilter(filter: BaseFilter): void {
    this.registeredFilters.set(filter.id, filter);
  }

  /**
   * Gets a registered filter by unique ID.
   */
  public getFilter(id: string): BaseFilter | undefined {
    return this.registeredFilters.get(id);
  }

  /**
   * Gets all registered built-in filters in default order.
   */
  public getAllFilters(): BaseFilter[] {
    return Array.from(this.registeredFilters.values());
  }

  /**
   * Returns default filter IDs array.
   */
  public getDefaultFilterIds(): string[] {
    return Array.from(this.registeredFilters.keys());
  }
}
