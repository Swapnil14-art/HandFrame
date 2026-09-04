# HandFrame — Web Application Technical Specification

**Document Version:** 6.0.0 (Web-First, Fullscreen Camera & Temporary Local Filter Management)  
**Status:** Approved Specification (Single Source of Truth)  
**Target Platform:** Modern Web Browsers (Desktop & Mobile Devices)  

---

## 1. EXECUTIVE SUMMARY & PRODUCT DEFINITION

### 1.1 What HandFrame Is
**HandFrame** is a browser-based, local-first creative camera web application. It uses the device camera and computer vision hand tracking to create a dynamic four-point visual frame between the user's fingers. 

The application tracks four key physical hand landmarks—the left index fingertip, left thumb tip, right index fingertip, and right thumb tip—to define a dynamic quadrilateral region in real time. A selected visual filter is rendered **exclusively inside this quadrilateral region**, while the exterior background video feed remains untouched.

```text
Original Camera Feed (Background)
  ┌───────────────────────────────────────────────────┐
  │                                                   │
  │             P1 (Left Index)     P2 (Right Index)  │
  │                o-----------------o                │
  │               /   HandFrame     /                 │
  │              /  FILTER APPLIED /                  │
  │             o-----------------o                   │
  │             P4 (Left Thumb)     P3 (Right Thumb)  │
  │                                                   │
  └───────────────────────────────────────────────────┘
```

### 1.2 Web-First Architecture
HandFrame is designed ground-up as a responsive web application. The legacy desktop architecture (PySide6, Tkinter, Python desktop wrappers) is completely superseded by a modern browser-native frontend stack. HandFrame operates as a zero-installation, browser-based, local-first web application.

---

## 2. TARGET TECHNOLOGY STACK

The preferred technology stack for the web implementation is strictly client-side:

### 2.1 Frontend Framework & Build System
* **Framework:** React 18+
* **Language:** TypeScript 5+
* **Build Tool:** Vite
* **Styling:** Tailwind CSS (with responsive dynamic viewport & safe-area utilities)

### 2.2 Camera Access & Stream Management
* **WebRTC API:** `navigator.mediaDevices.getUserMedia()`
* **Stream Handling:** HTML5 `<video>` element with media stream bindings and track control

### 2.3 Computer Vision & Hand Tracking
* **Tracking Library:** MediaPipe Tasks Vision (`@mediapipe/tasks-vision` / `HandLandmarker`)
* **Execution Environment:** Client-side WebAssembly (WASM) running locally in a browser worker thread

> **Strict Machine Learning Scope:** MediaPipe is used exclusively for local hand landmark detection. Do NOT introduce heavy ML frameworks (TensorFlow, PyTorch, YOLO), cloud AI services, OpenAI APIs, or generative AI.

### 2.4 Rendering & Compositing
* **Primary Rendering Engine:** HTML5 2D Canvas (`CanvasRenderingContext2D`)
* **Accelerated Effects:** WebGL used selectively only when it provides a meaningful performance improvement for expensive visual filters. Do not introduce unnecessary rendering frameworks merely for complexity.

### 2.5 Route Environment Configuration
* **Environment Variable:** Route configuration for the unlisted filter management page must be configurable via environment variables (e.g. `import.meta.env.VITE_FILTER_EDITOR_PATH`), defaulting to `/aesthetic14`.

### 2.6 Persistence & Backend Requirement
* **Backend Requirement:** None. No user registration, authentication, database, or backend server is required.
* **Storage Policy:** Built-in filter registry serves as default configuration. The special filter editor uses in-memory temporary session state that resets automatically on page reload.

---

## 3. LOCAL-FIRST CAMERA PROCESSING

All camera stream capture, hand landmarker tracking, coordinate mapping, filter processing, and canvas compositing execute **100% locally inside the user's browser runtime**. The live camera stream is **never** transmitted to any server.

### Key Advantages:
* **Ultra-Low Latency:** Eliminates network round-trip overhead to achieve real-time 30–60 FPS rendering.
* **Total Privacy:** Camera frames remain strictly in local memory and are never stored or transmitted.
* **Real-Time Responsiveness:** Provides instant visual feedback in sync with natural hand movements.
* **Reduced Infrastructure:** Operates client-side with zero cloud processing or server bandwidth costs.
* **Offline Functionality:** Functions completely offline once static application assets and MediaPipe WASM bundles are cached by the browser.

