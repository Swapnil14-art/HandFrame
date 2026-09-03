# HandFrame — Complete Project & Filter System Specification

**Document Version:** 2.0.0 (First-Class Filter Engine & Dual-Workflow Architecture)  
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
1. **Startup Entry**: The application launches into a clean entry view offering two choices: **[ START CAMERA ]** to enter the framing experience, or **[ MANAGE FILTERS ]** to configure active filters and rotation order.
2. **Framing**: The user brings both hands into the camera field of view, creating a natural framing box with their thumbs and index fingers.
3. **Dynamic Masking**: The system tracks the 4 fingertips in real-time, calculates the quadrilateral region, extracts/crops the selected video region, passes it through the currently active filter module, and composites it back into the live output frame.
4. **Touch-to-Switch Gesture**: Bringing all four tracked fingertips together into a tight cluster (a "pinch-all" gesture) emits an event that advances to the next enabled filter in the user's configured order, entering a lockout state until fingers separate.

### 1.4 Main Use Cases
- **Creative Media & Interactive Video**: Real-time performance art, dynamic video streaming, visual framing effects.
- **Interactive Displays & Kiosks**: Touchless interaction in exhibitions or public demo stations.
- **Educational CV Demonstration**: A modular architecture demonstrating landmark tracking, perspective transforms, image compositing, and decoupled filter engine design.

### 1.5 Explicit Non-Goals & Architectural Constraints
To ensure high performance, low latency, offline operation, and reliability, HandFrame strictly enforces:

```
[ STRICT CONSTRAINTS CHECKLIST ]
❌ NO Generative AI / LLMs / OpenAI API
❌ NO TensorFlow / PyTorch / YOLO
❌ NO Face/Identity/AR Filters (dog ears, makeup, face morphing)
❌ NO Cloud Services or Network Dependencies
❌ NO Web Application Frameworks / Electron
❌ NO Unnecessary Third-Party Libraries
```

- **100% Offline-First**: Zero internet connectivity required during execution.
- **Local Processing**: MediaPipe is used strictly for local hand landmark detection. All visual processing—region detection, masking, filters, compositing, and video processing—is performed locally using OpenCV and NumPy.
- **Fixed Small Tech Stack**: **Python 3.11+ + OpenCV + MediaPipe + NumPy + PySide6 + PyInstaller**.

---

## 2. FILTERS AS FIRST-CLASS INDEPENDENT MODULES

### 2.1 First-Class Architectural Mandate
Filters in HandFrame are **first-class, completely independent modules**. The core application must **NEVER** contain filter-specific hardcoded branching or `if-elif` logic:

```python
# ❌ FORBIDDEN IN HANDFRAME CORE:
if active_filter == "grayscale":
    frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
elif active_filter == "sepia":
    frame = apply_sepia(frame)
```

Instead, the core system strictly operates via the polymorphic interface:
```python
# ✅ MANDATORY HANDFRAME CORE DESIGN:
filtered_region = active_filter.apply(image_region)
```

### 2.2 System Decoupling Matrix
The filter engine must be completely decoupled from all other subsystems:

| Subsystem | Decoupling Guarantee |
|---|---|
| **Camera Handling** | Filters never read from or control video capture devices. |
| **Hand Tracking** | Filters receive image arrays; they do not know where hands or landmarks are. |
| **Gesture Detection** | Gesture engines emit generic events (`FILTER_CHANGE_REQUESTED`); they do not reference filter names. |
| **UI System** | UI elements query the filter registry for display metadata without executing filter internals. |
| **Compositing** | Compositors place processed regions back into frames; filters only process cropped sub-regions. |
| **Application Startup** | Startup code loads filter manifests dynamically via configuration without hardcoded imports. |

### 2.3 Filter Scope & Processing Contract
A HandFrame filter operates **strictly on the extracted sub-image region** inside the bounding quadrilateral:

```text
Original Camera Frame
        │
        ├── Outside HandFrame  -> Unchanged
        │
        └── Inside HandFrame Region
                 ↓
          Cropped Bounding Region (np.ndarray: BGR uint8)
                 ↓
             active_filter.apply(region)
                 ↓
          Processed Region (np.ndarray: BGR uint8)
                 ↓
          Compositor (Alpha-Mask Blend into Frame)
```

### 2.4 Strict Scope Exclusion: What is NOT a HandFrame Filter
HandFrame filters are **full-frame visual and image-processing effects**. They change the visual appearance, color grading, tone, texture, or optics of the region—NOT the identity or facial geometry of a person.

