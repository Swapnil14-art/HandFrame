import { BaseFilter } from '../types/FilterTypes';

export class Y2kDigicamFilter implements BaseFilter {
  readonly id = 'y2k_digicam';
  readonly displayName = 'Y2K / Digicam';
  readonly description = 'Early 2000s compact digital camera aesthetic with high contrast and sharp flash.';
  readonly category = 'Retro' as const;
  readonly version = '1.0.0';

  apply(imageData: ImageData): ImageData {
    const data = imageData.data;
    const len = data.length;

    for (let i = 0; i < len; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Punchy saturation and high contrast flash
      r = Math.min(255, Math.max(0, (r - 128) * 1.35 + 138));
      g = Math.min(255, Math.max(0, (g - 128) * 1.3 + 135));
      b = Math.min(255, Math.max(0, (b - 128) * 1.25 + 130));

      // Slight cyan highlight clipping
      if (r > 220) r = 255;
      if (g > 220) g = 255;

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }

    return imageData;
  }
}
