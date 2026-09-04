import { BaseFilter } from '../types/FilterTypes';

export class GrayscaleFilter implements BaseFilter {
  readonly id = 'grayscale';
  readonly displayName = 'Grayscale';
  readonly description = 'Classic monochrome black-and-white high contrast conversion.';
  readonly category = 'Monochrome' as const;
  readonly version = '1.0.0';

  apply(imageData: ImageData): ImageData {
    const data = imageData.data;
    const len = data.length;

    for (let i = 0; i < len; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = lum;
      data[i + 1] = lum;
      data[i + 2] = lum;
    }

    return imageData;
  }
}
