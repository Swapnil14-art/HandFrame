# HandFrame — Web-First Application & Filter System Specification

**Document Version:** 3.0.0 (Web-First, Fullscreen Browser Architecture)  
**Author:** Senior Software Architect & Computer Vision Engineer  
**Status:** Approved Specification (Single Source of Truth)  
**Target Platform:** Web Browsers (Desktop & Mobile Front/Rear Cameras)  

---

## 1. EXECUTIVE SUMMARY & PLATFORM CHANGE

### 1.1 What HandFrame Is
**HandFrame** is a real-time, web-first computer vision application that allows users to create a dynamic visual frame using their hands. By tracking four specific physical hand landmarks—the left index fingertip, left thumb tip, right index fingertip, and right thumb tip—the system constructs a dynamic quadrilateral region on the camera stream. A modular visual filter is applied **exclusively inside this region**, while the exterior background video feed remains untouched.

### 1.2 Web-First Architectural Pivot
HandFrame has transitioned from a desktop application (PySide6/Python) to a **web-first, browser-based application**. It delivers a zero-installation, instant-access, local-first camera experience directly in modern desktop and mobile browsers.

```
[ STACK SPECIFICATION ]
- Core Framework: React 18+
- Language: TypeScript 5+
- Build Tool: Vite
- Styling: Tailwind CSS (with arbitrary values & safe-area utilities)
- Hand Landmarker: MediaPipe Tasks Vision (@mediapipe/tasks-vision)
- Camera Access: WebRTC navigator.mediaDevices.getUserMedia()
- Image Processing & Compositing: HTML5 Canvas 2D Context / WebGL
- Configuration Persistence: Browser LocalStorage
```

### 1.3 Why Browser Local-First Processing Is Mandatory
All video capture, hand tracking, coordinate geometry, filter application, and canvas compositing occur **100% locally in the user's browser runtime**.

- **Ultra-Low Latency**: Eliminates network round-trips to maintain 30–60 FPS real-time rendering.
- **Privacy First**: Video streams and camera frames never leave the user's device memory.
- **Zero Server Infrastructure**: Operates entirely client-side without cloud API costs or backend processing servers.
- **Offline Reliability**: Executes offline once browser static assets and MediaPipe WASM bundles are cached.

### 1.4 Explicit Architectural Non-Goals
```
[ STRICT CONSTRAINTS CHECKLIST ]
❌ NO Python / PySide6 / Desktop Native Wrappers
❌ NO Backend Servers / Node API Dependencies
❌ NO Face/Identity/AR Filters (dog ears, makeup, face morphing)
❌ NO Cloud AI Services / OpenAI API / Generative AI
❌ NO TensorFlow / PyTorch / YOLO Heavy ML Frameworks
```

---

## 2. FULLSCREEN CAMERA EXPERIENCE & UI/UX DIRECTION

### 2.1 Viewport Dominance (`100dvh`)
The camera feed is the **primary hero experience** of HandFrame. When active, the camera view occupies the entire viewport across desktop and mobile devices without page scrolling.

