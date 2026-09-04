import { BaseFilter } from '../types/FilterTypes';

export class GreenPixelFilter implements BaseFilter {
  public id = 'green_pixel';
  public displayName = 'Green Pixel';
  public description = 'Pixelated retro green phosphor matrix terminal effect';
  public category = 'Retro' as const;
  public version = '1.0.0';

  private pixelSize: number = 6;

  public apply(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), width, height);
    const outData = output.data;

    for (let y = 0; y < height; y += this.pixelSize) {
      for (let x = 0; x < width; x += this.pixelSize) {
        let totalLum = 0;
        let count = 0;

        for (let py = 0; py < this.pixelSize && y + py < height; py++) {
          for (let px = 0; px < this.pixelSize && x + px < width; px++) {
            const idx = ((y + py) * width + (x + px)) * 4;
            totalLum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            count++;
          }
        }

        const avgLum = count > 0 ? totalLum / count : 0;
        const norm = avgLum / 255; // 0.0 to 1.0

        // Map to green phosphor spectrum: Dark Forest Green -> Neon Matrix Lime Green -> Soft Mint White
        const r = Math.round(norm * 40);
        const g = Math.round(Math.min(255, norm * 240 + 15));
        const b = Math.round(norm * 60);

        for (let py = 0; py < this.pixelSize && y + py < height; py++) {
          for (let px = 0; px < this.pixelSize && x + px < width; px++) {
            const outIdx = ((y + py) * width + (x + px)) * 4;
            outData[outIdx]     = r;
            outData[outIdx + 1] = g;
            outData[outIdx + 2] = b;
          }
        }
      }
    }

    return output;
  }
}
