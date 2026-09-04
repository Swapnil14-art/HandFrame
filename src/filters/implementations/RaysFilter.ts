import { BaseFilter } from '../types/FilterTypes';

export class RaysFilter implements BaseFilter {
  public id = 'rays';
  public displayName = 'Rays';
  public description = 'Generates radial light streaks streaming outward from sub-region center';
  public category = 'Dreamy' as const;
  public version = '1.0.0';

  public apply(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), width, height);
    const outData = output.data;

    const cx = width / 2;
    const cy = height / 2;
    const numSamples = 6;
    const decay = 0.85;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;

        // Radial ray vector pointing towards center (cx, cy)
        let vx = (cx - x) / width;
        let vy = (cy - y) / height;

        let accR = data[idx];
        let accG = data[idx + 1];
        let accB = data[idx + 2];
        let currentWeight = 1.0;

        let sx = x;
        let sy = y;

        for (let s = 0; s < numSamples; s++) {
          sx += vx * 3.5;
          sy += vy * 3.5;

          const ix = Math.floor(sx);
          const iy = Math.floor(sy);

          if (ix >= 0 && ix < width && iy >= 0 && iy < height) {
            const sIdx = (iy * width + ix) * 4;
            const lum = 0.299 * data[sIdx] + 0.587 * data[sIdx + 1] + 0.114 * data[sIdx + 2];

            if (lum > 110) {
              currentWeight *= decay;
              accR += data[sIdx] * currentWeight * 0.4;
              accG += data[sIdx + 1] * currentWeight * 0.4;
              accB += data[sIdx + 2] * currentWeight * 0.4;
            }
          }
        }

        outData[idx]     = Math.min(255, accR);
        outData[idx + 1] = Math.min(255, accG);
        outData[idx + 2] = Math.min(255, accB);
      }
    }

    return output;
  }
}
