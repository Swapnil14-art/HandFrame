import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { Point2D } from '../camera/CoordinateTransformer';

export interface HandFramePoints {
  P1: Point2D; // Left Index Tip
  P2: Point2D; // Right Index Tip
  P3: Point2D; // Right Thumb Tip
  P4: Point2D; // Left Thumb Tip
  confidence: number;
}

export class HandTracker {
  private handLandmarker: HandLandmarker | null = null;
  private isInitializing: boolean = false;
  private isReady: boolean = false;

  /**
   * Initializes MediaPipe HandLandmarker WASM instance.
   */
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
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      this.isReady = true;
      this.isInitializing = false;
    } catch (err) {
      console.warn('Failed GPU delegate for HandLandmarker, falling back to CPU:', err);
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
   * Detects hands in live video frame and extracts 4 key fingertip landmarks.
   */
  public detect(videoElement: HTMLVideoElement, timestamp: number): HandFramePoints | null {
    if (!this.handLandmarker || !this.isReady) return null;
    if (videoElement.readyState < 2) return null;

    try {
      const results = this.handLandmarker.detectForVideo(videoElement, timestamp);

      if (!results || !results.landmarks || results.landmarks.length < 2) {
        return null; // Require 2 hands for full 4-point HandFrame
      }

      const hand0 = results.landmarks[0]; // 21 landmarks
      const hand1 = results.landmarks[1];

      const handedness0 = results.handednesses?.[0]?.[0]?.categoryName; // 'Left' or 'Right'
      const handedness1 = results.handednesses?.[1]?.[0]?.categoryName;

      let leftHandLandmarks = hand0;
      let rightHandLandmarks = hand1;

      // Determine left vs right hand
      if (handedness0 === 'Right' || handedness1 === 'Left') {
        leftHandLandmarks = hand1;
        rightHandLandmarks = hand0;
      } else {
        // Fallback: sort by horizontal X position of wrist (Landmark 0)
        if (hand0[0].x > hand1[0].x) {
          leftHandLandmarks = hand1;
          rightHandLandmarks = hand0;
        }
      }

      // Landmark ID 8 = INDEX_FINGER_TIP, Landmark ID 4 = THUMB_TIP
      const P1_norm = { x: leftHandLandmarks[8].x, y: leftHandLandmarks[8].y };  // Left Index
      const P4_norm = { x: leftHandLandmarks[4].x, y: leftHandLandmarks[4].y };  // Left Thumb
      const P2_norm = { x: rightHandLandmarks[8].x, y: rightHandLandmarks[8].y }; // Right Index
      const P3_norm = { x: rightHandLandmarks[4].x, y: rightHandLandmarks[4].y }; // Right Thumb

      const score0 = results.handednesses?.[0]?.[0]?.score || 0.8;
      const score1 = results.handednesses?.[1]?.[0]?.score || 0.8;

      return {
        P1: P1_norm,
        P2: P2_norm,
        P3: P3_norm,
        P4: P4_norm,
        confidence: (score0 + score1) / 2,
      };
    } catch (err) {
      console.warn('Error during hand detection frame:', err);
      return null;
    }
  }

  public close(): void {
    if (this.handLandmarker) {
      this.handLandmarker.close();
      this.handLandmarker = null;
      this.isReady = false;
    }
  }
}
