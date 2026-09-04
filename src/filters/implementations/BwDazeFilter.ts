import { BaseFilter } from '../types/FilterTypes';

export class BwDazeFilter implements BaseFilter {
  public id = 'bw_daze';
  public displayName = 'BW Daze';
  public description = 'Dreamy high-contrast monochrome with soft ambient halo glow';
  public category = 'Monochrome' as const;
  public version = '1.0.0';

  public apply(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), width, height);
    const outData = output.data;

    const monoBuf = new Float32Array(width * height);

    // High-contrast monochrome pass
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      // Contrast boost S-curve
      const contrastLum = Math.min(255, Math.max(0, (lum - 128) * 1.4 + 128));
      monoBuf[i] = contrastLum;
    }

    // Soft 2px blur pass for daze halo
    const radius = 2;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let acc = 0, count = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          const ny = y + dy;
          if (ny >= 0 && ny < height) {
            for (let dx = -radius; dx <= radius; dx++) {
              const nx = x + dx;
              if (nx >= 0 && nx < width) {
                acc += monoBuf[ny * width + nx];
                count++;
              }
            }
          }
        }

        const outIdx = (y * width + x) * 4;
        const origVal = monoBuf[y * width + x];
        const blurVal = acc / count;

        // Screen blend orig + blur for dreamy daze
        const dazeVal = Math.min(255, origVal * 0.65 + blurVal * 0.45);

        outData[outIdx]     = dazeVal;
        outData[outIdx + 1] = dazeVal;
        outData[outIdx + 2] = dazeVal;
      }
    }

    return output;
  }
}