The following are **EXPLICITLY OUT OF SCOPE**:
- ❌ Face morphing, slimming, or eye enlargement
- ❌ Dog ears, cat whiskers, or facial accessory overlays
- ❌ Makeup, beard generation, or hair replacement
- ❌ AR character models, 3D object tracking, or person transformations

---

## 3. UNIVERSAL FILTER SYSTEM ARCHITECTURE

### 3.1 Common Universal Interface (`BaseFilter`)
Every filter class must inherit from `BaseFilter` and implement `apply()`:

```python
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import numpy as np

class BaseFilter(ABC):
    """
    Universal Abstract Base Class for all HandFrame visual filters.
    """
    def __init__(
        self,
        filter_id: str,
        name: str,
        description: str = "",
        category: str = "General",
        version: str = "1.0.0",
        parameters: Optional[Dict[str, Any]] = None
    ):
        self.filter_id = filter_id
        self.name = name
        self.description = description
        self.category = category
        self.version = version
        self.parameters = parameters or {}

    @abstractmethod
    def apply(self, image: np.ndarray) -> np.ndarray:
        """
        Processes an input sub-image region and returns the filtered output region.
        
        :param image: BGR uint8 numpy array of shape (H, W, 3)
        :return: Processed BGR uint8 numpy array of exact shape (H, W, 3)
        """
        pass

    def update_parameter(self, key: str, value: Any) -> None:
        """Optional parameter tuning hook for dynamic adjustments."""
        if key in self.parameters:
            self.parameters[key] = value
```

### 3.2 Filter Registry Manager (`FilterRegistry`)
The central registry maintains installed filters, loads active filters from configuration, and handles rotation ordering:

```python
import logging
from typing import List, Dict, Optional
import numpy as np
from handframe.filters.base_filter import BaseFilter

logger = logging.getLogger(__name__)

class FilterRegistry:
    """Manages available, enabled, and active visual filters."""
    def __init__(self):
        self._installed_filters: Dict[str, BaseFilter] = {}
        self._enabled_ids: List[str] = []
        self._active_index: int = 0

    def register(self, filter_instance: BaseFilter) -> None:
        """Registers an installed filter instance."""
        self._installed_filters[filter_instance.filter_id] = filter_instance

    def set_enabled_filters(self, enabled_ids: List[str]) -> None:
        """Sets active filter rotation list in deterministic order."""
        valid_ids = [fid for fid in enabled_ids if fid in self._installed_filters]
        if not valid_ids:
            logger.warning("No valid enabled filter IDs found! Falling back to 'original'.")
            valid_ids = ["original"] if "original" in self._installed_filters else list(self._installed_filters.keys())
        
        self._enabled_ids = valid_ids
        self._active_index = 0

    def get_active_filter(self) -> BaseFilter:
        """Returns currently selected active filter."""
        if not self._enabled_ids:
            raise RuntimeError("Filter registry contains no enabled filters!")
        active_id = self._enabled_ids[self._active_index]
        return self._installed_filters[active_id]

    def next_filter(self) -> BaseFilter:
        """Advances to next enabled filter in deterministic rotation."""
        if self._enabled_ids:
            self._active_index = (self._active_index + 1) % len(self._enabled_ids)
        return self.get_active_filter()

    def previous_filter(self) -> BaseFilter:
        """Rewinds to previous enabled filter in deterministic rotation."""
        if self._enabled_ids:
            self._active_index = (self._active_index - 1) % len(self._enabled_ids)
        return self.get_active_filter()

    def get_all_installed(self) -> List[BaseFilter]:
        """Returns all registered filter instances."""
        return list(self._installed_filters.values())

    def get_enabled_ids(self) -> List[str]:
        """Returns list of currently enabled filter IDs."""
        return list(self._enabled_ids)
```

### 3.3 Active Filter Configuration (`config/enabled_filters.json`)
The active filter list and rotation order are configured in a human-readable JSON file, completely independent of core code:

```json
{
  "version": "1.0.0",
  "enabled_filters": [
    "original",
    "moody",
    "warm_film",
    "vintage_film",
    "vhs",
    "dreamy_blur",
    "y2k_digicam",
    "pixelate",
    "cinematic",
    "cool"
  ]
}
```

### 3.4 Filter Crash Isolation & Error Handling
If an individual filter throws an unhandled runtime exception during processing, the core system catches it, logs the failure, falls back safely to `OriginalFilter`, and keeps the camera stream running smoothly:

