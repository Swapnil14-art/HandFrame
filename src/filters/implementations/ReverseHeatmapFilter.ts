import { BaseFilter } from '../types/FilterTypes';

export class ReverseHeatmapFilter implements BaseFilter {
  public id = 'reverse_heatmap';
  public displayName = 'Reverse Heatmap';
  public description = 'Inverted thermal heatmap color gradient mapping';
  public category = 'Artistic' as const;
  public version = '1.0.0';

  private lutR = new Uint8Array(256);
  private lutG = new Uint8Array(256);
  private lutB = new Uint8Array(256);

  constructor() {
    this.buildReverseThermalLUT();
  }

  /**
   * Precomputes a 3-segment piecewise thermal color gradient Look-Up Table (LUT):
   * Inverts luminance (val = 255 - lum) so bright regions map to warm yellow/white
   * and dark regions map to cool blue/violet.
   * - Segment 1 [0..84]: Deep Blue to Magenta
   * - Segment 2 [85..169]: Magenta to Red/Orange
   * - Segment 3 [170..255]: Orange to Bright Yellow/White
   */
  private buildReverseThermalLUT(): void {
    // Reverse thermal gradient: Low lum -> White/Yellow, Mid -> Red/Magenta, High -> Deep Blue/Violet
    for (let i = 0; i < 256; i++) {
      const val = 255 - i; // Invert luminance for reverse heatmap

      let r = 0, g = 0, b = 0;
      if (val < 85) {
        // Dark to Blue/Magenta
        r = Math.round((val / 85) * 180);
        g = 0;
        b = Math.round(150 + (val / 85) * 105);
      } else if (val < 170) {
        // Magenta to Red/Orange
        const t = (val - 85) / 85;
        r = Math.round(180 + t * 75);
        g = Math.round(t * 180);
        b = Math.round((1 - t) * 255);
      } else {
        // Orange to Bright Yellow/White
        const t = (val - 170) / 85;
        r = 255;
        g = Math.round(180 + t * 75);
        b = Math.round(t * 255);
      }

      this.lutR[i] = r;
      this.lutG[i] = g;
      this.lutB[i] = b;
    }
  }

  /**
   * Applies reverse heatmap in O(1) time per pixel.
   */
  public apply(imageData: ImageData): ImageData {
    const { data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), imageData.width, imageData.height);
    const outData = output.data;

    const len = data.length;
    for (let i = 0; i < len; i += 4) {
      // Calculate perceptual luminance
      const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);

      // O(1) Instant Table Lookup
      outData[i]     = this.lutR[lum];
      outData[i + 1] = this.lutG[lum];
      outData[i + 2] = this.lutB[lum];
    }

    return output;
  }
}
