# ✋ Detect Sign Language with Teachable Machine

A Next.js web app that classifies **American Sign Language (ASL)** hand signs using a model exported from [Google Teachable Machine](https://teachablemachine.withgoogle.com/).

## Features

| Mode | Description |
|------|-------------|
| 📂 Upload | Drag & drop or select an image from your device |
| 🎲 Random | Randomly picks a sample image from `public/samples/` |
| 📷 Webcam | Live camera feed with one-click capture |

All three modes run the gesture through the Teachable Machine model and display:
- The **top predicted label** (e.g. `A`, `B`, `C`)
- The **confidence percentage**
- A **reference image** of the correct sign (from `public/signs/`)
- A **confidence bar chart** for all classes

## Tech Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4**
- **TensorFlow.js** `1.3.1` (browser build)
- **@teachablemachine/image** `0.8.5`

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Add your Teachable Machine model

Export your model from [teachablemachine.withgoogle.com](https://teachablemachine.withgoogle.com/) as **TensorFlow.js** format and place the three files inside `public/model/`:

```
public/
└── model/
    ├── model.json
    ├── metadata.json
    └── weights.bin
```

### 3. Add reference sign images

Place one reference image per class label inside `public/signs/`, named exactly after the class label the model uses:

```
public/
└── signs/
    ├── A.jpg
    ├── B.jpg
    └── ...
```

> If a reference image is missing, the app falls back to showing the label as large text.

### 4. (Optional) Add sample images for Random mode

Place hand-sign photos inside `public/samples/`. Any `.jpg`, `.jpeg`, `.png`, `.gif`, or `.webp` file is supported. The `/api/samples` route lists them at runtime.

```
public/
└── samples/
    ├── hand_a_01.jpg
    └── hand_b_02.jpg
```

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
├── app/
│   ├── api/samples/route.ts   # Lists files in public/samples/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx               # Main page with tab switcher
├── components/
│   ├── ImageUpload.tsx        # File upload + classify
│   ├── RandomImage.tsx        # Random sample + classify
│   ├── ResultCard.tsx         # Prediction result display
│   └── Webcam.tsx             # Live webcam capture + classify
├── hooks/
│   └── useTeachableModel.ts   # Loads the TM model on mount
├── lib/
│   └── classifier.ts          # Wraps model.predict()
└── public/
    ├── model/                 # ← Place TM model files here
    ├── signs/                 # ← Place reference sign images here
    └── samples/               # ← Place sample images here
```

## Known Limitations & Future Improvements

### 📷 Webcam mode
- **No preprocessing pipeline** — captured frames are passed directly to the model without resizing, cropping to a square, or normalising brightness/contrast. Adding a preprocessing step (e.g. centre-crop to 224×224) would more closely match the training conditions in Teachable Machine and could improve accuracy.
- **No hand-detection overlay** — there is no visual cue showing which region of the frame the model is focusing on. Integrating a lightweight hand-landmark model (e.g. MediaPipe Hands) to crop and highlight the hand area before classification would make the webcam mode significantly more robust.
