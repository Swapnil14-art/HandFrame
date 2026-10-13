import { Point2D } from '../camera/CoordinateTransformer';

/**
 * Gesture State Machine States:
 * - READY: Idle state, listening for fingertips to converge.
 * - APPROACHING: Fingertips are within trigger threshold; confirming over consecutive frames (debounce).
 * - TRIGGERED: Frame switch event fired exactly once.
 * - WAITING_FOR_SEPARATION: Requires fingers to spread apart (hysteresis) before accepting new gestures.
 */
export type GestureState = 'READY' | 'APPROACHING' | 'TRIGGERED' | 'WAITING_FOR_SEPARATION';

export interface GestureConfig {
  triggerThreshold?: number; // Normalized distance (0..1) to detect closed pinch (Default: 0.055)
  releaseThreshold?: number; // Distance needed to reset (Default: 0.110) - 2x trigger for hysteresis
  consecutiveFramesRequired?: number; // Minimum frames fingers must stay closed (Default: 3 for debouncing)
  cooldownMs?: number; // Minimum delay between triggers in ms (Default: 500ms)
}

export class GestureController {
  private state: GestureState = 'READY';
  private triggerThreshold: number;
  private releaseThreshold: number;
  private consecutiveFramesRequired: number;
  private cooldownMs: number;

  private frameCounter: number = 0;
  private lastTriggerTime: number = 0;

  private onGestureTriggeredCallback?: () => void;

  constructor(config: GestureConfig = {}) {
    this.triggerThreshold = config.triggerThreshold ?? 0.055;
    this.releaseThreshold = config.releaseThreshold ?? 0.110;
    this.consecutiveFramesRequired = config.consecutiveFramesRequired ?? 3;
    this.cooldownMs = config.cooldownMs ?? 500;
  }

  public setOnGestureTriggered(callback: () => void): void {
    this.onGestureTriggeredCallback = callback;
  }

  public getState(): GestureState {
    return this.state;
  }

  /**
   * Evaluates fingertip positions per frame using a scale-independent Centroid Convergence metric.
   * How it works:
   * 1. Finds the geometric center (centroid C) of all 4 fingertips.
   * 2. Measures distance from C to the furthest fingertip.
   * 3. If that maximum distance is under the threshold, ALL 4 fingers must be pinching together.
   */
  public processFrame(
    points: { P1: Point2D; P2: Point2D; P3: Point2D; P4: Point2D } | null,
    timestampNow: number = performance.now()
  ): {
    state: GestureState;
    distanceNorm: number;
    triggeredThisFrame: boolean;
  } {
    if (!points) {
      // Tracking lost: reset debounce counter to avoid false triggers
      this.frameCounter = 0;
      return { state: this.state, distanceNorm: 1.0, triggeredThisFrame: false };
    }

    const { P1, P2, P3, P4 } = points;
    const pts = [P1, P2, P3, P4];

    // 1. Calculate centroid (average X and Y) of all 4 fingertips
    const cx = (P1.x + P2.x + P3.x + P4.x) / 4;
    const cy = (P1.y + P2.y + P3.y + P4.y) / 4;

    // 2. Find max squared Euclidean distance from any fingertip to the centroid.
    // Requiring max distance <= threshold guarantees every single fingertip has converged.
    let maxDistToCentroidSq = 0;
    for (const pt of pts) {
      const dx = pt.x - cx;
      const dy = pt.y - cy;
      const distSq = dx * dx + dy * dy;
      if (distSq > maxDistToCentroidSq) {
        maxDistToCentroidSq = distSq;
      }
    }

    const maxDistNorm = Math.sqrt(maxDistToCentroidSq);
    let triggeredThisFrame = false;

    // Guard: Prevent triggers during active cooldown period (500ms)
    const timeSinceLastTrigger = timestampNow - this.lastTriggerTime;
    const isCooldownActive = timeSinceLastTrigger < this.cooldownMs;

    // State Machine Transition Logic:
    switch (this.state) {
      case 'READY':
        // Fingertips closed and cooldown passed -> start confirming gesture
        if (maxDistNorm < this.triggerThreshold && !isCooldownActive) {
          this.state = 'APPROACHING';
          this.frameCounter = 1;
        } else {
          this.frameCounter = 0;
        }
        break;

      case 'APPROACHING':
        if (maxDistNorm < this.triggerThreshold && !isCooldownActive) {
          this.frameCounter++;
          // Debounce: verify gesture held steadily for 3 consecutive frames
          if (this.frameCounter >= this.consecutiveFramesRequired) {
            // TRIGGER GESTURE (Fire callback to advance to next filter)
            this.state = 'TRIGGERED';
            triggeredThisFrame = true;
            this.lastTriggerTime = timestampNow;

            if (this.onGestureTriggeredCallback) {
              this.onGestureTriggeredCallback();
            }

            // Immediately switch to waiting state to prevent multiple triggers in one pinch
            this.state = 'WAITING_FOR_SEPARATION';
            this.frameCounter = 0;
          }
        } else {
          // Hand moved or opened before reaching frame count threshold
          this.state = 'READY';
          this.frameCounter = 0;
        }
        break;

      case 'WAITING_FOR_SEPARATION':
        // HYSTERESIS: User must actively open their hands beyond releaseThreshold (0.110)
        // This prevents jitter around the 0.055 boundary from re-triggering.
        if (maxDistNorm > this.releaseThreshold && !isCooldownActive) {
          this.state = 'READY';
          this.frameCounter = 0;
        }
        break;

      case 'TRIGGERED':
        // Fallback transition
        this.state = 'WAITING_FOR_SEPARATION';
        this.frameCounter = 0;
        break;
    }

    return {
      state: this.state,
      distanceNorm: maxDistNorm,
      triggeredThisFrame,
    };
  }

  public reset(): void {
    this.state = 'READY';
    this.frameCounter = 0;
    this.lastTriggerTime = 0;
  }
}
