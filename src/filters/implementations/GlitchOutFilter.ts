import { BaseFilter } from '../types/FilterTypes';

export class GlitchOutFilter implements BaseFilter {
  public id = 'glitch_out';
  public displayName = 'Glitch Pop';
  public description = 'Digital glitch distortion with dynamic changing RGB-split edge outlines, horizontal displacement, and irregular hold timing';
  public category = 'Artistic' as const;
  public version = '4.0.0';

  public apply(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), width, height);
    const outData = output.data;

    // Time-based irregular state driver (~4-5 FPS switching, every 3rd state holds longer)
    const now = Date.now();
    
    // Cycle pattern: 260ms step 0, 260ms step 1, 480ms step 2 (hold state) -> Total cycle = 1000ms
    const cycleDuration = 1000;
    const cycleTime = now % cycleDuration;
    const cycleIndex = Math.floor(now / cycleDuration);

    let stepInCycle = 0;
    if (cycleTime < 260) {
      stepInCycle = 0;
    } else if (cycleTime < 520) {
      stepInCycle = 1;
    } else {
      stepInCycle = 2; // Hold state (longer duration)
    }

    const stateStep = cycleIndex * 3 + stepInCycle;

    // Deterministic pseudo-random hash for current state
    const hash = (seed: number) => {
      const x = Math.sin(seed * 12.9898 + stateStep * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };

    // 1. Compute grayscale luminance buffer & Sobel edge buffer for edge outline detection
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

    // 2. Select Dynamic RGB-split Outline Mode across states
    // State A: RED (left) <-> CYAN (right)
    // State B: CYAN (left) <-> RED (right)
    // State C: RED + BLUE displaced asymmetrically
    // State D: MAGENTA / GREEN or BLUE offset
    // State E: Opposite-side displacement
    const mode = Math.abs(stateStep) % 5;
    let rEdgeOffsetX = 0, rEdgeOffsetY = 0;
    let gEdgeOffsetX = 0, gEdgeOffsetY = 0;
    let bEdgeOffsetX = 0, bEdgeOffsetY = 0;

    const baseOffsetDist = 5 + Math.round(hash(88) * 4); // 5-9px split distance

    switch (mode) {
      case 0: // State A: RED <- outline -> CYAN (G+B)
        rEdgeOffsetX = -baseOffsetDist;
        gEdgeOffsetX = baseOffsetDist;
        bEdgeOffsetX = baseOffsetDist;
        break;
      case 1: // State B: CYAN (G+B) <- outline -> RED
        rEdgeOffsetX = baseOffsetDist;
        gEdgeOffsetX = -baseOffsetDist;
        bEdgeOffsetX = -baseOffsetDist;
        break;
      case 2: // State C: RED + BLUE displaced asymmetrically
        rEdgeOffsetX = -baseOffsetDist;
        rEdgeOffsetY = -2;
        gEdgeOffsetX = 0;
        bEdgeOffsetX = Math.round(baseOffsetDist * 1.3);
        bEdgeOffsetY = 2;
        break;
      case 3: // State D: MAGENTA (R+B) / BLUE offset
        rEdgeOffsetX = -baseOffsetDist;
        gEdgeOffsetX = Math.round(baseOffsetDist * 0.8);
        bEdgeOffsetX = -Math.round(baseOffsetDist * 0.6);
        bEdgeOffsetY = -3;
        break;
      case 4: // State E: Opposite-side displacement
      default:
        rEdgeOffsetX = Math.round(baseOffsetDist * 1.2);
        rEdgeOffsetY = 3;
        gEdgeOffsetX = -Math.round(baseOffsetDist * 0.5);
        bEdgeOffsetX = -baseOffsetDist;
        bEdgeOffsetY = -2;
        break;
    }

    // 3. Dynamic horizontal displacement bands & subtle geometric warping
    const numBands = 2 + Math.floor(hash(7) * 3);
    const bandOffsets = new Int16Array(height);

    for (let b = 0; b < numBands; b++) {
      const bandYCenter = Math.floor(hash(10 + b) * height);
      const bandShift = Math.round((hash(20 + b) - 0.5) * 28); // Controlled displacement (not destructive)
      const halfH = Math.floor(Math.max(4, height / 30) * (0.8 + hash(30 + b) * 0.8));

      const startY = Math.max(0, bandYCenter - halfH);
      const endY = Math.min(height - 1, bandYCenter + halfH);

      for (let y = startY; y <= endY; y++) {
        bandOffsets[y] = bandShift;
      }
    }

    // Micro-scanlines factor (clean, no purple tint)
    const scanlineDarken = 0.94;

    // 4. Main Rendering Pass
    for (let y = 0; y < height; y++) {
      const isScanline = y % 3 === 0;
      const bandX = bandOffsets[y];

      // Subtle localized wave jitter
      const waveOffset = Math.round(Math.sin(y * 0.15 + stateStep) * (hash(42) > 0.4 ? 2 : 0));
      const totalShiftX = bandX + waveOffset;

      for (let x = 0; x < width; x++) {
        const outIdx = (y * width + x) * 4;

        // Controlled horizontal displacement for underlying natural image
        const sampleX = Math.min(width - 1, Math.max(0, x + totalShiftX));
        const sampleIdx = (y * width + sampleX) * 4;

        let origR = data[sampleIdx];
        let origG = data[sampleIdx + 1];
        let origB = data[sampleIdx + 2];

        // Sample Edge intensities at chromatic split offsets
        const rx = Math.min(width - 1, Math.max(0, sampleX + rEdgeOffsetX));
        const ry = Math.min(height - 1, Math.max(0, y + rEdgeOffsetY));
        const edgeR = edges[ry * width + rx];

        const gx = Math.min(width - 1, Math.max(0, sampleX + gEdgeOffsetX));
        const gy = Math.min(height - 1, Math.max(0, y + gEdgeOffsetY));
        const edgeG = edges[gy * width + gx];

        const bx = Math.min(width - 1, Math.max(0, sampleX + bEdgeOffsetX));
        const by = Math.min(height - 1, Math.max(0, y + bEdgeOffsetY));
        const edgeB = edges[by * width + bx];

        // Apply Dynamic RGB-Split Outlines (strong chromatic edge split)
        // Outline threshold
        const edgeThreshold = 24;

        if (edgeR > edgeThreshold) {
          const intensity = Math.min(1.0, (edgeR - edgeThreshold) / 45);
          origR = Math.min(255, Math.round(origR * (1 - intensity * 0.3) + 255 * intensity));
        }

        if (edgeG > edgeThreshold) {
          const intensity = Math.min(1.0, (edgeG - edgeThreshold) / 45);
          origG = Math.min(255, Math.round(origG * (1 - intensity * 0.3) + 255 * intensity));
        }

        if (edgeB > edgeThreshold) {
          const intensity = Math.min(1.0, (edgeB - edgeThreshold) / 45);
          origB = Math.min(255, Math.round(origB * (1 - intensity * 0.3) + 255 * intensity));
        }

        // Apply subtle scanlines without tinting
        if (isScanline) {
          origR = Math.round(origR * scanlineDarken);
          origG = Math.round(origG * scanlineDarken);
          origB = Math.round(origB * scanlineDarken);
        }

        outData[outIdx]     = origR;
        outData[outIdx + 1] = origG;
        outData[outIdx + 2] = origB;
        outData[outIdx + 3] = 255;
      }
    }

    return output;
  }
}
