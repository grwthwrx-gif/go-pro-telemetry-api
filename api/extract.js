// api/extract.js
import extractTelemetry from "../lib/telemetry.js";

export default async function handler(req, res) {
  const { videoUrl } = req.query;

  if (!videoUrl) {
    return res.status(400).json({ error: "Missing videoUrl parameter" });
  }

  try {
    const telemetry = await extractTelemetry(videoUrl);
    res.status(200).json(telemetry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
