import { extractTelemetry } from "../lib/telemetry.js";

export default async function handler(req, res) {
  try {
    const { videoUrl } = req.query;

    if (!videoUrl) {
      return res.status(400).json({ error: "Missing videoUrl parameter" });
    }

    const telemetry = await extractTelemetry(videoUrl);

    if (!telemetry || telemetry.samples.length === 0) {
      return res.status(404).json({ error: "No telemetry data found" });
    }

    res.status(200).json(telemetry);
  } catch (err) {
    console.error("Error extracting telemetry:", err);
    res.status(500).json({ error: "Failed to extract telemetry" });
  }
}
