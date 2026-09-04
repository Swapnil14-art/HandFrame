import { BaseFilter } from '../types/FilterTypes';

export class NegativeFilter implements BaseFilter {
  readonly id = 'negative';
  readonly displayName = 'Negative';
  readonly description = 'Color inversion with striking negative edge contrasts.';
  readonly category = 'Artistic' as const;
  readonly version = '1.0.0';

  apply(imageData: ImageData): ImageData {
    const data = imageData.data;
    const len = data.length;

    for (let i = 0; i < len; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }

    return imageData;
  }
}
