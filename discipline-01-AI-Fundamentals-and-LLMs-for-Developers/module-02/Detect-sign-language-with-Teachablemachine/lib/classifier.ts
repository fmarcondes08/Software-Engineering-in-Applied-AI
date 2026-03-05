export interface Prediction {
  label: string;
  confidence: number;
}

export async function classify(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any,
  imageElement: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
): Promise<Prediction[]> {
  const raw = await model.predict(imageElement);
  return (raw as Array<{ className: string; probability: number }>)
    .map((p) => ({ label: p.className, confidence: p.probability }))
    .sort((a, b) => b.confidence - a.confidence);
}
