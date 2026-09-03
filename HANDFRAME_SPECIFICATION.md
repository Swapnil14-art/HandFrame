# HandFrame — Complete Project Specification

**Document Version:** 1.1.0 (Fixed Stack & PySide6 Architecture Specification)  
**Author:** Senior Software Architect & Computer Vision Engineer  
**Status:** Approved Specification (Single Source of Truth)  
**Target Platform:** Standalone Cross-platform Desktop (Windows, macOS, Linux)  

---

## 1. PROJECT OVERVIEW

### 1.1 What HandFrame Is
**HandFrame** is a real-time computer vision application that allows users to create a dynamic visual frame using their hands. By tracking four specific physical landmarks across both hands—specifically the left index fingertip, left thumb tip, right index fingertip, and right thumb tip—the application forms a dynamic quadrilateral region on the live camera stream. A modular visual filter is computed and rendered **exclusively inside this bounding region**, while the exterior background video stream remains untouched in real-time.

### 1.2 Problem & Core Concept
Traditional photo and video filters are applied uniformly across an entire image frame or tracked rigidly around detected human faces. HandFrame introduces an intuitive, tactile form of spatial interaction: using physical hand gestures to define the spatial bounding box ("viewfinder") of an effect. The user directly controls the geometry, position, orientation, and scale of the filtered window using physical spatial interactions.

### 1.3 How the Interaction Works
1. **Framing**: The user brings both hands into the camera field of view, creating a natural framing box with their thumbs and index fingers.
2. **Dynamic Masking**: The system tracks the 4 fingertips in real-time, calculates the quadrilateral region, extracts/crops the selected video region, applies an active visual filter, and composites it seamlessly into the live output frame.
3. **Touch-to-Switch Gesture**: To change the active visual filter, the user brings all four tracked fingertips together into a tight cluster (a "pinch-all" or "four-point touch" gesture). The system detects this proximity, transitions the active filter index exactly once, and enters a lockout state until the user separates their fingers again.

### 1.4 Main Use Cases
- **Creative Media & Interactive Video**: Real-time performance art, dynamic video streaming, visual framing effects.
- **Interactive Displays & Kiosks**: Touchless interaction in exhibitions or public demo stations.
- **Educational CV Demonstration**: A crisp, clean modular architecture demonstrating landmark tracking, perspective transforms, convex hull generation, image compositing, and finite state machines.

### 1.5 Explicit Non-Goals & Architectural Constraints
To ensure high performance, low latency, offline operation, and reliability, HandFrame strictly enforces:

```
[ STRICT CONSTRAINTS CHECKLIST ]
❌ NO Generative AI / LLMs / OpenAI API
❌ NO TensorFlow / PyTorch / YOLO
❌ NO Cloud Services or Network Dependencies
❌ NO Web Application Frameworks / Electron
❌ NO Unnecessary Third-Party Libraries
```

- **100% Offline-First**: Zero internet connectivity required during execution.
- **Local Processing**: MediaPipe is used strictly for local hand landmark detection. All actual HandFrame visual processing—region detection, masking, perspective transformation, filters, compositing, and video processing—is performed using OpenCV and NumPy.
- **Fixed Small Tech Stack**: **Python 3.11+ + OpenCV + MediaPipe + NumPy + PySide6 + PyInstaller**.

---

## 2. CORE FUNCTIONAL REQUIREMENTS

The system features are strictly categorized into **MVP (Minimum Viable Product)**, **Recommended**, and **Future/Optional** to preserve project focus.

