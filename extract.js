import fetch from "node-fetch";
import { parseTelemetry } from "../lib/telemetry.js";

export default async function handler(req, res) {
  try {
    const { videoUrl } = req.query;
    if (!videoUrl) {
      return res.status(400).json({ error: "Missing videoUrl query param" });
    }

    // Fetch video
    const response = await fetch(videoUrl);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());

    // Parse telemetry
    const telemetry = await parseTelemetry(buffer);

    // Extract GPS5 samples if present
    const gps = telemetry.streams?.find(s => s.name === "GPS5")?.samples || [];
    const samples = gps.map(s => ({
      lat: s.value[0],
      lon: s.value[1],
      alt: s.value[2],
      speedKmh: s.value[3] * 3.6,
      timeMs: s.cts
    }));

    res.status(200).json({
      samples,
      totalSamples: samples.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

