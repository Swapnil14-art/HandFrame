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

export class HandTracker {
  private handLandmarker: HandLandmarker | null = null;
  private isInitializing: boolean = false;
  private isReady: boolean = false;

  // Temporal persistence & grace period state
  private lastValidPoints: HandFramePoints | null = null;
  private graceFramesCount: number = 0;
  private readonly maxGraceFrames: number = 12; // ~350ms grace period at 30fps

  // Temporal palm center tracking to prevent MediaPipe classification flips during 180° rotation
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
        minHandDetectionConfidence: 0.4,
        minHandPresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
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
          minHandDetectionConfidence: 0.35,
          minHandPresenceConfidence: 0.35,
          minTrackingConfidence: 0.35,
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

    try {
      const results = this.handLandmarker.detectForVideo(videoElement, timestamp);

      const hasTwoHands = results && results.landmarks && results.landmarks.length >= 2;

      if (!hasTwoHands) {
        // TEMPORAL GRACE PERIOD: Retain last valid points during temporary tracking drops
        if (this.lastValidPoints && this.graceFramesCount < this.maxGraceFrames) {
          this.graceFramesCount++;
          return {
            ...this.lastValidPoints,
            status: 'TRACKING_DEGRADED',
            isGraceFrame: true,
          };
        }

        // Grace period expired
        this.lastValidPoints = null;
        this.lastLeftCenter = null;
        this.lastRightCenter = null;
        this.graceFramesCount = 0;
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

      // Extract points strictly in absolute semantic order:
      // LEFT_THUMB (landmark 4) → LEFT_INDEX (landmark 8) → RIGHT_INDEX (landmark 8) → RIGHT_THUMB (landmark 4)
      const leftThumb: Point2D  = { x: leftHand[4].x,  y: leftHand[4].y };
      const leftIndex: Point2D  = { x: leftHand[8].x,  y: leftHand[8].y };
      const rightIndex: Point2D = { x: rightHand[8].x, y: rightHand[8].y };
      const rightThumb: Point2D = { x: rightHand[4].x, y: rightHand[4].y };

      const currentPoints: HandFramePoints = {
        P1: leftThumb,   // LEFT_THUMB
        P2: leftIndex,   // LEFT_INDEX
        P3: rightIndex,  // RIGHT_INDEX
        P4: rightThumb,  // RIGHT_THUMB
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
    this.lastLeftCenter = null;
    this.lastRightCenter = null;
    this.graceFramesCount = 0;
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