```python
def safe_apply_filter(active_filter: BaseFilter, region_img: np.ndarray, fallback_filter: BaseFilter) -> np.ndarray:
    try:
        output = active_filter.apply(region_img)
        if output is None or output.shape != region_img.shape or output.dtype != np.uint8:
            raise ValueError(f"Invalid output format from filter '{active_filter.filter_id}'")
        return output
    except Exception as e:
        logger.error(f"Filter '{active_filter.filter_id}' failed during processing: {e}. Falling back to Original.")
        return fallback_filter.apply(region_img)
```

---

## 4. FILTER ADDITION & REMOVAL WORKFLOWS

### 4.1 Step-by-Step Filter Addition Workflow
Adding a brand-new filter requires **zero changes** to core processing, hand tracking, UI, or camera code.

#### Step 1: Create Filter Module File
Create `handframe/filters/custom_warmth_filter.py`:

```python
import cv2
import numpy as np
from handframe.filters.base_filter import BaseFilter

class CustomWarmthFilter(BaseFilter):
    def __init__(self):
        super().__init__(
            filter_id="custom_warmth",
            name="Custom Warmth",
            description="Adds a rich golden hour temperature cast.",
            category="Color"
        )

    def apply(self, image: np.ndarray) -> np.ndarray:
        # Increase Red channel slightly, decrease Blue channel
        b, g, r = cv2.split(image)
        r = cv2.add(r, 20)
        b = cv2.subtract(b, 15)
        return cv2.merge([b, g, r])
```

#### Step 2: Register Filter Instance
Add registration line to `handframe/filters/__init__.py`:

```python
from handframe.filters.custom_warmth_filter import CustomWarmthFilter

def build_default_registry() -> FilterRegistry:
    registry = FilterRegistry()
    # ... register existing filters ...
    registry.register(CustomWarmthFilter())
    return registry
```

#### Step 3: Enable in Configuration
Add `"custom_warmth"` to `config/enabled_filters.json`:

```json
{
  "enabled_filters": [
    "original",
    "custom_warmth",
    "moody",
    "vhs"
  ]
}
```

#### Step 4: Run Application
Launch HandFrame. The new filter immediately participates in the gesture rotation loop.

---

### 4.2 Step-by-Step Filter Removal Workflow
1. **Temporary Deactivation**: Simply edit `config/enabled_filters.json` and remove the filter ID string. The filter implementation remains in the codebase for future use.
2. **Permanent Removal**: Delete the module file from `handframe/filters/` and remove its registration line from `handframe/filters/__init__.py`.
3. **Graceful Degradation**: If an enabled filter ID in `enabled_filters.json` does not exist in the registry, HandFrame logs a warning and skips it without crashing.

---

### 4.3 Developer Test of Modular Isolation
The architecture satisfies this mandatory verification test:
> A developer can write a new `BaseFilter` subclass in `handframe/filters/my_effect.py`, register it, add its ID to `enabled_filters.json`, and cycle to it using hand gestures without touching `main.py`, `hand_tracker.py`, `gesture_engine.py`, `compositor.py`, or `camera_worker.py`.

---

## 5. PRE-INSTALLED REQUIRED FILTER LIBRARY (15 FILTERS)

HandFrame ships with 15 carefully engineered, high-quality, aesthetic image-processing filters implemented using OpenCV and NumPy vectorization.

