import { Point2D } from '../camera/CoordinateTransformer';
import { QuadOneEuroFilter } from '../tracking/OneEuroFilter';

export interface QuadPolygon {
  P1: Point2D; // LEFT_THUMB
  P2: Point2D; // LEFT_INDEX
  P3: Point2D; // RIGHT_INDEX
  P4: Point2D; // RIGHT_THUMB
}

export class QuadGeometry {
  /**
   * One Euro Filter Instance per session for adaptive velocity-aware temporal smoothing.
   */
  private static filterInstance = new QuadOneEuroFilter();

  /**
   * Smooths quadrilateral points using the One Euro Filter.
   * If tracking was just acquired (previous === null), resets filter history to prevent jumping.
   */
  public static smoothQuad(
    current: QuadPolygon,
    previous: QuadPolygon | null,
    timestampMs: number = performance.now()
  ): QuadPolygon {
    if (!previous) {
      this.filterInstance.reset();
      return this.filterInstance.filter(current, timestampMs);
    }

    return this.filterInstance.filter(current, timestampMs);
  }

  public static resetFilter(): void {
    this.filterInstance.reset();
  }

  /**
   * Calculates quadrilateral surface area in pixels using the Shoelace Formula (Gauss's Area Formula).
   * Math: Area = 0.5 * |(x1*y2 + x2*y3 + x3*y4 + x4*y1) - (x2*y1 + x3*y2 + x4*y3 + x1*y4)|
   * Used to measure frame size and detect collapsed pinch gestures.
   */
  public static getPolygonArea(quad: QuadPolygon): number {
    const { P1, P2, P3, P4 } = quad;
    return Math.abs(
      0.5 *
        (P1.x * P2.y +
          P2.x * P3.y +
          P3.x * P4.y +
          P4.x * P1.y -
          (P2.x * P1.y + P3.x * P2.y + P4.x * P3.y + P1.x * P4.y))
    );
  }

  /**
   * Calculates Axis-Aligned Bounding Box (AABB) enclosing the quadrilateral.
   * Purpose: Critical performance optimization. Instead of reading and filtering the entire 1080p canvas,
   * we only extract and process the rectangular pixel sub-region containing the hand frame.
   */
  public static getBoundingBox(
    quad: QuadPolygon,
    canvasWidth: number,
    canvasHeight: number
  ): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
    const xs = [quad.P1.x, quad.P2.x, quad.P3.x, quad.P4.x];
    const ys = [quad.P1.y, quad.P2.y, quad.P3.y, quad.P4.y];

    // Find extreme coordinates containing all 4 fingertips
    let minX = Math.floor(Math.min(...xs));
    let minY = Math.floor(Math.min(...ys));
    let maxX = Math.ceil(Math.max(...xs));
    let maxY = Math.ceil(Math.max(...ys));

    // Clamp coordinates to canvas boundaries to avoid out-of-bounds ImageData extraction errors
    minX = Math.max(0, minX);
    minY = Math.max(0, minY);
    maxX = Math.min(canvasWidth, maxX);
    maxY = Math.min(canvasHeight, maxY);

    // Ensure dimensions are at least 1px wide/tall
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);

    return { minX, minY, maxX, maxY, width, height };
  }
}
