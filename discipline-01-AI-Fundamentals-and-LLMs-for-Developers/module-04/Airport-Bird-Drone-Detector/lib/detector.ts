import type * as tf from '@tensorflow/tfjs';

export type DetectionLabel = 'bird' | 'drone';

export interface Detection {
  label: DetectionLabel;
  confidence: number; // 0.0 – 1.0
  classIndex: number;
}

// IMPORTANT: this order must match the class order used during Colab training.
// ImageDataGenerator sorts class names alphabetically: 0 = bird, 1 = drone.
export const CLASSES: DetectionLabel[] = ['bird', 'drone'];

const INPUT_SIZE = 224; // MobileNetV2 expected input resolution

/**
 * Preprocesses a video frame for MobileNetV2 inference.
 *
 * Steps:
 *  1. tf.browser.fromPixels()  — HTMLVideoElement/canvas → [H, W, 3] int tensor
 *  2. resizeBilinear()         — resize to [224, 224]
 *  3. .div(127.5).sub(1)       — MobileNetV2 expects [-1, 1] normalization
 *  4. .expandDims(0)           — add batch dim → [1, 224, 224, 3]
 *
 * Wrapped in tf.tidy() so intermediate tensors are freed automatically,
 * preventing memory leaks in the RAF inference loop.
 *
 * NOTE: The Colab notebook uses tf.keras.applications.mobilenet_v2.preprocess_input
 * which also maps [0, 255] → [-1, 1]. These must stay in sync.
 */
export function preprocessFrame(
  source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap,
  tfLib: typeof tf
): tf.Tensor4D {
  return tfLib.tidy(() => {
    const pixel = tfLib.browser.fromPixels(source as HTMLCanvasElement);
    const resized = tfLib.image.resizeBilinear(pixel, [INPUT_SIZE, INPUT_SIZE]);
    const normalized = resized.div(127.5).sub(1);
    return normalized.expandDims(0) as tf.Tensor4D;
  });
}

/**
 * Returns ALL class probabilities as an array of Detections,
 * sorted by confidence descending. The top Detection drives the overlay;
 * all detections are shown in the StatsPanel confidence bars.
 */
export async function detectAllClasses(
  model: tf.GraphModel,
  source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap,
  tfLib: typeof tf
): Promise<Detection[]> {
  const input = preprocessFrame(source, tfLib);

  // GraphModel.predict() returns Tensor | Tensor[] | NamedTensorMap.
  // For a single-output model (our MobileNetV2 head) it will be a single Tensor,
  // but we guard the array case for robustness.
  const output = model.predict(input);
  input.dispose();
  const outputTensor = (Array.isArray(output) ? output[0] : output) as tf.Tensor;

  const probabilities = (await outputTensor.data()) as Float32Array;
  outputTensor.dispose();

  return CLASSES.map((label, idx) => ({
    label,
    confidence: probabilities[idx],
    classIndex: idx,
  })).sort((a, b) => b.confidence - a.confidence);
}
