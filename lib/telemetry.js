import fetch from "node-fetch";
import { parse as mp4boxParse } from "mp4box"; // fallback if needed

// Simple telemetry extractor — currently works with GoPro/GPX-style metadata.
// Later we can extend this for Insta360 and DJI.
export async function extractTelemetry(videoUrl) {
  // 1. Fetch video file
  const response = await fetch(videoUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch video: ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  // 🚨 PLACEHOLDER PARSING — 
  // Normally we'd use gpmf-extract or gopro-telemetry, but since Vercel has issues,
  // we stub this with demo GPS + speed values to prove the flow works.

  // TODO: Replace with actual parsing logic
  const samples = [
    { lat: 51.71765, lon: -3.38487, alt: 443.67, speedKmh: 18, timeMs: 100 },
    { lat: 51.71766, lon: -3.38486, alt: 444.13, speedKmh: 19.2, timeMs: 200 },
    { lat: 51.71767, lon: -3.38485, alt: 445.52, speedKmh: 20.4, timeMs: 300 },
  ];

  return {
    samples,
    totalSamples: samples.length,
  };
}
