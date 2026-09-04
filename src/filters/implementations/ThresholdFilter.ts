import { BaseFilter } from '../types/FilterTypes';

export class ThresholdFilter implements BaseFilter {
  public id = 'threshold';
  public displayName = 'Threshold';
  public description = 'High contrast black and white binary thresholding';
  public category = 'Monochrome' as const;
  public version = '1.0.0';

  private threshold: number = 120;

  public apply(imageData: ImageData): ImageData {
    const { data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), imageData.width, imageData.height);
    const outData = output.data;

    const len = data.length;
    for (let i = 0; i < len; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const val = lum >= this.threshold ? 255 : 0;

      outData[i]     = val;
      outData[i + 1] = val;
      outData[i + 2] = val;
    }

    return output;
  }
}
