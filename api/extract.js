import fetch from "node-fetch";

export default async function handler(req, res) {
  const { videoUrl } = req.query;

  if (!videoUrl) {
    return res.status(400).json({ error: "Missing videoUrl parameter" });
  }

  try {
    // Fetch the video (later we’ll parse telemetry here)
    const response = await fetch(videoUrl, { method: "HEAD" });
    if (!response.ok) {
      throw new Error(`Video not accessible: ${response.statusText}`);
    }

    // ---- MOCKED TELEMETRY DATA ----
    const telemetry = {
      samples: [
        { lat: 51.71765, lon: -3.38487, alt: 443.67, speedKmh: 18.0, timeMs: 100 },
        { lat: 51.71766, lon: -3.38486, alt: 444.13, speedKmh: 19.2, timeMs: 200 },
        { lat: 51.71767, lon: -3.38485, alt: 445.52, speedKmh: 20.4, timeMs: 300 }
      ],
      totalSamples: 3
    };

    res.status(200).json(telemetry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
