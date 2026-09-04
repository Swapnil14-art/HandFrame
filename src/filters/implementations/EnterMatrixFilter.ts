import { BaseFilter } from '../types/FilterTypes';

export class EnterMatrixFilter implements BaseFilter {
  public id = 'enter_matrix';
  public displayName = 'Enter Matrix';
  public description = 'Dense green dot matrix with deep black luminance shadows';
  public category = 'Retro' as const;
  public version = '2.0.0';

  private cellSize: number = 4; // Dense 4x4px straight grid

  public apply(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), width, height);
    const outData = output.data;

    for (let y = 0; y < height; y += this.cellSize) {
      for (let x = 0; x < width; x += this.cellSize) {
        let totalLum = 0;
        let count = 0;

        // Sample 4x4 block luminance
        for (let py = 0; py < this.cellSize && y + py < height; py++) {
          for (let px = 0; px < this.cellSize && x + px < width; px++) {
            const idx = ((y + py) * width + (x + px)) * 4;
            totalLum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            count++;
          }
        }

        const avgLum = count > 0 ? totalLum / count : 0;

        // Determine green vs black tonal threshold based on original image luminance
        // Dark areas (eyes, nose, hair, deep shadows) -> PURE BLACK
        for (let py = 0; py < this.cellSize && y + py < height; py++) {
          for (let px = 0; px < this.cellSize && x + px < width; px++) {
            const outIdx = ((y + py) * width + (x + px)) * 4;

            if (avgLum < 65) {
              // Dark facial features & shadows -> Pure Black
              outData[outIdx]     = 0;
              outData[outIdx + 1] = 0;
              outData[outIdx + 2] = 0;
            } else {
              // Matrix dot pattern: center 2x2 dot inside 4x4 block
              const isCenterDot = py >= 1 && py <= 2 && px >= 1 && px <= 2;

              if (isCenterDot) {
                if (avgLum > 160) {
                  // High highlights -> Bright Mint Neon Green Dot
                  outData[outIdx]     = 80;
                  outData[outIdx + 1] = 255;
                  outData[outIdx + 2] = 140;
                } else {
                  // Midtones -> Matrix Emerald Green Dot
                  const greenVal = Math.min(255, Math.round(110 + (avgLum - 65) * 1.2));
                  outData[outIdx]     = 0;
                  outData[outIdx + 1] = greenVal;
                  outData[outIdx + 2] = Math.round(greenVal * 0.25);
                }
              } else {
                // Cell gap margin -> Dark Green / Black grid outline
                outData[outIdx]     = 0;
                outData[outIdx + 1] = avgLum > 180 ? 30 : 0;
                outData[outIdx + 2] = 0;
              }
            }
          }
        }
      }
    }

    return output;
  }
}
