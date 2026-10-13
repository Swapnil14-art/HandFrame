import { BaseFilter } from '../types/FilterTypes';

export class FilmGrainFilter implements BaseFilter {
  readonly id = 'film_grain';
  readonly displayName = 'Film Grain';
  readonly description = 'Analog monochrome film grain texture with boosted midtone contrast.';
  readonly category = 'Film' as const;
  readonly version = '1.0.0';

  /**
   * Emulates analog 35mm silver-halide film stock:
   * 1. Converts input to perceptual black-and-white luminance.
   * 2. Adds dynamic uniform noise (in range [-30, +30]) to simulate optical film grain particles.
   * 3. Clamps result into [0, 255].
   */
  apply(imageData: ImageData): ImageData {
    const data = imageData.data;
    const len = data.length;

    for (let i = 0; i < len; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Convert to monochrome luminance (BT.601 standard)
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // Add high-frequency random noise (-30 to +30)
      const noise = (Math.random() - 0.5) * 60;
      const grainVal = Math.min(255, Math.max(0, lum + noise));

      data[i] = grainVal;
      data[i + 1] = grainVal;
      data[i + 2] = grainVal;
    }

    return imageData;
  }
}
