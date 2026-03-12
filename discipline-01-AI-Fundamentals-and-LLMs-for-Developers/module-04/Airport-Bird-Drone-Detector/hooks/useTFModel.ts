'use client';

import { useEffect, useState } from 'react';
import type * as tf from '@tensorflow/tfjs';

export interface TFModelState {
  model: tf.GraphModel | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Loads a TensorFlow.js GraphModel from the given URL.
 *
 * Design decisions:
 * - Dynamic import of @tensorflow/tfjs inside useEffect guards against SSR
 *   (TF.js accesses window/document on import, which breaks Next.js server render)
 * - tf.ready() initializes the best available backend (WebGL > WASM > CPU)
 * - tf.loadGraphModel() loads a tfjs_graph_model exported from Colab via
 *   tensorflowjs_converter --input_format=tf_saved_model --output_format=tfjs_graph_model
 * - Warmup pass with tf.zeros([1,224,224,3]) prevents the first real inference from
 *   being artificially slow (same pattern as DuckHunt's worker.js)
 * - The `cancelled` flag prevents state updates after unmount
 */
export function useTFModel(modelUrl: string): TFModelState {
  const [model, setModel] = useState<tf.GraphModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        // Dynamic import: avoids SSR breakage — TF.js touches `window` on import
        const tfLib = await import('@tensorflow/tfjs');

        // tf.ready() ensures the best backend (WebGL > WASM > CPU) is initialized
        await tfLib.ready();

        const loadedModel = await tfLib.loadGraphModel(modelUrl);

        // Warmup pass: prevents the first real inference from being slow.
        // GraphModel.predict() can return Tensor | Tensor[] — dispose both cases.
        const warmupInput = tfLib.zeros([1, 224, 224, 3]);
        const warmupResult = loadedModel.predict(warmupInput);
        warmupInput.dispose();
        if (Array.isArray(warmupResult)) {
          warmupResult.forEach((t: tf.Tensor) => t.dispose());
        } else {
          (warmupResult as tf.Tensor).dispose();
        }

        if (!cancelled) {
          setModel(loadedModel);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [modelUrl]);

  return { model, isLoading, error };
}
