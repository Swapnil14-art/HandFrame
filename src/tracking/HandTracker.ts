import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { Point2D } from '../camera/CoordinateTransformer';

export type TrackingStatus =
  | 'NO_HANDS'
  | 'ONE_HAND'
  | 'TWO_HANDS'
  | 'TRACKING_STABLE'
  | 'TRACKING_DEGRADED';

export interface HandFramePoints {
  P1: Point2D; // RIGHT_THUMB (Landmark 4 of Right Hand)
  P2: Point2D; // RIGHT_INDEX (Landmark 8 of Right Hand)
  P3: Point2D; // LEFT_INDEX  (Landmark 8 of Left Hand)
  P4: Point2D; // LEFT_THUMB  (Landmark 4 of Left Hand)
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
   * Detects 2 hands and extracts fingertips strictly in semantic identity order:
   * [RIGHT_THUMB, RIGHT_INDEX, LEFT_INDEX, LEFT_THUMB]
   */
  public detect(
    videoElement: HTMLVideoElement,
    timestamp: number,
    isMirrored: boolean = false
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
        this.graceFramesCount = 0;
        return null;
      }

      const hand0 = results.landmarks[0];
      const hand1 = results.landmarks[1];

      const h0Label = results.handednesses?.[0]?.[0]?.categoryName; // 'Right' or 'Left'
      const h1Label = results.handednesses?.[1]?.[0]?.categoryName; // 'Right' or 'Left'

      let rightHand = hand0;
      let leftHand = hand1;

      if (h0Label === 'Right' && h1Label === 'Left') {
        rightHand = hand0;
        leftHand = hand1;
      } else if (h0Label === 'Left' && h1Label === 'Right') {
        rightHand = hand1;
        leftHand = hand0;
      } else if (this.lastValidPoints) {
        // Ambiguous handedness label from MediaPipe: match against previous frame Right vs Left
        const prevRightCenter = {
          x: (this.lastValidPoints.P1.x + this.lastValidPoints.P2.x) / 2,
          y: (this.lastValidPoints.P1.y + this.lastValidPoints.P2.y) / 2,
        };
        const prevLeftCenter = {
          x: (this.lastValidPoints.P3.x + this.lastValidPoints.P4.x) / 2,
          y: (this.lastValidPoints.P3.y + this.lastValidPoints.P4.y) / 2,
        };

        const h0Center = { x: hand0[9].x, y: hand0[9].y };
        const h1Center = { x: hand1[9].x, y: hand1[9].y };

        const dist0ToRight = this.distSq(h0Center, prevRightCenter) + this.distSq(h1Center, prevLeftCenter);
        const dist1ToRight = this.distSq(h1Center, prevRightCenter) + this.distSq(h0Center, prevLeftCenter);

        if (dist1ToRight < dist0ToRight) {
          rightHand = hand1;
          leftHand = hand0;
        } else {
          rightHand = hand0;
          leftHand = hand1;
        }
      } else {
        // First frame fallback if MediaPipe labels are identical: sort by X coordinate
        const h0x = hand0[9].x;
        const h1x = hand1[9].x;
        if (isMirrored ? h0x < h1x : h0x > h1x) {
          rightHand = hand1;
          leftHand = hand0;
        } else {
          rightHand = hand0;
          leftHand = hand1;
        }
      }

      // Confidence computation
      const score0 = results.handednesses?.[0]?.[0]?.score || 0.85;
      const score1 = results.handednesses?.[1]?.[0]?.score || 0.85;
      const confidence = (score0 + score1) / 2;

      // Extract points strictly in semantic order: RIGHT_THUMB, RIGHT_INDEX, LEFT_INDEX, LEFT_THUMB
      const rightThumb: Point2D = { x: rightHand[4].x, y: rightHand[4].y };
      const rightIndex: Point2D = { x: rightHand[8].x, y: rightHand[8].y };
      const leftIndex: Point2D  = { x: leftHand[8].x,  y: leftHand[8].y };
      const leftThumb: Point2D  = { x: leftHand[4].x,  y: leftHand[4].y };

      const currentPoints: HandFramePoints = {
        P1: rightThumb, // RIGHT_THUMB
        P2: rightIndex, // RIGHT_INDEX
        P3: leftIndex,  // LEFT_INDEX
        P4: leftThumb,  // LEFT_THUMB
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

  private distSq(a: Point2D, b: Point2D): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  public resetHistory(): void {
    this.lastValidPoints = null;
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
