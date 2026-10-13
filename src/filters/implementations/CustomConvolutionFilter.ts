import { BaseFilter, FilterCategory } from '../types/FilterTypes';

export class CustomConvolutionFilter implements BaseFilter {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly category: FilterCategory = 'Custom';
  readonly version = '1.0.0';
  readonly filterType = 'CONVOLUTION' as const;

  public kernelSize: 3 | 5;
  public kernel: number[];
  public divisor: number;
  public offset: number;

  constructor(
    id: string,
    displayName: string,
    kernelSize: 3 | 5,
    kernel: number[],
    divisor?: number,
    offset: number = 0,
    description: string = 'Custom spatial convolution kernel filter'
  ) {
    this.id = id;
    this.displayName = displayName;
    this.kernelSize = kernelSize;
    this.kernel = kernel;
    this.offset = offset;
    this.description = description;

    if (divisor !== undefined && divisor !== 0) {
      this.divisor = divisor;
    } else {
      const sum = kernel.reduce((acc, val) => acc + val, 0);
      this.divisor = sum !== 0 ? sum : 1;
    }
  }

  /**
   * Applies a 2D spatial convolution matrix (3x3 or 5x5) over image pixels.
   * Key concepts teachers ask about:
   * 1. Kernel sliding: Moves a small matrix of weights over each pixel and its neighbors.
   * 2. Sum of products: Each color channel (R, G, B) = sum(neighbor_pixel * kernel_weight).
   * 3. Divisor: Normalizes kernel weights to maintain proper image brightness (prevents overexposure).
   * 4. Border Clamping: Replicates edge pixels when kernel extends past image boundary.
   */
  public apply(imageData: ImageData): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const srcData = imageData.data;
    const len = srcData.length;

    // Buffer to hold processed destination pixels without mutating source during iteration
    const output = new Uint8ClampedArray(len);

    const kSize = this.kernelSize;
    const halfK = Math.floor(kSize / 2); // 1 for 3x3, 2 for 5x5
    const kernel = this.kernel;
    const divisor = this.divisor || 1;
    const offset = this.offset;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;

        let kIdx = 0;
        // Iterate over surrounding neighborhood
        for (let ky = -halfK; ky <= halfK; ky++) {
          // CLAMP border policy: keep coordinates inside [0, height-1]
          let pxY = y + ky;
          if (pxY < 0) pxY = 0;
          else if (pxY >= height) pxY = height - 1;

          for (let kx = -halfK; kx <= halfK; kx++) {
            // CLAMP border policy: keep coordinates inside [0, width-1]
            let pxX = x + kx;
            if (pxX < 0) pxX = 0;
            else if (pxX >= width) pxX = width - 1;

            const weight = kernel[kIdx++];
            const srcIdx = (pxY * width + pxX) * 4;

            rSum += srcData[srcIdx] * weight;
            gSum += srcData[srcIdx + 1] * weight;
            bSum += srcData[srcIdx + 2] * weight;
          }
        }

        const dstIdx = (y * width + x) * 4;
        // Normalize by divisor and add brightness offset (e.g. +128 for emboss)
        const nr = rSum / divisor + offset;
        const ng = gSum / divisor + offset;
        const nb = bSum / divisor + offset;

        output[dstIdx] = nr < 0 ? 0 : nr > 255 ? 255 : nr;
        output[dstIdx + 1] = ng < 0 ? 0 : ng > 255 ? 255 : ng;
        output[dstIdx + 2] = nb < 0 ? 0 : nb > 255 ? 255 : nb;
        output[dstIdx + 3] = srcData[dstIdx + 3]; // Preserve original alpha transparency
      }
    }

    // Copy processed pixel data back into imageData
    imageData.data.set(output);
    return imageData;
  }
}
