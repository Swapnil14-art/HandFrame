import { BaseFilter, FilterCategory } from '../types/FilterTypes';

export class CustomColorMatrixFilter implements BaseFilter {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly category: FilterCategory = 'Custom';
  readonly version = '1.0.0';
  readonly filterType = 'COLOR_MATRIX' as const;

  // 3x3 Transformation Matrix: [a, b, c, d, e, f, g, h, i]
  public matrix: number[];
  // RGB Offsets: [rOffset, gOffset, bOffset]
  public offsets: number[];

  constructor(
    id: string,
    displayName: string,
    matrix: number[],
    offsets: number[] = [0, 0, 0],
    description: string = 'Custom 3x3 color transformation matrix filter'
  ) {
    this.id = id;
    this.displayName = displayName;
    this.matrix = matrix.length === 9 ? matrix : [1, 0, 0, 0, 1, 0, 0, 0, 1];
    this.offsets = offsets.length === 3 ? offsets : [0, 0, 0];
    this.description = description;
  }

  public apply(imageData: ImageData): ImageData {
    const data = imageData.data;
    const len = data.length;
    const [a, b, c, d, e, f, g, h, i] = this.matrix;
    const [rOff, gOff, bOff] = this.offsets;

    for (let idx = 0; idx < len; idx += 4) {
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const nr = a * r + b * g + c * b + rOff;
      const ng = d * r + e * g + f * b + gOff;
      const nb = g * r + h * g + i * b + bOff;

      data[idx] = nr < 0 ? 0 : nr > 255 ? 255 : nr;
      data[idx + 1] = ng < 0 ? 0 : ng > 255 ? 255 : ng;
      data[idx + 2] = nb < 0 ? 0 : nb > 255 ? 255 : nb;
    }

    return imageData;
  }
}
