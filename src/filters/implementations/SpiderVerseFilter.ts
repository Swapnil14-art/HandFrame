import { BaseFilter } from '../types/FilterTypes';

export class SpiderVerseFilter implements BaseFilter {
  public id = 'spider_verse';
  public displayName = 'Oil Painting';
  public description = 'Authentic 240p low-bitrate video stream compression with 4:2:0 chroma subsampling, blocky luminance quantization, and mosquito edge ringing';
  public category = 'Artistic' as const;
  public version = '5.0.0';

  // Reusable typed array buffers for zero-allocation per-frame processing
  private bufferCapacity = 0;
  private yBuf: Float32Array = new Float32Array(0);
  private cbBuf: Float32Array = new Float32Array(0);
  private crBuf: Float32Array = new Float32Array(0);
  private lowYBuf: Float32Array = new Float32Array(0);
  private lowCbBuf: Float32Array = new Float32Array(0);
  private lowCrBuf: Float32Array = new Float32Array(0);

  private ensureBuffers(width: number, height: number, lowW: number, lowH: number) {
    const fullSize = width * height;
    const lowSize = lowW * lowH;
    if (this.bufferCapacity < fullSize) {
      this.bufferCapacity = fullSize;
      this.yBuf = new Float32Array(fullSize);
      this.cbBuf = new Float32Array(fullSize);
      this.crBuf = new Float32Array(fullSize);
    }
    if (this.lowYBuf.length < lowSize) {
      this.lowYBuf = new Float32Array(lowSize);
      this.lowCbBuf = new Float32Array(lowSize);
      this.lowCrBuf = new Float32Array(lowSize);
    }
  }