---

## 4. HANDFRAME CORE CONCEPT & GEOMETRY

### 4.1 Tracked Fingertip Landmarks
HandFrame isolates exactly **four fingertip landmarks** from the MediaPipe Hand Landmarker output:

1. **P1 — Left Index Fingertip:** (`INDEX_FINGER_TIP`, Landmark ID: 8)
2. **P2 — Right Index Fingertip:** (`INDEX_FINGER_TIP`, Landmark ID: 8)
3. **P3 — Right Thumb Fingertip:** (`THUMB_TIP`, Landmark ID: 4)
4. **P4 — Left Thumb Fingertip:** (`THUMB_TIP`, Landmark ID: 4)

```text
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

### 4.2 Dynamic Quadrilateral Region
* The four vertices $P_1, P_2, P_3, P_4$ form a dynamic, non-rigid quadrilateral polygon.
* The selected visual filter is calculated and rendered **strictly inside this quadrilateral**.
* Everything outside the quadrilateral remains original, unedited camera feed.
* The quadrilateral can move, rotate, resize, stretch, and warp freely as the user's hands move. It is **not assumed to be rectangular** or axis-aligned.

### 4.3 Strict Exclusion of Face & Identity Filters
HandFrame is **NOT a face-filter or identity modification application**. Filters are atmospheric, photographic, color grading, and artistic visual effects applied exclusively to the region bounded by the four fingertips.

The specification explicitly forbids:
* ❌ Face transformations, face morphing, or facial warping
* ❌ Dog ears, cat noses, or animal overlays
* ❌ Facial replacement or digital makeup
* ❌ Eye enlargement or hair color modification
* ❌ AR face masks or identity-altering filters
* ❌ Body shape modification

---

## 5. FILTER CHANGE GESTURE SYSTEM

### 5.1 Proximity Pinch Gesture
When all four tracked fingertips come sufficiently close together into a single cluster (a "four-point pinch"), HandFrame advances to the next enabled filter in the active cycle.

### 5.2 Device-Independent Proximity Metric
The proximity metric calculates the maximum normalized pairwise distance across all six fingertip pairs:

$$d_{\text{norm}} = \frac{\max_{i < j} \|P_i - P_j\|}{\sqrt{W_{\text{frame}}^2 + H_{\text{frame}}^2}}$$

* **Trigger Threshold ($T_{\text{trigger}}$):** $d_{\text{norm}} < 0.045$ (fingertips touching).
* **Release Threshold ($T_{\text{release}}$):** $d_{\text{norm}} > 0.080$ (fingertips separated).

Normalizing by the frame diagonal length ($\sqrt{W^2 + H^2}$) ensures consistent gesture sensitivity across desktop webcams, mobile portrait screens, and high-resolution video streams regardless of screen resolution.

### 5.3 Gesture State Machine
To ensure the gesture triggers **exactly once** per pinch and does not continuously cycle while fingers remain together, the engine enforces a debounced state machine:

```text
  READY
    │
    │ d_norm < T_trigger (held 3 consecutive frames)
    ▼
  TRIGGERED
    │  - Advance to next enabled filter
    │  - Show brief filter name toast
    ▼
  WAIT_FOR_SEPARATION
    │  - Lock gesture trigger until fingers separate
    │
    │ d_norm > T_release
    ▼
  READY
