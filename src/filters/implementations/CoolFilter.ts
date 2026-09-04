import { BaseFilter } from '../types/FilterTypes';

export class CoolFilter implements BaseFilter {
  readonly id = 'cool';
  readonly displayName = 'Cool';
  readonly description = 'Crisp cyan/blue cast with elevated shadow clarity and fresh highlights.';
  readonly category = 'Artistic' as const;
  readonly version = '1.0.0';

  apply(imageData: ImageData): ImageData {
    const data = imageData.data;
    const len = data.length;

    for (let i = 0; i < len; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      r = Math.max(0, r * 0.85 - 10);
      g = Math.min(255, g * 1.05 + 5);
      b = Math.min(255, b * 1.2 + 15);

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }

    return imageData;
  }
}
