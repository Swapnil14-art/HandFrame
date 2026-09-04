import { BaseFilter } from '../types/FilterTypes';

export class PixelateFilter implements BaseFilter {
  readonly id = 'pixelate';
  readonly displayName = 'Pixelated';
  readonly description = 'Retro 8-bit block quantization pixel effect.';
  readonly category = 'Artistic' as const;
  readonly version = '1.0.0';

  apply(imageData: ImageData): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    const blockSize = 8;

    for (let y = 0; y < height; y += blockSize) {
      for (let x = 0; x < width; x += blockSize) {
        const centerIdx = (Math.min(height - 1, y + Math.floor(blockSize / 2)) * width + Math.min(width - 1, x + Math.floor(blockSize / 2))) * 4;

        const r = data[centerIdx];
        const g = data[centerIdx + 1];
        const b = data[centerIdx + 2];

        // Fill block
        for (let by = 0; by < blockSize && (y + by) < height; by++) {
          for (let bx = 0; bx < blockSize && (x + bx) < width; bx++) {
            const idx = ((y + by) * width + (x + bx)) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
          }
        }
      }
    }

    return imageData;
  }
}