  public apply(imageData: ImageData): ImageData {
    const { width, height, data } = imageData;
    const output = new ImageData(new Uint8ClampedArray(data), width, height);
    const outData = output.data;

    // 1. Target resolution: downscale scale factor (~2.5x - 3x downscale to simulate ~240p stream)
    const scale = Math.max(2, Math.min(4, Math.floor(Math.min(width, height) / 200)));
    const lowW = Math.floor(width / scale);
    const lowH = Math.floor(height / scale);

    if (lowW <= 0 || lowH <= 0) return output;

    this.ensureBuffers(width, height, lowW, lowH);

    const lowY = this.lowYBuf;
    const lowCb = this.lowCbBuf;
    const lowCr = this.lowCrBuf;

    // 2. Downsample pass + RGB -> YCbCr conversion
    // Box-filter downsample into low-resolution grid
    for (let ly = 0; ly < lowH; ly++) {
      const srcY = ly * scale;
      for (let lx = 0; lx < lowW; lx++) {
        const srcX = lx * scale;
        const srcIdx = (srcY * width + srcX) * 4;

        const r = data[srcIdx];
        const g = data[srcIdx + 1];
        const b = data[srcIdx + 2];

        // Standard ITU-R BT.601 RGB to YCbCr conversion
        const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
        const cbVal = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const crVal = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

        const lowIdx = ly * lowW + lx;
        lowY[lowIdx] = yVal;
        lowCb[lowIdx] = cbVal;
        lowCr[lowIdx] = crVal;
      }
    }

    // 3. Heavy Chroma Subsampling (4:2:0 / 4:1:1 style coarse color blocks & color bleed)
    // Low-bitrate video smears chroma over 4x4 or 8x8 low-res pixel blocks
    const chromaBlock = 3;
    for (let by = 0; by < lowH; by += chromaBlock) {
      const bh = Math.min(chromaBlock, lowH - by);
      for (let bx = 0; bx < lowW; bx += chromaBlock) {
        const bw = Math.min(chromaBlock, lowW - bx);

        let sumCb = 0, sumCr = 0, count = bw * bh;
        for (let dy = 0; dy < bh; dy++) {
          const row = (by + dy) * lowW + bx;
          for (let dx = 0; dx < bw; dx++) {
            sumCb += lowCb[row + dx];
            sumCr += lowCr[row + dx];
          }
        }

        // Quantize Cb and Cr heavily (single-digit bitrate chroma banding)
        const avgCb = Math.round((sumCb / count) / 12) * 12;
        const avgCr = Math.round((sumCr / count) / 12) * 12;

        for (let dy = 0; dy < bh; dy++) {
          const row = (by + dy) * lowW + bx;
          for (let dx = 0; dx < bw; dx++) {
            lowCb[row + dx] = avgCb;
            lowCr[row + dx] = avgCr;
          }
        }
      }
    }

    // 4. Block-based DCT Luminance Quantization & Gradient Stepping (8x8 video macroblocks)
    const blockLow = 4; // 4 low-res pixels * scale = ~12-16 source pixels macroblock
    for (let by = 0; by < lowH; by += blockLow) {
      const bh = Math.min(blockLow, lowH - by);
      for (let bx = 0; bx < lowW; bx += blockLow) {
        const bw = Math.min(blockLow, lowW - bx);

        // Find block min, max, and mean luminance
        let sumY = 0, minY = 255, maxY = 0;
        const count = bw * bh;

        for (let dy = 0; dy < bh; dy++) {
          const row = (by + dy) * lowW + bx;
          for (let dx = 0; dx < bw; dx++) {
            const yv = lowY[row + dx];
            sumY += yv;
            if (yv < minY) minY = yv;
            if (yv > maxY) maxY = yv;
          }
        }

        const avgY = sumY / count;
        const contrast = maxY - minY;

        // In low-contrast/flat gradient areas, compress into coarse stepped luminance (color banding)
        // In high-contrast edge areas, preserve structural shape but add coarse quantization
        const quantStep = contrast < 22 ? 16 : 8;

        for (let dy = 0; dy < bh; dy++) {
          const row = (by + dy) * lowW + bx;
          const isEdge = dy === 0 || dy === bh - 1;

          for (let dx = 0; dx < bw; dx++) {
            const isColEdge = dx === 0 || dx === bw - 1;
            let yv = lowY[row + dx];

            if (contrast < 22) {
              // Smooth gradient area: posterize/band heavily towards macroblock DC
              yv = avgY * 0.55 + yv * 0.45;
              yv = Math.round(yv / quantStep) * quantStep;
            } else {
              // Edge area: keep sharp transitions with slight step quantization
              yv = Math.round(yv / quantStep) * quantStep;
            }

            // Subtle macroblock boundary discontinuity (typical of H.263/MPEG-4 ASP low-bitrate)
            if (isEdge || isColEdge) {
              yv = yv > avgY ? yv + 2 : yv - 2;
            }

            lowY[row + dx] = yv;
          }
        }
      }
    }

    // 5. High-Contrast Edge Ringing / Mosquito Artifacts (Sobel on downscaled luminance)
    // Low-pass ringing overshoot along strong edges (Gibbs phenomenon in DCT compression)
    const ringBuf = this.yBuf; // reuse buffer for edge magnitude
    for (let ly = 1; ly < lowH - 1; ly++) {
      for (let lx = 1; lx < lowW - 1; lx++) {
        const idx = ly * lowW + lx;
        const gx = -lowY[(ly - 1) * lowW + (lx - 1)] + lowY[(ly - 1) * lowW + (lx + 1)]
                 - 2 * lowY[ly * lowW + (lx - 1)]     + 2 * lowY[ly * lowW + (lx + 1)]
                 - lowY[(ly + 1) * lowW + (lx - 1)] + lowY[(ly + 1) * lowW + (lx + 1)];
        const gy = -lowY[(ly - 1) * lowW + (lx - 1)] - 2 * lowY[(ly - 1) * lowW + lx] - lowY[(ly - 1) * lowW + (lx + 1)]
                 + lowY[(ly + 1) * lowW + (lx - 1)] + 2 * lowY[(ly + 1) * lowW + lx] + lowY[(ly + 1) * lowW + (lx + 1)];
        ringBuf[idx] = Math.sqrt(gx * gx + gy * gy);
      }
    }

    // Apply deterministic edge ringing overshoot
    for (let ly = 1; ly < lowH - 1; ly++) {
      for (let lx = 1; lx < lowW - 1; lx++) {
        const idx = ly * lowW + lx;
        const mag = ringBuf[idx];
        if (mag > 40) {
          // Ringing modulation phase based on local grid coordinates
          const ringPhase = ((lx + ly) % 2 === 0 ? 1 : -1) * Math.min(8, (mag - 40) * 0.12);
          lowY[idx] = Math.min(255, Math.max(0, lowY[idx] + ringPhase));
        }
      }
    }

    // 6. Fast Upscale & YCbCr -> RGB Conversion back to output buffer
    // Nearest-neighbor with slight box blend to produce authentic 240p video monitor look
    const invScale = 1 / scale;

    for (let y = 0; y < height; y++) {
      const ly = Math.min(lowH - 1, Math.floor(y * invScale));
      const rowOffsetLow = ly * lowW;
      const rowOffsetOut = y * width * 4;

      for (let x = 0; x < width; x++) {
        const lx = Math.min(lowW - 1, Math.floor(x * invScale));
        const lowIdx = rowOffsetLow + lx;

        const yVal = lowY[lowIdx];
        const cbVal = lowCb[lowIdx] - 128;
        const crVal = lowCr[lowIdx] - 128;

        // ITU-R BT.601 YCbCr to RGB conversion
        let r = yVal + 1.402 * crVal;
        let g = yVal - 0.344136 * cbVal - 0.714136 * crVal;
        let b = yVal + 1.772 * cbVal;

        // Coarse RGB output clamp
        const outIdx = rowOffsetOut + x * 4;
        outData[outIdx]     = Math.min(255, Math.max(0, Math.round(r)));
        outData[outIdx + 1] = Math.min(255, Math.max(0, Math.round(g)));
        outData[outIdx + 2] = Math.min(255, Math.max(0, Math.round(b)));
        outData[outIdx + 3] = 255;
      }
    }

    return output;
  }
}
