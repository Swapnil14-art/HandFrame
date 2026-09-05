import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { Point2D } from '../camera/CoordinateTransformer';

export type TrackingStatus =
  | 'NO_HANDS'
  | 'ONE_HAND'
  | 'TWO_HANDS'
  | 'TRACKING_STABLE'
  | 'TRACKING_DEGRADED';

export interface HandFramePoints {
  P1: Point2D; // LEFT_THUMB  (Landmark 4 of Left Hand)
  P2: Point2D; // LEFT_INDEX  (Landmark 8 of Left Hand)
  P3: Point2D; // RIGHT_INDEX (Landmark 8 of Right Hand)
  P4: Point2D; // RIGHT_THUMB (Landmark 4 of Right Hand)
  confidence: number;
  status: TrackingStatus;
  isGraceFrame?: boolean;
}

interface PointVelocity {
  vx: number;
  vy: number;
}

export class HandTracker {
  private handLandmarker: HandLandmarker | null = null;
  private isInitializing: boolean = false;
  private isReady: boolean = false;

  // Temporal persistence & short-term predictive grace period
  private lastValidPoints: HandFramePoints | null = null;
  private lastTimestamp: number = 0;
  private graceFramesCount: number = 0;
  private readonly maxGraceFrames: number = 10; // ~300ms grace period at 30+ fps

  // Velocity tracking per fingertip landmark for short-term prediction
  private velocities: { P1: PointVelocity; P2: PointVelocity; P3: PointVelocity; P4: PointVelocity } = {
    P1: { vx: 0, vy: 0 },
    P2: { vx: 0, vy: 0 },
    P3: { vx: 0, vy: 0 },
    P4: { vx: 0, vy: 0 },
  };

  // Temporal palm center tracking to maintain hand identity during 180° rotations & hand crossing
  private lastLeftCenter: Point2D | null = null;
  private lastRightCenter: Point2D | null = null;