| # | Filter ID | Name | Category | Aesthetic Description & OpenCV / NumPy Implementation |
|---|---|---|---|---|
| **1** | `original` | **Original** | Basic | Unmodified camera feed. Serves as baseline preview. |
| **2** | `moody` | **Moody** | Cinematic | Deeper shadows, controlled highlights, reduced saturation (-20%), elevated contrast using S-curve lookup tables (`cv2.LUT`). |
| **3** | `warm` | **Warm** | Color | Warm golden temperature. Boosts Red channel (+15), slightly dims Blue (-10), subtle saturation boost. |
| **4** | `cool` | **Cool** | Color | Cyan/blue tone. Boosts Blue/Green channels, slightly reduces Red, controlled contrast for crisp look. |
| **5** | `vintage_film` | **Vintage Film** | Film | Faded/lifted blacks (black point shifted to 25), muted saturation, warm tone, subtle film grain matrix, slight vignetting. |
| **6** | `film_grain` | **Film Grain** | Film | Analog film grain texture overlay using Gaussian noise matrix scaled and blended onto original image without shifting color hues. |
| **7** | `dreamy_blur` | **Dreamy Blur** | Dreamy | Soft diffusion glow. Blends Gaussian blurred highlight layer with original image (`cv2.addWeighted`), retaining sharp structural edges. |
| **8** | `cinematic` | **Cinematic** | Cinematic | Teal & Orange color grading. Shifts shadows toward teal and highlights toward warm amber using color mapping matrices (`cv2.transform`). |
| **9** | `y2k_digicam` | **Y2K / Digicam** | Retro | Nostalgic early 2000s digital compact camera look. Slightly blown-out highlights, mild digital noise, elevated contrast, punchy primary colors. |
| **10** | `vhs` | **VHS** | Retro | Analog tape look. Horizontal scanlines overlay, mild chromatic RGB channel offset (`np.roll`), analog tape noise, washed retro tones. |
| **11** | `pixelate` | **Pixelated** | Creative | Retro 8-bit mosaic effect. Downscales region by factor of 8 (`INTER_LINEAR`) then upscales via `INTER_NEAREST`. |
| **12** | `negative` | **Negative** | Basic | Classic color inversion using vectorized bitwise inversion (`cv2.bitwise_not`). |
| **13** | `grayscale` | **Grayscale** | Basic | Clean monochrome conversion (`cv2.cvtColor` to `COLOR_BGR2GRAY` mapped back to 3-channel BGR). |
| **14** | `sepia` | **Sepia** | Film | Rich vintage brown monochrome produced via 3x3 color matrix transformation (`cv2.transform`). |
| **15** | `retro_flash` | **Retro Flash** | Retro | High-contrast compact camera flash aesthetic. Brightened center exposure, hard contrast, slightly washed shadows, subtle vignette. |

---

## 6. APPLICATION STARTUP & WORKFLOW SEPARATION

### 6.1 Two Distinct User Experiences
HandFrame enforces a strict separation between configuration and framing:

1. **Filter Management Experience**: Used to inspect available filters, toggle active filters, reorder rotation sequences, and preview visual effects on sample images.
2. **HandFrame Camera Experience**: The live, distraction-free viewfinder where users framing with hands and switch filters seamlessly via gestures.

### 6.2 Application Entrypoint Workflow

```text
                  +-------------------------------+
                  |  Launch HandFrame Application |
                  +---------------+---------------+
                                  |
                                  v
                  +---------------+---------------+
                  |  PySide6 Startup View Window  |
                  |                               |
                  |  [ START CAMERA ]             |
                  |  [ MANAGE FILTERS ]           |
                  +-------+---------------+-------+
                          |               |
         Select Start     |               | Select Manage
                          v               v
            +-------------+---+       +---+-------------+
            | HandFrame Live  |       | Filter Manager  |
            | Camera View     |       | PySide6 Screen  |
            +-----------------+       +-----------------+
```

### 6.3 Filter Management Screen Specification
The PySide6 Filter Manager screen provides an aesthetic, simple interface for customizing active filters:

```
+-----------------------------------------------------------------------+
|  HandFrame — Filter Manager                                     [X]   |
+-----------------------------------------------------------------------+
| AVAILABLE FILTERS                          ROTATION ORDER & PREVIEW   |
|                                                                       |
|  [x] Original                              1. Original                |
|  [x] Moody                                 2. Moody          [ ▲ ]    |
|  [x] Warm Film                             3. Vintage Film   [ ▼ ]    |
|  [x] Vintage Film                          4. VHS                     |
|  [x] VHS                                                              |
|  [ ] Pixelated                             +-----------------------+  |
|  [ ] Negative                              |  FILTER PREVIEW       |  |
|  [ ] Thermal                               |  [Sample Image / Live]|  |
|                                            +-----------------------+  |
|-----------------------------------------------------------------------|
|  [ Save Configuration ]                        [ START CAMERA ]       |
+-----------------------------------------------------------------------+
```

Features:
- Checkboxes to enable/disable filters from the active gesture cycle.
- **Move Up / Move Down** buttons to reorder the rotation sequence.
- Live or static sample image preview demonstrating selected filter effects.
- **Save Configuration** updates `config/enabled_filters.json` immediately.

### 6.4 Event-Driven Gesture Switch Architecture
Gesture detection operates completely decoupled from filter rotation logic:

