# HandFrame 📸✨

> **Browser-Based Real-Time Hand-Tracked Quadrilateral Camera Filter Engine**

HandFrame is a zero-installation, local-first web application that tracks your hand landmarks in real time to form a dynamic 4-point visual frame between your fingertips. Visual filters and effects render dynamically **exclusively inside this bounding quadrilateral frame**, leaving the exterior video feed untouched.

---

## 🌟 Key Features

* **Dynamic 4-Point Hand Framing:** Detects 4 physical hand landmarks in real time:
  * **P1**: Left Index Fingertip
  * **P2**: Right Index Fingertip
  * **P3**: Right Thumb Tip
  * **P4**: Left Thumb Tip
* **100% Client-Side Machine Learning:** Powered by Google MediaPipe Tasks Vision (`HandLandmarker`) running locally in WebAssembly (WASM). No video data leaves your device.
* **Jitter-Free Tracking:** Smooth landmark temporal filtering via a One-Euro Filter algorithm for organic, stable motion.
* **Instant Pinch Gesture Cycling:** Pinch all 4 tracking fingertips together to dynamically cycle through camera filters hands-free.
* **20+ Built-In Artistic Filters:**
  * **Classic/Tonal:** Grayscale, Negative, Film Grain, Threshold, Cutout
  * **Dynamic / Stylized:** Enter Matrix, Rage Shift, Moving Rage Motion, Sketch, Retro Arcade, Glitch Out
  * **Color / Optical:** RGB Split, Spectral Map, Reverse Heatmap, BW Daze, Pixelate, Outline
* **In-Session Custom Filter Lab:** Unlisted filter creation studio (`/custom`) to build custom color-matrix and convolution kernel filters in real time.
* **Keyboard & Touch Accessibility:** Full keyboard navigation support (`Space`/`Right Arrow` for next filter, `Left Arrow` for previous, `S` for snapshots, `F` for fullscreen, `D` for performance debug overlay).

---

## 📐 Hand Landmark Framing Mechanism

```text
Original Camera Feed (Background)
  ┌────────────────────────────────────────────────────────┐
  │                                                        │
  │              P1 (Left Index)      P2 (Right Index)     │
  │                 o──────────────────o                   │
  │                /    HandFrame     /                    │
  │               /   FILTER APPLIED /                     │
  │              o──────────────────o                      │
  │              P4 (Left Thumb)      P3 (Right Thumb)     │
  │                                                        │
  └────────────────────────────────────────────────────────┘
```

The application creates an affine-transformed clipping polygon across $(P1, P2, P3, P4)$, applies real-time pixel transformations via HTML5 2D Canvas context, and composites the filtered imagery back onto the background feed.

---

## 🚀 Tech Stack

* **Frontend Framework:** React 18 + TypeScript 5
* **Bundler & Dev Server:** Vite 6
* **Styling:** Tailwind CSS with responsive viewport & safe-area handling
* **Hand Tracking & ML:** `@mediapipe/tasks-vision` (MediaPipe HandLandmarker WebAssembly)
* **Compositing Engine:** HTML5 Canvas 2D (`CanvasRenderingContext2D` with hardware acceleration)
* **Icons:** Lucide React

---

## 🛠️ Quickstart & Local Development

### Prerequisites
* Node.js 18+ or later
* Modern Web Browser with WebRTC & WebAssembly support (Chrome, Safari, Firefox, Edge)
* Camera / Webcam connected

### Installation

```bash
# Clone the repository
git clone https://github.com/Swapnil14-art/HandFrame.git
cd HandFrame

# Install dependencies
npm install

# Start the Vite local development server
npm run dev
```

Open your browser at `http://localhost:5173` to launch HandFrame.

### Production Build

```bash
# Typecheck and build optimized static assets
npm run build

# Preview production build locally
npm run preview
```

---

## ⌨️ Controls & Shortcuts

| Action | Shortcut / Control |
|---|---|
| **Next Filter** | `Space` / `→` (Right Arrow) / Click Bottom Filter Pill |
| **Previous Filter** | `←` (Left Arrow) |
| **Take Snapshot** | `S` / Camera Button |
| **Toggle Debug Overlay** | `D` / Bug Button |
| **Toggle Fullscreen** | `F` / Expand Button |
| **Hands-Free Cycle** | Pinch all 4 fingertips together |
| **Custom Filter Studio** | Navigate to `/custom` route |

---

## 🔒 Privacy & Security

HandFrame operates under a strict **Zero-Server, Local-First** guarantee:
* All video frames from your webcam are processed directly in your browser's memory.
* Hand tracking inferences run locally in WebAssembly.
* No video feeds, images, or biometric landmark data are ever transmitted or stored on any remote server.

---

## 📄 License

This project is licensed under the MIT License.
