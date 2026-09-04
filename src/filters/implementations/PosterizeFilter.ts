import { BaseFilter } from '../types/FilterTypes';

export class PosterizeFilter implements BaseFilter {
  public id = 'posterize';
  public displayName = 'Posterize';
  public description = 'Quantizes color depth into distinct graphic posterization bands';
  public category = 'Artistic' as const;
  public version = '1.0.0';

  private levels: number = 4;

  public apply(imageData: ImageData): ImageData {
    const { data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), imageData.width, imageData.height);
    const outData = output.data;

    const step = 255 / (this.levels - 1);
    const len = data.length;

    for (let i = 0; i < len; i += 4) {
      outData[i]     = Math.round(Math.round(data[i]     / step) * step);
      outData[i + 1] = Math.round(Math.round(data[i + 1] / step) * step);
      outData[i + 2] = Math.round(Math.round(data[i + 2] / step) * step);
    }

    return output;
  }
}
