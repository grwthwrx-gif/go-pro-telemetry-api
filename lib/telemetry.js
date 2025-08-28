// lib/telemetry.js
import fetch from "node-fetch";
import gpmfExtract from "gpmf-extract";
import gpmfParse from "gpmf-parser";

/**
 * Extracts telemetry (GPS + speed + time) from a GoPro video URL
 */
export default async function extractTelemetry(videoUrl) {
  try {
    // Download video into buffer
    const res = await fetch(videoUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch video: ${res.statusText}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract raw GPMF stream
    const gpmfData = await gpmfExtract(buffer);

    // Parse into structured telemetry
    const parsed = gpmfParse(gpmfData);

    // Collect GPS samples
    const samples = [];
    if (parsed.DEVC) {
      parsed.DEVC.forEach((dev) => {
        if (dev.strm) {
          dev.strm.forEach((stream) => {
            if (stream.GPS5) {
              stream.GPS5.forEach((gps) => {
                samples.push({
                  lat: gps.value[0] / 1e7, // degrees
                  lon: gps.value[1] / 1e7,
                  alt: gps.value[2] / 1000, // meters
                  speedKmh: gps.value[3] * 3.6, // m/s → km/h
                  timeMs: gps.cts, // timestamp
                });
              });
            }
          });
        }
      });
    }

    return {
      samples,
      totalSamples: samples.length,
    };
  } catch (err) {
    console.error("Telemetry extraction error:", err);
    return { error: err.message };
  }
}
