import { BaseFilter } from '../filters/types/FilterTypes';
import { QuadPolygon, QuadGeometry } from '../geometry/QuadGeometry';

export class QuadCompositor {
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D;

  constructor() {
    this.offscreenCanvas = document.createElement('canvas');
    const ctx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Failed to create offscreen 2D canvas context');
    }
    this.offscreenCtx = ctx;
  }

  /**
   * Composites camera frame with regional quadrilateral filter.
   */
  public renderFrame(
    mainCtx: CanvasRenderingContext2D,
    videoElement: HTMLVideoElement,
    canvasWidth: number,
    canvasHeight: number,
    quad: QuadPolygon | null,
    activeFilter: BaseFilter,
    isMirrored: boolean = false
  ): void {
    // 1. Draw background raw camera video feed
    mainCtx.save();
    if (isMirrored) {
      mainCtx.translate(canvasWidth, 0);
      mainCtx.scale(-1, 1);
    }
    mainCtx.drawImage(videoElement, 0, 0, canvasWidth, canvasHeight);
    mainCtx.restore();

    if (!quad) return;

    // 2. Compute bounding box around quadrilateral
    const bbox = QuadGeometry.getBoundingBox(quad, canvasWidth, canvasHeight);
    if (bbox.width <= 2 || bbox.height <= 2) return;

    // 3. Extract sub-region ImageData if not Original filter
    if (activeFilter.id !== 'original') {
      try {
        const subImageData = mainCtx.getImageData(bbox.minX, bbox.minY, bbox.width, bbox.height);

        // Apply active filter module
        const processedData = activeFilter.apply(subImageData);

        // Resize offscreen canvas & put processed image
        if (this.offscreenCanvas.width !== bbox.width || this.offscreenCanvas.height !== bbox.height) {
          this.offscreenCanvas.width = bbox.width;
          this.offscreenCanvas.height = bbox.height;
        }
        this.offscreenCtx.putImageData(processedData, 0, 0);

        // 4. Clip main canvas to quadrilateral polygon path
        mainCtx.save();
        mainCtx.beginPath();
        mainCtx.moveTo(quad.P1.x, quad.P1.y);
        mainCtx.lineTo(quad.P2.x, quad.P2.y);
        mainCtx.lineTo(quad.P3.x, quad.P3.y);
        mainCtx.lineTo(quad.P4.x, quad.P4.y);
        mainCtx.closePath();
        mainCtx.clip();

        // 5. Draw filtered sub-image inside clipped polygon
        mainCtx.drawImage(this.offscreenCanvas, bbox.minX, bbox.minY);
        mainCtx.restore();
      } catch (err) {
        console.warn('Error during regional filter compositing:', err);
      }
    }

    // 6. Draw subtle, elegant HandFrame bounding line & fingertip indicators
    mainCtx.save();
    mainCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    mainCtx.lineWidth = 1.5;
    mainCtx.setLineDash([6, 6]);

    mainCtx.beginPath();
    mainCtx.moveTo(quad.P1.x, quad.P1.y);
    mainCtx.lineTo(quad.P2.x, quad.P2.y);
    mainCtx.lineTo(quad.P3.x, quad.P3.y);
    mainCtx.lineTo(quad.P4.x, quad.P4.y);
    mainCtx.closePath();
    mainCtx.stroke();

    // Corner dots at fingertips
    const points = [quad.P1, quad.P2, quad.P3, quad.P4];
    mainCtx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    points.forEach((pt) => {
      mainCtx.beginPath();
      mainCtx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      mainCtx.fill();
    });

    mainCtx.restore();
  }
}
