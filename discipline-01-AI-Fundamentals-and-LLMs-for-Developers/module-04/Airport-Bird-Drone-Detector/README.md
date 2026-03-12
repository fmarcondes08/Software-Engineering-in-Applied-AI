# Airport Bird & Drone Detector

A Next.js web application that runs a **TensorFlow.js MobileNetV2 classifier** over airport surveillance video frames in real time, overlaying:
- A **green circle ⊙** when a bird is detected
- A **red X ✕** when a drone is detected

Built as a postgraduate exercise in Software Engineering in Applied AI — Module 04.
Follows the spirit of `DuckHunt-JS-parte01`, applying real-time ML inference to a pre-recorded airport video.

## Demo

![Demo screenshot placeholder — add after first run]

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript 5 |
| Styling | Tailwind CSS v4 |
| ML inference | TensorFlow.js 4.x (`tf.loadLayersModel`) |
| Model | MobileNetV2 fine-tuned via transfer learning |
| Training | Google Colab + `tensorflowjs_converter` |
| Dataset | [Kaggle Bird vs Drone](https://www.kaggle.com/datasets/stealthknight/bird-vs-drone) |

## Project Structure

```
Airport-Bird-Drone-Detector/
├── app/
│   ├── layout.tsx            # Root layout with metadata
│   ├── page.tsx              # Main page: model hook + VideoDetector
│   └── globals.css           # Tailwind CSS v4 import
├── components/
│   ├── VideoDetector.tsx     # <video> + <canvas> overlay + requestAnimationFrame loop
│   ├── DetectionOverlay.tsx  # Canvas drawing functions: drawBird (⊙) / drawDrone (✕)
│   └── StatsPanel.tsx        # Live confidence bars + FPS + frame counter
├── hooks/
│   └── useTFModel.ts         # Loads TF.js LayersModel with warmup pass and error state
├── lib/
│   └── detector.ts           # preprocessFrame + detectAllClasses inference utilities
├── public/
│   ├── model/                # model.json + weight shards (place here after Colab export)
│   └── video/
│       └── airport_birds_drones_sample.mp4
└── colab/
    └── train_and_export.ipynb
```

## Quick Start

### 1. Train the model (Google Colab)

Open `colab/train_and_export.ipynb` in [Google Colab](https://colab.research.google.com/) with a GPU runtime (T4).

Run all cells to:
- Download the [Bird vs Drone dataset](https://www.kaggle.com/datasets/stealthknight/bird-vs-drone) from Kaggle
- Fine-tune MobileNetV2 with two-phase transfer learning
- Evaluate and plot accuracy curves + confusion matrix
- Export the model to TensorFlow.js LayersModel format

Then download `tfjs_model.zip` and unzip it into `public/model/`:

```
public/model/
├── model.json
└── group1-shard1of1.bin   (filename may vary)
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser, then click **Play**.

## How It Works

1. The `<video>` element plays `airport_birds_drones_sample.mp4`.
2. A `<canvas>` is positioned absolutely on top of the video with `pointer-events-none`.
3. A `requestAnimationFrame` loop in `VideoDetector.tsx` runs on every frame:
   - `detectAllClasses()` in `lib/detector.ts` preprocesses the video frame:
     - Resize to 224×224 using `tf.image.resizeBilinear`
     - Normalize pixel values to [-1, 1] via `.div(127.5).sub(1)` (MobileNetV2 standard)
   - `model.predict()` returns softmax probabilities `[P(bird), P(drone)]`
   - The top prediction drives the canvas drawing:
     - **Bird** → green circle + center dot centered on the frame
     - **Drone** → red X lines centered on the frame
4. `StatsPanel` shows live confidence bars for both classes, inference FPS, and total frame count.

## Model Details

| Property | Value |
|---|---|
| Architecture | MobileNetV2 (pretrained ImageNet, fine-tuned) |
| Training phases | Phase 1: head only (5 epochs) → Phase 2: last 30 layers (10 epochs) |
| Classes | `bird` (index 0), `drone` (index 1) — alphabetical order |
| Input | 224×224 RGB, normalized to [-1, 1] |
| Output | Softmax probabilities `[P(bird), P(drone)]` |
| Export format | TF.js LayersModel (`tf.loadLayersModel`) |

> **Critical:** The class order `{'bird': 0, 'drone': 1}` is set alphabetically by Keras's
> `ImageDataGenerator`. This must match `CLASSES = ['bird', 'drone']` in `lib/detector.ts`.
> Verify with `print(train_generator.class_indices)` in the Colab notebook.

## Known Limitations

- **Frame-level classifier, not object detector:** The model classifies the entire video frame. The detection marker is always drawn at the frame center. A proper solution would use a YOLO-style detector for spatial localization.
- **Mixed scenes:** If both a bird and drone appear in a single frame, the dominant class wins.
- **Inference speed:** Depends on the browser's WebGL backend — typically 5–15 FPS for MobileNetV2. No GPU acceleration in browser means CPU-based WebGL fallback.

## Running the Build

```bash
npm run build   # TypeScript type-check + Next.js production build
npm start       # Production server
```