```

---

## 6. UNIVERSAL FILTER SYSTEM & BUILT-IN PRESETS

### 6.1 Extensible Filter Suite
Filters are independent visual processing modules registered in the system. The built-in filter suite includes a broad set of visual styles:

* **Original:** Clean, unfiltered camera pass-through baseline.
* **Moody:** High contrast, desaturated shadows, deep atmospheric tones.
* **Warm:** Golden hour tint with boosted warm tones and soft highlights.
* **Cool:** Crisp cyan/blue cast with elevated shadow clarity.
* **Vintage Film:** Lifted blacks, muted contrast, and vintage warm color shifts.
* **Film Grain:** Analog film grain simulation with dynamic monochrome texture.
* **Dreamy Blur:** Soft bloom diffusion with highlight glow.
* **Cinematic:** Classic teal-and-orange color grade with high dynamic range look.
* **Y2K / Digicam:** Early 2000s compact digital camera aesthetic with high sharpness and flash highlights.
* **VHS:** Retro analog tape simulation with scanlines and chromatic aberration.
* **Pixelated:** Retro 8-bit / 16-bit block quantization.
* **Negative:** Color inversion with high contrast edges.
* **Grayscale:** Classic monochrome black-and-white conversion.
* **Sepia:** Warm antique brown monochrome tone.
* **Retro Flash:** High-exposure vintage camera flash aesthetic.

These filters serve as standard built-in presets defined by the application's central filter registry.

---

## 7. FILTER ARCHITECTURE & EXTENSIBILITY

### 7.1 Decoupled Module Design
The core HandFrame engine must **NOT** contain filter-specific conditionals such as `if (filter === "moody")` or hardcoded branching. The filter system is completely decoupled from camera handling, hand tracking, gesture detection, geometry calculations, and UI components.

> **"Adding or removing a filter must not require modification of the camera, tracking, gesture, or HandFrame core logic."**

### 7.2 Conceptual Code Structure
```text
filters/
├── types/
│   └── FilterTypes.ts            # Common filter interfaces & type definitions
├── registry/
│   └── FilterRegistry.ts         # Central filter registry & active cycle manager
├── implementations/
│   ├── OriginalFilter.ts
│   ├── MoodyFilter.ts
│   ├── WarmFilter.ts
│   ├── VintageFilmFilter.ts
│   ├── VhsFilter.ts
│   ├── PixelateFilter.ts
│   └── ... (individual built-in filter modules)
└── presets/
    └── DefaultFilters.ts         # Central manifest of built-in filters
```

### 7.3 Standard Filter Interface
Every filter module exposes a unified interface:

```typescript
export interface BaseFilter {
  readonly id: string;                  // Unique string identifier (e.g., 'vintage_film')
  readonly displayName: string;         // Human-readable display name (e.g., 'Vintage Film')
  readonly description?: string;       // Optional brief effect description
  readonly category?: string;          // Optional category grouping
  
  /**
   * Applies the visual filter to a cropped ImageData sub-region.
   * @param imageData HTML5 Canvas ImageData containing the quadrilateral bounding box.
   * @returns Processed ImageData object of identical dimensions.
   */
  apply(imageData: ImageData): ImageData;
}
```

---

## 8. UNLISTED TEMPORARY LOCAL FILTER MANAGEMENT ROUTE

### 8.1 Concept & Purpose
HandFrame features a built-in set of predefined filters. While standard users experience the default filter suite, a dedicated **unlisted, temporary filter management route** allows users to temporarily add, remove, or reorder built-in filters for their local browser session.

### 8.2 Unlisted Route Specification (`/aesthetic14`)
* **Default Route Path:** `/aesthetic14`
* **Environment Variable Override:** The route path must be configurable via an environment variable (e.g. `VITE_FILTER_EDITOR_PATH`), defaulting to `/aesthetic14`.
* **Zero UI Exposure / Non-Advertised Route:** This route must **NOT** be displayed, linked, or advertised anywhere in the standard frontend UI. It must not appear in:
  - Navigation bars or headers
  - Landing page buttons or text
  - Floating camera overlay controls
  - Footers, settings menus, or help dialogs
  - Visible links, buttons, or normal UI copy
* **Direct Address Bar Entry Only:** The page is accessed exclusively when a user manually enters the specific URL path into their browser address bar.
* **UX Discoverability Requirement:** Hiding the route is a discoverability/UX choice to keep the main experience minimal. It does not imply security authentication or backend access control.

```text
Normal Frontend (Landing / Camera)  ─── [No links to editor]
                                          
