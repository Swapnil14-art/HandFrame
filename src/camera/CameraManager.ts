export interface CameraDevice {
  deviceId: string;
  label: string;
  facingMode?: 'user' | 'environment';
}

export type CameraErrorCode =
  | 'SECURE_CONTEXT_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'CAMERA_NOT_FOUND'
  | 'CAMERA_IN_USE'
  | 'UNSUPPORTED_BROWSER'
  | 'OVERCONSTRAINED'
  | 'UNKNOWN_ERROR';

export class CameraError extends Error {
  public code: CameraErrorCode;
  public redirectHttpsUrl?: string;

  constructor(code: CameraErrorCode, message: string, redirectHttpsUrl?: string) {
    super(message);
    this.name = 'CameraError';
    this.code = code;
    this.redirectHttpsUrl = redirectHttpsUrl;
  }
}

export class CameraManager {
  private currentStream: MediaStream | null = null;
  private currentDeviceId: string | null = null;
  private currentFacingMode: 'user' | 'environment' = 'user';
  private videoElement: HTMLVideoElement | null = null;

  /**
   * Initializes camera stream on target HTML5 video element.
   * Enforces standard W3C Secure Context requirements for navigator.mediaDevices.getUserMedia().
   */
  public async startCamera(
    videoElement: HTMLVideoElement,
    preferredFacingMode: 'user' | 'environment' = 'user'
  ): Promise<MediaStream> {
    this.videoElement = videoElement;
    this.currentFacingMode = preferredFacingMode;

    // Ensure required mobile Safari & Chrome inline autoplay attributes
    videoElement.setAttribute('playsinline', 'true');
    videoElement.setAttribute('muted', 'true');
    videoElement.setAttribute('autoplay', 'true');
    videoElement.playsInline = true;
    videoElement.muted = true;

    // Stop existing stream if active
    this.stopCamera();

    // 1. Validate browser support for navigator.mediaDevices
    if (!navigator?.mediaDevices) {
      throw new CameraError(
        'UNSUPPORTED_BROWSER',
        'Your web browser does not support WebRTC mediaDevices API. Please update your browser or use Safari/Chrome.'
      );
    }

    // 2. Validate Secure Context (HTTPS or localhost)
    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '[::1]';

    const isSecureContext =
      window.isSecureContext === true ||
      window.location.protocol === 'https:' ||
      isLocalhost;

    if (!isSecureContext || !navigator.mediaDevices.getUserMedia) {
      const portSuffix = window.location.port ? `:${window.location.port}` : '';
      const httpsUrl = `https://${window.location.hostname}${portSuffix}${window.location.pathname}${window.location.hash}`;
      throw new CameraError(
        'SECURE_CONTEXT_REQUIRED',
        'Camera access requires a Secure Context (HTTPS or localhost). Browsers disable getUserMedia on plain HTTP network IP addresses.',
        httpsUrl
      );
    }

    // Progressive Constraint Levels to prevent OverconstrainedError on Mobile & Desktop
    const constraintLevels: MediaStreamConstraints[] = [
      // Level 1: Mobile-optimized ideal resolution & facing mode
      {
        audio: false,
        video: {
          facingMode: { ideal: preferredFacingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      },
      // Level 2: Simple facing mode constraint
      {
        audio: false,
        video: {
          facingMode: preferredFacingMode,
        },
      },
      // Level 3: Basic video stream fallback
      {
        audio: false,
        video: true,
      },
    ];

    let lastError: any = null;
    let stream: MediaStream | null = null;

    for (const constraints of constraintLevels) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) break;
      } catch (err: any) {
        console.warn('getUserMedia failed with constraint level, trying fallback:', constraints, err);
        lastError = err;
      }
    }

    if (!stream) {
      if (lastError) {
        const errName = lastError.name || '';
        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
          throw new CameraError(
            'PERMISSION_DENIED',
            'Camera permission was denied. Please allow camera access in site permissions.'
          );
        }
        if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
          throw new CameraError(
            'CAMERA_NOT_FOUND',
            'No camera hardware was detected on your device.'
          );
        }
        if (errName === 'NotReadableError' || errName === 'TrackStartError') {
          throw new CameraError(
            'CAMERA_IN_USE',
            'Camera hardware is currently in use by another application (e.g. Zoom, Teams, or another browser tab).'
          );
        }
        if (errName === 'OverconstrainedError' || errName === 'ConstraintNotSatisfiedError') {
          throw new CameraError(
            'OVERCONSTRAINED',
            'Camera resolution or facing mode constraint is not supported by your device.'
          );
        }
      }
      throw new CameraError('UNKNOWN_ERROR', lastError?.message || 'Unable to start camera stream.');
    }

    try {
      this.currentStream = stream;
      videoElement.srcObject = stream;

      // Extract device ID if available
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        if (settings.deviceId) {
          this.currentDeviceId = settings.deviceId;
        }
      }

      // Explicit play invocation with promise catch for mobile autoplay policies
      try {
        await videoElement.play();
      } catch (playErr) {
        console.warn('videoElement.play() promise rejected:', playErr);
      }

      return stream;
    } catch (err) {
      console.error('Error attaching stream to video element:', err);
      throw err;
    }
  }

  /**
   * Switches facing mode between user (front) and environment (rear).
   */
  public async switchCamera(videoElement: HTMLVideoElement): Promise<MediaStream> {
    const nextFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
    return this.startCamera(videoElement, nextFacingMode);
  }

  /**
   * Enumerates available video input devices.
   */
  public async getCameraDevices(): Promise<CameraDevice[]> {
    if (!navigator?.mediaDevices?.enumerateDevices) {
      return [];
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === 'videoinput')
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${idx + 1}`,
        }));
    } catch (err) {
      console.warn('Failed to enumerate devices:', err);
      return [];
    }
  }

  /**
   * Gets current facing mode ('user' or 'environment').
   */
  public getFacingMode(): 'user' | 'environment' {
    return this.currentFacingMode;
  }

  /**
   * Checks if current camera stream is mirrored (front camera).
   */
  public isMirrored(): boolean {
    return this.currentFacingMode === 'user';
  }

  /**
   * Stops active camera tracks and detaches video element srcObject.
   */
  public stopCamera(): void {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach((track) => track.stop());
      this.currentStream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }
}
