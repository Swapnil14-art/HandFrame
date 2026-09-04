import { BaseFilter } from '../types/FilterTypes';

export class OriginalFilter implements BaseFilter {
  readonly id = 'original';
  readonly displayName = 'Original';
  readonly description = 'Clean camera pass-through baseline without modification.';
  readonly category = 'Basic' as const;
  readonly version = '1.0.0';

  apply(imageData: ImageData): ImageData {
    // Original returns data untouched
    return imageData;
  }
}
