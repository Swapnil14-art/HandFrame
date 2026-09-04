import { BaseFilter } from '../types/FilterTypes';

export class WarmFilter implements BaseFilter {
  readonly id = 'warm';
  readonly displayName = 'Warm';
  readonly description = 'Golden hour tint boosting red and yellow tones with warm lifted midtones.';
  readonly category = 'Artistic' as const;
  readonly version = '1.0.0';

  apply(imageData: ImageData): ImageData {
    const data = imageData.data;
    const len = data.length;

    for (let i = 0; i < len; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Boost Red and Green, reduce Blue for warm golden glow
      r = Math.min(255, r * 1.15 + 15);
      g = Math.min(255, g * 1.05 + 8);
      b = Math.max(0, b * 0.85 - 10);

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }

    return imageData;
  }
}
