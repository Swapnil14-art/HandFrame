# HandFrame — Complete Project Specification

**Document Version:** 1.0.0  
**Author:** Senior Software Architect & Computer Vision Engineer  
**Status:** Approved Specification (Single Source of Truth)  
**Target Platform:** Cross-platform Desktop (Windows, macOS, Linux)  

---

## 1. PROJECT OVERVIEW

### 1.1 What HandFrame Is
**HandFrame** is a real-time computer vision application that allows users to create a dynamic visual frame using their hands. By tracking four specific physical landmarks across both hands—specifically the left index fingertip, left thumb tip, right index fingertip, and right thumb tip—the application forms a dynamic quadrilateral region on the live camera stream. A modular visual filter is computed and rendered **exclusively inside this bounding region**, while the exterior background video stream remains untouched in real-time.

### 1.2 Problem & Core Concept
Traditional photo and video filters are applied uniformly across an entire image frame or tracked rigidly around detected human faces. HandFrame introduces an intuitive, tactile form of spatial interaction: using physical hand gestures to define the spatial bounding box ("viewfinder") of an effect. The user directly controls the geometry, position, orientation, and scale of the filtered window using physical spatial interactions.

### 1.3 How the Interaction Works
1. **Framing**: The user brings both hands into the camera field of view, creating a natural framing box with their thumbs and index fingers.
2. **Dynamic Masking**: The system tracks the 4 fingertips in real-time, calculates the quadrilateral region, transforms/masks the selected video region, applies an active visual filter, and composites it seamlessly into the live output frame.
3. **Touch-to-Switch Gesture**: To change the active visual filter, the user brings all four tracked fingertips together into a tight cluster (a "pinch-all" or "four-point touch" gesture). The system detects this proximity, transitions the active filter index exactly once, and enters a lockout state until the user separates their fingers again.

### 1.4 Main Use Cases
- **Creative Media & Interactive Video**: Real-time performance art, dynamic video streaming, visual framing effects.
- **Interactive Displays & Kiosks**: Touchless interaction in exhibitions or public demo stations.
- **Educational CV Demonstration**: A crisp, clean modular architecture demonstrating landmark tracking, perspective transforms, convex hull generation, image compositing, and finite state machines.

### 1.5 Explicit Non-Goals (Scope Boundaries)
To ensure high performance, low latency, offline operation, and reliability, HandFrame explicitly excludes:
- **No Generative AI / LLMs**: No cloud visual generation, text-to-image prompts, or API calls to external services.
- **No Cloud Dependencies**: Zero internet connectivity required during execution.
- **No Heavy Deep Learning Training**: Rely exclusively on lightweight local landmark inference (e.g., MediaPipe Hands CPU/GPU pipeline).
- **No Complex 3D Graphics Engines**: Rendering is handled strictly via standard frame buffer compositing engines (e.g., OpenCV, NumPy).

---

## 2. CORE FUNCTIONAL REQUIREMENTS

The system features are strictly categorized into **MVP (Minimum Viable Product)**, **Recommended**, and **Future/Optional** to preserve project focus.

