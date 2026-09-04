import { BaseFilter } from '../types/FilterTypes';

export class RetroFlashFilter implements BaseFilter {
  readonly id = 'retro_flash';
  readonly displayName = 'Retro Flash';
  readonly description = 'High-exposure vintage camera flash aesthetic with bright highlights.';
  readonly category = 'Retro' as const;
  readonly version = '1.0.0';

  apply(imageData: ImageData): ImageData {
    const data = imageData.data;
    const len = data.length;

    for (let i = 0; i < len; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Exposure boost + flash pop
      r = Math.min(255, r * 1.3 + 20);
      g = Math.min(255, g * 1.25 + 15);
      b = Math.min(255, b * 1.15 + 10);

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }

    return imageData;
  }
}
