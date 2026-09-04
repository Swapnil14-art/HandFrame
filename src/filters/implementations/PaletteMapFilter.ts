import { BaseFilter } from '../types/FilterTypes';

export class PaletteMapFilter implements BaseFilter {
  public id = 'palette_map';
  public displayName = 'Palette Map';
  public description = 'Remaps image tones into a stylized 4-stop Cyberpunk color palette';
  public category = 'Artistic' as const;
  public version = '1.0.0';

  // 4-stop gradient palette (RGB)
  private palette = [
    [15, 12, 41],    // Midnight Indigo (Darkest)
    [255, 0, 110],   // Electric Pink (Mid-dark)
    [0, 245, 212],   // Neon Turquoise (Mid-bright)
    [255, 230, 109], // Bright Goldenrod (Brightest)
  ];

  public apply(imageData: ImageData): ImageData {
    const { data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), imageData.width, imageData.height);
    const outData = output.data;

    const len = data.length;
    for (let i = 0; i < len; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255; // 0.0 to 1.0

      // Map luminance to 3 palette intervals
      const pos = lum * (this.palette.length - 1);
      const index = Math.floor(pos);
      const nextIndex = Math.min(this.palette.length - 1, index + 1);
      const t = pos - index;

      const c1 = this.palette[index];
      const c2 = this.palette[nextIndex];

      outData[i]     = Math.round(c1[0] + (c2[0] - c1[0]) * t);
      outData[i + 1] = Math.round(c1[1] + (c2[1] - c1[1]) * t);
      outData[i + 2] = Math.round(c1[2] + (c2[2] - c1[2]) * t);
    }

    return output;
  }
}
