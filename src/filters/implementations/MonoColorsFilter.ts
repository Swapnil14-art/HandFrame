import { BaseFilter } from '../types/FilterTypes';

export class MonoColorsFilter implements BaseFilter {
  public id = 'mono_colors';
  public displayName = 'Mono Colors';
  public description = 'Monochromatic color mapping through a single vibrant Electric Teal color ramp';
  public category = 'Monochrome' as const;
  public version = '1.0.0';

  // Single-hue gradient stops: Deep Midnight Blue -> Electric Cyan -> Bright Mint White
  private startColor = [10, 25, 55];   // Dark stop
  private midColor   = [0, 210, 235];  // Mid vibrant stop
  private endColor   = [230, 255, 250]; // Bright stop

  public apply(imageData: ImageData): ImageData {
    const { data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), imageData.width, imageData.height);
    const outData = output.data;

    const len = data.length;
    for (let i = 0; i < len; i += 4) {
      const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;

      let r = 0, g = 0, b = 0;
      if (lum < 0.5) {
        const t = lum * 2;
        r = Math.round(this.startColor[0] + (this.midColor[0] - this.startColor[0]) * t);
        g = Math.round(this.startColor[1] + (this.midColor[1] - this.startColor[1]) * t);
        b = Math.round(this.startColor[2] + (this.midColor[2] - this.startColor[2]) * t);
      } else {
        const t = (lum - 0.5) * 2;
        r = Math.round(this.midColor[0] + (this.endColor[0] - this.midColor[0]) * t);
        g = Math.round(this.midColor[1] + (this.endColor[1] - this.midColor[1]) * t);
        b = Math.round(this.midColor[2] + (this.endColor[2] - this.midColor[2]) * t);
      }

      outData[i]     = r;
      outData[i + 1] = g;
      outData[i + 2] = b;
    }

    return output;
  }
}
