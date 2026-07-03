/**
 * faceUtils.ts
 * Shared utilities for face-api.js model loading and face descriptor extraction.
 */

let modelsLoaded = false;

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  // Dynamically import to avoid SSR issues
  const faceapi = await import('face-api.js');
  const MODEL_URL = '/models';
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  modelsLoaded = true;
}

/**
 * Extract a 128-float face descriptor from an HTMLVideoElement or HTMLImageElement.
 * Returns null if no face is detected.
 */
export async function getFaceDescriptor(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<Float32Array | null> {
  const faceapi = await import('face-api.js');
  const detection = await faceapi
    .detectSingleFace(source, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();
  return detection ? detection.descriptor : null;
}

/**
 * Compare two face descriptors. Returns euclidean distance.
 * Typical threshold for a match: distance < 0.5
 */
export async function compareFaceDescriptors(
  a: Float32Array,
  b: Float32Array
): Promise<number> {
  const faceapi = await import('face-api.js');
  return faceapi.euclideanDistance(a, b);
}

/**
 * Load a base64 image string into an HTMLImageElement for descriptor extraction.
 */
export function base64ToImage(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = base64;
  });
}
