import { BaseFilter } from '../types/FilterTypes';

export class GrayscaleFilter implements BaseFilter {
  readonly id = 'grayscale';
  readonly displayName = 'Grayscale';
  readonly description = 'Classic monochrome black-and-white high contrast conversion.';
  readonly category = 'Monochrome' as const;
  readonly version = '1.0.0';

  /**
   * Converts RGB pixels to grayscale using ITU-R BT.601 Perceptual Luminance:
   * Formula: Y = 0.299 * R + 0.587 * G + 0.114 * B
   * Why these weights? Human eyes are most sensitive to green wavelengths and least sensitive to blue.
   */
  apply(imageData: ImageData): ImageData {
    const data = imageData.data;
    const len = data.length;

    for (let i = 0; i < len; i += 4) {
      // Calculate weighted perceptual brightness
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = lum;     // Set R
      data[i + 1] = lum; // Set G
      data[i + 2] = lum; // Set B
    }

    return imageData;
  }
}