- **Desktop Viewport**: `100vw` × `100dvh` edge-to-edge canvas with floating, non-intrusive UI controls.
- **Mobile Viewport**: Portrait-first, `100vw` × `100dvh` responsive viewport honoring device safe-area insets (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`).
- **No Page Scroll**: `overflow: hidden` on root containers to prevent accidental mobile gesture scrolling or rubber-banding.

### 2.2 Minimal, Premium Design Philosophy
HandFrame follows an **Aesthetic + Minimal + Premium + Unobtrusive** visual design language:
> **"Simple does not mean empty. The goal is a highly polished creative experience with very little UI."**

- **Camera as Hero**: The interface feels almost invisible during active framing. Controls float tastefully above the video canvas using subtle translucency (`backdrop-blur-md bg-black/40`), refined typography, and smooth micro-interactions.
- **No SaaS Clutter**: Avoid dashboard layouts, excessive card panels, aggressive gradients, heavy borders, dense toolbars, or unnecessary icons.
- **Auto-Hiding Controls**: Overlay controls subtly dim or hide after 3 seconds of inactivity and reappear on tap/hover/mouse move.
- **Filter Change Toast**: When a gesture triggers a filter change, a minimal filter name label (e.g. `MOODY`) appears briefly at top-center and smoothly fades out over 1.2 seconds.

### 2.3 Comprehensive Coordinate Transformation System
The application must dynamically transform coordinates across the processing pipeline:

```text
Camera Video Stream (Native Resolution W_cam x H_cam)
                       ↓
  Displayed HTML5 <video> Element (Object-fit Cover/Contain)
                       ↓
  Render Canvas (<canvas> W_canvas x H_canvas)
                       ↓
  MediaPipe Normalized Hand Landmarks (x_norm, y_norm ∈ [0.0, 1.0])
                       ↓
  HandFrame Quadrilateral Pixel Coordinates (P1, P2, P3, P4)
```

The transformation matrix must correctly handle:
1. **Front-Facing Mirrored Cameras**: Horizontal flipping (`scaleX(-1)`) mapped seamlessly to canvas space.
2. **Rear-Facing Mobile Cameras**: Standard non-mirrored coordinate mapping.
3. **Aspect Ratio Discrepancies**: Letterboxing/cropping calculations (`object-fit: cover` vs `contain`).
4. **Orientation Shifts**: Seamless recalculation when mobile devices rotate between portrait and landscape.

---

## 3. HANDFRAME CORE FUNCTIONALITY (PRESERVED)

### 3.1 4-Point Landmark Detection
HandFrame isolates four specific fingertip landmarks from MediaPipe Tasks Vision (`HandLandmarker`):

```
       [Left Index Tip] (ID: 8)         [Right Index Tip] (ID: 8)
                P1                              P2
                 o------------------------------o
                /                                \
               /                                  \
              /                                    \
             o--------------------------------------o
            P4                                      P3
       [Left Thumb Tip] (ID: 4)         [Right Thumb Tip] (ID: 4)
```

- **P1**: Left Hand Index Fingertip (`INDEX_FINGER_TIP`, ID: 8)
- **P2**: Right Hand Index Fingertip (`INDEX_FINGER_TIP`, ID: 8)
- **P3**: Right Hand Thumb Tip (`THUMB_TIP`, ID: 4)
- **P4**: Left Hand Thumb Tip (`THUMB_TIP`, ID: 4)

### 3.2 Dynamic Quadrilateral Region
- The 4 points form a dynamic polygon (quadrilateral).
- The quad is **not assumed to be rectangular**; it tilts, scales, and warps as the user moves their hands.
- The visual filter is calculated and rendered **strictly inside** this polygon.
- Everything outside the polygon remains raw camera background.

### 3.3 Polygon Geometry Validation
A quad region is valid for filtering if:
1. **Convexity**: Adjacent edge cross-products share identical signs (non-self-intersecting).
2. **Minimum Surface Area**: Surface area calculated via Shoelace formula exceeds threshold ($\ge 1200\text{ px}^2$ on 720p).
3. **Interior Angles**: Angles remain between $20^\circ$ and $160^\circ$.

---

## 4. GESTURE DETECTION STATE MACHINE (PRESERVED)

### 4.1 Touch-Pinch Distance Metric
When all four tracked fingertips converge into a tight cluster (a "four-point pinch"), the system triggers a filter switch.

The proximity metric evaluates the normalized maximum pairwise distance between all 6 point pairs:
$$d_{\text{norm}} = \frac{\max_{i < j} \|P_i - P_j\|}{\sqrt{W_{\text{frame}}^2 + H_{\text{frame}}^2}}$$

- **Trigger Threshold ($T_{\text{trigger}}$)**: $d_{\text{norm}} < 0.045$ (fingertips touching).
- **Release Threshold ($T_{\text{release}}$)**: $d_{\text{norm}} > 0.080$ (fingertips separated).

### 4.2 State Machine Lifecycle
To prevent filter cycling while fingers remain together, the system enforces a debounced state machine:

```
  +-------------------------------------------------------------------+
  |                             READY                                 |
  +---------------------------------+---------------------------------+
                                    |
                                    | d_norm < T_trigger (for 3 frames)
                                    v
  +-------------------------------------------------------------------+
  |                           TRIGGERED                               |
  |  - Advance filter index (next_filter)                             |
  |  - Display subtle toast notification                              |
  +---------------------------------+---------------------------------+
                                    |
                                    v
  +-------------------------------------------------------------------+
  |                      WAIT_FOR_SEPARATION                          |
  |  - Filter switching LOCKED OUT                                    |
  +---------------------------------+---------------------------------+
                                    |
                                    | d_norm > T_release
                                    v
  +-------------------------------------------------------------------+
  |                             READY                                 |
  +-------------------------------------------------------------------+
```

---

## 5. FIRST-CLASS MODULAR FILTER SYSTEM ARCHITECTURE

### 5.1 Universal Filter Interface
Filters are first-class, independent modules. Core processing **NEVER** uses hardcoded branching (`if (filterId === 'moody')`).

```typescript
// src/filters/types/FilterTypes.ts
export type FilterCategory = 'Basic' | 'Cinematic' | 'Film' | 'Retro' | 'Dreamy' | 'Creative' | 'Color';

export interface FilterMetadata {
  id: string;
  name: string;
  description: string;
  category: FilterCategory;
  version: string;
  parameters?: Record<string, number | string | boolean>;
}

export interface BaseFilter extends FilterMetadata {
  /**
   * Applies the visual filter to a cropped sub-region image.
   * @param imageData HTML5 Canvas ImageData object of the cropped bounding box.
   * @returns Processed ImageData object of identical dimensions.
   */
  apply(imageData: ImageData): ImageData;
}
```

### 5.2 Decoupled Module Architecture
```text
src/filters/
├── types/
│   └── FilterTypes.ts            # Common TypeScript interfaces
├── registry/
│   └── FilterRegistry.ts         # Central filter manager & active ordering
├── presets/
│   └── DefaultFilters.ts         # Filter manifest loader
└── implementations/
    ├── OriginalFilter.ts         # 1. Original (Baseline)
    ├── MoodyFilter.ts            # 2. Moody Cinematic
    ├── WarmFilter.ts             # 3. Warm Tone
    ├── CoolFilter.ts             # 4. Cool Tone
    ├── VintageFilmFilter.ts     # 5. Vintage Film
    ├── FilmGrainFilter.ts       # 6. Film Grain
    ├── DreamyBlurFilter.ts      # 7. Dreamy Blur
    ├── CinematicFilter.ts        # 8. Teal & Orange Cinematic
    ├── Y2kDigicamFilter.ts      # 9. Y2K Digicam
    ├── VhsFilter.ts              # 10. VHS Retro Tape
    ├── PixelateFilter.ts         # 11. Pixelated 8-Bit
    ├── NegativeFilter.ts         # 12. Negative Invert
    ├── GrayscaleFilter.ts        # 13. Grayscale
    ├── SepiaFilter.ts            # 14. Sepia
    └── RetroFlashFilter.ts      # 15. Retro Flash
```

### 5.3 Filter Scope & Strict Exclusions
- **In Scope**: Color grading, contrast, saturation, film grain, vintage tones, scanlines, blur diffusion, pixelation, color offsets.
- **Strictly Out of Scope**: Face morphing, dog ears, cat noses, eye enlargement, makeup overlays, facial accessories, AR identity modifications.

---

## 6. EDIT FILTERS EXPERIENCE & LOCAL STORAGE PERSISTENCE

### 6.1 Dedicated Edit Filters Experience
HandFrame provides a distinct **Edit Filters** management view separate from the camera:

- **Enable / Disable Toggles**: Checkboxes to select which filters participate in gesture rotation. Disabled filters are skipped during camera usage.
- **Deterministic Reordering**:
  - **Desktop**: Drag-and-drop handles (`≡`) to reorder the rotation sequence.
  - **Mobile**: Touch-friendly Move Up (`▲`) and Move Down (`▼`) buttons.
- **Live Preview Canvas**: Renders selected filters in real-time onto a sample preview image using the exact filter implementation.
- **Reset to Default**: One-tap button restoring default enabled filter list and sequence.

### 6.2 Browser LocalStorage Schema
User filter choices and ordering persist automatically across browser reloads:

```json
// LocalStorage Key: "handframe_filter_config_v1"
{
  "version": "1.0.0",
  "enabledFilterIds": [
    "original",
    "moody",
    "warm",
    "vintage_film",
    "vhs",
    "dreamy_blur",
    "y2k_digicam",
    "pixelate"
  ]
}
```

---

## 7. COMPOSITING PIPELINE & PERFORMANCE OPTIMIZATION

### 7.1 Region-Only Bounding Box Crop Pipeline
To maintain 30–60 FPS on desktop and mobile browsers, filters process **only the cropped sub-image bounding box**:

```text
1. Compute axis-aligned bounding box [xMin, yMin, xMax, yMax] around quad points.
2. Crop sub-region from raw video canvas context (getImageData).
3. Execute active_filter.apply(croppedImageData).
4. Create polygon path on 2D context using quad points.
5. Clip context & draw processed sub-region inside quad path.
6. Composite seamlessly over original unedited camera canvas.
```

### 7.2 Browser Memory & Latency Optimizations
- **Zero React In-Loop Re-renders**: The real-time camera processing loop executes strictly inside `requestAnimationFrame()` using direct HTML Canvas refs. React state is **never** updated on per-frame loops.
- **Buffer Reuse**: Pre-allocate offscreen canvas buffers and `ImageData` arrays to avoid garbage collection pauses.
- **No Per-Pixel JS Loops Where Native Canvas/WebGL Applies**: Utilize `ctx.filter`, canvas blending modes, and typed array operations (`Uint8ClampedArray`) for maximum execution speed.

---

## 8. NAVIGATION, LANDING PAGE & CAMERA CONTROLS

### 8.1 Minimal Landing Page
The application opens to a minimal, elegant landing view:
- **Title & Concept**: Clean typography introducing HandFrame.
- **Primary Actions**:
  - **`[ START CAMERA ]`**: Launches WebRTC camera stream and enters fullscreen viewfinder.
  - **`[ EDIT FILTERS ]`**: Opens the filter management screen.

### 8.2 Floating Camera Controls
In camera mode, floating minimal controls overlay the video feed:
- **Top-Left**: Back to Menu (`←`)
- **Top-Right**: Front/Rear Camera Toggle (on supported mobile devices) & Debug Overlay Toggle (`D`)
- **Bottom-Center**: Current Active Filter Pill (clickable to manually advance filter)

---

## 9. ERROR HANDLING, PERMISSIONS & CAMERA SWITCHING

### 9.1 Camera Access & WebRTC Permission States
- **Permission Prompt**: Clear UI explaining camera usage prior to browser permission prompt.
- **Permission Denied**: Friendly UI state with instructions on enabling camera access in browser settings.
- **No Camera Found**: Clear notification when no video input devices are detected.
- **Unsupported Browser**: Fallback notice for browsers lacking WebRTC / MediaPipe WASM support.

### 9.2 Front / Rear Camera Switching
For mobile devices supporting multiple cameras:
- Toggling calls `MediaStreamTrack.stop()` on existing tracks.
- Re-requests `getUserMedia()` with updated `facingMode: "user" | "environment"`.
- Automatically recalculates aspect ratio, video dimensions, and coordinate mirror matrices.

---

## 10. DEVELOPMENT DEBUG OVERLAY MODE

Pressing 'D' (or tapping Debug in controls) toggles a dev overlay displaying:
- 4 tracked landmark points (colored circles)
- Quadrilateral bounding outline & centroid
- Real-time FPS counter & frame processing latency (ms)
- Camera stream native resolution vs canvas display resolution
- Current gesture state machine status (`READY` / `TRIGGERED` / `WAIT_FOR_SEPARATION`)

---

## 11. MCP SERVER USAGE GUIDELINES

Implementation agents may utilize available MCP servers for:
- Researching modern web design trends and minimal UI patterns.
- Validating browser responsive layouts and mobile viewport behavior (`100dvh`).
- Testing accessibility, touch targets, and safe-area compatibility.

MCP usage must **not** introduce third-party cloud runtime dependencies or compromise offline-first client-side execution.

---

## 12. MANDATORY NON-IMPLEMENTATION INSTRUCTION

> **CRITICAL MANDATE: THIS TASK IS STRICTLY AN UPDATE TO THE TECHNICAL SPECIFICATION FILE (`HANDFRAME_SPECIFICATION.md`). DO NOT IMPLEMENT CODE, DO NOT CREATE COMPONENTS, DO NOT INSTALL DEPENDENCIES, DO NOT MODIFY SOURCE CODE, AND DO NOT RUN THE APPLICATION.**