Direct URL Input (/aesthetic14)   ───▶ Unlisted Filter Editor Page
```

### 8.3 In-Memory & Reload Reset Behavior
* **Strictly Local Session State:** Modifications made on the special filter editor page apply **only to the current browser/device session**.
* **Zero Persistent Storage:** Temporary filter configurations MUST NOT be persisted in `localStorage`, `IndexedDB`, cookies, or remote databases.
* **Reload Resets to Default:** When the user reloads or refreshes the browser page:
  ```text
  Temporary filter modifications
               │
               ▼
           DISCARDED
               │
               ▼
  Default built-in registry configuration restored
  ```
  - Added filters disappear from the temporary cycle.
  - Removed filters return to the available cycle.
  - Temporary reordering changes are discarded.
  - Built-in default configuration is completely restored upon refresh.

### 8.4 Filter Editor Functionality
The unlisted page interacts directly with the application's central `FilterRegistry`:

1. **Select from Built-in Filters Only:** Users choose strictly from filters already implemented in the application. Users cannot write custom code or upload external filters.
2. **Temporary Add / Remove:** Users can enable or disable registered built-in filters for their current session.
3. **Temporary Reordering:** Users can adjust the rotation order (desktop drag-and-drop handles `≡` or mobile touch arrows `▲` `▼`).
4. **Live Filter Previews:** Displays real-time visual previews executing `filter.apply(...)` on sample image data.

```text
HAND FRAME

Filter Management (Temporary Session)

≡  ✓  Original
≡  ✓  Moody
≡  ✓  Warm
≡  ✕  VHS
≡  ✓  Vintage Film
≡  ✓  Cinematic

        Reset to Default
```

---

## 9. FULLSCREEN CAMERA & VIEWPORT MANAGEMENT

### 9.1 Camera Viewport Dominance
The camera is the primary hero experience. When active, the camera view fills the available screen space without page scrolling or window framing.

### 9.2 Viewport Filling vs. Browser Fullscreen API
The specification explicitly distinguishes between two fullscreen levels:

1. **Viewport Filling Camera (`100dvh`):** The camera canvas occupies 100% of the browser's visible viewport (`100vw` × `100dvh`).
2. **Browser Fullscreen API Mode:** An explicit, accessible **`Fullscreen`** toggle control that invokes `element.requestFullscreen()` (where supported by the browser) to hide browser chrome entirely.

The Fullscreen control is floating, minimal, and aesthetically integrated into the camera UI overlay.

### 9.3 Desktop Camera Experience
* Camera fills the entire browser window viewport (`100vw` × `100dvh`).
* Floating controls overlay the camera without occupying fixed layout blocks.
* No scrollbars (`overflow: hidden`).
* Camera is not placed inside a small centered card container.

```text
┌──────────────────────────────────────┐
│                                      │
│                                      │
│          FULLSCREEN CAMERA           │
│                                      │
│       HandFrame interaction          │
│                                      │
│                              controls│
└──────────────────────────────────────┘
```

### 9.4 Mobile Camera Experience
* Fullscreen portrait-first experience with smooth adaptation to landscape rotation.
* Uses modern dynamic viewport height units (`100dvh`) to prevent layout shifts when mobile address bars collapse.
* Honors mobile safe-area insets (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`).
* Prevents accidental touch scrolling, elastic bounce, or gesture navigation interference.
* Touch-friendly floating control targets ($\ge 44 \times 44\text{ px}$).

---

## 10. COORDINATE MAPPING SYSTEM

The engine must maintain exact spatial alignment between physical fingertips and generated filter vertices across the entire rendering pipeline:

```text
Camera Stream (Native Resolution: W_cam × H_cam)
                        ↓
  Displayed HTML5 <video> / Viewport Canvas (W_view × H_view)
                        ↓
  Render Canvas Coordinates (W_canvas × H_canvas)
                        ↓
  MediaPipe Normalized Hand Landmarks (x_norm, y_norm ∈ [0.0, 1.0])
                        ↓
  HandFrame Quadrilateral Pixel Coordinates (P1, P2, P3, P4)
```

### Transformation Requirements:
* **Desktop Webcams:** Standard landscape aspect mapping.
* **Mobile Front Cameras:** Horizontal mirroring (`scaleX(-1)`) correctly mapped to canvas space.
* **Mobile Rear Cameras:** Direct non-mirrored spatial mapping.
* **Orientation Changes:** Dynamic re-calculation when mobile devices rotate between portrait and landscape.
* **Display Scaling:** Correct scaling across `object-fit: cover` and `object-fit: contain` modes without spatial drift between visible fingertips and quadrilateral boundaries.

---

