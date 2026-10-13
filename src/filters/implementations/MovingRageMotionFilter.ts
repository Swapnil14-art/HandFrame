import { BaseFilter } from '../types/FilterTypes';

export class MovingRageMotionFilter implements BaseFilter {
  public id = 'moving_rage_motion';
  public displayName = 'Moving Rage Motion';
  public description = 'Anime Rage filter with an intense earthquake/shake effect applied to the white energy outlines and strokes';
  public category = 'Artistic' as const;
  public version = '1.0.0';

  public apply(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), width, height);
    const outData = output.data;

    // 1. Earthquake Screen Shake Simulation:
    // Uses combined multi-frequency harmonic sines & cosines to generate natural, non-repetitive camera rumble
    const now = Date.now();
    const t = now / 35;
    const shakeTime = now / 18;

    // Linear translation shake offsets (dx, dy)
    const dx = Math.sin(shakeTime * 0.83) * 4.8 + Math.cos(shakeTime * 1.57) * 2.6;
    const dy = Math.cos(shakeTime * 0.91) * 4.8 + Math.sin(shakeTime * 1.41) * 2.6;

    // Center coordinates for rotational jitter around image center
    const cx = width / 2;
    const cy = height / 2;
    // Tiny angular shake (~1.4 degrees)
    const angleJitter = Math.sin(shakeTime * 0.45) * 0.024;
    const cosA = Math.cos(angleJitter);
    const sinA = Math.sin(angleJitter);

    // 1. Compute grayscale luminance buffer & edge magnitude buffer
    const gray = new Float32Array(width * height);
    const edges = new Float32Array(width * height);

    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }

    // Sobel edge detection pass for facial features & subject silhouette
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

    // 2. High-contrast render pass: Pitch Black subject + Shaking White anime energy lines
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const outIdx = (y * width + x) * 4;

        // Apply minute rotational & translation earthquake jitter to outline sampling position
        const rx = x - cx;
        const ry = y - cy;
        const rotX = rx * cosA - ry * sinA + cx;
        const rotY = rx * sinA + ry * cosA + cy;

        const jx = Math.min(width - 1, Math.max(0, Math.round(rotX - dx)));
        const jy = Math.min(height - 1, Math.max(0, Math.round(rotY - dy)));

        const edge = edges[jy * width + jx];

        // 2. Procedural Anime Energy Turbulence:
        // Superimposes sinusoidal waveforms to synthesize fluid lightning / electric aura around edges
        const n1 = Math.sin(jx * 0.07 + t * 2.3 + Math.cos(jy * 0.04 - t * 1.7));
        const n2 = Math.cos(jy * 0.09 - t * 2.9 + Math.sin(jx * 0.05 + t * 1.3));
        const n3 = Math.sin((jx + jy) * 0.12 - t * 3.5);
        const energyFlow = n1 * n2 + n3 * 0.5;

        // Energy aura expands outward from structural edge contours
        const isNearEdge = edge > 22;
        const isStrongEdge = edge > 42; // Eyes, nose, mouth, fingers, jawline, clothing contours

        // White energy stroke condition: near edges + turbulent noise threshold
        const isEnergyStroke = isNearEdge && energyFlow > 0.38;

        if (isStrongEdge || isEnergyStroke) {
          // Pure White high-contrast anime stroke (shaking around anchor)
          outData[outIdx]     = 255;
          outData[outIdx + 1] = 255;
          outData[outIdx + 2] = 255;
          outData[outIdx + 3] = 255;
        } else {
          // Pitch Black background and subject body
          outData[outIdx]     = 5;
          outData[outIdx + 1] = 5;
          outData[outIdx + 2] = 8;
          outData[outIdx + 3] = 255;
        }
      }
    }

    return output;
  }
}
