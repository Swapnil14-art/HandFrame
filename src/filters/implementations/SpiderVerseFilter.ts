import { BaseFilter } from '../types/FilterTypes';

export class SpiderVerseFilter implements BaseFilter {
  public id = 'spider_verse';
  public displayName = 'Oil Painting';
  public description = 'Rich digital oil-paste painting aesthetic with visible brush-like color blending, vibrant depth, and preserved details';
  public category = 'Artistic' as const;
  public version = '3.0.0';

  public apply(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), width, height);
    const outData = output.data;

    // 1. Compute grayscale luminance buffer & Sobel edge buffer for subtle structural preservation
    const gray = new Float32Array(width * height);
    const edges = new Float32Array(width * height);

    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }

    // Sobel edge pass to find key structural contours (eyes, lips, high-contrast borders)
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

    // Radius for Kuwahara-like quadrant brush blending (radius 3 = 7x7 window)
    const radius = 3;
    const qCount = 4 * 4; // 16 pixels per quadrant in radius 3

    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        const outIdx = (y * width + x) * 4;
        const edge = edges[y * width + x];
        const lum = gray[y * width + x];

        // 2. Oil Painting Kuwahara-style Quadrant Filtering (Find lowest variance quadrant)
        // 4 Quadrants: Q0 (Top-Left), Q1 (Top-Right), Q2 (Bottom-Left), Q3 (Bottom-Right)
        let meanR0 = 0, meanG0 = 0, meanB0 = 0, sqR0 = 0, sqG0 = 0, sqB0 = 0;
        let meanR1 = 0, meanG1 = 0, meanB1 = 0, sqR1 = 0, sqG1 = 0, sqB1 = 0;
        let meanR2 = 0, meanG2 = 0, meanB2 = 0, sqR2 = 0, sqG2 = 0, sqB2 = 0;
        let meanR3 = 0, meanG3 = 0, meanB3 = 0, sqR3 = 0, sqG3 = 0, sqB3 = 0;

        // Q0: Top-Left [-radius, 0] x [-radius, 0]
        for (let dy = -radius; dy <= 0; dy++) {
          for (let dx = -radius; dx <= 0; dx++) {
            const pIdx = ((y + dy) * width + (x + dx)) * 4;
            const pr = data[pIdx];
            const pg = data[pIdx + 1];
            const pb = data[pIdx + 2];
            meanR0 += pr; meanG0 += pg; meanB0 += pb;
            sqR0 += pr * pr; sqG0 += pg * pg; sqB0 += pb * pb;
          }
        }

        // Q1: Top-Right [0, radius] x [-radius, 0]
        for (let dy = -radius; dy <= 0; dy++) {
          for (let dx = 0; dx <= radius; dx++) {
            const pIdx = ((y + dy) * width + (x + dx)) * 4;
            const pr = data[pIdx];
            const pg = data[pIdx + 1];
            const pb = data[pIdx + 2];
            meanR1 += pr; meanG1 += pg; meanB1 += pb;
            sqR1 += pr * pr; sqG1 += pg * pg; sqB1 += pb * pb;
          }
        }

        // Q2: Bottom-Left [-radius, 0] x [0, radius]
        for (let dy = 0; dy <= radius; dy++) {
          for (let dx = -radius; dx <= 0; dx++) {
            const pIdx = ((y + dy) * width + (x + dx)) * 4;
            const pr = data[pIdx];
            const pg = data[pIdx + 1];
            const pb = data[pIdx + 2];
            meanR2 += pr; meanG2 += pg; meanB2 += pb;
            sqR2 += pr * pr; sqG2 += pg * pg; sqB2 += pb * pb;
          }
        }

        // Q3: Bottom-Right [0, radius] x [0, radius]
        for (let dy = 0; dy <= radius; dy++) {
          for (let dx = 0; dx <= radius; dx++) {
            const pIdx = ((y + dy) * width + (x + dx)) * 4;
            const pr = data[pIdx];
            const pg = data[pIdx + 1];
            const pb = data[pIdx + 2];
            meanR3 += pr; meanG3 += pg; meanB3 += pb;
            sqR3 += pr * pr; sqG3 += pg * pg; sqB3 += pb * pb;
          }
        }

        // Variance = E[X^2] - (E[X])^2
        const mR0 = meanR0 / qCount, mG0 = meanG0 / qCount, mB0 = meanB0 / qCount;
        const var0 = (sqR0 + sqG0 + sqB0) / qCount - (mR0 * mR0 + mG0 * mG0 + mB0 * mB0);

        const mR1 = meanR1 / qCount, mG1 = meanG1 / qCount, mB1 = meanB1 / qCount;
        const var1 = (sqR1 + sqG1 + sqB1) / qCount - (mR1 * mR1 + mG1 * mG1 + mB1 * mB1);

        const mR2 = meanR2 / qCount, mG2 = meanG2 / qCount, mB2 = meanB2 / qCount;
        const var2 = (sqR2 + sqG2 + sqB2) / qCount - (mR2 * mR2 + mG2 * mG2 + mB2 * mB2);

        const mR3 = meanR3 / qCount, mG3 = meanG3 / qCount, mB3 = meanB3 / qCount;
        const var3 = (sqR3 + sqG3 + sqB3) / qCount - (mR3 * mR3 + mG3 * mG3 + mB3 * mB3);

        // Pick quadrant with minimum variance (smoothest color patch preserving sharp borders)
        let minVar = var0;
        let paintR = mR0, paintG = mG0, paintB = mB0;

        if (var1 < minVar) { minVar = var1; paintR = mR1; paintG = mG1; paintB = mB1; }
        if (var2 < minVar) { minVar = var2; paintR = mR2; paintG = mG2; paintB = mB2; }
        if (var3 < minVar) { minVar = var3; paintR = mR3; paintG = mG3; paintB = mB3; }

        // 3. Color Depth & Vibrancy Boost (Rich oil-paste pigment without muddiness)
        const paintLum = 0.299 * paintR + 0.587 * paintG + 0.114 * paintB;
        let rSat = paintLum + 1.28 * (paintR - paintLum);
        let gSat = paintLum + 1.25 * (paintG - paintLum);
        let bSat = paintLum + 1.28 * (paintB - paintLum);

        // S-curve richness / contrast
        rSat = ((rSat - 128) * 1.12) + 128;
        gSat = ((gSat - 128) * 1.12) + 128;
        bSat = ((bSat - 128) * 1.12) + 128;

        // 4. Subtle Canvas & Impasto Paint Texture (organic canvas weave)
        const weave = Math.sin(x * 0.75) * Math.cos(y * 0.75) * 3.5 + Math.sin((x + y) * 0.5) * 2.0;
        rSat += weave;
        gSat += weave;
        bSat += weave;

        // 5. Preserved details and subtle structural edge integration (no thick/cartoon lines)
        if (edge > 95) {
          // Subtle, thin structural darkening only on prominent edges to preserve facial features
          const edgeDarken = Math.max(0.72, 1.0 - (edge - 95) * 0.002);
          rSat *= edgeDarken;
          gSat *= edgeDarken;
          bSat *= edgeDarken;
        }

        // Clamp to 0-255
        outData[outIdx]     = Math.min(255, Math.max(0, Math.round(rSat)));
        outData[outIdx + 1] = Math.min(255, Math.max(0, Math.round(gSat)));
        outData[outIdx + 2] = Math.min(255, Math.max(0, Math.round(bSat)));
        outData[outIdx + 3] = 255;
      }
    }

    return output;
  }
}
