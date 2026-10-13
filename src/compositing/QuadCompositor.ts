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
   * Calculates aspect-ratio preserving 'cover' dimensions for video rendering.
   */
  private getCoverBounds(
    videoWidth: number,
    videoHeight: number,
    canvasWidth: number,
    canvasHeight: number
  ): { renderWidth: number; renderHeight: number; offsetX: number; offsetY: number } {
    if (videoWidth <= 0 || videoHeight <= 0 || canvasWidth <= 0 || canvasHeight <= 0) {
      return { renderWidth: canvasWidth, renderHeight: canvasHeight, offsetX: 0, offsetY: 0 };
    }

    const videoAspect = videoWidth / videoHeight;
    const canvasAspect = canvasWidth / canvasHeight;

    let renderWidth = canvasWidth;
    let renderHeight = canvasHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (canvasAspect > videoAspect) {
      // Canvas is wider than video stream -> scale by width, crop top/bottom
      renderHeight = canvasWidth / videoAspect;
      offsetY = (canvasHeight - renderHeight) / 2;
    } else {
      // Canvas is taller than video stream -> scale by height, crop left/right
      renderWidth = canvasHeight * videoAspect;
      offsetX = (canvasWidth - renderWidth) / 2;
    }

    return { renderWidth, renderHeight, offsetX, offsetY };
  }

  /**
   * Main Compositing Pipeline:
   * 1. Draws base camera stream to full canvas (handling aspect-ratio cover and mirror flip).
   * 2. Computes the quadrilateral's bounding box to isolate the active region.
   * 3. Extracts only that sub-region of pixel data (ImageData) for high performance.
   * 4. Applies the active visual filter to the cropped pixels on an offscreen canvas.
   * 5. Clips the main canvas using HTML5 Canvas 2D path (`mainCtx.clip()`) along P1-P2-P3-P4.
   * 6. Draws the filtered offscreen canvas into the clipped polygon mask.
   * 7. Renders dashed boundary lines and fingertip indicators.
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
    const videoWidth = videoElement.videoWidth || canvasWidth;
    const videoHeight = videoElement.videoHeight || canvasHeight;

    // Calculate aspect ratio crop and centering offsets
    const { renderWidth, renderHeight, offsetX, offsetY } = this.getCoverBounds(
      videoWidth,
      videoHeight,
      canvasWidth,
      canvasHeight
    );

    // Clear background to black
    mainCtx.fillStyle = '#000000';
    mainCtx.fillRect(0, 0, canvasWidth, canvasHeight);

    const isCutout = Boolean(activeFilter.isCutout || activeFilter.id === 'cutout');

    if (isCutout) {
      // CUTOUT FILTER MODE (Cardboard cutout illusion):
      // - Exterior of HandFrame remains pure black (#000000).
      // - Interior of HandFrame shows the live camera view clipped to the quadrilateral.
      if (!quad) return;

      const bbox = QuadGeometry.getBoundingBox(quad, canvasWidth, canvasHeight);
      if (bbox.width <= 2 || bbox.height <= 2) return;

      // Clip canvas to HandFrame quadrilateral polygon
      mainCtx.save();
      mainCtx.beginPath();
      mainCtx.moveTo(quad.P1.x, quad.P1.y);
      mainCtx.lineTo(quad.P2.x, quad.P2.y);
      mainCtx.lineTo(quad.P3.x, quad.P3.y);
      mainCtx.lineTo(quad.P4.x, quad.P4.y);
      mainCtx.closePath();
      mainCtx.clip(); // Restricts all subsequent draw operations to inside the polygon

      // Draw camera video strictly inside the clipped polygon
      if (isMirrored) {
        mainCtx.translate(canvasWidth, 0);
        mainCtx.scale(-1, 1);
        mainCtx.drawImage(videoElement, offsetX, offsetY, renderWidth, renderHeight);
      } else {
        mainCtx.drawImage(videoElement, offsetX, offsetY, renderWidth, renderHeight);
      }
      mainCtx.restore();

      // Draw dashed boundaries & corner dots
      this.renderBoundingGuides(mainCtx, quad);
      return;
    }

    // STANDARD REGIONAL FILTER MODE:
    // Step 1: Draw full camera feed in background
    mainCtx.save();
    if (isMirrored) {
      mainCtx.translate(canvasWidth, 0);
      mainCtx.scale(-1, 1);
      mainCtx.drawImage(videoElement, offsetX, offsetY, renderWidth, renderHeight);
    } else {
      mainCtx.drawImage(videoElement, offsetX, offsetY, renderWidth, renderHeight);
    }
    mainCtx.restore();

    // If hands are not detected, stop here (shows raw camera feed)
    if (!quad) return;

    // Step 2: Compute bounding box around quadrilateral
    const bbox = QuadGeometry.getBoundingBox(quad, canvasWidth, canvasHeight);
    if (bbox.width <= 2 || bbox.height <= 2) return;

    // Step 3: Extract sub-region pixels and apply filter (skipped for "original" filter)
    if (activeFilter.id !== 'original') {
      try {
        // Performance win: Read only the bounding box sub-region pixels (e.g. 300x300 instead of 1920x1080)
        const subImageData = mainCtx.getImageData(bbox.minX, bbox.minY, bbox.width, bbox.height);

        // Process pixels through filter algorithm (Sobel, color matrix, pixelate, etc.)
        const processedData = activeFilter.apply(subImageData);

        // Transfer filtered pixels onto offscreen canvas
        if (this.offscreenCanvas.width !== bbox.width || this.offscreenCanvas.height !== bbox.height) {
          this.offscreenCanvas.width = bbox.width;
          this.offscreenCanvas.height = bbox.height;
        }
        this.offscreenCtx.putImageData(processedData, 0, 0);

        // Step 4: Clip main canvas to the exact quadrilateral polygon
        mainCtx.save();
        mainCtx.beginPath();
        mainCtx.moveTo(quad.P1.x, quad.P1.y);
        mainCtx.lineTo(quad.P2.x, quad.P2.y);
        mainCtx.lineTo(quad.P3.x, quad.P3.y);
        mainCtx.lineTo(quad.P4.x, quad.P4.y);
        mainCtx.closePath();
        mainCtx.clip();

        // Step 5: Stamp the filtered offscreen canvas over the clipped polygon
        mainCtx.drawImage(this.offscreenCanvas, bbox.minX, bbox.minY);
        mainCtx.restore();
      } catch (err) {
        console.warn('Error during regional filter compositing:', err);
      }
    }

    // Step 6: Render subtle dashed boundary lines and fingertip indicators
    this.renderBoundingGuides(mainCtx, quad);
  }

  /**
   * Draws subtle HandFrame bounding line & fingertip indicators.
   */
  private renderBoundingGuides(mainCtx: CanvasRenderingContext2D, quad: QuadPolygon): void {
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