## 11. MOBILE CAMERA SWITCHING

On mobile devices with multiple cameras, users can switch between front (selfie) and rear (environment) cameras.

### Switching Sequence:
1. Stop active tracks on current video stream (`track.stop()`).
2. Re-call `navigator.mediaDevices.getUserMedia()` with requested `facingMode` (`"user"` or `"environment"`).
3. Update stream dimensions and aspect ratio metrics.
4. Recalculate horizontal mirroring and coordinate matrices.
5. Maintain valid hand tracking and active filter state uninterrupted.

---

## 12. UI / VISUAL DESIGN DIRECTION

### 12.1 Target Aesthetic
> **Extremely simple, premium, modern, artistic, minimal, and unobtrusive.**

The camera is the product; the UI supports the camera rather than competing with it. While the camera is active, the interface feels almost invisible.

> **"Simple does not mean unfinished. Every visible UI element should feel intentional."**

### 12.2 Design Guidelines
* **Typography:** Crisp, high-end sans-serif typography (e.g., Inter, Outfit, or system sans-serif) with spacious tracking.
* **Translucency & Blur:** Subtle floating panels with dark translucent backgrounds and soft backdrop blur (`backdrop-blur-md bg-black/40`).
* **Restrained Controls:** Minimal floating icons that auto-hide or dim after 3 seconds of inactivity.
* **Subtle Toast Feedback:** When the filter changes, the active filter name appears briefly at top-center (e.g., `MOODY`) and smoothly fades out over 1.2 seconds.
* **Design Research Assistance:** Implementation agents may use available MCP servers (such as StitchMCP) to research UI patterns, evaluate minimal camera layouts, and test responsive/accessibility behavior.

### 12.3 Strict UI Exclusions
Avoid:
* ❌ Dashboard layouts or multi-card grids
* ❌ Heavy SaaS borders, aggressive drop shadows, or bright gradients
* ❌ Large permanent toolbars or fixed navigation bars over the camera
* ❌ Cluttered icon banks or dense instruction banners
* ❌ Generic SaaS styling

---

## 13. WEBSITE STRUCTURE & NAVIGATION

The primary public application uses a simple, streamlined structure:

```text
Landing Page
   │
   └── Start HandFrame (Fullscreen Camera Experience)
```

*(Note: The filter management route `/aesthetic14` is unlisted and not linked anywhere in the navigation tree).*

### 13.1 Landing Page
A clean, elegant introduction communicating the core concept:

```text
HAND FRAME

Create the frame.
Change what happens inside it.

[ Start HandFrame ]
```

### 13.2 Floating Camera Controls
When the camera is active, minimal floating controls float over the video feed:
* **Top-Left:** Return to Landing Page (`←`).
* **Top-Right:** Fullscreen Toggle (`⛶`), Mobile Camera Switch (where supported), Debug Mode Toggle (`D`).
* **Bottom-Center:** Active Filter Indicator Pill (clickable to manually advance filter).

---

## 14. PERFORMANCE & COMPOSITING OPTIMIZATION

### 14.1 Frame Rate Targets
* **Minimum Target:** 30 FPS on standard mobile and desktop devices.
* **Optimal Target:** 60 FPS on performance hardware.

### 14.2 React Render Loop Isolation
* The frame processing pipeline runs strictly inside `requestAnimationFrame()`.
* React state updates are **NEVER** called inside the per-frame animation loop.
* Canvas rendering utilizes direct DOM element references (`useRef`).

### 14.3 Region-Only Compositing
Filters process **only the bounding area inside the HandFrame quadrilateral**, avoiding unnecessary full-frame re-processing:

1. Calculate axis-aligned bounding box around $P_1, P_2, P_3, P_4$.
2. Crop sub-region `ImageData`.
3. Apply active filter module to sub-region.
4. Clip context using polygon path formed by $P_1, P_2, P_3, P_4$.
5. Composite filtered sub-region over raw camera feed canvas.

---

## 15. ERROR STATES & ACCESSIBILITY

### 15.1 Graceful Failure Handling
Presents simple, human-readable UI messaging without raw technical stack traces for:
* Camera permission denied
* No camera hardware detected
* Camera locked by another application
* Unsupported browser (lacking WebRTC / WASM support)
* MediaPipe landmarker initialization failure
* Camera switching failure
* Low device performance detection

