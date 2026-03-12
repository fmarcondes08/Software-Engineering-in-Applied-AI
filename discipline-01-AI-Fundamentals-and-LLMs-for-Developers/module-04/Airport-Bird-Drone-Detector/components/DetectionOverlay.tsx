import type { Detection } from '@/lib/detector';

/**
 * Pure canvas drawing utilities for the detection overlay.
 *
 * This module exports imperative drawing functions used by VideoDetector's
 * requestAnimationFrame loop. The default export is a no-op component
 * (VideoDetector owns and renders the actual <canvas> element).
 */

export function drawBird(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  confidence: number
): void {
  const radius = 40;

  // Outer glow ring
  ctx.save();
  ctx.shadowColor = '#22c55e';
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = '#22c55e'; // green-500
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  // Center dot
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#22c55e';
  ctx.fill();

  // Confidence label
  ctx.font = 'bold 15px monospace';
  ctx.fillStyle = '#22c55e';
  ctx.textAlign = 'center';
  ctx.fillText(`bird  ${(confidence * 100).toFixed(0)}%`, x, y + radius + 22);
}

export function drawDrone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  confidence: number
): void {
  const size = 36;

  // X arms with glow
  ctx.save();
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 24;
  ctx.strokeStyle = '#ef4444'; // red-500
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(x - size, y - size);
  ctx.lineTo(x + size, y + size);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + size, y - size);
  ctx.lineTo(x - size, y + size);
  ctx.stroke();

  ctx.restore();

  // Confidence label
  ctx.font = 'bold 15px monospace';
  ctx.fillStyle = '#ef4444';
  ctx.textAlign = 'center';
  ctx.fillText(`drone  ${(confidence * 100).toFixed(0)}%`, x, y + size + 26);
}

export function clearOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  ctx.clearRect(0, 0, width, height);
}

/**
 * Main draw dispatcher: clears the canvas, then draws the appropriate marker
 * for the top detection at the center of the frame.
 */
export function drawDetection(
  ctx: CanvasRenderingContext2D,
  detection: Detection,
  canvasWidth: number,
  canvasHeight: number
): void {
  clearOverlay(ctx, canvasWidth, canvasHeight);

  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;

  if (detection.label === 'bird') {
    drawBird(ctx, cx, cy, detection.confidence);
  } else {
    drawDrone(ctx, cx, cy, detection.confidence);
  }
}

// Default export is a no-op — VideoDetector owns the <canvas> element
export default function DetectionOverlay() {
  return null;
}
