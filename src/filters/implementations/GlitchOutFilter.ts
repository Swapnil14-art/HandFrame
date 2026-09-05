import { BaseFilter } from '../types/FilterTypes';

export class GlitchOutFilter implements BaseFilter {
  public id = 'glitch_out';
  public displayName = 'Glitch Out';
  public description = 'Dynamic neon RGB chromatic split with multi-channel ghosting, displacement bands, and vibrant magenta/cyan/purple spectrum';
  public category = 'Artistic' as const;
  public version = '3.0.0';

  public apply(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), width, height);
    const outData = output.data;

    // Time-based irregular state driver (~4-5 FPS switching, every 3rd state holds longer)
    const now = Date.now();
    
    // Cycle pattern: 300ms step 0, 220ms step 1, 480ms step 2 (hold state) -> Total cycle = 1000ms
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

    // Calculate displacement parameters for current glitch state
    const redShiftX = Math.round((hash(1) - 0.5) * 36);
    const redShiftY = Math.round((hash(2) - 0.5) * 6);
    
    const cyanShiftX = Math.round((hash(3) - 0.5) * 32);
    const cyanShiftY = Math.round((hash(4) - 0.5) * 6);

    const purpleShiftX = Math.round((hash(5) - 0.5) * 26);
    const purpleShiftY = Math.round((hash(6) - 0.5) * 8);

    // Dynamic horizontal displacement bands (2 to 4 irregular bands)
    const numBands = 2 + Math.floor(hash(7) * 3);
    const bandHeight = Math.max(6, Math.floor(height / 25));
    const bandOffsets = new Int16Array(height);

    for (let b = 0; b < numBands; b++) {
      const bandYCenter = Math.floor(hash(10 + b) * height);
      const bandShift = Math.round((hash(20 + b) - 0.5) * 40);
      const halfH = Math.floor(bandHeight * (0.8 + hash(30 + b) * 0.8));

      const startY = Math.max(0, bandYCenter - halfH);
      const endY = Math.min(height - 1, bandYCenter + halfH);

      for (let y = startY; y <= endY; y++) {
        bandOffsets[y] = bandShift;
      }
    }

    // Micro-scanlines darkening factor
    const scanlineDarken = 0.88;

    // Main pixel rendering loop
    for (let y = 0; y < height; y++) {
      const isScanline = y % 2 === 0;
      const bandX = bandOffsets[y];

      for (let x = 0; x < width; x++) {
        const outIdx = (y * width + x) * 4;

        // Apply horizontal band displacement to source coordinate
        const baseX = Math.min(width - 1, Math.max(0, x + bandX));

        // 1. Clean original image reference
        const origIdx = (y * width + baseX) * 4;
        const origR = data[origIdx];
        const origG = data[origIdx + 1];
        const origB = data[origIdx + 2];

        // 2. Red / Hot Pink shifted copy
        const rx = Math.min(width - 1, Math.max(0, baseX + redShiftX));
        const ry = Math.min(height - 1, Math.max(0, y + redShiftY));
        const rIdx = (ry * width + rx) * 4;
        const rSample = data[rIdx];

        // 3. Cyan / Electric Blue shifted copy
        const cx = Math.min(width - 1, Math.max(0, baseX + cyanShiftX));
        const cy = Math.min(height - 1, Math.max(0, y + cyanShiftY));
        const cIdx = (cy * width + cx) * 4;
        const cSampleG = data[cIdx + 1];
        const cSampleB = data[cIdx + 2];

        // 4. Neon Purple / Magenta ghost copy
        const px = Math.min(width - 1, Math.max(0, baseX + purpleShiftX));
        const py = Math.min(height - 1, Math.max(0, y + purpleShiftY));
        const pIdx = (py * width + px) * 4;
        const pSampleR = data[pIdx];
        const pSampleB = data[pIdx + 2];

        // Synthesize Neon Glitch Spectrum (Hot Pink/Magenta, Electric Blue, Cyan, Neon Purple)
        // Red/Magenta ghost component
        const pinkR = rSample * 1.15 + 20;
        const pinkG = rSample * 0.15;
        const pinkB = rSample * 0.75 + 30;

        // Cyan/Blue ghost component
        const cyanR = cSampleG * 0.1;
        const cyanG = cSampleG * 1.05 + 15;
        const cyanB = cSampleB * 1.2 + 30;

        // Neon Purple ghost component
        const purpleR = pSampleR * 0.7 + 25;
        const purpleG = 0;
        const purpleB = pSampleB * 0.95 + 40;

        // Blend ghost layers with original image to preserve facial & object structural recognition
        let r = origR * 0.42 + pinkR * 0.3 + cyanR * 0.1 + purpleR * 0.25;
        let g = origG * 0.45 + pinkG * 0.1 + cyanG * 0.45 + purpleG * 0.05;
        let b = origB * 0.4 + pinkB * 0.25 + cyanB * 0.45 + purpleB * 0.3;

        // Apply scanline tinting
        if (isScanline) {
          r *= scanlineDarken;
          g *= scanlineDarken;
          b *= scanlineDarken;
        }

        // Clamp values to valid 0-255 range
        outData[outIdx]     = Math.min(255, Math.max(0, Math.round(r)));
        outData[outIdx + 1] = Math.min(255, Math.max(0, Math.round(g)));
        outData[outIdx + 2] = Math.min(255, Math.max(0, Math.round(b)));
        outData[outIdx + 3] = 255;
      }
    }

    return output;
  }
}
