import { BaseFilter } from '../types/FilterTypes';

export class VhsFilter implements BaseFilter {
  readonly id = 'vhs';
  readonly displayName = 'VHS';
  readonly description = 'Retro analog tape simulation with scanlines and RGB chromatic aberration.';
  readonly category = 'Retro' as const;
  readonly version = '1.0.0';

  apply(imageData: ImageData): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    // Chromatic aberration offset (shift Red channel left, Blue right)
    const offset = 4;
    const copy = new Uint8ClampedArray(data);

    for (let y = 0; y < height; y++) {
      const isScanline = (y % 4 === 0);

      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;

        // Shifted indices
        const rIdx = (y * width + Math.max(0, x - offset)) * 4;
        const bIdx = (y * width + Math.min(width - 1, x + offset)) * 4;

        let r = copy[rIdx];
        let g = copy[idx + 1];
        let b = copy[bIdx + 2];

        // Scanline darkening
        if (isScanline) {
          r *= 0.82;
          g *= 0.82;
          b *= 0.82;
        }

        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
      }
    }

    return imageData;
  }
}
