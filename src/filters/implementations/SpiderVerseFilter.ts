import { BaseFilter } from '../types/FilterTypes';

export class SpiderVerseFilter implements BaseFilter {
  public id = 'spider_verse';
  public displayName = 'Spider-Verse';
  public description = 'Vibrant comic-animation style with controlled registration RGB split, thin ink outlines, and subtle micro honeycomb texture';
  public category = 'Artistic' as const;
  public version = '2.0.0';

  public apply(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), width, height);
    const outData = output.data;

    // 1. Compute grayscale luminance buffer & Sobel edge buffer
    const gray = new Float32Array(width * height);
    const edges = new Float32Array(width * height);

    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }

    // Sobel edge detection pass for clean, thin ink outlines & registration alignment
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;

        const gx =
          -gray[(y - 1) * width + (x - 1)] + gray[(y - 1) * width + (x + 1)] -
          2 * gray[y * width + (x - 1)] + 2 * gray[y * width + (x + 1)] -
          gray[(y + 1) * width + (x - 1)] + gray[(y + 1) * width + (x + 1)];

        const gy =
          -gray[(y - 1) * width + (x - 1)] - 2 * gray[(y - 1) * width + x] - gray[(y - 1) * width + (x + 1)] +
          gray[(y + 1) * width + (x - 1)] + 2 * gray[(y + 1) * width + x] + gray[(y + 1) * width + (x + 1)];

        edges[idx] = Math.sqrt(gx * gx + gy * gy);
      }
    }

    const chromaticOffset = 2; // Restrained 2px registration offset around edges

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const outIdx = (y * width + x) * 4;
        const edge = edges[y * width + x];
        const lum = gray[y * width + x];

        // 2. Controlled Comic-Print Registration Misalignment (RGB split on/near edges only)
        let origR = data[outIdx];
        let origG = data[outIdx + 1];
        let origB = data[outIdx + 2];

        if (edge > 25) {
          const rx = Math.min(width - 1, Math.max(0, x + chromaticOffset));
          const bx = Math.min(width - 1, Math.max(0, x - chromaticOffset));
          const rIdx = (y * width + rx) * 4;
          const bIdx = (y * width + bx) * 4;

          origR = data[rIdx];
          origB = data[bIdx + 2];
        }

        // 3. Vibrant Spider-Verse Color Grading & Saturation Boost
        // Saturation amplification (1.45x)
        let rSat = lum + 1.45 * (origR - lum);
        let gSat = lum + 1.35 * (origG - lum);
        let bSat = lum + 1.50 * (origB - lum);

        // Spider-Verse signature palette tinting: Deep blues/purples in shadows, vivid crimson in midtones, cyan accents in highlights
        if (lum < 100) {
          // Deep Spider-Man suit blue/purple shadow depth
          rSat = rSat * 0.90 + 12;
          gSat = gSat * 0.85 + 5;
          bSat = bSat * 1.10 + 25;
        } else if (lum < 200) {
          // Punchy comic midtone crimson & warm skin pop
          rSat = rSat * 1.12 + 15;
          gSat = gSat * 1.02;
          bSat = bSat * 0.95;
        } else {
          // High-tech Spider-Verse electric cyan / white highlights
          rSat = rSat * 1.05;
          gSat = gSat * 1.08 + 10;
          bSat = bSat * 1.12 + 15;
        }

        // Stylized 8-level comic color quantization (smooth 3D animation feel)
        let r = Math.min(255, Math.max(0, Math.floor(rSat / 32) * 32 + 16));
        let g = Math.min(255, Math.max(0, Math.floor(gSat / 32) * 32 + 16));
        let b = Math.min(255, Math.max(0, Math.floor(bSat / 32) * 32 + 16));

        // 4. Subtle Micro Honeycomb / Halftone Grid (3px cell size, 12% opacity blend)
        const hx = x % 3;
        const hy = y % 3;
        const isHexGridBorder = (hx === 0 && hy === 0) || (hx === 1 && hy === 2);

        if (isHexGridBorder && lum < 170) {
          // Micro CMYK print texture
          r = Math.round(r * 0.88);
          g = Math.round(g * 0.88);
          b = Math.round(b * 0.92 + 8);
        }

        // 5. Restrained, Clean Thin Ink Outlines (integrated naturally)
        if (edge > 65) {
          // Thin dark ink line integrated with underlying tone
          outData[outIdx]     = Math.round(r * 0.20 + 10);
          outData[outIdx + 1] = Math.round(g * 0.20 + 10);
          outData[outIdx + 2] = Math.round(b * 0.25 + 20);
          outData[outIdx + 3] = 255;
        } else {
          // Rich Spider-Verse comic tone
          outData[outIdx]     = r;
          outData[outIdx + 1] = g;
          outData[outIdx + 2] = b;
          outData[outIdx + 3] = 255;
        }
      }
    }

    return output;
  }
}
