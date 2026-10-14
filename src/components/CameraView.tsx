import React, { useEffect, useRef, useState } from 'react';
import { CameraManager, CameraError } from '../camera/CameraManager';
import { CoordinateTransformer } from '../camera/CoordinateTransformer';
import { HandTracker, HandFramePoints } from '../tracking/HandTracker';
import { QuadGeometry, QuadPolygon } from '../geometry/QuadGeometry';
import { GestureController } from '../gesture/GestureController';
import { QuadCompositor } from '../compositing/QuadCompositor';
import { FilterSessionStore } from '../store/FilterSessionStore';
import { ToastNotification } from './ToastNotification';
import { DebugOverlay, DebugData } from './DebugOverlay';
import {
  ArrowLeft,
  Maximize,
  Minimize,
  RefreshCw,
  Bug,
  Sparkles,
  AlertCircle,
  Lock,
  CameraOff,
  VideoOff,
  Camera,
  HelpCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Keyboard,
} from 'lucide-react';

interface CameraViewProps {
  onBackToLanding: () => void;
}

/**
 * CameraView Component:
 * Core interactive view managing real-time webcam feed, MediaPipe hand tracking inference,
 * temporal smoothing with One Euro Filter, pinch gesture detection, and canvas filter compositing.
 */
export const CameraView: React.FC<CameraViewProps> = ({ onBackToLanding }) => {
  // DOM References: invisible HTML5 video stream and visible presentation canvas
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Engine lifecycle states: loading status, user-facing error dialogs, and active UI modes
  const [isLoading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Initializing HandFrame Engine...');
  const [errorDetails, setErrorDetails] = useState<{
    title: string;
    message: string;
    code?: string;
    redirectUrl?: string;
  } | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const [debugData, setDebugData] = useState<DebugData>({
    fps: 0,
    latencyMs: 0,
    gestureState: 'READY',
    distanceNorm: 1,
    confidence: 0,
    activeFilterName: 'Original',
    hasQuad: false,
    videoWidth: 0,
    videoHeight: 0,
    canvasWidth: 0,
    canvasHeight: 0,
  });

  const [activeFilterName, setActiveFilterName] = useState('Original');

  // Core managers refs (persisted across RAF loop without triggering React renders)
  const cameraManagerRef = useRef<CameraManager>(new CameraManager());
  const handTrackerRef = useRef<HandTracker>(new HandTracker());
  const gestureControllerRef = useRef<GestureController>(new GestureController());
  const compositorRef = useRef<QuadCompositor | null>(null);
  const sessionStoreRef = useRef<FilterSessionStore>(FilterSessionStore.getInstance());

  const animationFrameIdRef = useRef<number | null>(null);
  const videoFrameCallbackIdRef = useRef<number | null>(null);
  const lastQuadRef = useRef<QuadPolygon | null>(null);

  // Performance & inference frame caching refs
  const lastVideoTimeRef = useRef<number>(-1);
  const cachedLandmarksResultRef = useRef<HandFramePoints | null>(null);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());
  const currentFpsRef = useRef(0);

  useEffect(() => {
    let isMounted = true;

    const sessionStore = sessionStoreRef.current;
    setActiveFilterName(sessionStore.getCurrentFilter().displayName);

    // Subscribe to store filter changes
    const unsubscribeStore = sessionStore.subscribe(() => {
      const current = sessionStore.getCurrentFilter();
      setActiveFilterName(current.displayName);
    });

    const initEngine = async () => {
      try {
        if (!videoRef.current || !canvasRef.current) return;
        setErrorDetails(null);
        setIsLoading(true);

        // 1. Initialize Compositor
        compositorRef.current = new QuadCompositor();

        // 2. Start Camera after explicit user action
        setLoadingText('Requesting Camera Stream...');
        await cameraManagerRef.current.startCamera(videoRef.current, 'user');
        if (!isMounted) return;

        // 3. Initialize MediaPipe Hand Tracker WASM
        setLoadingText('Loading Local Hand Landmarker WASM...');
        await handTrackerRef.current.initialize();
        if (!isMounted) return;

        // 4. Setup Gesture trigger callback
        gestureControllerRef.current.setOnGestureTriggered(() => {
          const next = sessionStore.nextFilter();
          setToastMessage(next.displayName);
        });

        setIsLoading(false);

        // 5. Start main requestAnimationFrame / requestVideoFrameCallback loop
        startRenderLoop();
      } catch (err: any) {
        console.error('HandFrame engine initialization error:', err);
        if (isMounted) {
          setIsLoading(false);

          if (err instanceof CameraError) {
            switch (err.code) {
              case 'SECURE_CONTEXT_REQUIRED':
                setErrorDetails({
                  title: 'HTTPS Security Required',
                  message:
                    'Camera access requires a Secure Context (HTTPS or localhost). Mobile Safari & Chrome disable camera access on plain HTTP IP addresses.',
                  code: err.code,
                  redirectUrl: err.redirectHttpsUrl,
                });
                break;

              case 'PERMISSION_DENIED':
                setErrorDetails({
                  title: 'Camera Permission Denied',
                  message:
                    'Camera permission was blocked. Please allow camera permissions in your browser site settings (lock icon in address bar) and retry.',
                  code: err.code,
                });
                break;

              case 'CAMERA_NOT_FOUND':
                setErrorDetails({
                  title: 'No Camera Detected',
                  message: 'No camera hardware was found on your device. Please plug in or enable a camera.',
                  code: err.code,
                });
                break;

              case 'CAMERA_IN_USE':
                setErrorDetails({
                  title: 'Camera Currently In Use',
                  message:
                    'Your camera is in use by another app (e.g. Zoom, Teams, or another browser tab). Please close other camera apps and retry.',
                  code: err.code,
                });
                break;

              case 'UNSUPPORTED_BROWSER':
                setErrorDetails({
                  title: 'Browser Not Supported',
                  message: 'Your web browser does not support WebRTC mediaDevices API. Please update your browser or use Safari/Chrome.',
                  code: err.code,
                });
                break;

              case 'OVERCONSTRAINED':
              case 'UNKNOWN_ERROR':
              default:
                setErrorDetails({
                  title: 'Camera Access Error',
                  message: err.message || 'Failed to initialize local camera. Please retry.',
                  code: err.code,
                });
                break;
            }
          } else {
            setErrorDetails({
              title: 'Engine Error',
              message: err?.message || 'An unexpected error occurred during camera initialization.',
            });
          }
        }
      }
    };

    initEngine();

    // Keyboard shortcut handler for navigation, capture, debug, fullscreen & help
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'd' || e.key === 'D') {
        setIsDebugOpen((prev) => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 's' || e.key === 'S') {
        handleTakeSnapshot();
      } else if (e.key === 'h' || e.key === 'H' || e.key === '?') {
        setIsHelpOpen((prev) => !prev);
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        handleManualNextFilter();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleManualPreviousFilter();
      } else if (e.key === 'Escape') {
        setIsHelpOpen(false);
        setIsDebugOpen(false);
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          setCountdown(null);
          setToastMessage('Snapshot timer cancelled');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleKeyDown);
      unsubscribeStore();

      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }

      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (videoFrameCallbackIdRef.current && videoRef.current && 'cancelVideoFrameCallback' in videoRef.current) {
        (videoRef.current as any).cancelVideoFrameCallback(videoFrameCallbackIdRef.current);
      }

      cameraManagerRef.current.stopCamera();
      handTrackerRef.current.close();
    };
  }, []);

  const startRenderLoop = () => {
    const video = videoRef.current;
    if (!video) return;

    /**
     * Core Real-Time Frame Loop:
     * Executes once per camera frame. Coordinates:
     * 1. MediaPipe AI hand detection (with frame caching optimization).
     * 2. Coordinate transformation (normalized -> canvas pixels with aspect-ratio cover).
     * 3. One Euro temporal smoothing.
     * 4. Gesture controller state machine check.
     * 5. Canvas regional filter compositing.
     * 6. Live FPS and inference latency measurement.
     */
    const processFrame = (timestamp: number) => {
      const startTime = performance.now();

      const canvas = canvasRef.current;
      const tracker = handTrackerRef.current;
      const compositor = compositorRef.current;
      const sessionStore = sessionStoreRef.current;

      if (video && canvas && tracker && compositor && video.readyState >= 2) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          // Keep canvas dimensions synced with the browser window / viewport
          const displayWidth = canvas.clientWidth || window.innerWidth;
          const displayHeight = canvas.clientHeight || window.innerHeight;

          if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
          }

          const isMirrored = cameraManagerRef.current.isMirrored();

          // Optimization: Only run heavy MediaPipe AI inference when the camera hardware produces a NEW frame
          let landmarksResult = cachedLandmarksResultRef.current;
          if (video.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = video.currentTime;
            landmarksResult = tracker.detect(video, timestamp, isMirrored);
            cachedLandmarksResultRef.current = landmarksResult;
          }

          let quad: QuadPolygon | null = null;
          if (landmarksResult) {
            const transformConfig = {
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              canvasWidth: canvas.width,
              canvasHeight: canvas.height,
              isMirrored,
              objectFit: 'cover' as const,
            };

            // Convert normalized MediaPipe points [0..1] to pixel canvas coordinates
            // Strict semantic order: P1=Left Thumb, P2=Left Index, P3=Right Index, P4=Right Thumb
            const rawQuad: QuadPolygon = {
              P1: CoordinateTransformer.normalizedToCanvasPoint(landmarksResult.P1, transformConfig),
              P2: CoordinateTransformer.normalizedToCanvasPoint(landmarksResult.P2, transformConfig),
              P3: CoordinateTransformer.normalizedToCanvasPoint(landmarksResult.P3, transformConfig),
              P4: CoordinateTransformer.normalizedToCanvasPoint(landmarksResult.P4, transformConfig),
            };

            // Apply One Euro adaptive low-pass filter to smooth vertex motion
            quad = QuadGeometry.smoothQuad(rawQuad, lastQuadRef.current, timestamp);
            lastQuadRef.current = quad;
          } else {
            // Hand tracking lost: reset filter memory to avoid jumping on re-acquisition
            if (lastQuadRef.current) {
              QuadGeometry.resetFilter();
            }
            lastQuadRef.current = null;
          }

          // Evaluate pinch gesture state machine (advances filter on fingertip collapse)
          const gestureResult = gestureControllerRef.current.processFrame(
            landmarksResult
              ? {
                  P1: landmarksResult.P1,
                  P2: landmarksResult.P2,
                  P3: landmarksResult.P3,
                  P4: landmarksResult.P4,
                }
              : null,
            startTime
          );

          // Composite camera frame and apply the active filter inside the quadrilateral
          const currentFilter = sessionStore.getCurrentFilter();
          compositor.renderFrame(ctx, video, canvas.width, canvas.height, quad, currentFilter, isMirrored);

          // Measure actual rendered FPS
          frameCountRef.current++;
          const now = performance.now();
          if (now - lastFpsTimeRef.current >= 1000) {
            currentFpsRef.current = Math.round((frameCountRef.current * 1000) / (now - lastFpsTimeRef.current));
            frameCountRef.current = 0;
            lastFpsTimeRef.current = now;
          }

          const latencyMs = Math.round(performance.now() - startTime);

          // Throttle debug UI updates to avoid unnecessary React re-renders
          if (isDebugOpen && Math.random() < 0.1) {
            setDebugData({
              fps: currentFpsRef.current,
              latencyMs,
              gestureState: gestureResult.state,
              distanceNorm: gestureResult.distanceNorm,
              confidence: landmarksResult?.confidence || 0,
              activeFilterName: currentFilter.displayName,
              hasQuad: quad !== null,
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              canvasWidth: canvas.width,
              canvasHeight: canvas.height,
            });
          }
        }
      }

      // Schedule next frame
      scheduleNextFrame();
    };

    /**
     * Schedules next frame using requestVideoFrameCallback (preferred for webcams)
     * or standard requestAnimationFrame fallback.
     */
    const scheduleNextFrame = () => {
      const v = videoRef.current;
      if (!v) return;

      // requestVideoFrameCallback fires only when a fresh hardware frame is delivered by the camera
      if ('requestVideoFrameCallback' in v && typeof (v as any).requestVideoFrameCallback === 'function') {
        videoFrameCallbackIdRef.current = (v as any).requestVideoFrameCallback((now: number) => processFrame(now));
      } else {
        animationFrameIdRef.current = requestAnimationFrame((now: number) => processFrame(now));
      }
    };

    scheduleNextFrame();
  };

  // Advances to next filter module in the session sequence
  function handleManualNextFilter() {
    const next = sessionStoreRef.current.nextFilter();
    setToastMessage(next.displayName);
  }

  // Regresses to previous filter module in the session sequence
  function handleManualPreviousFilter() {
    const prev = sessionStoreRef.current.previousFilter();
    setToastMessage(prev.displayName);
  }

  // Encodes canvas pixels into a full-resolution PNG image and triggers automatic browser download
  function executeCapture() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      // Trigger white flash animation overlay for camera shutter feedback
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 200);

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.download = `HandFrame-${timestamp}.png`;
      link.href = dataUrl;
      link.click();

      setToastMessage('📸 Snapshot Saved!');
    } catch (err) {
      console.error('Failed to capture snapshot:', err);
    }
  }

  // Initiates 3-second countdown timer before taking picture, allowing user to pose hand frame
  function handleTakeSnapshot() {
    // If countdown timer is already active, clicking or pressing 'S' cancels it
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
      setCountdown(null);
      setToastMessage('Snapshot timer cancelled');
      return;
    }

    let timeLeft = 3;
    setCountdown(timeLeft);

    countdownIntervalRef.current = window.setInterval(() => {
      timeLeft -= 1;
      if (timeLeft > 0) {
        setCountdown(timeLeft);
      } else {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        setCountdown(null);
        executeCapture();
      }
    }, 1000);
  }

  // Toggles between front user selfie camera and rear environment camera
  const handleSwitchCamera = async () => {
    if (!videoRef.current) return;
    try {
      setIsLoading(true);
      setLoadingText('Switching Camera Source...');
      await cameraManagerRef.current.switchCamera(videoRef.current);
      setIsLoading(false);
    } catch (err) {
      console.warn('Failed to switch camera:', err);
      setIsLoading(false);
    }
  };

  // Enters or exits HTML5 Fullscreen mode for distraction-free presentation
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          setIsFullscreen(false);
        }
      }
    } catch (err) {
      console.warn('Fullscreen API error:', err);
    }
  };

  const renderErrorIcon = () => {
    if (!errorDetails) return null;
    switch (errorDetails.code) {
      case 'SECURE_CONTEXT_REQUIRED':
        return <Lock className="w-12 h-12 text-amber-400 mb-4 animate-pulse" />;
      case 'CAMERA_IN_USE':
        return <VideoOff className="w-12 h-12 text-orange-400 mb-4 animate-pulse" />;
      case 'CAMERA_NOT_FOUND':
      case 'PERMISSION_DENIED':
        return <CameraOff className="w-12 h-12 text-rose-500 mb-4 animate-bounce" />;
      default:
        return <AlertCircle className="w-12 h-12 text-rose-500 mb-4 animate-bounce" />;
    }
  };

  return (
    <div className="relative w-screen h-dvh bg-black overflow-hidden select-none">
      {/* Active WebRTC video element (rendered transparently for mobile video frame decoding) */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Main Fullscreen Output Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Camera Shutter Flash Animation */}
      <div
        className={`absolute inset-0 bg-white pointer-events-none transition-opacity duration-200 z-40 ${
          isFlashing ? 'opacity-80' : 'opacity-0'
        }`}
      />

      {/* 3-Second Countdown Display Overlay */}
      {countdown !== null && (
        <div className="absolute inset-0 z-40 pointer-events-none flex flex-col items-center justify-center">
          <div className="relative flex items-center justify-center">
            {/* Outer pulsating radar ring */}
            <div className="w-36 h-36 md:w-44 md:h-44 rounded-full border-4 border-emerald-400/50 animate-ping absolute" />
            {/* Glassmorphism badge */}
            <div className="w-28 h-28 md:w-36 md:h-36 rounded-full bg-black/75 backdrop-blur-xl border-2 border-white/30 flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.4)]">
              <span
                key={countdown}
                className="text-6xl md:text-7xl font-extrabold font-mono text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.9)] animate-pulse"
              >
                {countdown}
              </span>
            </div>
          </div>
          <div className="mt-5 px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-white text-xs md:text-sm font-medium tracking-wider uppercase">
              Capturing in {countdown}s... Pose!
            </p>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-lg flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full border-2 border-white/20 border-t-white animate-spin mb-4" />
          <p className="text-white/90 text-sm font-medium tracking-wide">{loadingText}</p>
          <p className="text-white/40 text-xs mt-2">Processing 100% locally inside browser</p>
        </div>
      )}

      {/* Error Overlay */}
      {errorDetails && (
        <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6 text-center">
          {renderErrorIcon()}
          <h2 className="text-white text-lg font-semibold mb-2">{errorDetails.title}</h2>
          <p className="text-white/70 text-xs max-w-sm mb-6 leading-relaxed">{errorDetails.message}</p>

          <div className="flex flex-wrap justify-center gap-3">
            {errorDetails.redirectUrl ? (
              <button
                onClick={() => (window.location.href = errorDetails.redirectUrl!)}
                className="px-5 py-2.5 bg-emerald-500 text-black text-xs font-semibold rounded-full hover:bg-emerald-400 transition-all shadow-lg active:scale-95"
              >
                Switch to HTTPS Version
              </button>
            ) : (
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 bg-emerald-500 text-black text-xs font-semibold rounded-full hover:bg-emerald-400 transition-all shadow-lg active:scale-95"
              >
                Retry Camera
              </button>
            )}
            <button
              onClick={onBackToLanding}
              className="px-5 py-2.5 bg-white/10 text-white border border-white/20 text-xs font-semibold rounded-full hover:bg-white/20 transition-all active:scale-95"
            >
              Back to Landing
            </button>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      <ToastNotification message={toastMessage} onClear={() => setToastMessage(null)} />

      {/* Dev Debug Overlay */}
      {isDebugOpen && (
        <DebugOverlay data={debugData} onClose={() => setIsDebugOpen(false)} />
      )}

      {/* Keyboard & Gesture Shortcuts Modal */}
      {isHelpOpen && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-zinc-950/95 border border-white/15 rounded-2xl p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <Keyboard className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-semibold tracking-wide">Shortcuts & Controls</h3>
              </div>
              <button
                onClick={() => setIsHelpOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors text-white/70 hover:text-white"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-white/70">Next Filter</span>
                <div className="flex gap-1.5">
                  <kbd className="px-2 py-0.5 bg-white/10 rounded font-mono text-white/90">Space</kbd>
                  <kbd className="px-2 py-0.5 bg-white/10 rounded font-mono text-white/90">→</kbd>
                </div>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-white/70">Previous Filter</span>
                <kbd className="px-2 py-0.5 bg-white/10 rounded font-mono text-white/90">←</kbd>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-white/70">Capture Snapshot (3s Timer)</span>
                <kbd className="px-2 py-0.5 bg-white/10 rounded font-mono text-white/90">S</kbd>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-white/70">Toggle Fullscreen</span>
                <kbd className="px-2 py-0.5 bg-white/10 rounded font-mono text-white/90">F</kbd>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-white/70">Debug & Landmark HUD</span>
                <kbd className="px-2 py-0.5 bg-white/10 rounded font-mono text-white/90">D</kbd>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-white/70">Toggle This Guide</span>
                <div className="flex gap-1.5">
                  <kbd className="px-2 py-0.5 bg-white/10 rounded font-mono text-white/90">H</kbd>
                  <kbd className="px-2 py-0.5 bg-white/10 rounded font-mono text-white/90">?</kbd>
                </div>
              </div>

              <div className="pt-2">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200">
                  <p className="font-semibold text-xs mb-1 flex items-center gap-1.5">
                    ✨ Hands-Free Gesture Cycling
                  </p>
                  <p className="text-[11px] text-emerald-300/80 leading-relaxed">
                    Bring the 4 tracked fingertips (Index & Thumb of both hands) together inside the camera view to trigger hands-free filter changes!
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsHelpOpen(false)}
              className="mt-5 w-full py-2.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl text-xs font-semibold tracking-wide transition-all active:scale-[0.98]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Floating Top Controls Overlay */}
      <div className="absolute top-0 inset-x-0 p-4 md:p-6 flex items-center justify-between z-30 pointer-events-none">
        {/* Top-Left: Exit Camera */}
        <button
          onClick={onBackToLanding}
          className="pointer-events-auto w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/80 hover:text-white hover:bg-black/60 flex items-center justify-center transition-all shadow-lg active:scale-95"
          title="Exit Camera"
          aria-label="Exit Camera"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Top-Right Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Capture Snapshot with visible on-screen shortcut badge and 3s countdown */}
          <button
            onClick={handleTakeSnapshot}
            className={`relative group w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center transition-all shadow-lg active:scale-95 ${
              countdown !== null
                ? 'bg-emerald-500/30 border-emerald-400 text-emerald-300 animate-pulse'
                : 'bg-black/40 border-white/10 text-white/80 hover:text-white hover:bg-black/60'
            }`}
            title={countdown !== null ? `Capturing in ${countdown}s (Click to cancel)` : "Capture Snapshot (Press 'S' for 3s timer)"}
            aria-label="Capture Snapshot"
          >
            <Camera className="w-4 h-4 text-white/90 group-hover:text-emerald-400 transition-colors" />
            <span className="absolute -bottom-1 -right-1 px-1 py-0.2 bg-zinc-900 border border-white/20 text-[9px] font-mono text-emerald-400 font-bold rounded shadow leading-tight">
              {countdown !== null ? `${countdown}s` : 'S'}
            </span>
          </button>

          {/* Switch Camera */}
          <button
            onClick={handleSwitchCamera}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/80 hover:text-white hover:bg-black/60 flex items-center justify-center transition-all shadow-lg active:scale-95"
            title="Switch Camera"
            aria-label="Switch Camera"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Toggle Fullscreen Mode */}
          <button
            onClick={toggleFullscreen}
            className="relative w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/80 hover:text-white hover:bg-black/60 flex items-center justify-center transition-all shadow-lg active:scale-95"
            title="Toggle Fullscreen (F)"
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            <span className="absolute -bottom-1 -right-1 px-1 py-0.2 bg-zinc-900 border border-white/20 text-[9px] font-mono text-white/70 font-semibold rounded shadow leading-tight">
              F
            </span>
          </button>

          {/* Shortcuts / Help */}
          <button
            onClick={() => setIsHelpOpen((prev) => !prev)}
            className={`relative w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center transition-all shadow-lg active:scale-95 ${
              isHelpOpen ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/30' : 'text-white/80 hover:text-white hover:bg-black/60'
            }`}
            title="Keyboard Shortcuts & Gestures (H / ?)"
            aria-label="Keyboard Shortcuts & Gestures"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="absolute -bottom-1 -right-1 px-1 py-0.2 bg-zinc-900 border border-white/20 text-[9px] font-mono text-white/70 font-semibold rounded shadow leading-tight">
              H
            </span>
          </button>

          {/* Toggle Debug Overlay */}
          <button
            onClick={() => setIsDebugOpen((prev) => !prev)}
            className={`relative w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center transition-all shadow-lg active:scale-95 ${
              isDebugOpen ? 'text-emerald-400 border-emerald-500/40 bg-emerald-950/30' : 'text-white/80 hover:text-white hover:bg-black/60'
            }`}
            title="Toggle Debug Overlay (D)"
            aria-label="Toggle Debug Overlay"
          >
            <Bug className="w-4 h-4" />
            <span className="absolute -bottom-1 -right-1 px-1 py-0.2 bg-zinc-900 border border-white/20 text-[9px] font-mono text-white/70 font-semibold rounded shadow leading-tight">
              D
            </span>
          </button>
        </div>
      </div>

      {/* Floating Bottom-Center Filter Indicator Pill with Prev/Next Controls */}
      <div className="absolute bottom-6 inset-x-0 flex flex-col items-center justify-center z-30 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Previous Filter Button */}
          <button
            onClick={handleManualPreviousFilter}
            className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-white/70 hover:text-white hover:bg-black/70 flex items-center justify-center transition-all shadow-xl active:scale-90"
            title="Previous filter (Left Arrow)"
            aria-label="Previous filter"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Filter Indicator Pill */}
          <button
            onClick={handleManualNextFilter}
            className="group bg-black/50 backdrop-blur-md border border-white/15 px-5 py-2.5 rounded-full text-white/90 hover:text-white hover:bg-black/70 hover:border-white/30 transition-all shadow-2xl flex items-center gap-2.5 active:scale-95"
            title="Click to cycle next filter (Space / Right Arrow)"
          >
            <Sparkles className="w-3.5 h-3.5 text-white/70 group-hover:text-white transition-colors" />
            <span className="text-xs font-mono tracking-wider uppercase">{activeFilterName}</span>
          </button>

          {/* Next Filter Button */}
          <button
            onClick={handleManualNextFilter}
            className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-white/70 hover:text-white hover:bg-black/70 flex items-center justify-center transition-all shadow-xl active:scale-90"
            title="Next filter (Right Arrow / Space)"
            aria-label="Next filter"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* On-Screen Shortcut Badges Bar */}
        <div className="flex items-center gap-2 mt-2.5 text-[10px] text-white/60 tracking-wide font-normal flex-wrap justify-center pointer-events-auto">
          <button
            onClick={handleTakeSnapshot}
            className={`backdrop-blur-md border px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-all text-white/80 active:scale-95 ${
              countdown !== null
                ? 'bg-emerald-500/30 border-emerald-400 text-emerald-300 animate-pulse'
                : 'bg-black/50 border-white/10 hover:border-emerald-500/50 hover:bg-black/70'
            }`}
            title="3s delayed snapshot (S)"
          >
            <Camera className="w-3 h-3 text-emerald-400" />
            <kbd className="px-1 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded font-mono font-bold text-[9px]">
              {countdown !== null ? `${countdown}s` : 'S'}
            </kbd>
            <span className="text-white/90 font-medium">
              {countdown !== null ? `Capturing (${countdown}s)` : 'Snapshot (3s)'}
            </span>
          </button>
          <span className="bg-black/50 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-full flex items-center gap-1.5 text-white/80">
            <kbd className="px-1 py-0.2 bg-white/10 rounded font-mono text-white/90 text-[9px]">Space / Arrows</kbd>
            <span>Cycle Filter</span>
          </span>
          <button
            onClick={() => setIsHelpOpen(true)}
            className="bg-black/50 backdrop-blur-md border border-white/10 hover:border-white/30 px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-all text-white/80 active:scale-95"
            title="View all shortcuts and gestures"
          >
            <kbd className="px-1 py-0.2 bg-white/10 rounded font-mono text-white/90 text-[9px]">H</kbd>
            <span>Help</span>
          </button>
        </div>
      </div>
    </div>
  );
};