| ID | Feature Name | Description | Priority |
|---|---|---|---|
| **FR-01** | Live Camera Capture | Capture webcam feed (default camera index 0) at $\ge 30$ FPS and configurable resolutions ($640\times 480$, $1280\times 720$). | **MVP** |
| **FR-02** | Dual-Hand Landmark Tracking | Concurrently detect and track Left Hand and Right Hand landmarks locally using MediaPipe Hands. | **MVP** |
| **FR-03** | 4-Point Landmark Extraction | Extract pixel coordinates for Left Index Tip (#8), Left Thumb Tip (#4), Right Index Tip (#8), and Right Thumb Tip (#4). | **MVP** |
| **FR-04** | Quad Convexity & Size Validation | Validate that the 4 extracted points form a non-self-intersecting, convex quadrilateral exceeding minimum surface area limits. | **MVP** |
| **FR-05** | Polygon Region Masking | Generate a binary/alpha mask for the quadrilateral region and isolate interior pixels for transformation. | **MVP** |
| **FR-06** | Modular Filter Engine | Process interior pixels through a dynamically loaded filter pipeline adhering to a unified abstract base class. | **MVP** |
| **FR-07** | Region-Only Compositing | Composite the filtered quadrilateral output strictly back into the primary camera frame. | **MVP** |
| **FR-08** | Gesture-Based Filter Switch | Monitor pair-wise Euclidean distances among all 4 points. Trigger a single filter transition when all 6 pair distances fall below a threshold. | **MVP** |
| **FR-09** | Debounced Gesture State Machine | Require explicit separation of fingertips before re-arming the filter-switch gesture detector. | **MVP** |
| **FR-10** | Minimal On-Screen Overlay | Render unobtrusive UI text indicating current filter name, FPS counter, and gesture trigger indicators. | **MVP** |
| **FR-11** | Temporal Coordinate Landmark Smoothing | Exponential moving average (EMA) or Kalman filtering on raw $(x,y)$ coordinates to eliminate landmark jitter. | **Recommended** |
| **FR-12** | Perspective Rectification / Homography | Optional planar perspective un-warping prior to filter processing (e.g., for pixel grid aligned effects). | **Recommended** |
| **FR-13** | Edge Feathering & Alpha Blending | Apply Gaussian blending along the quadrilateral boundaries for smooth visual integration. | **Recommended** |
| **FR-14** | Video File Input/Output Processing | Process pre-recorded `.mp4`/`.avi` files offline and export composited output to disk. | **Recommended** |
| **FR-15** | Keyboard / Debug Hotkeys | Allow manual filter switching (Left/Right arrows), debug overlay toggle ('D'), and quit ('Q'). | **Recommended** |
| **FR-16** | Video Recording & Snapshot Export | Capture filtered output stream directly to disk with a single hotkey trigger. | **Future/Optional** |
| **FR-17** | Filter Parameter Control | Interactive physical adjustment of filter parameters (e.g., controlling blur radius via hand distance). | **Future/Optional** |

---

## 3. USER FLOW & EXCEPTION HANDLING

```
 +------------------------+
 |   Launch Application   |
 +-----------+------------+
             |
             v
 +------------------------+      Camera Fail
 | Initialize Camera/Media| --------------------> [ Display Error & Exit / Retry ]
 +-----------+------------+
             |
             v
 +------------------------+
 | Read Next Video Frame  | <----------------------------------+
 +-----------+------------+                                    |
             |                                                 |
             v                                                 |
 +------------------------+  No Hands                          |
 | Detect Hands & Extract | ----------+                        |
 |       Landmarks        |           |                        |
 +-----------+------------+           |                        |
             | Both Hands             v                        |
             v               +------------------+              |
 +------------------------+  | Composite Uncut  |              |
 | Validate Quad Geometry |  | Raw Video Frame  |              |
 +-----------+------------+  +--------+---------+              |
             |                        |                        |
      Valid  |  Invalid Geometry      |                        |
   +---------+--------+               |                        |
   |                  |               |                        |
   v                  v               |                        |
+--------+    +---------------+       |                        |
| Process|    | Render Raw +  |       |                        |
| Filter |    | Status Banner |       |                        |
+---+----+    +-------+-------+       |                        |
    |                 |               |                        |
    v                 v               v                        |
+-----------------------------------------------+              |
| Update Gesture State Machine & Filter Index   |              |
+---------------------+-------------------------+              |
                      |                                        |
                      v                                        |
+-----------------------------------------------+              |
|  Render Composited Frame to UI Display Window | -------------+
+-----------------------------------------------+
```

### 3.1 Standard User Flow
1. **Startup**: App starts, loads configuration settings (`config.json`), initializes OpenCV video capture device and MediaPipe Hand Landmarker module.
2. **Live Feed Initialization**: Display window renders live raw webcam feed at target resolution ($1280\times 720$ at 30 FPS). UI status indicates `STATUS: SEARCHING_FOR_HANDS`.
3. **Detection & Framing**: User places left and right hands in front of the lens. MediaPipe classifies hand handedness (Left/Right) and locates Index Tip (#8) and Thumb Tip (#4) for both hands.
4. **Quadrilateral Formation**: System connects the 4 points in anti-clockwise cyclic order: `[Left Thumb -> Left Index -> Right Index -> Right Thumb]`.
5. **Masking & Filtering**: Interior quadrilateral pixels are isolated, passed through the active filter (e.g., *Vintage*), and blended back onto the main canvas. UI displays `FILTER: Vintage (1/8)`.
6. **Gesture Interaction**: User brings all 4 fingers together into a tight cluster ($< 35 \text{ px}$ distance). Filter switches from *Vintage* to *Pixelate*. The UI momentarily highlights a `[GESTURE TRIGGERED]` status indicator.
7. **Lockout Phase**: User holds fingers together. Gesture state shifts to `WAIT_FOR_RELEASE`. No duplicate filter switching occurs.
8. **Separation**: User spreads fingers apart ($> 65 \text{ px}$). Gesture state resets to `READY`.
9. **Exit**: User presses 'q' or closes window. Camera resources and video write buffers release cleanly.

### 3.2 Exception & Degradation Behavior
- **Zero or One Hand Detected**: The bounding box cannot be established. The system seamlessly renders the raw video feed, displays a semi-transparent HUD note (`"Show both hands to frame"`), and maintains active gesture monitoring until 2 hands return.
- **Wrong Hand Orientation / Crossed Hands**: If hands cross over such that Right Hand appears on the screen left and Left Hand on screen right, spatial coordinate ordering (sorting points by x-coordinate or angular order relative to center) prevents geometry flipping and polygon inversion.
- **Occluded / Missing Fingertips**: If confidence drops below `0.5`, system retains last-known spatial coordinates for up to $N=5$ consecutive frames before dropping frame construction gracefully.
- **Rapid Motion / Motion Blur**: Temporary tracking loss triggers immediate, soft fade-out of the filtered region back to raw background rather than visual artifact tearing.

---

## 4. HAND TRACKING SPECIFICATION

### 4.1 MediaPipe Hand Landmarks Mapping
MediaPipe Hands provides 21 3D landmarks per detected hand. HandFrame isolates exactly two key landmarks per hand:

```
          [Index Fingertip] (ID: 8)
                o
               /
              / 
             o (ID: 7)
            /
           o (ID: 6)
          /
  (ID: 4) o---------o---------o (ID: 0: Wrist)
 [Thumb Tip]     (ID: 2)   (ID: 1)
```

- **Thumb Tip**: Landmark Index `4` (`WRIST` -> `THUMB_CMC` -> `THUMB_MCP` -> `THUMB_IP` -> `THUMB_TIP`)
- **Index Fingertip**: Landmark Index `8` (`INDEX_FINGER_MCP` -> `INDEX_FINGER_PIP` -> `INDEX_FINGER_DIP` -> `INDEX_FINGER_TIP`)

### 4.2 Handedness & Tracking Reliability
MediaPipe returns handedness metadata (`"Left"` vs `"Right"`). To guard against hand identity swapping (which occurs when hands cross or flip):
1. **MediaPipe Handedness Inspection**: Read primary classification label and classification score (require $\ge 0.7$).
2. **Spatial Coordinate Guard**: Compute spatial center $X_c$ for Hand A and Hand B. If `handedness` metadata disagrees with horizontal spatial positions in standard camera view for $>3$ frames, re-evaluate assignment using relative wrist coordinates.
3. **Canonical Point Mapping**:
   - $P_{LT}$: Left Hand Thumb Tip (Landmark 4)
   - $P_{LI}$: Left Hand Index Tip (Landmark 8)
   - $P_{RI}$: Right Hand Index Tip (Landmark 8)
   - $P_{RT}$: Right Hand Thumb Tip (Landmark 4)

### 4.3 Coordinate Systems & Conversions
MediaPipe outputs normalized coordinates:
$$x_{\text{norm}}, y_{\text{norm}} \in [0.0, 1.0], \quad z_{\text{norm}} \in [-1.0, 1.0]$$

These are immediately mapped to absolute pixel coordinates based on current frame dimensions $(W, H)$:
$$X_{\text{px}} = \text{clamp}(\lfloor x_{\text{norm}} \times W \rfloor, 0, W-1)$$
$$Y_{\text{px}} = \text{clamp}(\lfloor y_{\text{norm}} \times H \rfloor, 0, H-1)$$

### 4.4 Coordinate Smoothing & Jitter Reduction
Raw landmark detections fluctuate by $\pm 2\text{--}5$ pixels due to sensor noise and subtle hand trembling. An **Exponential Moving Average (EMA)** filter is applied frame-by-frame to every tracked point:

$$\hat{P}_t = \alpha \cdot P_{\text{raw}, t} + (1 - \alpha) \cdot \hat{P}_{t-1}$$

- Recommended smoothing factor: $\alpha = 0.35$ (balanced responsiveness and stability).
- Adaptive smoothing: If point velocity $\|\vec{v}\| = \|\hat{P}_t - \hat{P}_{t-1}\| > 50\text{ px/frame}$, dynamically bump $\alpha \to 0.85$ to eliminate lag during fast hand movement.

---

## 5. QUADRILATERAL & FRAME GEOMETRY

### 5.1 Point Ordering & Polygon Construction
To avoid self-intersecting "hourglass" polygons, the 4 landmark points must be sorted in cyclic trigonometric order (clockwise or counter-clockwise) relative to their geometric centroid $(\bar{X}, \bar{Y})$:

$$\bar{X} = \frac{1}{4}\sum_{i=1}^4 X_i, \quad \bar{Y} = \frac{1}{4}\sum_{i=1}^4 Y_i$$

For each point $P_i$, calculate polar angle $\theta_i$:
$$\theta_i = \text{atan2}(Y_i - \bar{Y}, X_i - \bar{X})$$

Sort points by $\theta_i$ in ascending order to yield a strictly ordered convex or non-self-intersecting simple polygon vertex array:
$$\mathbf{V} = [P_{(1)}, P_{(2)}, P_{(3)}, P_{(4)}]$$

```
          P1 (Left Index)           P2 (Right Index)
                 +-----------------+
                /                   \
               /                     \
              /                       \
             +-------------------------+
          P4 (Left Thumb)           P3 (Right Thumb)
```

### 5.2 Geometry Validation Rules
Before passing polygon vertices to the Compositor Engine, $\mathbf{V}$ must satisfy three geometric validity criteria:

1. **Non-Self-Intersection Check**: Cross products of consecutive edge vectors must share the same sign:
   $$\text{sign}\left( (\vec{e}_i \times \vec{e}_{i+1})_z \right) = \text{constant} \quad \forall i \in \{1..4\}$$
2. **Minimum Enclosed Area**: Polygon surface area $A$ computed via Shoelace Formula must exceed a minimum threshold:
   $$A = \frac{1}{2} \left| \sum_{i=1}^{4} (X_i Y_{i+1} - X_{i+1} Y_i) \right| \ge 1200 \text{ pixels}^2$$
   *(Prevents processing minuscule regions or degenerating into lines)*.
3. **Convexity / Maximum Aspect Ratio**: Interior angles must be within $[20^\circ, 160^\circ]$.

If geometry validation fails, the frame generator flags `INVALID_GEOMETRY`, suppressing filter execution and maintaining clean rendering without crashes.

---

## 6. FILTER PROCESSING ENGINE

### 6.1 Abstract Filter Architecture
Every filter in HandFrame derives from a clean, unified abstract base class `BaseFilter`.

```python
from abc import ABC, abstractmethod
import numpy as np

class BaseFilter(ABC):
    """
    Abstract Base Class for all HandFrame visual filters.
    """
    
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
        self.params = {}

    @abstractmethod
    def apply(self, image: np.ndarray, mask: np.ndarray = None) -> np.ndarray:
        """
        Applies visual effect to input frame.
        
        :param image: BGR uint8 numpy array (H, W, 3)
        :param mask: Binary single-channel uint8 numpy array (H, W), 255 inside frame region, 0 outside.
        :return: Processed BGR uint8 numpy array (H, W, 3)
        """
        pass

    def set_parameter(self, key: str, value: float):
        """Allows dynamic adjustment of filter properties."""
        if key in self.params:
            self.params[key] = value

    def get_info(self) -> dict:
        return {"name": self.name, "description": self.description, "params": self.params}
```

### 6.2 Filter Registry & Dynamic Factory Pattern
Filters are registered centrally using a `FilterRegistry` manager:

```python
class FilterRegistry:
    def __init__(self):
        self._filters = []
        self._active_index = 0

    def register(self, filter_instance: BaseFilter):
        self._filters.append(filter_instance)

    def get_active_filter(self) -> BaseFilter:
        if not self._filters:
            raise RuntimeError("No filters registered in system!")
        return self._filters[self._active_index]

    def next_filter(self) -> BaseFilter:
        if self._filters:
            self._active_index = (self._active_index + 1) % len(self._filters)
        return self.get_active_filter()

    def previous_filter(self) -> BaseFilter:
        if self._filters:
            self._active_index = (self._active_index - 1) % len(self._filters)
        return self.get_active_filter()
```

---

## 7. INITIAL FILTER LIBRARY

The initial release includes 8 diverse, high-performance, real-time filters:

| # | Filter Name | Visual Effect | Algorithmic Approach | Target Computational Cost | Parameters |
|---|---|---|---|---|---|
| 1 | **Grayscale** | Classic Black & White | `cv2.cvtColor(BGR2GRAY)` + channel stack | Very Low ($<0.2\text{ ms}$) | None |
| 2 | **Sepia Vintage** | Warm, aged brown tone | Color matrix multiplication ($\mathbf{M}_{\text{sepia}} \cdot \mathbf{C}$) | Low ($<0.5\text{ ms}$) | `intensity` (0.0 - 1.0) |
| 3 | **Negative / Invert** | Photo negative color reversal | Bitwise inversion `255 - frame` | Extremely Low ($<0.1\text{ ms}$) | None |
| 4 | **Gaussian Blur** | Soft defocus / privacy blurring | `cv2.GaussianBlur` with kernel $(k, k)$ | Low-Medium ($1.0\text{ ms}$) | `kernel_size` (odd, default 21) |
| 5 | **Pixelate / Retro** | 8-bit blocky mosaic effect | Downscale via `INTER_NEAREST` then upscale | Low ($0.3\text{ ms}$) | `block_size` (default 16 px) |
| 6 | **Sobel Edge Detect** | High-contrast neon edge highlights | Sobel gradients $G_x, G_y \to \text{magnitude}$ | Medium ($1.2\text{ ms}$) | `threshold` (0 - 255) |
| 7 | **Thermal Vision** | Simulated infrared temperature map | Gray conversion + `cv2.applyColorMap(COLORMAP_JET)` | Low ($0.4\text{ ms}$) | `colormap_type` |
| 8 | **Pop Art Cyan Shift** | Vivid cyberpunk color channel shift | Split channels, offset R/B, recombine | Low ($0.3\text{ ms}$) | `shift_amount` (default 15 px) |

---

## 8. GESTURE DETECTION SYSTEM

### 8.1 Gesture Logic: Four-Point Convergence
The gesture trigger evaluates whether all 4 tracked points ($P_{LT}, P_{LI}, P_{RI}, P_{RT}$) coalesce into a tight cluster.

```
       NORMAL FRAMING                         TOUCH SWITCH GESTURE
      (Points Separated)                      (Points Converged)

    P1 o--------------o P2                           o P1, P2
       |              |                            o   o P3, P4
       |              |                         Max Distance < Threshold
    P4 o--------------o P3
```

### 8.2 Proximity Metric
Compute all $C(4, 2) = 6$ pairwise Euclidean distances:
$$d(P_a, P_b) = \sqrt{(X_a - X_b)^2 + (Y_a - Y_b)^2}$$

Define max pair distance $D_{\text{max}}$:
$$D_{\text{max}} = \max \left\{ d(P_{LT}, P_{LI}), d(P_{LT}, P_{RI}), d(P_{LT}, P_{RT}), d(P_{LI}, P_{RI}), d(P_{LI}, P_{RT}), d(P_{RI}, P_{RT}) \right\}$$

To remain invariant across different camera frame resolutions ($640\times 480$ vs $1920\times 1080$), normalize $D_{\text{max}}$ relative to the diagonal length $L_{\text{diag}} = \sqrt{W^2 + H^2}$:

$$d_{\text{norm}} = \frac{D_{\text{max}}}{L_{\text{diag}}}$$

- **Touch Threshold ($T_{\text{trigger}}$)**: $d_{\text{norm}} < 0.045$ ($\approx 35\text{ px}$ on $1280\times 720$).
- **Release Threshold ($T_{\text{release}}$)**: $d_{\text{norm}} > 0.080$ ($\approx 65\text{ px}$ on $1280\times 720$).

### 8.3 State Machine Architecture & Debouncing

```
                        +----------------------+
                        |        IDLE          | <-------------------+
                        +----------+-----------+                     |
                                   |                                 |
                         d_norm < T_trigger                          |
                         for >= N_trigger frames                     |
                                   |                                 |
                                   v                                 |
                        +----------------------+                     |
                        |   TRIGGER_PENDING    |                     |
                        +----------+-----------+                     |
                                   |                                 |
                            Switch Filter                            |
                                   |                                 |
                                   v                                 |
                        +----------------------+                     |
                        |   WAIT_FOR_RELEASE   |                     |
                        +----------+-----------+                     |
                                   |                                 |
                         d_norm > T_release                          |
                         or cooldown elapsed                         |
                                   +---------------------------------+
```

### 8.4 Gesture Detection Pseudocode

```python
class GestureState:
    IDLE = 0
    TRIGGER_PENDING = 1
    WAIT_FOR_RELEASE = 2

class GestureEngine:
    def __init__(self, trigger_thresh_norm=0.045, release_thresh_norm=0.080, debounce_frames=3, cooldown_sec=0.8):
        self.trigger_thresh = trigger_thresh_norm
        self.release_thresh = release_thresh_norm
        self.debounce_frames = debounce_frames
        self.cooldown_sec = cooldown_sec
        
        self.state = GestureState.IDLE
        self.close_frame_count = 0
        self.last_trigger_time = 0.0

    def update(self, points, frame_dims, current_time) -> bool:
        """
        Returns True ONLY ONCE when a valid gesture trigger occurs.
        """
        if points is None or len(points) < 4:
            self.state = GestureState.IDLE
            self.close_frame_count = 0
            return False

        W, H = frame_dims
        diag = (W**2 + H**2) ** 0.5
        
        # Calculate max pairwise distance
        max_dist = 0.0
        for i in range(4):
            for j in range(i + 1, 4):
                dist = ((points[i][0] - points[j][0])**2 + (points[i][1] - points[j][1])**2)**0.5
                if dist > max_dist:
                    max_dist = dist
                    
        norm_dist = max_dist / diag

        # State Machine Transitions
        if self.state == GestureState.IDLE:
            if norm_dist < self.trigger_thresh:
                self.close_frame_count += 1
                if self.close_frame_count >= self.debounce_frames:
                    if (current_time - self.last_trigger_time) >= self.cooldown_sec:
                        self.state = GestureState.WAIT_FOR_RELEASE
                        self.last_trigger_time = current_time
                        self.close_frame_count = 0
                        return True
            else:
                self.close_frame_count = 0

        elif self.state == GestureState.WAIT_FOR_RELEASE:
            if norm_dist > self.release_thresh and (current_time - self.last_trigger_time) >= 0.3:
                self.state = GestureState.IDLE
                
        return False
```

---

## 9. IMAGE COMPOSITING PIPELINE

### 9.1 Step-by-Step Execution Sequence

```
1. Raw BGR Frame (1280x720) ──> 2. MediaPipe Hand Landmark Tracking
                                          │
                                          ▼
4. Mask Generation <────────────── 3. Extract & Smooth 4 Fingertips
   (fillConvexPoly)                       │
          │                               ▼
          ▼                      5. Apply Active Filter (Full Frame)
   Binary Alpha Mask                      │
          │                               ▼
          └─────────────────────> 6. Bitwise Blend / Composite
                                          │
                                          ▼
                                 7. Render Final Output Frame
```

### 9.2 Compositing Mathematics & Code Snippet
To guarantee maximum processing speed, masking is executed using OpenCV NumPy vectorization rather than pixel loops:

```python
def composite_frame(raw_frame: np.ndarray, filtered_frame: np.ndarray, quad_points: np.ndarray, feather_radius: int = 5) -> np.ndarray:
    """
    Composites filtered_frame into raw_frame inside quad_points boundary with optional edge feathering.
    """
    H, W, C = raw_frame.shape
    mask = np.zeros((H, W), dtype=np.uint8)
    
    # 1. Rasterize filled polygon onto binary mask
    pts = quad_points.astype(np.int32).reshape((-1, 1, 2))
    cv2.fillConvexPoly(mask, pts, 255)
    
    # 2. Optional Soft Edge Feathering
    if feather_radius > 0:
        ksize = feather_radius * 2 + 1
        mask_blurred = cv2.GaussianBlur(mask, (ksize, ksize), 0)
        alpha = (mask_blurred.astype(np.float32) / 255.0)[:, :, np.newaxis]
    else:
        alpha = (mask.astype(np.float32) / 255.0)[:, :, np.newaxis]
        
    # 3. Alpha blend composite: Output = (Filtered * Alpha) + (Raw * (1 - Alpha))
    output_frame = (filtered_frame.astype(np.float32) * alpha + 
                    raw_frame.astype(np.float32) * (1.0 - alpha)).astype(np.uint8)
                    
    return output_frame
```

---

## 10. VIDEO FILE SUPPORT ARCHITECTURE

HandFrame uses a clean input abstraction layer allowing the exact same landmarking, filtering, gesture, and compositing pipeline to operate seamlessly over either a **Live Webcam Stream** or a **Pre-recorded Video File**.

```
              +-----------------------+
              |   Input Source Interface|
              +-----------+-----------+
                          |
             +------------+------------+
             |                         |
             v                         v
  +--------------------+    +--------------------+
  | OpenCV Camera Feed |    | Video File Stream  |
  | (Real-time Clock)  |    | (Step-by-step Frame|
  +---------+----------+    +----------+---------+
            |                          |
            +------------+-------------+
                         |
                         v
            +--------------------------+
            |  Core Processing Pipeline|
            |  (Tracking, Mask, Filter)|
            +------------+-------------+
                         |
             +-----------+-----------+
             |                       |
             v                       v
  +--------------------+   +--------------------+
  | Display UI Window  |   | Video File Writer  |
  |   (Interactive)    |   | (Export MP4 File)  |
  +--------------------+   +--------------------+
```

### Shared Engine Limitations & Rules
- **Speed Processing**: Live camera processes frames based on real-time arrival ($30\text{ FPS}$). Video file processing can run asynchronously frame-by-frame as fast as CPU/GPU permits, or locked to native file framerate.
- **Landmark Continuity**: Pre-recorded video files with high motion blur may challenge landmark tracking. Tracking failure fallbacks (retaining raw background) handle recorded media identically to live streams.

---

## 11. UI / UX SPECIFICATION

### 11.1 Display Layout & Minimal Visual HUD
The application prioritizes an immersive camera view. Visual overlays are kept ultra-lightweight and rendered semi-transparently at screen corners.

```
+-------------------------------------------------------------------+
| FPS: 31.4 | STATUS: TRACKING_OK                  FILTER: VINTAGE  |
|                                                                   |
|             (P1) Left Index              (P2) Right Index         |
|                 +--------------------------+                      |
|                /    [ Filtered Region ]     \                     |
|               /   (Visual Effect Active)     \                    |
|              +--------------------------------+                   |
|          (P4) Left Thumb                (P3) Right Thumb          |
|                                                                   |
|                                                                   |
| [Q]: Quit | [SPACE]: Pause | [D]: Debug Lines | [N]: Next Filter |
+-------------------------------------------------------------------+
```

### 11.2 Key UI Overlay Components
1. **Top-Left HUD**:
   - `FPS: xx.x` (Real-time performance rendering rate).
   - `STATUS: SEARCHING | TRACKING_OK | INVALID_GEOMETRY | GESTURE_ACTIVE`.
2. **Top-Right HUD**:
   - `FILTER: <Filter Name> (<Active Index>/<Total Count>)`.
3. **Debug Bounds (Toggleable via 'D' key)**:
   - Green bounding line linking the 4 tracked quad points.
   - Colored landmark dots: Left Thumb (Blue), Left Index (Cyan), Right Thumb (Red), Right Index (Yellow).
   - Dynamic distance indicator between points during gesture convergence.
4. **Bottom HUD Hotkey Bar**:
   - Non-intrusive keyboard legend for fast manual overrides.

---

## 12. FILTER MANAGEMENT & EXTENSIBILITY GUIDE

To make adding or removing filters effortless without modifying core engine logic:

### 12.1 Adding a New Filter in 3 Steps
1. Create a new file in `handframe/filters/` (e.g., `my_custom_filter.py`).
2. Subclass `BaseFilter` and implement `apply(self, image, mask)`:

```python
# handframe/filters/my_custom_filter.py
import cv2
import numpy as np
from handframe.filters.base_filter import BaseFilter

class MyCustomFilter(BaseFilter):
    def __init__(self):
        super().__init__(name="My Custom Filter", description="Applies custom hue rotation")

    def apply(self, image: np.ndarray, mask: np.ndarray = None) -> np.ndarray:
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        hsv[:, :, 0] = (hsv[:, :, 0] + 40) % 180
        return cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
```

3. Instantiate and add your filter to `FilterRegistry` in `handframe/filters/__init__.py`:

```python
# handframe/filters/__init__.py
from handframe.filters.filter_registry import FilterRegistry
from handframe.filters.grayscale_filter import GrayscaleFilter
from handframe.filters.my_custom_filter import MyCustomFilter

def build_default_registry() -> FilterRegistry:
    registry = FilterRegistry()
    registry.register(GrayscaleFilter())
    registry.register(MyCustomFilter())  # <--- Added cleanly!
    return registry
```

### 12.2 Removing a Filter
Simply comment out or delete its `registry.register(...)` line in `build_default_registry()`. Core application execution remains completely unaffected.

---

## 13. PROJECT ARCHITECTURE

### 13.1 ASCII Dataflow & Architecture Diagram

```
+-----------------------------------------------------------------------+
|                            INPUT LAYER                                |
|  +---------------------------+     +-------------------------------+  |
|  | OpenCV Camera Capture Stream|  OR |  Video File Reader Stream     |  |
|  +-------------+-------------+     +---------------+---------------+  |
+----------------|-----------------------------------|------------------+
                 |                                   |
                 +-----------------+-----------------+
                                   | Raw BGR Frame
                                   v
+-----------------------------------------------------------------------+
|                           TRACKING ENGINE                             |
|  +-----------------------------------------------------------------+  |
|  | MediaPipe Hands Local Detector                                  |  |
|  |  - Extracts Left/Right Hand Landmark Coordinates (IDs 4 & 8)     |  |
|  +-------------------------------+---------------------------------+  |
|                                  | Raw Coordinates                    |
|                                  v                                    |
|  +-----------------------------------------------------------------+  |
|  | Landmark Smoother (Exponential Moving Average Filter)           |  |
|  +-------------------------------+---------------------------------+  |
+----------------------------------|------------------------------------+
                                   | Smoothed 4 Points
               +-------------------+-------------------+
               |                                       |
               v                                       v
+------------------------------+       +--------------------------------+
|     FRAME GEOMETRY MODULE    |       |     GESTURE RECOGNITION ENGINE |
| - Polygon Order Sorting      |       | - Pairwise Distance Matrix     |
| - Shoelace Convexity Check   |       | - Debounced State Machine      |
| - Valid Quad Mask Generator  |       | - Triggers Filter Index Increment|
+--------------+---------------+       +---------------+----------------+
               |                                       |
               | Quad Mask & Points                    | Filter Switch Signal
               v                                       v
+-----------------------------------------------------------------------+
|                          FILTER PROCESSING ENGINE                     |
|  +-----------------------------------------------------------------+  |
|  | Filter Registry (Active Filter: BaseFilter)                     |  |
|  |  - Executes apply(raw_frame, mask)                              |  |
|  +-------------------------------+---------------------------------+  |
+----------------------------------|------------------------------------+
                                   | Filtered Image Frame
                                   v
+-----------------------------------------------------------------------+
|                          COMPOSITING & UI ENGINE                      |
|  +-----------------------------------------------------------------+  |
|  | Bitwise Alpha Compositor (Smooth Region Blending)               |  |
|  | HUD Overlay Manager (FPS, Status, Filter Name, Debug Lines)     |  |
|  +-------------------------------+---------------------------------+  |
+----------------------------------|------------------------------------+
                                   | Final Composited BGR Output Frame
                                   v
+-----------------------------------------------------------------------+
|                           OUTPUT DISPLAY LAYER                        |
|  +---------------------------+     +-------------------------------+  |
|  | OpenCV GUI Window Display | AND | Video File Export Writer      |  |
|  +---------------------------+     +-------------------------------+  |
+-----------------------------------------------------------------------+
```

---

## 14. RECOMMENDED DIRECTORY STRUCTURE

```
HandFrame/
├── assets/                          # Static icons, sample media, demo videos
│   └── sample_video.mp4
├── config/
│   └── default_config.json          # System parameters, thresholds, camera configs
├── handframe/                       # Main Python Package Source
│   ├── __init__.py                  # Package init
│   ├── main.py                      # Main Application Entrypoint
│   ├── core/                        # Core algorithmic modules
│   │   ├── __init__.py
│   │   ├── camera_stream.py         # Threaded OpenCV camera reader
│   │   ├── hand_tracker.py          # MediaPipe Hands wrapper & smoothing
│   │   ├── frame_geometry.py        # Point sorting, area & convexity validation
│   │   ├── gesture_engine.py        # Proximity metrics & debounced state machine
│   │   └── compositor.py            # Region extraction, masking, alpha blending
│   ├── filters/                     # Modular Visual Filter Architecture
│   │   ├── __init__.py              # Filter factory & default registry builder
│   │   ├── base_filter.py           # Abstract Base Class BaseFilter
│   │   ├── filter_registry.py       # Registry & switching state manager
│   │   ├── grayscale_filter.py      # Filter 1: Grayscale
│   │   ├── sepia_filter.py          # Filter 2: Sepia Vintage
│   │   ├── invert_filter.py         # Filter 3: Invert / Negative
│   │   ├── blur_filter.py           # Filter 4: Gaussian Blur
│   │   ├── pixelate_filter.py       # Filter 5: Pixelate Mosaic
│   │   ├── edge_filter.py           # Filter 6: Sobel Edge Detection
│   │   ├── thermal_filter.py        # Filter 7: Thermal False-Color
│   │   └── popart_filter.py         # Filter 8: Cyan RGB Shift
│   ├── ui/                          # Display & HUD
│   │   ├── __init__.py
│   │   ├── hud_overlay.py           # Text overlays, FPS counter, status indicators
│   │   └── window_manager.py        # OpenCV window creation & keyboard handlers
│   └── utils/                       # Helper functions
│       ├── __init__.py
│       ├── logger.py                # Console logger
│       └── config_loader.py         # JSON configuration parser
├── tests/                           # Automated Test Suite
│   ├── test_geometry.py             # Unit tests for polygon convexity & sorting
│   ├── test_gesture.py              # Unit tests for gesture state transitions
│   ├── test_filters.py              # Unit tests for filter API compliance
│   └── test_compositor.py           # Unit tests for mask generation & alpha blend
├── .gitignore                       # Git ignore rules
├── HANDFRAME_SPECIFICATION.md       # Project Technical Specification (This File)
├── README.md                        # Quickstart documentation
└── requirements.txt                 # Project dependencies
```

---

## 15. RECOMMENDED TECHNOLOGY STACK & RATIONALE

| Layer | Recommended Technology | Alternatives Considered | Rationale & Selection Criteria |
|---|---|---|---|
| **Language** | **Python 3.10+** | C++, Rust | High computer vision ecosystem support, rapid modular development, easy filter authoring. |
| **Computer Vision** | **OpenCV (`opencv-python`)** | PIL, Scikit-Image | Industry standard for real-time frame manipulation, high-speed C++ backend bindings. |
| **Landmark Detection** | **MediaPipe (`mediapipe`)** | OpenPose, YOLOv8-pose | Extremely lightweight, highly accurate 21-point 3D hand tracking operating locally on CPU/GPU. |
| **Numerical Processing** | **NumPy (`numpy`)** | PyTorch, CuPy | Zero-copy vectorization for frame masking, fast spatial distance and matrix math without heavy dependencies. |
| **UI Rendering** | **OpenCV HighGUI (`cv2.imshow`)** | PySide6, PyQt, Tkinter | Zero external UI dependencies, lightweight frame buffer rendering, low memory footprint. |
| **Configuration** | **JSON / Standard Library** | YAML, TOML | Simple human-editable format, zero third-party parsing overhead. |

---

## 16. PERFORMANCE REQUIREMENTS & TARGET BENCHMARKS

### 16.1 Target Metrics
- **Target Frame Rate**: $\ge 30 \text{ FPS}$ on standard mid-range desktop CPU (Intel i5 10th Gen / AMD Ryzen 5 or equivalent).
- **Target Frame Latency**: $\le 33 \text{ ms}$ total end-to-end processing pipeline time per frame.
- **Maximum Resolution**: Default $1280 \times 720$ (720p). Downscaled internally to $640 \times 480$ for MediaPipe landmark inference if CPU load exceeds threshold.
- **Memory Footprint**: $\le 250 \text{ MB}$ RAM during steady-state processing.
- **CPU Utilization**: $\le 30\%$ on a quad-core modern CPU.

### 16.2 Pipeline Latency Budget Allocation (Total Budget: 33ms)

```
[Camera Capture]  ─────> 4 ms
[MediaPipe Tracking] ──> 14 ms  (Primary Bottleneck)
[Geometry & Gesture] ──> 1 ms
[Filter Execution]   ──> 6 ms
[Compositing Engine] ──> 4 ms
[UI HUD & Render]    ──> 4 ms
--------------------------------
TOTAL LATENCY:           33 ms  (Yields ~30.3 FPS)
```

### 16.3 Optimization Fallback Strategies
If runtime FPS falls below 20 FPS:
1. **Decouple Tracking Frequency**: Run MediaPipe Hand Detection every 2nd frame, using optical flow or linear velocity estimation for intermediate frames.
2. **Resolution Scaling**: Infer landmarks on $640 \times 360$ frames while keeping full resolution for compositing.
3. **Optimized Threading**: Isolate OpenCV `VideoCapture` into a dedicated daemon thread to prevent frame buffer retrieval locks.

---

## 17. ERROR HANDLING & SYSTEM RESILIENCE

| Error Condition | Cause | Graceful Degradation Strategy |
|---|---|---|
| **Camera Unavailable** | Device index 0 missing or locked by another app. | Catch `cv2.VideoCapture` failure, output clear error message in console, prompt user for camera index retry or auto-fallback to sample video file. |
| **MediaPipe Fail** | Library dependency mismatch or missing model binaries. | Catch initialization exception, display diagnostic log, fall back to pure color test frame mode. |
| **Tracking Loss** | Hands moved out of view or occluded. | Maintain raw webcam background rendering, clear active quad frame gracefully, set UI status `SEARCHING_FOR_HANDS`. |
| **Invalid Quad Geometry** | Self-intersecting lines or collinear points. | Suppress filter execution for current frame, draw red warning bounding lines in debug mode, set UI status `GEOMETRY_INVALID`. |
| **Filter Exception** | Runtime error inside custom user filter. | Catch exception safely inside `FilterRegistry.apply()`, log stack trace once, auto-fallback to safe default `GrayscaleFilter`. |
| **Video File EOF** | End of input video file reached. | Auto-rewind video feed to Frame 0 for seamless continuous loop. |

---

## 18. COMPREHENSIVE EDGE CASE HANDLING MATRIX

| Edge Case | Expected System Behavior |
|---|---|
| **One Hand Only in Frame** | Display raw background stream. UI HUD shows `"Show second hand to form frame"`. No filter applied. |
| **Hands Cross Over (Left on Right, Right on Left)** | Polygon sorting algorithm arranges vertices by relative angular order rather than raw hand ID, preventing hourglass distortion. |
| **Fingertips Occluded / Hidden** | Smooth coordinate interpolation holds last valid point for up to 5 frames. If unrecovered, drop region cleanly. |
| **Fingers Touch (Gesture Performed)** | Proximity engine detects convergence, triggers exact 1-count filter increment, locks gesture state until points separate. |
| **Rapid Hand Movement** | Landmark velocity triggers adaptive EMA smoothing ($\alpha \to 0.85$), minimizing visual quad lag behind physical fingers. |
| **Low Ambient Light / Cluttered Background** | MediaPipe confidence score check suppresses false-positive hand detections below threshold ($0.5$). |
| **Quad Frame Too Small ($< 1200\text{ px}^2$)** | Geometry validator flags `QUAD_TOO_SMALL`, preventing sub-pixel filtering overhead or division-by-zero errors. |
| **Quad Frame Covers Full Screen** | Filter engine scales seamlessly to full frame dimensions without memory reallocation bounds errors. |

---

## 19. CONFIGURATION SPECIFICATION (`default_config.json`)

All operational variables are maintained externally in JSON format for easy tuning:

```json
{
  "camera": {
    "device_index": 0,
    "width": 1280,
    "height": 720,
    "fps": 30
  },
  "tracking": {
    "max_num_hands": 2,
    "min_detection_confidence": 0.7,
    "min_tracking_confidence": 0.5,
    "smoothing_alpha": 0.35
  },
  "geometry": {
    "min_area_pixels": 1200,
    "feather_radius_pixels": 5
  },
  "gesture": {
    "trigger_threshold_norm": 0.045,
    "release_threshold_norm": 0.080,
    "debounce_frames": 3,
    "cooldown_seconds": 0.8
  },
  "ui": {
    "show_hud": true,
    "debug_mode": false,
    "window_name": "HandFrame - Real-Time Vision Frame"
  }
}
```

---

## 20. TESTING STRATEGY

### 20.1 Automated Unit Tests
- **Geometry Tests (`tests/test_geometry.py`)**: Verify Shoelace area formulas, clockwise vertex sorting, and convexity detection over synthetic point sets.
- **Gesture State Machine Tests (`tests/test_gesture.py`)**: Feed sequence of mock distance matrices; verify single trigger firing and re-arm lockout state.
- **Filter Interface Compliance (`tests/test_filters.py`)**: Iterate all registered filters; verify output shapes match input shapes `(H, W, 3)` and datatype remains `uint8`.
- **Compositing Tests (`tests/test_compositor.py`)**: Check that pixel values outside quad boundary in composited output match raw input image exactly.

### 20.2 Manual Camera QA Test Plan

| Test ID | Scenario | Steps | Expected Outcome |
|---|---|---|---|
| **QA-01** | Basic Framing | Raise both hands, bring index & thumb tips into frame. | Clean frame boundary appears; visual filter activates inside box. |
| **QA-02** | Gesture Trigger | Bring all 4 fingertips together to touch. | Filter changes immediately *once*. HUD updates filter title. |
| **QA-03** | Lockout Check | Keep all 4 fingertips touching for 5 seconds. | Filter does *not* continuously cycle. |
| **QA-04** | Separation Re-arm | Separate fingers wide, then bring together again. | Second gesture trigger succeeds, moving to next filter. |
| **QA-05** | Single Hand Withdrawal | Hide right hand behind back. | Filter vanishes smoothly; raw camera stream continues uninterrupted. |
| **QA-06** | Hotkey Controls | Press 'N' key, 'D' key, 'Q' key. | 'N' advances filter; 'D' toggles debug lines; 'Q' closes application cleanly. |

---

## 21. DEVELOPMENT PHASES & ROADMAP

```
Phase 1: Project Setup & Base Camera Stream
  └── Initialize repo, config loader, threaded OpenCV camera feed.

Phase 2: MediaPipe Landmark Integration
  └── Integrate MediaPipe Hands, isolate IDs 4 & 8, implement coordinate mapping.

Phase 3: Coordinate Smoothing & Geometry Module
  └── Build EMA coordinate smoother, 4-point sorting, convexity validation.

Phase 4: Polygon Masking & Compositing Pipeline
  └── Implement binary mask rasterization and vectorized alpha blending.

Phase 5: Abstract Filter Architecture & Base Filters
  └── Build BaseFilter, FilterRegistry, and initial 4 core filters (Grayscale, Blur, Sepia, Invert).

Phase 6: Gesture Engine Implementation
  └── Implement proximity math, debounced state machine, re-arm lockout logic.

Phase 7: Full Filter Library Expansion
  └── Add Pixelate, Sobel Edge, Thermal, and PopArt filters.

Phase 8: UI Overlays & Interactive Debug Controls
  └── Build HUD overlay, FPS counter, status indicators, hotkey handlers.

Phase 9: Video File Input/Output Integration
  └── Add video file processing pipeline and offline MP4 export.

Phase 10: Automated Testing, Optimization & Documentation
  └── Execute unit tests, profile latency budget, finalize README quickstart.
```

---

## 22. MVP DEFINITION

The **Minimum Viable Product (MVP)** is complete when the application:
1. Opens live camera feed at $\ge 30 \text{ FPS}$.
2. Detects dual hands and tracks Left Index (#8), Left Thumb (#4), Right Index (#8), and Right Thumb (#4).
3. Constructs a valid quadrilateral region and applies a visual filter **strictly inside** the frame.
4. Includes at least 4 working filters (Grayscale, Sepia, Blur, Invert) adhering to `BaseFilter`.
5. Fired-detects the 4-point pinch gesture to switch active filters **exactly once per touch gesture**.
6. Maintains debounced lockout until fingers separate.
7. Operates 100% offline without third-party generative AI dependencies.

---

## 23. ACCEPTANCE CRITERIA CHECKLIST

- [ ] **AC-01**: Application launches successfully without network access.
- [ ] **AC-02**: Live video feed displays with HUD indicating current status and FPS.
- [ ] **AC-03**: Hand landmarks (IDs 4 & 8 on left/right hands) are accurately detected and smoothed.
- [ ] **AC-04**: Quadrilateral region is correctly formed with cyclic vertex ordering.
- [ ] **AC-05**: Filter effect is visible **only inside** the quadrilateral frame.
- [ ] **AC-06**: Exterior video pixels remain completely unmodified.
- [ ] **AC-07**: Bringing 4 points close ($d_{\text{norm}} < 0.045$) switches active filter.
- [ ] **AC-08**: Holding 4 points together does *not* cause filter cycling.
- [ ] **AC-09**: Separating points ($d_{\text{norm}} > 0.080$) resets gesture engine for next trigger.
- [ ] **AC-10**: Modular filter architecture allows adding a new filter by adding one class file.
- [ ] **AC-11**: Frame processing maintains $\ge 30 \text{ FPS}$ at 720p resolution.
- [ ] **AC-12**: Pressing 'Q' exits the application cleanly without unhandled exceptions.

---

## 24. FUTURE EXTENSIONS (POST-MVP)

- **Gesture-Controlled Filter Parameters**: Pinch-and-drag distance between thumbs adjusts filter intensity or blur radius in real time.
- **Multi-Frame Support**: Allow two people to create separate independent filter frames concurrently.
- **Snapshot & GIF Recording**: Dedicated hotkey to capture high-res snapshots of the framed scene.
- **Dynamic Perspective Rectification**: Apply homography perspective transform to flatten skewed framed views into a rectangular axis-aligned sub-window.

---

## 25. PRIVACY & SECURITY STATEMENT

- **100% Local Processing**: All image frames, hand landmarks, and calculations remain in volatile system memory (RAM).
- **No Cloud Transmissions**: No telemetric data, analytics, or image feeds are ever transmitted externally.
- **Zero Third-Party AI Services**: No dependencies on external API keys, OpenAI, cloud CV, or online model hosts.
- **Transparent Camera Access**: Camera hardware is accessed strictly while the application window is active and released immediately upon termination.

---

## 26. FINAL IMPLEMENTATION BLUEPRINT

### 26.1 Tech Stack Summary
- **Python 3.10+**, **OpenCV (`opencv-python`)**, **MediaPipe (`mediapipe`)**, **NumPy (`numpy`)**.

### 26.2 Core Class Hierarchy

```
HandFrame App Manager (handframe/main.py)
   ├── CameraStream (handframe/core/camera_stream.py)
   ├── HandTracker (handframe/core/hand_tracker.py)
   ├── FrameGeometry (handframe/core/frame_geometry.py)
   ├── GestureEngine (handframe/core/gesture_engine.py)
   ├── FilterRegistry (handframe/filters/filter_registry.py)
   │     └── BaseFilter (handframe/filters/base_filter.py)
   │           ├── GrayscaleFilter
   │           ├── SepiaFilter
   │           ├── InvertFilter
   │           ├── BlurFilter
   │           ├── PixelateFilter
   │           ├── EdgeFilter
   │           ├── ThermalFilter
   │           └── PopArtFilter
   ├── Compositor (handframe/core/compositor.py)
   └── HUDOverlay (handframe/ui/hud_overlay.py)
```

### 26.3 Core Execution Loop Blueprint

```python
# Conceptual Main Loop Architecture Blueprint
import cv2
import time
from handframe.core.camera_stream import CameraStream
from handframe.core.hand_tracker import HandTracker
from handframe.core.frame_geometry import FrameGeometry
from handframe.core.gesture_engine import GestureEngine
from handframe.core.compositor import Compositor
from handframe.filters import build_default_registry
from handframe.ui.hud_overlay import HUDOverlay

def run_handframe():
    camera = CameraStream(device_index=0, width=1280, height=720).start()
    tracker = HandTracker(min_detection_confidence=0.7)
    geometry = FrameGeometry()
    gesture_engine = GestureEngine()
    filter_registry = build_default_registry()
    compositor = Compositor()
    hud = HUDOverlay()
    
    prev_time = time.time()

    while True:
        frame = camera.read()
        if frame is None:
            break
            
        current_time = time.time()
        fps = 1.0 / max(current_time - prev_time, 0.001)
        prev_time = current_time

        # 1. Detect Hand Landmarks
        landmarks = tracker.process_frame(frame)
        
        output_frame = frame.copy()
        
        if landmarks.has_both_hands():
            points = tracker.extract_four_points(landmarks)
            smoothed_pts = tracker.smooth_points(points)
            
            # 2. Check Gesture Trigger
            if gesture_engine.update(smoothed_pts, (frame.shape[1], frame.shape[0]), current_time):
                filter_registry.next_filter()
                hud.flash_gesture_trigger()
                
            # 3. Validate & Composite Frame
            if geometry.validate_quad(smoothed_pts):
                active_filter = filter_registry.get_active_filter()
                filtered_full = active_filter.apply(frame)
                output_frame = compositor.composite(frame, filtered_full, smoothed_pts)
                hud.set_status("TRACKING_OK")
            else:
                hud.set_status("INVALID_GEOMETRY")
        else:
            hud.set_status("SEARCHING_FOR_HANDS")

        # 4. Render Overlay & Display
        hud.render(output_frame, fps=fps, active_filter_name=filter_registry.get_active_filter().name)
        cv2.imshow("HandFrame", output_frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    camera.stop()
    cv2.destroyAllWindows()
```
