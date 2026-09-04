import { BaseFilter } from '../types/FilterTypes';

export class CinematicFilter implements BaseFilter {
  readonly id = 'cinematic';
  readonly displayName = 'Cinematic';
  readonly description = 'Classic Hollywood teal and orange color grade with rich shadow depth.';
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

      if (lum < 128) {
        // Shadows -> Teal shift (boost Blue & Green, lower Red)
        r = Math.max(0, r * 0.8);
        g = Math.min(255, g * 1.1 + 10);
        b = Math.min(255, b * 1.3 + 20);
      } else {
        // Highlights -> Orange shift (boost Red & Green, lower Blue)
        r = Math.min(255, r * 1.2 + 15);
        g = Math.min(255, g * 1.05 + 5);
        b = Math.max(0, b * 0.75);
      }

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }

    return imageData;
  }
}
