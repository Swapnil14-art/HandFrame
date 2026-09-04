export type FilterCategory = 
  | 'Basic' 
  | 'Cinematic' 
  | 'Film' 
  | 'Retro' 
  | 'Dreamy' 
  | 'Artistic' 
  | 'Monochrome'
  | 'Custom';

export type FilterType = 'EXISTING_BUILT_IN' | 'COLOR_MATRIX' | 'CONVOLUTION';

export interface FilterMetadata {
  id: string;
  displayName: string;
  description: string;
  category: FilterCategory;
  version: string;
  author?: string;
  filterType?: FilterType;
}

export interface BaseFilter extends FilterMetadata {
  /**
   * Applies the visual filter to a cropped ImageData sub-region.
   * @param imageData HTML5 Canvas ImageData containing the quadrilateral bounding box.
   * @returns Processed ImageData object of identical dimensions.
   */
  apply(imageData: ImageData): ImageData;
}