```
+------------------+         Normalized Dist < 0.045         +------------------------+
|  GestureEngine   | --------------------------------------> |  QSignal / Event       |
|  State Machine   |   (Emits FILTER_CHANGE_REQUESTED)       |  filter_change_trigger |
+------------------+                                         +-----------+------------+
                                                                         |
                                                                         v
+------------------+         Advances Active Index           +-----------+------------+
|  FilterRegistry  | <-------------------------------------- |  FilterController      |
|  (Enabled List)  |           `next_filter()`               |  (State Manager)       |
+------------------+                                         +------------------------+
```

---

## 7. HAND TRACKING & GEOMETRY SPECIFICATION

### 7.1 MediaPipe Landmark Isolation
HandFrame extracts 4 specific landmarks from dual hands:
- **Left Hand Thumb Tip**: Landmark ID `4` ($P_{LT}$)
- **Left Hand Index Tip**: Landmark ID `8` ($P_{LI}$)
- **Right Hand Index Tip**: Landmark ID `8` ($P_{RI}$)
- **Right Hand Thumb Tip**: Landmark ID `4` ($P_{RT}$)

### 7.2 Landmark Coordinate Smoothing (EMA)
Raw coordinates are smoothed frame-by-frame to eliminate jitter:
$$\hat{P}_t = \alpha \cdot P_{\text{raw}, t} + (1 - \alpha) \cdot \hat{P}_{t-1} \quad (\alpha = 0.35)$$

### 7.3 Polygon Ordering & Validation
Points are sorted in cyclic polar order around centroid $(\bar{X}, \bar{Y})$.
Valid quads must satisfy:
1. **Convexity**: Cross products of adjacent edges maintain uniform sign.
2. **Minimum Area**: Surface area via Shoelace formula $\ge 1200\text{ px}^2$.

---

## 8. REGION-ONLY OPTIMIZED COMPOSITING PIPELINE

To guarantee **30–60 FPS**, visual filters process **only the cropped sub-image bounding box**:

```python
def process_region_and_composite(
    raw_frame: np.ndarray,
    quad_pts: np.ndarray,
    active_filter: BaseFilter,
    feather_radius: int = 5
) -> np.ndarray:
    H, W, _ = raw_frame.shape
    output_frame = raw_frame.copy()
    
    # 1. Axis-aligned bounding box around the quadrilateral
    x_min = max(0, int(np.min(quad_pts[:, 0])))
    x_max = min(W, int(np.max(quad_pts[:, 0])))
    y_min = max(0, int(np.min(quad_pts[:, 1])))
    y_max = min(H, int(np.max(quad_pts[:, 1])))
    
    if (x_max - x_min) < 10 or (y_max - y_min) < 10:
        return output_frame
        
    # 2. Crop sub-region
    cropped_raw = raw_frame[y_min:y_max, x_min:x_max]
    
    # 3. Apply visual filter strictly to cropped sub-region with crash isolation
    try:
        filtered_cropped = active_filter.apply(cropped_raw)
    except Exception:
        filtered_cropped = cropped_raw
    
    # 4. Generate local polygon mask
    local_pts = quad_pts.copy()
    local_pts[:, 0] -= x_min
    local_pts[:, 1] -= y_min
    
    mask_local = np.zeros((y_max - y_min, x_max - x_min), dtype=np.uint8)
    cv2.fillConvexPoly(mask_local, local_pts.astype(np.int32), 255)
    
    if feather_radius > 0:
        ksize = feather_radius * 2 + 1
        mask_local = cv2.GaussianBlur(mask_local, (ksize, ksize), 0)
        
    alpha = (mask_local.astype(np.float32) / 255.0)[:, :, np.newaxis]
    
    # 5. Vectorized alpha compositing back into canvas
    composited_sub = (filtered_cropped.astype(np.float32) * alpha + 
                      cropped_raw.astype(np.float32) * (1.0 - alpha)).astype(np.uint8)
                      
    output_frame[y_min:y_max, x_min:x_max] = composited_sub
    return output_frame
```

---

## 9. PYSIDE6 THREADING & DEPENDENCIES

### 9.1 PySide6 GUI Thread Separation
- **Main GUI Thread**: PySide6 `QMainWindow`, startup view, Filter Manager dialog, HUD overlays.
- **Worker Thread (`CameraWorkerThread` subclassing `QThread`)**: OpenCV camera capture loop, MediaPipe tracking, gesture evaluation, and region-only compositing. Emits `frame_processed(QImage, dict)` to main thread.

