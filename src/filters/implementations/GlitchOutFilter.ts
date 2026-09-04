import { BaseFilter } from '../types/FilterTypes';

export class GlitchOutFilter implements BaseFilter {
  public id = 'glitch_out';
  public displayName = 'Glitch Out';
  public description = 'Futuristic neon digital glitch with electric purple, magenta & blue horizontal displacements and fragmented outlines';
  public category = 'Artistic' as const;
  public version = '1.0.0';

  public apply(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), width, height);
    const outData = output.data;

    // Time-dependent irregular animation driver
    const now = Date.now();
    const time = now / 40;
    const frameSeed = Math.floor(now / 70); // Rapid, irregular digital signal switching

    // Pseudo-random hash helper for deterministic procedural noise
    const hash = (n: number) => {
      return (Math.sin(n * 12.9898 + frameSeed * 78.233) * 43758.5453123) % 1;
    };

    // 1. Grayscale luminance & Sobel edge detection pass for contour detection
    const gray = new Float32Array(width * height);
    const edges = new Float32Array(width * height);

    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }

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

    // 2. Pre-calculate horizontal glitch displacement bands (4px to 18px bands)
    const bandOffsets = new Int16Array(height);
    const bandGlitched = new Uint8Array(height);

    const bandHeight = Math.max(4, Math.floor(height / 35));
    for (let y = 0; y < height; y += bandHeight) {
      const bandIdx = Math.floor(y / bandHeight);
      const bandHash = Math.abs(hash(bandIdx * 17.3 + time * 0.1));

      if (bandHash > 0.62) {
        // Active horizontal displacement band
        const shiftDirection = bandHash > 0.81 ? 1 : -1;
        const shiftAmount = Math.round((bandHash * 22 + 4) * shiftDirection);

        for (let b = 0; b < bandHeight && y + b < height; b++) {
          bandOffsets[y + b] = shiftAmount;
          bandGlitched[y + b] = 1;
        }
      }
    }

    // 3. Main pixel processing pass
    for (let y = 0; y < height; y++) {
      const isScanline = y % 2 === 0;
      const offsetX = bandOffsets[y];
      const isBandGlitch = bandGlitched[y] === 1;

      for (let x = 0; x < width; x++) {
        const outIdx = (y * width + x) * 4;

        // Displaced sampling coordinate
        const sampledX = Math.min(width - 1, Math.max(0, x + offsetX));
        const sampleIdx = (y * width + sampledX) * 4;

        // RGB Chromatic offset: Red/Magenta shifted right, Blue/Cyan shifted left
        const chromaShift = isBandGlitch ? 10 : 3;
        const rx = Math.min(width - 1, Math.max(0, sampledX + chromaShift));
        const bx = Math.min(width - 1, Math.max(0, sampledX - chromaShift));

        const rIdx = (y * width + rx) * 4;
        const bIdx = (y * width + bx) * 4;

        let r = data[rIdx];
        let g = data[sampleIdx + 1];
        let b = data[bIdx + 2];

        // Edge contour highlight: Fragmented neon cyan & magenta outlines
        const edge = edges[y * width + sampledX];
        const isNeonEdge = edge > 40;

        // Micro block digital fragment check (16x8px blocks)
        const blockX = Math.floor(x / 16);
        const blockY = Math.floor(y / 8);
        const blockHash = Math.abs(hash(blockX * 3.1 + blockY * 7.7 + time * 0.3));
        const isBlockFragment = blockHash > 0.88;

        // Palette Injections: Electric Purple (#9D00FF), Magenta (#FF007F), Neon Blue (#0088FF)
        if (isBlockFragment) {
          // Fragment block color swap
          if (blockHash > 0.94) {
            // Electric Magenta
            r = Math.min(255, r + 160);
            g = Math.round(g * 0.2);
            b = Math.min(255, b + 180);
          } else {
            // Neon Cyan / Blue
            r = Math.round(r * 0.2);
            g = Math.min(255, g + 180);
            b = Math.min(255, b + 240);
          }
        } else if (isNeonEdge) {
          // Fragmented outline glitch accent
          if ((x + y) % 2 === 0) {
            // Neon Magenta
            r = 255;
            g = 20;
            b = 180;
          } else {
            // Electric Cyan
            r = 0;
            g = 230;
            b = 255;
          }
        } else if (isBandGlitch) {
          // Displaced interior band: Inject electric purple / magenta pop while preserving face details
          r = Math.min(255, Math.round(r * 1.1 + 45));
          g = Math.round(g * 0.75);
          b = Math.min(255, Math.round(b * 1.25 + 65));
        } else {
          // Base vibrant futuristic gaming tone: Subtle electric purple tint in midtones
          r = Math.min(255, Math.round(r * 1.05 + 10));
          g = Math.round(g * 0.92);
          b = Math.min(255, Math.round(b * 1.15 + 20));
        }

        // Apply 2px scanline texture
        if (isScanline) {
          r = Math.round(r * 0.88);
          g = Math.round(g * 0.88);
          b = Math.round(b * 0.88);
        }

        outData[outIdx]     = r;
        outData[outIdx + 1] = g;
        outData[outIdx + 2] = b;
        outData[outIdx + 3] = 255;
      }
    }

    return output;
  }
}
