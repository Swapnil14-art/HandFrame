import { BaseFilter } from '../types/FilterTypes';

export class MoodyFilter implements BaseFilter {
  readonly id = 'moody';
  readonly displayName = 'Moody';
  readonly description = 'High contrast with deep, desaturated shadows and rich atmospheric tones.';
  readonly category = 'Cinematic' as const;
  readonly version = '1.0.0';

  apply(imageData: ImageData): ImageData {
    const data = imageData.data;
    const len = data.length;

    for (let i = 0; i < len; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Luminance
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // Desaturate slightly
      r = r * 0.7 + lum * 0.3;
      g = g * 0.7 + lum * 0.3;
      b = b * 0.75 + lum * 0.25;

      // Contrast S-curve boost
      r = Math.min(255, Math.max(0, (r - 128) * 1.3 + 120));
      g = Math.min(255, Math.max(0, (g - 128) * 1.3 + 120));
      b = Math.min(255, Math.max(0, (b - 128) * 1.35 + 130)); // Cool shadows

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }

    return imageData;
  }
}
