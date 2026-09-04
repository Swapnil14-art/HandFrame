import { BaseFilter } from '../types/FilterTypes';

export class SpiderVerseFilter implements BaseFilter {
  public id = 'spider_verse';
  public displayName = 'Spider-Verse';
  public description = 'Comic-book visual style with chromatic separation, halftone dots, and bold ink outlines';
  public category = 'Artistic' as const;
  public version = '1.0.0';

  public apply(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), width, height);
    const outData = output.data;

    // 1. Convert to luminance buffer for Sobel edge detection & halftone calculation
    const gray = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }

    const chromaticOffset = 5; // 5px RGB chromatic registration offset

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const outIdx = (y * width + x) * 4;

        // Chromatic sampling (Red shifted right, Blue/Cyan shifted left)
        const rx = Math.min(width - 1, Math.max(0, x + chromaticOffset));
        const bx = Math.min(width - 1, Math.max(0, x - chromaticOffset));

        const rIdx = (y * width + rx) * 4;
        const bIdx = (y * width + bx) * 4;

        let r = data[rIdx];
        let g = data[outIdx + 1];
        let b = data[bIdx + 2];

        const lum = gray[y * width + x];

        // Comic-book 4x4 halftone dot screen pattern
        const dotX = x % 4;
        const dotY = y % 4;
        const isDotCenter = (dotX === 1 || dotX === 2) && (dotY === 1 || dotY === 2);
        if (isDotCenter && lum < 140) {
          // Darken shadow dots for CMYK print texture
          r = Math.round(r * 0.75);
          g = Math.round(g * 0.75);
          b = Math.round(b * 0.75);
        }

        // Posterize colors to 5 vibrant comic book levels
        r = Math.floor(r / 51) * 51;
        g = Math.floor(g / 51) * 51;
        b = Math.floor(b / 51) * 51;

        // Sobel Ink Outline calculation
        let edge = 0;
        if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
          const gx = -gray[(y - 1) * width + (x - 1)] + gray[(y - 1) * width + (x + 1)] -
                     2 * gray[y * width + (x - 1)] + 2 * gray[y * width + (x + 1)] -
                     gray[(y + 1) * width + (x - 1)] + gray[(y + 1) * width + (x + 1)];

          const gy = -gray[(y - 1) * width + (x - 1)] - 2 * gray[(y - 1) * width + x] - gray[(y - 1) * width + (x + 1)] +
                     gray[(y + 1) * width + (x - 1)] + 2 * gray[(y + 1) * width + x] + gray[(y + 1) * width + (x + 1)];

          edge = Math.sqrt(gx * gx + gy * gy);
        }

        if (edge > 45) {
          // Bold black ink line
          outData[outIdx]     = 10;
          outData[outIdx + 1] = 10;
          outData[outIdx + 2] = 20;
        } else {
          // Vibrant Spider-Verse comic tone
          outData[outIdx]     = Math.min(255, r + 20);
          outData[outIdx + 1] = Math.min(255, g + 10);
          outData[outIdx + 2] = Math.min(255, b + 30);
        }
      }
    }

    return output;
  }
}