### 9.2 Exact Runtime Dependencies (`requirements.txt`)
```text
Python>=3.11
opencv-python>=4.8.0
mediapipe>=0.10.0
numpy>=1.24.0
PySide6>=6.5.0
pyinstaller>=6.0.0
```

---

## 10. PROJECT DIRECTORY STRUCTURE

```
HandFrame/
├── config/
│   ├── default_config.json          # System settings & gesture thresholds
│   └── enabled_filters.json         # Configurable active filter list & order
├── handframe/
│   ├── __init__.py
│   ├── main.py                      # Application launcher & PySide6 entrypoint
│   ├── core/                        # Core CV pipeline
│   │   ├── __init__.py
│   │   ├── camera_worker.py         # QThread video capture worker
│   │   ├── hand_tracker.py          # MediaPipe hands & EMA smoother
│   │   ├── frame_geometry.py        # Convex quad validation
│   │   ├── gesture_engine.py        # Proximity state machine & event emitter
│   │   └── compositor.py            # Region crop & alpha blending
│   ├── filters/                     # Modular Visual Filter System
│   │   ├── __init__.py              # Central registry builder & auto-loader
│   │   ├── base_filter.py           # Abstract Base Class BaseFilter
│   │   ├── filter_registry.py       # Registry & dynamic manager
│   │   ├── original_filter.py       # 1. Original (Baseline)
│   │   ├── moody_filter.py          # 2. Moody Cinematic
│   │   ├── warm_filter.py           # 3. Warm Tone
│   │   ├── cool_filter.py           # 4. Cool Tone
│   │   ├── vintage_film_filter.py   # 5. Vintage Film
│   │   ├── film_grain_filter.py     # 6. Film Grain
│   │   ├── dreamy_blur_filter.py    # 7. Dreamy Blur
│   │   ├── cinematic_filter.py      # 8. Cinematic Teal/Orange
│   │   ├── y2k_digicam_filter.py    # 9. Y2K / Digicam
│   │   ├── vhs_filter.py            # 10. VHS Retro Tape
│   │   ├── pixelate_filter.py       # 11. Pixelated 8-Bit
│   │   ├── negative_filter.py       # 12. Negative Invert
│   │   ├── grayscale_filter.py      # 13. Grayscale
│   │   ├── sepia_filter.py          # 14. Sepia
│   │   └── retro_flash_filter.py    # 15. Retro Flash
│   ├── ui/                          # PySide6 Desktop GUI
│   │   ├── __init__.py
│   │   ├── startup_view.py          # Startup screen [Start Camera / Manage Filters]
│   │   ├── filter_manager.py        # Filter Management GUI dialog
│   │   ├── camera_view.py           # Live camera feed window & HUD
│   │   └── status_bar.py            # HUD status bar
│   └── utils/
│       ├── __init__.py
│       ├── logger.py
│       └── config_loader.py
├── tests/
│   ├── test_filters.py              # Filter compliance unit tests
│   ├── test_geometry.py
│   └── test_gesture.py
├── HANDFRAME_SPECIFICATION.md       # Approved Technical Specification
├── README.md                        # Quickstart documentation
├── handframe.spec                   # PyInstaller Windows Executable Spec
└── requirements.txt                 # Dependency manifest
```

---

## 11. ACCEPTANCE CRITERIA CHECKLIST

- [x] **AC-01**: Filters are first-class, independent modules inheriting from `BaseFilter`.
- [x] **AC-02**: Core code contains zero `if filter == "grayscale":` hardcoded branching.
- [x] **AC-03**: Filters operate strictly on cropped sub-regions (`image_region -> processed_region`).
- [x] **AC-04**: Explicit exclusion of face AR, dog ears, makeup, or identity morphing effects.
- [x] **AC-05**: Active filter list and rotation order are configured via `config/enabled_filters.json`.
- [x] **AC-06**: Startup view provides clear choices: **[ START CAMERA ]** and **[ MANAGE FILTERS ]**.
- [x] **AC-07**: PySide6 Filter Manager allows toggling, reordering, saving, and previewing filters.
- [x] **AC-08**: 15 pre-installed aesthetic filters implemented using OpenCV and NumPy vectorization.
- [x] **AC-09**: Gesture detector emits decoupled events; gesture engine does not import filter classes.
- [x] **AC-10**: Filter runtime errors are caught safely and fall back to `OriginalFilter` without crashing.
- [x] **AC-11**: Developers can add new filters in 3 simple steps without modifying core engine code.
