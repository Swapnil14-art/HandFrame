import { BaseFilter } from '../types/FilterTypes';

export class SpiderVerseFilter implements BaseFilter {
  public id = 'spider_verse';
  public displayName = 'Oil Painting';
  public description = 'Ultra low-bitrate 240p digital video compression aesthetic with heavy macroblock quantization, chroma subsampling, and ringing artifacts';
  public category = 'Artistic' as const;
  public version = '4.0.0';

  public apply(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), width, height);
    const outData = output.data;

    // Macroblock grid size (8x8 DCT-like block compression typical of low-bitrate 240p video)
    const blockSize = 8;
    const time = Date.now() / 100;

    // Fast block-by-block DCT/macroblock quantization pass
    for (let by = 0; by < height; by += blockSize) {
      const blockH = Math.min(blockSize, height - by);

      for (let bx = 0; bx < width; bx += blockSize) {
        const blockW = Math.min(blockSize, width - bx);
        const count = blockW * blockH;

        // Calculate average block color (DC coefficient in low bitrate)
        let sumR = 0, sumG = 0, sumB = 0;
        for (let dy = 0; dy < blockH; dy++) {
          const rowOffset = ((by + dy) * width + bx) * 4;
          for (let dx = 0; dx < blockW; dx++) {
            const idx = rowOffset + dx * 4;
            sumR += data[idx];
            sumG += data[idx + 1];
            sumB += data[idx + 2];
          }
        }

        const avgR = sumR / count;
        const avgG = sumG / count;
        const avgB = sumB / count;

        // Severe Color Quantization (Single-digit bitrate color compression / posterization)
        // Quantize DC levels to rough 16-32 step buckets
        const quantDC_R = Math.round(avgR / 24) * 24;
        const quantDC_G = Math.round(avgG / 24) * 24;
        const quantDC_B = Math.round(avgB / 28) * 28;

        // Slight block boundary ringing/quantization noise
        const blockHash = Math.sin(bx * 12.9898 + by * 78.233 + Math.floor(time * 0.05)) * 43758.5453;
        const blockJitter = (blockHash - Math.floor(blockHash) - 0.5) * 8;

        // Render pixels in current macroblock with low-pass AC coefficients + DCT boundary artifacts
        for (let dy = 0; dy < blockH; dy++) {
          const y = by + dy;
          const isTopOrBottomEdge = dy === 0 || dy === blockH - 1;

          for (let dx = 0; dx < blockW; dx++) {
            const x = bx + dx;
            const isLeftOrRightEdge = dx === 0 || dx === blockW - 1;
            const origIdx = (y * width + x) * 4;

            // Retain small low-frequency detail from original (low bitrate preserves minimal gradient)
            const origR = data[origIdx];
            const origG = data[origIdx + 1];
            const origB = data[origIdx + 2];

            // Blend 75% heavy block DC quantization with 25% quantized original detail
            let r = quantDC_R * 0.75 + (Math.round(origR / 28) * 28) * 0.25 + blockJitter;
            let g = quantDC_G * 0.75 + (Math.round(origG / 28) * 28) * 0.25 + blockJitter;
            let b = quantDC_B * 0.75 + (Math.round(origB / 32) * 32) * 0.25 + blockJitter;

            // 240p Macroblock boundary discontinuity / grid line compression artifact
            if (isTopOrBottomEdge || isLeftOrRightEdge) {
              r = r * 0.92 + 3;
              g = g * 0.92 + 3;
              b = b * 0.92 + 5;
            }

            // Low-bitrate ringing/banding wave pattern
            const ringing = Math.sin((dx + dy) * 1.8) * 3.5;
            r += ringing;
            g += ringing;
            b += ringing;

            // Clamp output
            outData[origIdx]     = Math.min(255, Math.max(0, Math.round(r)));
            outData[origIdx + 1] = Math.min(255, Math.max(0, Math.round(g)));
            outData[origIdx + 2] = Math.min(255, Math.max(0, Math.round(b)));
            outData[origIdx + 3] = 255;
          }
        }
      }
    }

    return output;
  }
}