### 15.2 Web Accessibility
* Accessible ARIA labels on all control buttons.
* Desktop keyboard navigation (`Space` for manual filter switch, `F` for Fullscreen, `D` for Debug, `Esc` for Menu).
* Visible focus indicators.
* High contrast ratio for text elements.
* Touch-friendly target sizes ($\ge 44 \times 44\text{ px}$).

---

## 16. DEVELOPMENT DEBUG OVERLAY MODE

A dev-only overlay (toggled via `D` key or debug icon, hidden in production by default) showing:
* 4 tracked fingertip landmarks ($P_1$: green, $P_2$: blue, $P_3$: yellow, $P_4$: red)
* Quadrilateral bounding outline & centroid
* Real-time FPS counter & processing latency (ms)
* Stream resolution vs canvas resolution
* Active gesture state (`READY`, `TRIGGERED`, `WAIT_FOR_SEPARATION`)

---

## 17. CONCEPTUAL ARCHITECTURE PIPELINE

The future implementation architecture separates UI components from real-time processing:

```text
Camera Stream (WebRTC)
   │
   ▼
Hand Tracking (MediaPipe WASM Worker)
   │
   ▼
Four Fingertip Coordinates (P1, P2, P3, P4)
   │
   ▼
Geometry / Quadrilateral Validation
   │
   ▼
Gesture Controller (State Machine)
   │
   ▼
Filter Manager (Temporary Session State / Registry Defaults)
   │
   ▼
Region Filter Processing (Canvas / WebGL)
   │
   ▼
Fullscreen Camera Experience (Viewport Canvas)
```

---

## 18. NO OVER-ENGINEERING & NON-GOALS

The future implementation must remain clean and lightweight:
* ❌ NO Redux or complex global state libraries unless genuinely needed (React Context / lightweight state is sufficient).
* ❌ NO Backend services, databases, or microservices.
* ❌ NO User accounts, authentication, or cloud sync.
* ❌ NO Over-engineered plugin frameworks beyond the Filter Registry interface.

---

## 19. MCP SERVER USAGE GUIDELINES

Implementation agents may use available MCP servers (such as StitchMCP) during future development for:
* Researching minimal web UI designs and visual inspiration.
* Responsive viewport testing and mobile layout validation.
* Accessibility testing and performance profiling.

MCP tools must not introduce external runtime dependencies into the client application. HandFrame remains **lightweight + local-first + browser-based**.

---

## 20. ACCEPTANCE CRITERIA

### 20.1 Normal User Workflow
1. User visits the primary HandFrame URL.
2. Experiences the minimal landing page and fullscreen camera view.
3. No links, buttons, or mentions of the filter editor are visible anywhere in the UI.
4. HandFrame cycles through the standard built-in filter suite using the 4-finger pinch gesture.

### 20.2 Special Route User Workflow (`/aesthetic14`)
1. User manually navigates to `/aesthetic14` (or configured env path).
2. The unlisted filter management page renders with built-in filter toggles and reordering handles.
3. User temporarily adds, removes, or reorders built-in filters.
4. The temporary filter list immediately updates the local session gesture cycle.
5. Other users and devices remain completely unaffected.
6. Refreshing or reloading the page **discards** temporary modifications and restores the default built-in filter configuration.

---

## 21. ABSOLUTE NON-IMPLEMENTATION DIRECTIVE

> **CRITICAL MANDATE: THIS TASK IS STRICTLY AN UPDATE TO THE TECHNICAL SPECIFICATION FILE (`HANDFRAME_SPECIFICATION.md`). DO NOT IMPLEMENT CODE, DO NOT CREATE COMPONENTS, DO NOT WRITE STYLES, DO NOT INSTALL DEPENDENCIES, DO NOT INITIALIZE PROJECTS, AND DO NOT RUN DEVELOPMENT SERVERS.**

---

## 22. SINGLE SOURCE OF TRUTH SUMMARY

This document represents the **single source of truth** for HandFrame as a web application. All future web implementation work must strictly conform to the platform, UI, performance, gesture, filter architecture, coordinate mapping, unlisted filter editor route, and compositing specifications defined herein.
