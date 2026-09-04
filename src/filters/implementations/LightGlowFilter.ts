import { BaseFilter } from '../types/FilterTypes';

export class LightGlowFilter implements BaseFilter {
  public id = 'light_glow';
  public displayName = 'Light Glow';
  public description = 'Creates bright highlight extraction with radiant bloom and glow';
  public category = 'Dreamy' as const;
  public version = '1.0.0';

  public apply(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), width, height);
    const outData = output.data;

    // Create thresholded highlight buffer
    const glowBuf = new Float32Array(width * height * 3);

    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      if (lum > 140) {
        const factor = (lum - 140) / 115;
        glowBuf[i * 3]     = r * factor;
        glowBuf[i * 3 + 1] = g * factor;
        glowBuf[i * 3 + 2] = b * factor;
      }
    }

    // Fast 1D horizontal & vertical box blur pass over glow buffer
    const blurRadius = 4;
    const blurredGlow = new Float32Array(width * height * 3);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let accR = 0, accG = 0, accB = 0, count = 0;
        for (let dx = -blurRadius; dx <= blurRadius; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < width) {
            const idx = (y * width + nx) * 3;
            accR += glowBuf[idx];
            accG += glowBuf[idx + 1];
            accB += glowBuf[idx + 2];
            count++;
          }
        }
        const outIdx = (y * width + x) * 3;
        blurredGlow[outIdx]     = accR / count;
        blurredGlow[outIdx + 1] = accG / count;
        blurredGlow[outIdx + 2] = accB / count;
      }
    }

    // Blend additive glow onto original image
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      const gIdx = i * 3;

      outData[idx]     = Math.min(255, data[idx]     + blurredGlow[gIdx] * 1.4);
      outData[idx + 1] = Math.min(255, data[idx + 1] + blurredGlow[gIdx + 1] * 1.4);
      outData[idx + 2] = Math.min(255, data[idx + 2] + blurredGlow[gIdx + 2] * 1.4);
    }

    return output;
  }
}
