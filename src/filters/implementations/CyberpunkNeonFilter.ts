import { BaseFilter } from '../types/FilterTypes';

/**
 * CyberpunkNeonFilter:
 * Transforms the live camera feed inside the HandFrame into an electric, high-contrast
 * futuristic cyberpunk visual. Midtones shift to vivid hot magenta/neon purple, highlights
 * ignite in electric cyan/turquoise, and dark shadows fall into deep dystopian indigo.
 */
export class CyberpunkNeonFilter implements BaseFilter {
  public id = 'cyberpunk_neon';
  public displayName = 'Cyberpunk Neon';
  public description = 'Futuristic high-contrast dual-tone aesthetic with hot magenta and electric cyan';
  public category = 'Retro' as const;
  public version = '1.0.0';

  private lutR: Uint8Array = new Uint8Array(256);
  private lutG: Uint8Array = new Uint8Array(256);
  private lutB: Uint8Array = new Uint8Array(256);

  constructor() {
    this.buildNeonLUT();
  }

  /**
   * Precomputes 256-entry Look-Up Tables for fast O(1) luminance-to-neon grading.
   * Eliminates runtime mathematical overhead during real-time 60fps frame loops.
   */
  private buildNeonLUT(): void {
    for (let i = 0; i < 256; i++) {
      let r = 0;
      let g = 0;
      let b = 0;

      if (i < 80) {
        // Dark tones -> Deep dystopian indigo & violet
        const t = i / 80;
        r = Math.round(15 * (1 - t) + 40 * t);
        g = Math.round(5 * (1 - t) + 10 * t);
        b = Math.round(45 * (1 - t) + 120 * t);
      } else if (i < 175) {
        // Midtones -> Vivid hot magenta / electric pink
        const t = (i - 80) / 95;
        r = Math.round(40 + 200 * t);
        g = Math.round(10 + 35 * t);
        b = Math.round(120 + 70 * (1 - t) + 120 * t);
      } else {
        // Highlights -> Electric cyan / hyper-bright neon turquoise
        const t = (i - 175) / 80;
        r = Math.round(240 * (1 - t) + 50 * t);
        g = Math.round(45 * (1 - t) + 245 * t);
        b = Math.round(240 * (1 - t) + 255 * t);
      }

      this.lutR[i] = Math.min(255, Math.max(0, r));
      this.lutG[i] = Math.min(255, Math.max(0, g));
      this.lutB[i] = Math.min(255, Math.max(0, b));
    }
  }

  /**
   * Applies the Cyberpunk Neon color grade to the cropped quadrilateral region.
   */
  public apply(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), width, height);
    const outData = output.data;

    const len = data.length;
    for (let i = 0; i < len; i += 4) {
      const origR = data[i];
      const origG = data[i + 1];
      const origB = data[i + 2];

      // Standard perceptual luminance
      const lum = Math.round(0.299 * origR + 0.587 * origG + 0.114 * origB);

      // Fast LUT base lookup
      const baseR = this.lutR[lum];
      const baseG = this.lutG[lum];
      const baseB = this.lutB[lum];

      // Contrast boost and saturation punch
      outData[i]     = Math.min(255, (baseR * 0.7 + origR * 0.45) | 0);
      outData[i + 1] = Math.min(255, (baseG * 0.7 + origG * 0.35) | 0);
      outData[i + 2] = Math.min(255, (baseB * 0.7 + origB * 0.55) | 0);
      outData[i + 3] = data[i + 3];
    }

    return output;
  }
}
