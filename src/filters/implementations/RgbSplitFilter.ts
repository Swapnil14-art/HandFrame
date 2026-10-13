import { BaseFilter } from '../types/FilterTypes';

export class RgbSplitFilter implements BaseFilter {
  public id = 'rgb_split';
  public displayName = 'RGB Split';
  public description = 'Splits R, G, and B color channels spatially with 3D chromatic offset';
  public category = 'Retro' as const;
  public version = '1.0.0';

  /**
   * Chromatic Aberration (RGB Channel Splitting):
   * Simulates anaglyph 3D / lens prism dispersion by spatially displacing the Red and Blue channels
   * horizontally in opposite directions while keeping the Green channel anchored in place.
   */
  public apply(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), width, height);
    const outData = output.data;

    // Shift distances in pixels
    const offsetR = 8;  // Red channel shifts right (+8px)
    const offsetB = -8; // Blue channel shifts left (-8px)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const currIdx = (y * width + x) * 4;

        // Sample Red channel from shifted right coordinate (clamped to image width)
        const rx = Math.min(width - 1, Math.max(0, x + offsetR));
        const rIdx = (y * width + rx) * 4;

        // Sample Blue channel from shifted left coordinate (clamped to image width)
        const bx = Math.min(width - 1, Math.max(0, x + offsetB));
        const bIdx = (y * width + bx) * 4;

        outData[currIdx]     = data[rIdx];        // Shifted Red
        outData[currIdx + 1] = data[currIdx + 1]; // Stationary Green (anchor)
        outData[currIdx + 2] = data[bIdx + 2];    // Shifted Blue
      }
    }

    return output;
  }
}