  public async initialize(): Promise<void> {
    if (this.isReady || this.isInitializing) return;
    this.isInitializing = true;

    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.45,
        minHandPresenceConfidence: 0.45,
        minTrackingConfidence: 0.45,
      });

      this.isReady = true;
      this.isInitializing = false;
    } catch (err) {
      console.warn('GPU delegate failed for HandLandmarker, attempting CPU fallback:', err);
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.4,
          minHandPresenceConfidence: 0.4,
          minTrackingConfidence: 0.4,
        });

        this.isReady = true;
        this.isInitializing = false;
      } catch (fallbackErr) {
        this.isInitializing = false;
        console.error('Fatal: Failed to initialize HandLandmarker:', fallbackErr);
        throw fallbackErr;
      }
    }
  }

  public getIsReady(): boolean {
    return this.isReady;
  }

  /**
   * Detects 2 hands and extracts fingertips strictly in absolute semantic order:
   * [LEFT_THUMB, LEFT_INDEX, RIGHT_INDEX, RIGHT_THUMB]
   */
  public detect(
    videoElement: HTMLVideoElement,
    timestamp: number,
    _isMirrored: boolean = false
  ): HandFramePoints | null {
    if (!this.handLandmarker || !this.isReady) return null;
    if (videoElement.readyState < 2) return null;

    const dt = this.lastTimestamp > 0 ? Math.max(0.005, (timestamp - this.lastTimestamp) / 1000) : 0.033;
    this.lastTimestamp = timestamp;

    try {
      const results = this.handLandmarker.detectForVideo(videoElement, timestamp);

      const hasTwoHands = results && results.landmarks && results.landmarks.length >= 2;

      if (!hasTwoHands) {
        // PREDICTIVE GRACE PERIOD: Extrapolate with damped velocity during short tracking drops
        if (this.lastValidPoints && this.graceFramesCount < this.maxGraceFrames) {
          this.graceFramesCount++;
          const decay = Math.pow(0.82, this.graceFramesCount);

          const P1: Point2D = {
            x: Math.min(1, Math.max(0, this.lastValidPoints.P1.x + this.velocities.P1.vx * dt * decay)),
            y: Math.min(1, Math.max(0, this.lastValidPoints.P1.y + this.velocities.P1.vy * dt * decay)),
          };
          const P2: Point2D = {
            x: Math.min(1, Math.max(0, this.lastValidPoints.P2.x + this.velocities.P2.vx * dt * decay)),
            y: Math.min(1, Math.max(0, this.lastValidPoints.P2.y + this.velocities.P2.vy * dt * decay)),
          };
          const P3: Point2D = {
            x: Math.min(1, Math.max(0, this.lastValidPoints.P3.x + this.velocities.P3.vx * dt * decay)),
            y: Math.min(1, Math.max(0, this.lastValidPoints.P3.y + this.velocities.P3.vy * dt * decay)),
          };
          const P4: Point2D = {
            x: Math.min(1, Math.max(0, this.lastValidPoints.P4.x + this.velocities.P4.vx * dt * decay)),
            y: Math.min(1, Math.max(0, this.lastValidPoints.P4.y + this.velocities.P4.vy * dt * decay)),
          };

          const predictedPoints: HandFramePoints = {
            P1,
            P2,
            P3,
            P4,
            confidence: Math.max(0.2, this.lastValidPoints.confidence * 0.9),
            status: 'TRACKING_DEGRADED',
            isGraceFrame: true,
          };
          this.lastValidPoints = predictedPoints;
          return predictedPoints;
        }

        // Grace period expired
        this.resetHistory();
        return null;
      }

      const hand0 = results.landmarks[0];
      const hand1 = results.landmarks[1];

      const h0Label = results.handednesses?.[0]?.[0]?.categoryName; // 'Right' or 'Left'
      const h1Label = results.handednesses?.[1]?.[0]?.categoryName; // 'Right' or 'Left'

      const { leftHand, rightHand } = this.assignHands(hand0, hand1, h0Label, h1Label);

      // Confidence computation
      const score0 = results.handednesses?.[0]?.[0]?.score || 0.85;
      const score1 = results.handednesses?.[1]?.[0]?.score || 0.85;
      const confidence = (score0 + score1) / 2;

      // MANDATORY ABSOLUTE SEMANTIC FINGERTIP ORDERING:
      // P1: LEFT_THUMB  (landmark 4 of Left Hand)
      // P2: LEFT_INDEX  (landmark 8 of Left Hand)
      // P3: RIGHT_INDEX (landmark 8 of Right Hand)
      // P4: RIGHT_THUMB (landmark 4 of Right Hand)
      const leftThumb: Point2D  = { x: leftHand[4].x,  y: leftHand[4].y };
      const leftIndex: Point2D  = { x: leftHand[8].x,  y: leftHand[8].y };
      const rightIndex: Point2D = { x: rightHand[8].x, y: rightHand[8].y };
      const rightThumb: Point2D = { x: rightHand[4].x, y: rightHand[4].y };

      // Update landmark velocity vectors for short-term prediction
      if (this.lastValidPoints) {
        const smoothV = (newVal: number, oldVal: number, vOld: number) => {
          const instV = (newVal - oldVal) / dt;
          return vOld * 0.4 + instV * 0.6;
        };

        this.velocities.P1 = {
          vx: smoothV(leftThumb.x, this.lastValidPoints.P1.x, this.velocities.P1.vx),
          vy: smoothV(leftThumb.y, this.lastValidPoints.P1.y, this.velocities.P1.vy),
        };
        this.velocities.P2 = {
          vx: smoothV(leftIndex.x, this.lastValidPoints.P2.x, this.velocities.P2.vx),
          vy: smoothV(leftIndex.y, this.lastValidPoints.P2.y, this.velocities.P2.vy),
        };
        this.velocities.P3 = {
          vx: smoothV(rightIndex.x, this.lastValidPoints.P3.x, this.velocities.P3.vx),
          vy: smoothV(rightIndex.y, this.lastValidPoints.P3.y, this.velocities.P3.vy),
        };
        this.velocities.P4 = {
          vx: smoothV(rightThumb.x, this.lastValidPoints.P4.x, this.velocities.P4.vx),
          vy: smoothV(rightThumb.y, this.lastValidPoints.P4.y, this.velocities.P4.vy),
        };
      }

      const currentPoints: HandFramePoints = {
        P1: leftThumb,
        P2: leftIndex,
        P3: rightIndex,
        P4: rightThumb,
        confidence,
        status: 'TRACKING_STABLE',
        isGraceFrame: false,
      };

      this.graceFramesCount = 0;
      this.lastValidPoints = currentPoints;

      return currentPoints;
    } catch (err) {
      console.warn('Error during hand detection frame:', err);
      if (this.lastValidPoints && this.graceFramesCount < this.maxGraceFrames) {
        this.graceFramesCount++;
        return {
          ...this.lastValidPoints,
          status: 'TRACKING_DEGRADED',
          isGraceFrame: true,
        };
      }
      return null;
    }
  }

  /**
   * Assigns detected MediaPipe hands to Left Hand and Right Hand.
   * Uses temporal palm center tracking to maintain identity when hands invert (rotate 180°).
   */
  private assignHands(
    hand0: any[],
    hand1: any[],
    h0Label?: string,
    h1Label?: string
  ): { leftHand: any[]; rightHand: any[] } {
    const h0Center = { x: hand0[9].x, y: hand0[9].y };
    const h1Center = { x: hand1[9].x, y: hand1[9].y };

    if (this.lastLeftCenter && this.lastRightCenter) {
      const distA = this.distSq(h0Center, this.lastLeftCenter) + this.distSq(h1Center, this.lastRightCenter);
      const distB = this.distSq(h1Center, this.lastLeftCenter) + this.distSq(h0Center, this.lastRightCenter);

      if (distA <= distB) {
        this.lastLeftCenter = h0Center;
        this.lastRightCenter = h1Center;
        return { leftHand: hand0, rightHand: hand1 };
      } else {
        this.lastLeftCenter = h1Center;
        this.lastRightCenter = h0Center;
        return { leftHand: hand1, rightHand: hand0 };
      }
    }

    // Initial frame assignment (no previous history):
    let leftHand = hand0;
    let rightHand = hand1;

    if (h0Label === 'Left' && h1Label === 'Right') {
      leftHand = hand0;
      rightHand = hand1;
    } else if (h0Label === 'Right' && h1Label === 'Left') {
      leftHand = hand1;
      rightHand = hand0;
    } else {
      if (h0Center.x < h1Center.x) {
        leftHand = hand0;
        rightHand = hand1;
      } else {
        leftHand = hand1;
        rightHand = hand0;
      }
    }

    this.lastLeftCenter = { x: leftHand[9].x, y: leftHand[9].y };
    this.lastRightCenter = { x: rightHand[9].x, y: rightHand[9].y };

    return { leftHand, rightHand };
  }

  private distSq(a: Point2D, b: Point2D): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  public resetHistory(): void {
    this.lastValidPoints = null;
    this.lastTimestamp = 0;
    this.lastLeftCenter = null;
    this.lastRightCenter = null;
    this.graceFramesCount = 0;
    this.velocities = {
      P1: { vx: 0, vy: 0 },
      P2: { vx: 0, vy: 0 },
      P3: { vx: 0, vy: 0 },
      P4: { vx: 0, vy: 0 },
    };
  }

  public close(): void {
    if (this.handLandmarker) {
      this.handLandmarker.close();
      this.handLandmarker = null;
      this.isReady = false;
      this.resetHistory();
    }
  }
}
