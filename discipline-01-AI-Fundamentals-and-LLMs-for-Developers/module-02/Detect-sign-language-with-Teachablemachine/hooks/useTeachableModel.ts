'use client';

import { useEffect, useState } from 'react';

export interface TeachableModelState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any | null;
  classNames: string[];
  isLoading: boolean;
  error: string | null;
}

export function useTeachableModel(
  modelURL: string,
  metadataURL: string
): TeachableModelState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [model, setModel] = useState<any | null>(null);
  const [classNames, setClassNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        // Dynamic import to avoid SSR issues
        const tmImage = await import('@teachablemachine/image');
        const loadedModel = await tmImage.load(modelURL, metadataURL);

        if (!cancelled) {
          setModel(loadedModel);
          setClassNames(loadedModel.getClassLabels());
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
    return () => { cancelled = true; };
  }, [modelURL, metadataURL]);

  return { model, classNames, isLoading, error };
}
