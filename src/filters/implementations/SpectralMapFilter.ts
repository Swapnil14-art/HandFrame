import { BaseFilter } from '../types/FilterTypes';

export class SpectralMapFilter implements BaseFilter {
  public id = 'spectral_map';
  public displayName = 'Spectral Map';
  public description = 'Maps image luminance into a vibrant rainbow spectral gradient';
  public category = 'Artistic' as const;
  public version = '1.0.0';

  private lutR: Uint8Array = new Uint8Array(256);
  private lutG: Uint8Array = new Uint8Array(256);
  private lutB: Uint8Array = new Uint8Array(256);

  constructor() {
    this.buildLUT();
  }

  private buildLUT(): void {
    for (let i = 0; i < 256; i++) {
      const hue = (i / 255) * 300; // 0 (Red) to 300 (Magenta)
      const rgb = this.hslToRgb(hue / 360, 0.9, 0.5);
      this.lutR[i] = rgb[0];
      this.lutG[i] = rgb[1];
      this.lutB[i] = rgb[2];
    }
  }

  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
    let r: number, g: number, b: number;

    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = this.hueToRgb(p, q, h + 1 / 3);
      g = this.hueToRgb(p, q, h);
      b = this.hueToRgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  private hueToRgb(p: number, q: number, t: number): number {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  public apply(imageData: ImageData): ImageData {
    const { data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), imageData.width, imageData.height);
    const outData = output.data;

    const len = data.length;
    for (let i = 0; i < len; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

      outData[i]     = this.lutR[lum];
      outData[i + 1] = this.lutG[lum];
      outData[i + 2] = this.lutB[lum];
    }

    return output;
  }
}
