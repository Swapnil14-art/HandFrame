import { BaseFilter } from '../types/FilterTypes';

export class RgbSplitFilter implements BaseFilter {
  public id = 'rgb_split';
  public displayName = 'RGB Split';
  public description = 'Splits R, G, and B color channels spatially with 3D chromatic offset';
  public category = 'Retro' as const;
  public version = '1.0.0';

  public apply(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), width, height);
    const outData = output.data;

    const offsetR = 8;
    const offsetB = -8;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const currIdx = (y * width + x) * 4;

        // Red channel offset (Shift Right)
        const rx = Math.min(width - 1, Math.max(0, x + offsetR));
        const rIdx = (y * width + rx) * 4;

        // Blue channel offset (Shift Left)
        const bx = Math.min(width - 1, Math.max(0, x + offsetB));
        const bIdx = (y * width + bx) * 4;

        outData[currIdx]     = data[rIdx];     // Red from shifted offset
        outData[currIdx + 1] = data[currIdx + 1]; // Green stays centered
        outData[currIdx + 2] = data[bIdx + 2]; // Blue from shifted offset
      }
    }

    return output;
  }
}
