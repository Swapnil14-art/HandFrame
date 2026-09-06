import { BaseFilter } from '../types/FilterTypes';

/**
 * RetroArcadeFilter - 90s Arcade Game Visual Style
 * 
 * Features:
 * - Downsampled hard square pixels with nearest-neighbor rendering
 * - Punchy 16-color adaptive palette tailored to camera scene + classic 90s arcade tones
 * - Crisp high-contrast pixel-art outlines around subject contours (hands, fingers, face, clothing)
 * - Zero blur, zero soft gradients, zero smoothing
 * - 100% local real-time performance
 */
export class RetroArcadeFilter implements BaseFilter {
  public id = 'retro_arcade';
  public displayName = 'Retro Arcade';
  public description = '90s arcade-game visual style with adaptive 16-color palette and high-contrast pixel boundaries';
  public category = 'Retro' as const;
  public version = '1.0.0';

  public apply(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), width, height);
    const outData = output.data;

    // Determine grid block size for crisp square pixels
    const blockSize = Math.max(4, Math.min(8, Math.floor(Math.min(width, height) / 55))) || 6;
    const gridW = Math.ceil(width / blockSize);
    const gridH = Math.ceil(height / blockSize);
    const totalCells = gridW * gridH;

    // Arrays to store grid cell RGB & Luminance
    const cellR = new Uint8Array(totalCells);
    const cellG = new Uint8Array(totalCells);
    const cellB = new Uint8Array(totalCells);
    const cellLum = new Float32Array(totalCells);

    // 1. Pass 1: Compute average RGB and luminance per cell
    for (let gy = 0; gy < gridH; gy++) {
      const startY = gy * blockSize;
      const endY = Math.min(height, (gy + 1) * blockSize);

      for (let gx = 0; gx < gridW; gx++) {
        const startX = gx * blockSize;
        const endX = Math.min(width, (gx + 1) * blockSize);

        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let count = 0;

        for (let y = startY; y < endY; y++) {
          const rowOffset = y * width;
          for (let x = startX; x < endX; x++) {
            const idx = (rowOffset + x) * 4;
            sumR += data[idx];
            sumG += data[idx + 1];
            sumB += data[idx + 2];
            count++;
          }
        }

        const cellIdx = gy * gridW + gx;
        if (count > 0) {
          const r = Math.round(sumR / count);
          const g = Math.round(sumG / count);
          const b = Math.round(sumB / count);
          cellR[cellIdx] = r;
          cellG[cellIdx] = g;
          cellB[cellIdx] = b;
          cellLum[cellIdx] = 0.299 * r + 0.587 * g + 0.114 * b;
        }
      }
    }

    // 2. Build Dynamic 16-Color Adaptive Arcade Palette
    // 6 Core Arcade Master Anchor Colors (RGB)
    const palette: Array<[number, number, number]> = [
      [10, 10, 16],    // 0: Deep Shadow Black
      [245, 245, 255], // 1: Arcade Crisp White
      [230, 0, 38],    // 2: Arcade Crimson Red
      [0, 230, 57],    // 3: Neon Lime Green
      [0, 85, 255],    // 4: Cobalt Blue
      [255, 215, 0],   // 5: Sunburst Yellow
    ];

    // Build 3D Color Frequency Histogram (4x4x4 grid) to find top 10 dominant scene colors
    const histogram = new Int32Array(64); // 4 * 4 * 4
    const binSumR = new Float64Array(64);
    const binSumG = new Float64Array(64);
    const binSumB = new Float64Array(64);

    for (let i = 0; i < totalCells; i++) {
      const rBin = Math.min(3, Math.floor(cellR[i] / 64));
      const gBin = Math.min(3, Math.floor(cellG[i] / 64));
      const bBin = Math.min(3, Math.floor(cellB[i] / 64));
      const binIdx = (rBin << 4) | (gBin << 2) | bBin;

      histogram[binIdx]++;
      binSumR[binIdx] += cellR[i];
      binSumG[binIdx] += cellG[i];
      binSumB[binIdx] += cellB[i];
    }

    // Sort bins by frequency
    const binIndices: number[] = [];
    for (let i = 0; i < 64; i++) {
      if (histogram[i] > 0) binIndices.push(i);
    }
    binIndices.sort((a, b) => histogram[b] - histogram[a]);

    // Extract up to 10 scene-adaptive colors, boosting arcade punchiness & saturation
    for (let k = 0; k < Math.min(10, binIndices.length); k++) {
      const bIdx = binIndices[k];
      const count = histogram[bIdx];
      const avgR = binSumR[bIdx] / count;
      const avgG = binSumG[bIdx] / count;
      const avgB = binSumB[bIdx] / count;

      // Enhance saturation & contrast for retro arcade look
      const maxC = Math.max(avgR, avgG, avgB);
      const minC = Math.min(avgR, avgG, avgB);
      const delta = maxC - minC;

      let r = avgR;
      let g = avgG;
      let b = avgB;

      if (delta > 15) {
        // Boost color saturation by ~25%
        const factor = 1.25;
        const mean = (avgR + avgG + avgB) / 3;
        r = Math.min(255, Math.max(0, mean + (avgR - mean) * factor));
        g = Math.min(255, Math.max(0, mean + (avgG - mean) * factor));
        b = Math.min(255, Math.max(0, mean + (avgB - mean) * factor));
      }

      palette.push([Math.round(r), Math.round(g), Math.round(b)]);
    }

    // Fill remaining slots up to 16 with secondary arcade tones if needed
    const secondaryArcadeColors: Array<[number, number, number]> = [
      [0, 229, 255],   // Cyan
      [255, 0, 153],   // Magenta
      [255, 102, 0],   // Flame Orange
      [128, 0, 255],   // Arcade Purple
      [255, 184, 140], // Skin / Peach
      [74, 78, 105],   // Slate Gray
      [43, 112, 27],   // Forest Green
      [212, 155, 0],   // Warm Gold
      [92, 194, 255],  // Sky Blue
      [16, 20, 40],    // Dark Navy
    ];

    let secIdx = 0;
    while (palette.length < 16 && secIdx < secondaryArcadeColors.length) {
      palette.push(secondaryArcadeColors[secIdx++]);
    }
    // Cap palette strictly to 16 colors
    const finalPalette = palette.slice(0, 16);

    // 3. Pass 2: Edge detection & nearest-neighbor block rendering
    const edgeThreshold = 38; // Threshold for structural pixel-art outline detection

    for (let gy = 0; gy < gridH; gy++) {
      const startY = gy * blockSize;
      const endY = Math.min(height, (gy + 1) * blockSize);

      for (let gx = 0; gx < gridW; gx++) {
        const startX = gx * blockSize;
        const endX = Math.min(width, (gx + 1) * blockSize);
        const cellIdx = gy * gridW + gx;

        const curLum = cellLum[cellIdx];

        // Spatial edge gradient calculation with neighboring cells
        let maxEdgeDiff = 0;
        if (gx < gridW - 1) {
          const rightLum = cellLum[cellIdx + 1];
          maxEdgeDiff = Math.max(maxEdgeDiff, Math.abs(curLum - rightLum));
        }
        if (gy < gridH - 1) {
          const downLum = cellLum[cellIdx + gridW];
          maxEdgeDiff = Math.max(maxEdgeDiff, Math.abs(curLum - downLum));
        }

        let targetR: number;
        let targetG: number;
        let targetB: number;

        if (maxEdgeDiff > edgeThreshold) {
          // Strong edge boundary (hands, fingers, face, clothing contours) -> Dark Arcade Pixel Outline
          targetR = finalPalette[0][0]; // Deep Shadow Black outline
          targetG = finalPalette[0][1];
          targetB = finalPalette[0][2];
        } else {
          // Map cell RGB to nearest palette color using weighted perceptual Euclidean distance
          const cr = cellR[cellIdx];
          const cg = cellG[cellIdx];
          const cb = cellB[cellIdx];

          let bestDist = Infinity;
          let bestIdx = 0;

          for (let p = 0; p < finalPalette.length; p++) {
            const [pr, pg, pb] = finalPalette[p];
            const dr = cr - pr;
            const dg = cg - pg;
            const db = cb - pb;

            // Weighted perceptual color distance
            const dist = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
            if (dist < bestDist) {
              bestDist = dist;
              bestIdx = p;
            }
          }

          targetR = finalPalette[bestIdx][0];
          targetG = finalPalette[bestIdx][1];
          targetB = finalPalette[bestIdx][2];
        }

        // Nearest-neighbor solid block fill (hard square pixels, no blur)
        for (let y = startY; y < endY; y++) {
          const rowOffset = y * width;
          for (let x = startX; x < endX; x++) {
            const outIdx = (rowOffset + x) * 4;
            outData[outIdx]     = targetR;
            outData[outIdx + 1] = targetG;
            outData[outIdx + 2] = targetB;
            outData[outIdx + 3] = 255;
          }
        }
      }
    }

    return output;
  }
}
