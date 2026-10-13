import { BaseFilter } from '../types/FilterTypes';

export class PixelateFilter implements BaseFilter {
  readonly id = 'pixelate';
  readonly displayName = 'Pixelated';
  readonly description = 'Retro 8-bit block quantization pixel effect.';
  readonly category = 'Artistic' as const;
  readonly version = '1.0.0';

  /**
   * Spatial Mosaic Block Quantization (Pixelation):
   * Groups pixels into 8x8 squares. Samples the RGB color at the center of each block
   * and floods the entire 8x8 area with that single uniform color.
   */
  apply(imageData: ImageData): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    const blockSize = 8; // Pixel mosaic block dimension

    for (let y = 0; y < height; y += blockSize) {
      for (let x = 0; x < width; x += blockSize) {
        // Sample color from the geometric center of the 8x8 block
        const centerIdx = (Math.min(height - 1, y + Math.floor(blockSize / 2)) * width + Math.min(width - 1, x + Math.floor(blockSize / 2))) * 4;

        const r = data[centerIdx];
        const g = data[centerIdx + 1];
        const b = data[centerIdx + 2];

        // Flood-fill all pixels in this 8x8 block with the sampled color
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
