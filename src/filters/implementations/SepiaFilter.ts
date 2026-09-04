import { BaseFilter } from '../types/FilterTypes';

export class SepiaFilter implements BaseFilter {
  readonly id = 'sepia';
  readonly displayName = 'Sepia';
  readonly description = 'Warm antique brown monochrome tone evoking 19th-century photography.';
  readonly category = 'Monochrome' as const;
  readonly version = '1.0.0';

  apply(imageData: ImageData): ImageData {
    const data = imageData.data;
    const len = data.length;

    for (let i = 0; i < len; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const sepiaR = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b);
      const sepiaG = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b);
      const sepiaB = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b);

      data[i] = sepiaR;
      data[i + 1] = sepiaG;
      data[i + 2] = sepiaB;
    }

    return imageData;
  }
}
