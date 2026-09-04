import { BaseFilter } from '../types/FilterTypes';

export class AnimeRageFilter implements BaseFilter {
  public id = 'anime_rage';
  public displayName = 'Anime Rage';
  public description = 'Dark dramatic anime rage frame with bright white eye linework and flickering aura energy lines';
  public category = 'Artistic' as const;
  public version = '1.0.0';

  public apply(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), width, height);
    const outData = output.data;

    // Time-dependent flicker for procedural anime energy lines
    const time = Date.now() / 40;

    // Convert to luminance buffer
    const gray = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const outIdx = (y * width + x) * 4;
        const lum = gray[y * width + x];

        // Sobel edge detection for eyes, facial contours, and fingers
        const gx = -gray[(y - 1) * width + (x - 1)] + gray[(y - 1) * width + (x + 1)] -
                   2 * gray[y * width + (x - 1)] + 2 * gray[y * width + (x + 1)] -
                   gray[(y + 1) * width + (x - 1)] + gray[(y + 1) * width + (x + 1)];

        const gy = -gray[(y - 1) * width + (x - 1)] - 2 * gray[(y - 1) * width + x] - gray[(y - 1) * width + (x + 1)] +
                   gray[(y + 1) * width + (x - 1)] + 2 * gray[(y + 1) * width + x] + gray[(y + 1) * width + (x + 1)];

        const edgeMag = Math.sqrt(gx * gx + gy * gy);

        // Procedural flickering anime energy streak lines around strong edges
        const wave = Math.sin((x * 0.12 + y * 0.18 + time)) * Math.cos((y * 0.15 - x * 0.1 + time * 0.8));
        const isEnergySpark = edgeMag > 35 && wave > 0.65;

        // Dark dramatic manga base backdrop preserving facial features
        let r = Math.round(data[outIdx] * 0.22);
        let g = Math.round(data[outIdx + 1] * 0.22);
        let b = Math.round(data[outIdx + 2] * 0.28);

        if (edgeMag > 55 || isEnergySpark) {
          // Bright white / electric cyan eye & energy linework
          r = 245;
          g = 250;
          b = 255;
        } else if (lum > 170) {
          // Highlight contrast
          r = Math.min(255, r + 40);
          g = Math.min(255, g + 40);
          b = Math.min(255, b + 60);
        }

        outData[outIdx]     = r;
        outData[outIdx + 1] = g;
        outData[outIdx + 2] = b;
      }
    }

    return output;
  }
}
