import { BaseFilter } from '../types/FilterTypes';

/**
 * RetroArcadeFilter - 16-bit 90s Arcade Game Visual Style
 * 
 * Features:
 * - High-density 16-bit pixel-art resolution with crisp hard square pixels (nearest-neighbor)
 * - Punchy 16-color adaptive palette tailored to camera scene + classic 90s arcade tones
 * - 16-bit ordered checkerboard dithering between palette colors for classic 90s console/arcade shading
 * - Crisp high-contrast pixel-art outlines around subject contours (hands, fingers, face, clothing)
 * - Zero blur, zero soft gradients, zero smoothing
 * - 100% local real-time performance
 */
export class RetroArcadeFilter implements BaseFilter {
  public id = 'retro_arcade';
  public displayName = 'Retro Arcade';
  public description = '16-bit arcade-game visual style with adaptive 16-color palette and high-contrast pixel boundaries';
  public category = 'Retro' as const;
  public version = '1.1.0';

  public apply(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), width, height);
    const outData = output.data;

    // 16-bit Arcade Grid Resolution (finer 2-4px pixel blocks for 16-bit arcade sprite aesthetic)
    const blockSize = Math.max(2, Math.min(4, Math.floor(Math.min(width, height) / 95))) || 3;
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

    // 3. Pass 2: Edge detection & 16-bit pixel-art rendering with ordered checkerboard dithering
    const edgeThreshold = 32; // Crisp threshold for structural pixel-art outline detection

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

        let primaryR: number;
        let primaryG: number;
        let primaryB: number;
        let secondaryR: number;
        let secondaryG: number;
        let secondaryB: number;
        let isDithered = false;

        if (maxEdgeDiff > edgeThreshold) {
          // Strong edge boundary (hands, fingers, face, clothing contours) -> Dark Arcade Pixel Outline
          primaryR = finalPalette[0][0]; // Deep Shadow Black outline
          primaryG = finalPalette[0][1];
          primaryB = finalPalette[0][2];
          secondaryR = primaryR;
          secondaryG = primaryG;
          secondaryB = primaryB;
        } else {
          // Map cell RGB to 1st and 2nd nearest palette colors
          const cr = cellR[cellIdx];
          const cg = cellG[cellIdx];
          const cb = cellB[cellIdx];

          let bestDist = Infinity;
          let bestIdx = 0;
          let secondDist = Infinity;
          let secondIdx = 0;

          for (let p = 0; p < finalPalette.length; p++) {
            const [pr, pg, pb] = finalPalette[p];
            const dr = cr - pr;
            const dg = cg - pg;
            const db = cb - pb;

            const dist = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
            if (dist < bestDist) {
              secondDist = bestDist;
              secondIdx = bestIdx;
              bestDist = dist;
              bestIdx = p;
            } else if (dist < secondDist) {
              secondDist = dist;
              secondIdx = p;
            }
          }

          primaryR = finalPalette[bestIdx][0];
          primaryG = finalPalette[bestIdx][1];
          primaryB = finalPalette[bestIdx][2];

          // 16-bit ordered checkerboard dither condition: if cell is in midtone region between 1st & 2nd palette colors
          if (secondDist < bestDist * 1.85 && bestIdx !== 0 && bestIdx !== 1) {
            secondaryR = finalPalette[secondIdx][0];
            secondaryG = finalPalette[secondIdx][1];
            secondaryB = finalPalette[secondIdx][2];
            isDithered = true;
          } else {
            secondaryR = primaryR;
            secondaryG = primaryG;
            secondaryB = primaryB;
          }
        }

        // Nearest-neighbor block fill with 16-bit checkerboard pattern (hard square pixels, no blur)
        for (let y = startY; y < endY; y++) {
          const rowOffset = y * width;
          for (let x = startX; x < endX; x++) {
            const outIdx = (rowOffset + x) * 4;
            const useSecondary = isDithered && ((gx + gy) % 2 === 1);
            
            outData[outIdx]     = useSecondary ? secondaryR : primaryR;
            outData[outIdx + 1] = useSecondary ? secondaryG : primaryG;
            outData[outIdx + 2] = useSecondary ? secondaryB : primaryB;
            outData[outIdx + 3] = 255;
          }
        }
      }
    }

    return output;
  }
}