| ID | Feature Name | Description | Priority |
|---|---|---|---|
| **FR-01** | Live Camera Capture | Capture webcam feed (default camera index 0) at $\ge 30$ FPS (up to 60 FPS) at $1280\times 720$ resolution. | **MVP** |
| **FR-02** | Dual-Hand Landmark Tracking | Concurrently detect and track Left Hand and Right Hand landmarks locally using MediaPipe Hands. | **MVP** |
| **FR-03** | 4-Point Landmark Extraction | Extract pixel coordinates for Left Index Tip (#8), Left Thumb Tip (#4), Right Index Tip (#8), and Right Thumb Tip (#4). | **MVP** |
| **FR-04** | Quad Convexity & Size Validation | Validate that the 4 extracted points form a non-self-intersecting, convex quadrilateral exceeding minimum surface area limits. | **MVP** |
| **FR-05** | Region-Bounding Crop & Masking | Calculate axis-aligned bounding box of the quadrilateral, crop sub-image for filter application, and generate region alpha mask. | **MVP** |
| **FR-06** | Modular Filter Engine | Process region pixels through a dynamically loaded filter pipeline adhering to a unified `BaseFilter` abstract class. | **MVP** |
| **FR-07** | Region-Only Compositing | Composite the filtered quadrilateral output strictly back into the primary camera frame without touching exterior pixels. | **MVP** |
| **FR-08** | Gesture-Based Filter Switch | Monitor pair-wise Euclidean distances among all 4 points. Trigger a single filter transition when all 6 pair distances fall below threshold. | **MVP** |
| **FR-09** | Debounced Gesture State Machine | Require explicit separation of fingertips before re-arming the filter-switch gesture detector. | **MVP** |
| **FR-10** | PySide6 Desktop GUI | Render responsive native desktop interface with HUD overlay, active filter name, FPS counter, and status bar. | **MVP** |
| **FR-11** | Temporal Landmark Smoothing | Exponential moving average (EMA) filter on raw $(x,y)$ coordinates to eliminate landmark jitter without introducing latency. | **Recommended** |
| **FR-12** | PySide6 Thread Decoupling | Isolate camera capture and CV processing pipeline on a `QThread` worker to ensure 100% responsive UI thread. | **Recommended** |
| **FR-13** | Edge Feathering & Alpha Blending | Apply Gaussian blending along the quadrilateral boundaries for smooth visual integration. | **Recommended** |
| **FR-14** | Video File Input/Output Processing | Process pre-recorded `.mp4`/`.avi` files offline and export composited output to disk. | **Recommended** |
| **FR-15** | Keyboard / GUI Controls | Allow manual filter switching (Left/Right arrows / GUI buttons), debug overlay toggle ('D'), and quit ('Q'). | **Recommended** |
| **FR-16** | PyInstaller Executable Package | Package application into a standalone Windows executable (`HandFrame.exe`). | **Recommended** |
| **FR-17** | Video Recording & Snapshot Export | Capture filtered output stream directly to disk with a single hotkey / PySide6 button trigger. | **Future/Optional** |

---

## 3. USER FLOW & EXCEPTION HANDLING

```
 +---------------------------------------------+
 |   Launch PySide6 Desktop App (HandFrame)    |
 +----------------------+----------------------+
                        |
                        v
 +---------------------------------------------+      Camera Fail
 | Initialize OpenCV Camera & MediaPipe Worker | --------------------> [ PySide6 Error Dialog ]
 +----------------------+----------------------+
                        |
                        v
 +---------------------------------------------+
 | Worker Thread: Read Next Camera Frame (BGR) | <--------------------+
 +----------------------+----------------------+                      |
                        |                                             |
                        v                                             |
 +---------------------------------------------+  No Hands            |
 | MediaPipe Hands: Detect & Track Landmarks   | ----------+          |
 +----------------------+----------------------+           |          |
                        | Both Hands                       v          |
                        v                         +-----------------+ |
 +---------------------------------------------+  | Render Raw      | |
 | Validate Geometry & Compute Bounding Box    |  | Camera Frame    | |
 +----------------------+----------------------+  +--------+--------+ |
                        |                                  |          |
      Valid Quad        |  Invalid Geometry                |          |
   +--------------------+-------------------+              |          |
   |                                        |              |          |
   v                                        v              |          |
+------------------------------+   +-----------------+     |          |
| Crop Quad Region Bounding Box|   | Render Raw +    |     |          |
| Apply Active Filter & Mask   |   | Status Banner   |     |          |
| Composite back to Main Canvas|   +--------+--------+     |          |
+--------------+---------------+            |              |          |
               |                            |              |          |
               v                            v              v          |
+------------------------------------------------------------------+  |
| Update Gesture State Machine & Filter Index                      |  |
+-----------------------------------+------------------------------+  |
                                    |                                 |
                                    v                                 |
+------------------------------------------------------------------+  |
| Emit Frame Signal -> PySide6 UI Thread Renders QImage to Window   | -+
+------------------------------------------------------------------+
```

### 3.1 Standard User Flow
1. **Startup**: User launches `HandFrame.exe` (or `python -m handframe.main`). PySide6 main window displays, loads configuration settings (`default_config.json`), and spawns the background `CameraWorkerThread`.
2. **Live Feed Initialization**: PySide6 `QLabel` or `QOpenGLWidget` renders the live webcam stream at target resolution ($1280\times 720$ at 30–60 FPS). Status bar displays `Status: Searching for hands...`.
3. **Detection & Framing**: User brings both hands into view. MediaPipe classifies hand handedness (Left/Right) and extracts Index Tip (#8) and Thumb Tip (#4) for both hands.
4. **Quadrilateral Formation**: System connects the 4 points in cyclic order: `[Left Thumb -> Left Index -> Right Index -> Right Thumb]`.
5. **Region-Only Masking & Filtering**: System calculates the minimal axis-aligned bounding box around the 4 points, crops the sub-region, passes only cropped pixels through the active OpenCV filter (e.g., *Vintage*), masks the polygon, and composites back into the canvas. PySide6 HUD displays `Filter: Vintage (1/8)`.
6. **Gesture Interaction**: User brings all 4 fingers together into a tight cluster ($< 35 \text{ px}$ distance). Filter switches from *Vintage* to *Pixelate*. PySide6 status bar momentarily highlights `[GESTURE TRIGGERED: Filter Switched]`.
7. **Lockout Phase**: User holds fingers together. Gesture state shifts to `WAIT_FOR_RELEASE`. No duplicate filter switching occurs.
8. **Separation**: User spreads fingers apart ($> 65 \text{ px}$). Gesture state resets to `IDLE`.
9. **Exit**: User clicks window close button or presses 'Q'. The PySide6 `closeEvent` signals worker thread termination, releases camera hardware, and exits cleanly.

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
To ensure smooth tracking:
1. **MediaPipe Tracking Mode**: Use `static_image_mode=False` so MediaPipe leverages temporal video tracking rather than running full detection on every frame.
2. **Spatial Coordinate Guard**: Compute spatial center $X_c$ for Hand A and Hand B. If `handedness` metadata disagrees with horizontal spatial positions in standard camera view, re-evaluate assignment using relative wrist coordinates.
3. **Canonical Point Mapping**:
   - $P_{LT}$: Left Hand Thumb Tip (Landmark 4)
   - $P_{LI}$: Left Hand Index Tip (Landmark 8)
   - $P_{RI}$: Right Hand Index Tip (Landmark 8)
   - $P_{RT}$: Right Hand Thumb Tip (Landmark 4)

### 4.3 Coordinate Systems & Conversions
MediaPipe outputs normalized coordinates $x_{\text{norm}}, y_{\text{norm}} \in [0.0, 1.0]$. These map directly to pixel coordinates:
$$X_{\text{px}} = \text{clamp}(\lfloor x_{\text{norm}} \times W \rfloor, 0, W-1)$$
$$Y_{\text{px}} = \text{clamp}(\lfloor y_{\text{norm}} \times H \rfloor, 0, H-1)$$

### 4.4 Coordinate Smoothing & Jitter Reduction
An **Exponential Moving Average (EMA)** filter is applied frame-by-frame:
$$\hat{P}_t = \alpha \cdot P_{\text{raw}, t} + (1 - \alpha) \cdot \hat{P}_{t-1}$$
- Recommended smoothing factor: $\alpha = 0.35$ (balanced responsiveness and stability).
- Adaptive velocity bump: If $\|\hat{P}_t - \hat{P}_{t-1}\| > 50\text{ px/frame}$, set $\alpha = 0.85$.

---

## 5. QUADRILATERAL & FRAME GEOMETRY

### 5.1 Point Ordering & Polygon Construction
The 4 landmark points are sorted in cyclic order relative to geometric centroid $(\bar{X}, \bar{Y})$ using polar angle $\theta_i = \text{atan2}(Y_i - \bar{Y}, X_i - \bar{X})$ to guarantee a non-self-intersecting polygon.

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
1. **Non-Self-Intersection**: Cross products of consecutive edge vectors share identical sign.
2. **Minimum Enclosed Area**: Surface area $A$ via Shoelace formula $\ge 1200 \text{ pixels}^2$.
3. **Convexity / Angle Bounds**: Interior angles within $[20^\circ, 160^\circ]$.

---

## 6. FILTER PROCESSING ENGINE

### 6.1 Abstract Filter Architecture
Every filter inherits from `BaseFilter`:

```python
from abc import ABC, abstractmethod
import numpy as np

class BaseFilter(ABC):
    """Abstract Base Class for all HandFrame visual filters."""
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description

    @abstractmethod
    def apply(self, image: np.ndarray) -> np.ndarray:
        """
        Applies visual effect to input image region (BGR uint8 numpy array).
        :param image: BGR uint8 array (H, W, 3)
        :return: Filtered BGR uint8 array (H, W, 3)
        """
        pass
```

### 6.2 Filter Registry Manager
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

| # | Filter Name | Visual Effect | OpenCV / NumPy Implementation | Target Cost |
|---|---|---|---|---|
| 1 | **Grayscale** | Classic Black & White | `cv2.cvtColor(img, COLOR_BGR2GRAY)` | $<0.1\text{ ms}$ |
| 2 | **Sepia Vintage** | Warm, aged brown tone | Color matrix multiplication `cv2.transform` | $<0.3\text{ ms}$ |
| 3 | **Negative / Invert** | Color reversal | `cv2.bitwise_not(img)` | $<0.05\text{ ms}$ |
| 4 | **Gaussian Blur** | Soft defocus privacy blur | `cv2.GaussianBlur(img, (21, 21), 0)` | $<0.5\text{ ms}$ |
| 5 | **Pixelate / Retro** | 8-bit blocky mosaic | Downscale via `INTER_NEAREST` then upscale | $<0.2\text{ ms}$ |
| 6 | **Sobel Edge Detect** | Neon edge highlights | `cv2.Sobel` magnitude gradients | $<0.8\text{ ms}$ |
| 7 | **Thermal Vision** | Infrared heat map | `cv2.applyColorMap(gray, COLORMAP_JET)` | $<0.3\text{ ms}$ |
| 8 | **Pop Art Cyan Shift** | Cyberpunk channel offset | Split channels, offset R/B arrays via NumPy | $<0.2\text{ ms}$ |

---

## 8. GESTURE DETECTION SYSTEM

### 8.1 Four-Point Proximity Metric
Compute normalized max pairwise distance $d_{\text{norm}} = D_{\text{max}} / \sqrt{W^2 + H^2}$.
- **Touch Threshold ($T_{\text{trigger}}$)**: $d_{\text{norm}} < 0.045$ ($\approx 35\text{ px}$ on $1280\times 720$).
- **Release Threshold ($T_{\text{release}}$)**: $d_{\text{norm}} > 0.080$ ($\approx 65\text{ px}$ on $1280\times 720$).

### 8.2 Gesture State Machine Pseudocode
```python
class GestureState:
    IDLE = 0
    WAIT_FOR_RELEASE = 1

class GestureEngine:
    def __init__(self, trigger_thresh=0.045, release_thresh=0.080, debounce_frames=3, cooldown_sec=0.8):
        self.trigger_thresh = trigger_thresh
        self.release_thresh = release_thresh
        self.debounce_frames = debounce_frames
        self.cooldown_sec = cooldown_sec
        self.state = GestureState.IDLE
        self.close_frame_count = 0
        self.last_trigger_time = 0.0

    def update(self, points, frame_dims, current_time) -> bool:
        if points is None or len(points) < 4:
            self.state = GestureState.IDLE
            self.close_frame_count = 0
            return False

        W, H = frame_dims
        diag = (W**2 + H**2) ** 0.5
        max_dist = max(
            ((points[i][0]-points[j][0])**2 + (points[i][1]-points[j][1])**2)**0.5
            for i in range(4) for j in range(i+1, 4)
        )
        norm_dist = max_dist / diag

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

## 9. REGION-ONLY OPTIMIZED COMPOSITING PIPELINE

To achieve **30–60 FPS**, visual filters are applied **only to the cropped bounding box** of the quadrilateral region rather than the entire $1280\times 720$ frame.

```python
def process_region_and_composite(raw_frame: np.ndarray, quad_pts: np.ndarray, active_filter: BaseFilter, feather_radius: int = 5) -> np.ndarray:
    """
    Optimized Region-Only Compositing using OpenCV & NumPy bounding box cropping.
    """
    H, W, _ = raw_frame.shape
    output_frame = raw_frame.copy()
    
    # 1. Compute axis-aligned bounding box around the 4 quad points
    x_min = max(0, int(np.min(quad_pts[:, 0])))
    x_max = min(W, int(np.max(quad_pts[:, 0])))
    y_min = max(0, int(np.min(quad_pts[:, 1])))
    y_max = min(H, int(np.max(quad_pts[:, 1])))
    
    if (x_max - x_min) < 10 or (y_max - y_min) < 10:
        return output_frame
        
    # 2. Crop sub-region
    cropped_raw = raw_frame[y_min:y_max, x_min:x_max]
    
    # 3. Apply visual filter strictly to cropped sub-region
    filtered_cropped = active_filter.apply(cropped_raw)
    
    # 4. Generate local mask relative to bounding box offset
    local_pts = quad_pts.copy()
    local_pts[:, 0] -= x_min
    local_pts[:, 1] -= y_min
    
    mask_local = np.zeros((y_max - y_min, x_max - x_min), dtype=np.uint8)
    cv2.fillConvexPoly(mask_local, local_pts.astype(np.int32), 255)
    
    if feather_radius > 0:
        ksize = feather_radius * 2 + 1
        mask_local = cv2.GaussianBlur(mask_local, (ksize, ksize), 0)
        
    alpha = (mask_local.astype(np.float32) / 255.0)[:, :, np.newaxis]
    
    # 5. Composite cropped region back into main canvas
    composited_sub = (filtered_cropped.astype(np.float32) * alpha + 
                      cropped_raw.astype(np.float32) * (1.0 - alpha)).astype(np.uint8)
                      
    output_frame[y_min:y_max, x_min:x_max] = composited_sub
    return output_frame
```

---

## 10. PYSIDE6 DESKTOP UI & THREAD ARCHITECTURE

The application uses **PySide6** (Qt for Python) to provide a responsive, native desktop application interface.

### 10.1 UI Thread Separation (`QThread`)

```
+---------------------------------------------------------------------+
|                      PySide6 Main GUI Thread                        |
|  - MainWindow (QMainWindow)                                         |
|  - Frame Display Widget (QLabel / QImage Renderer)                  |
|  - Control Panel Bar (Filter Selector, Camera Selector, Record Btn) |
|  - Status Bar (FPS Counter, Gesture Indicator, Tracking Status)     |
+----------------------------------^----------------------------------+
                                   |
                          QSignal: frame_processed(QImage, dict)
                                   |
+----------------------------------+----------------------------------+
|                    CameraWorkerThread (QThread)                     |
|  - OpenCV VideoCapture (Camera / Video File Stream)                 |
|  - MediaPipe Hand Landmark Detector                                 |
|  - Frame Geometry & Gesture State Engine                            |
|  - Region-Only Filter Processing & Compositor                       |
+---------------------------------------------------------------------+
```

### 10.2 PySide6 MainWindow Wireframe Specification

```
+-----------------------------------------------------------------------+
|  HandFrame — Real-Time Desktop Vision Viewfinder              [-][square][X] |
+-----------------------------------------------------------------------+
| Camera: [ Default (0) v ] | Mode: [ Live Camera v ] | Reset Frame     |
+-----------------------------------------------------------------------+
|                                                                       |
|                                                                       |
|                    LIVE VIDEO FEED DISPLAY CANVAS                     |
|                      (Rendered via PySide6 QImage)                    |
|                                                                       |
|                                                                       |
+-----------------------------------------------------------------------+
| Filter: [ Pixelate Mosaic v ] | Prev | Next | [D] Debug Overlay       |
| Status: TRACKING_OK | FPS: 58.2 | Gesture: READY                       |
+-----------------------------------------------------------------------+
```

---

## 11. DEPENDENCY PHILOSOPHY & EXACT TECH STACK

HandFrame relies on a strict, intentionally minimal technology stack with **zero unnecessary dependencies**.

### 11.1 Fixed Dependency List

```text
# Production Runtime Dependencies
Python>=3.11
opencv-python>=4.8.0
mediapipe>=0.10.0
numpy>=1.24.0
PySide6>=6.5.0

# Build / Packaging Dependency
pyinstaller>=6.0.0
```

### 11.2 Explicit Non-Dependencies
- ❌ No `torch`, `torchvision`, `tensorflow`, `ultralytics` (YOLO)
- ❌ No `openai`, `langchain`, or cloud API clients
- ❌ No `flask`, `fastapi`, `django`, `electron`, `tauri`

---

## 12. PYINSTALLER PACKAGING & EXECUTABLE BUILD SPECIFICATION

HandFrame can be bundled into a standalone Windows executable (`HandFrame.exe`) using **PyInstaller**.

### 12.1 PyInstaller Spec File (`handframe.spec`)

```python
# handframe.spec - PyInstaller Build Configuration
import sys
import os
from PyInstaller.utils.hooks import collect_data_files

mediapipe_data = collect_data_files('mediapipe')

a = Analysis(
    ['handframe/main.py'],
    pathex=[],
    binaries=[],
    datas=mediapipe_data + [('config/default_config.json', 'config')],
    hiddenimports=['PySide6', 'cv2', 'mediapipe', 'numpy'],
    hookspath=[],
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'scipy', 'IPython'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='HandFrame',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    icon='assets/app_icon.ico',
)
```

### 12.2 One-Command Windows Executable Build
```powershell
pyinstaller --clean handframe.spec
```

---

## 13. PROJECT DIRECTORY STRUCTURE

```
HandFrame/
├── assets/                          # App icon, sample video media
│   ├── app_icon.ico
│   └── sample_video.mp4
├── config/
│   └── default_config.json          # System settings & thresholds
├── handframe/                       # Main Python Package Source
│   ├── __init__.py                  # Package init
│   ├── main.py                      # PySide6 Application Entrypoint
│   ├── core/                        # Core computer vision modules
│   │   ├── __init__.py
│   │   ├── camera_worker.py         # PySide6 QThread Video Capture Worker
│   │   ├── hand_tracker.py          # MediaPipe Hands wrapper & EMA smoothing
│   │   ├── frame_geometry.py        # Convex polygon sorting & validation
│   │   ├── gesture_engine.py        # Pairwise distance & debounced state machine
│   │   └── compositor.py            # Region crop, filter execution & masking
│   ├── filters/                     # Modular Visual Filter System
│   │   ├── __init__.py              # Default registry builder
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
│   ├── ui/                          # PySide6 Native Desktop UI
│   │   ├── __init__.py
│   │   ├── main_window.py           # PySide6 QMainWindow UI
│   │   ├── video_widget.py          # Custom QLabel/QOpenGL video display widget
│   │   └── status_bar.py            # PySide6 HUD & status bar
│   └── utils/                       # Helper functions
│       ├── __init__.py
│       ├── logger.py                # Logging utility
│       └── config_loader.py         # JSON configuration parser
├── tests/                           # Unit & Integration Tests
│   ├── test_geometry.py
│   ├── test_gesture.py
│   ├── test_filters.py
│   └── test_compositor.py
├── .gitignore
├── HANDFRAME_SPECIFICATION.md       # Approved Project Technical Specification
├── README.md                        # Quickstart documentation
├── handframe.spec                   # PyInstaller Windows Executable Spec
└── requirements.txt                 # Exact fixed dependency requirements
```

---

## 14. PERFORMANCE TARGETS & LATENCY BUDGET (Target: 30-60 FPS)

| Stage | Latency Budget (at 60 FPS = 16.6ms Total) | Optimization Technique |
|---|---|---|
| **Camera Capture** | $2.0 \text{ ms}$ | Decoupled OpenCV thread buffer reading |
| **MediaPipe Tracking** | $7.0 \text{ ms}$ | `static_image_mode=False` temporal tracking |
| **Geometry & Gesture** | $0.5 \text{ ms}$ | NumPy vectorized Euclidean distance matrix |
| **Crop & Mask Generation** | $1.5 \text{ ms}$ | Minimal axis-aligned bounding box crop |
| **Filter Execution** | $3.0 \text{ ms}$ | OpenCV C++ optimized kernel execution |
| **Compositing** | $1.5 \text{ ms}$ | NumPy array slicing vectorization |
| **PySide6 UI Render** | $1.0 \text{ ms}$ | Direct `QImage` to `QPixmap` pixel buffer write |

---

## 15. MVP DEFINITION & ACCEPTANCE CHECKLIST

- [ ] **AC-01**: Application launches PySide6 desktop window offline without cloud connection.
- [ ] **AC-02**: Live video stream displays smoothly at $\ge 30 \text{ FPS}$ (targeting up to 60 FPS).
- [ ] **AC-03**: Dual hand tracking locates Left/Right Thumb (#4) and Index (#8) tips with EMA smoothing.
- [ ] **AC-04**: Quadrilateral is correctly validated and filter is applied **only inside** the cropped region.
- [ ] **AC-05**: Exterior video pixels remain completely unmodified.
- [ ] **AC-06**: Four-point pinch gesture ($d_{\text{norm}} < 0.045$) switches active filter **exactly once**.
- [ ] **AC-07**: Debounced state machine prevents filter cycling until fingers separate ($d_{\text{norm}} > 0.080$).
- [ ] **AC-08**: Adding a new filter requires adding only one class file subclassing `BaseFilter`.
- [ ] **AC-09**: PyInstaller builds a standalone executable `HandFrame.exe` that runs without Python installed.
