import { BaseFilter } from '../types/FilterTypes';

export class VintageFilmFilter implements BaseFilter {
  readonly id = 'vintage_film';
  readonly displayName = 'Vintage Film';
  readonly description = 'Lifted blacks, matte contrast, soft magenta/amber shadows, and retro film vibe.';
  readonly category = 'Film' as const;
  readonly version = '1.0.0';

  apply(imageData: ImageData): ImageData {
    const data = imageData.data;
    const len = data.length;

    for (let i = 0; i < len; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Lift blacks (fade shadows)
      r = r * 0.8 + 35;
      g = g * 0.75 + 25;
      b = b * 0.7 + 45;

      // Soft warm highlight tone
      if (r > 150) r = Math.min(255, r * 1.05);
      if (b > 150) b = Math.max(0, b * 0.9);

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }

    return imageData;
  }
}
