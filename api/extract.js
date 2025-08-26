import fetch from "node-fetch";
import GoProTelemetry from "gopro-telemetry";
import { parseStringPromise } from "xml2js";

/**
 * Normalize telemetry samples to:
 * { lat, lon, alt, speedKmh, timeMs, isoTime? }
 */
function normalizeFromGoPro(gptJson) {
  // gopro-telemetry returns a tree keyed by camera ID e.g. "1"
  // with "streams" like GPS5, GPS9, etc.
  const roots = Object.values(gptJson || {});
  const out = [];

  for (const root of roots) {
    const streams = root?.streams || {};
    const streamObjs = typeof streams === "object" ? Object.values(streams) : [];

    for (const s of streamObjs) {
      const name = s?.name || s?.stream || s?.type || "";
      if (!/^GPS/i.test(name)) continue; // pick GPS5/GPS9/etc.

      const samples = s.samples || [];
      for (const smp of samples) {
        const v = smp.value || [];
        // Heuristic for GoPro GPS streams:
        // Most GPS* streams start [lat, lon, alt, speed(m/s)? ...]
        const lat = Number(v[0]);
        const lon = Number(v[1]);
        const alt = Number(v[2]);
        const maybeSpeed = Number(v[3]);
        const speedKmh = Number.isFinite(maybeSpeed) ? maybeSpeed * 3.6 : undefined;
        const timeMs = Number(smp.cts ?? smp.time ?? 0);
        const isoTime = smp.date;

        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          out.push({
            lat, lon,
            alt: Number.isFinite(alt) ? alt : undefined,
            speedKmh: Number.isFinite(speedKmh) ? speedKmh : undefined,
            timeMs: Number.isFinite(timeMs) ? timeMs : undefined,
            isoTime
          });
        }
      }
    }
  }

  // Sort by time if available
  out.sort((a, b) => (a.timeMs ?? 0) - (b.timeMs ?? 0));
  return out;
}

/** GPX parser → normalized samples */
async function parseGpx(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`GPX fetch failed: ${resp.status} ${resp.statusText}`);
  const xml = await resp.text();
  const gpx = await parseStringPromise(xml);

  const trksegs = gpx?.gpx?.trk?.flatMap(t => t.trkseg) || [];
  const pts = [];
  for (const seg of trksegs) {
    const trkpts = seg.trkpt || [];
    for (const p of trkpts) {
      const lat = Number(p.$?.lat);
      const lon = Number(p.$?.lon);
      const ele = p.ele ? Number(p.ele[0]) : undefined;
      const timeIso = p.time ? p.time[0] : undefined;
      // speed is not always in GPX, so we’ll compute later client-side if needed
      pts.push({
        lat, lon, alt: ele,
        isoTime: timeIso,
        timeMs: timeIso ? Date.parse(timeIso) : undefined
      });
    }
  }
  // If only time-based, ensure increasing order
  pts.sort((a, b) => (a.timeMs ?? 0) - (b.timeMs ?? 0));
  return pts;
}

export default async function handler(req, res) {
  try {
    const { videoUrl, gpxUrl } = req.query;
    if (!videoUrl && !gpxUrl) {
      return res.status(400).json({
        error: "Provide at least one of: videoUrl (GoPro MP4) or gpxUrl (sidecar)."
      });
    }

    // 1) Try GoPro embedded telemetry (GPMF in MP4)
    let samples = [];
    if (videoUrl) {
      // HEAD first (fast fail if URL is bad)
      const head = await fetch(videoUrl, { method: "HEAD" });
      if (!head.ok) throw new Error(`Video not accessible: ${head.status} ${head.statusText}`);

      // Download the video (or enough of it; gopro-telemetry can parse the buffer)
      const resp = await fetch(videoUrl);
      if (!resp.ok) throw new Error(`Video fetch failed: ${resp.status} ${resp.statusText}`);
      const buffer = Buffer.from(await resp.arrayBuffer());

      // gopro-telemetry options:
      // - timeOut: avoid long parsing on big files
      // - repeat:false to avoid duplicating packets
      const gpt = await GoProTelemetry(buffer, { timeOut: 15000, repeat: false }).catch(() => null);

      if (gpt) {
        samples = normalizeFromGoPro(gpt);
      }
    }

    // 2) If no embedded GPS, but GPX provided → parse GPX
    if ((!samples || samples.length === 0) && gpxUrl) {
      samples = await parseGpx(gpxUrl);
    }

    if (!samples || samples.length === 0) {
      return res.status(404).json({
        error: "No GPS telemetry found. For Insta360/DJI, provide ?gpxUrl=<public GPX>. For GoPro, ensure GPS was enabled."
      });
    }

    // Optional: backfill speed if missing (simple segment speed; you can refine client-side)
    let prev = null;
    for (const s of samples) {
      if (s.speedKmh == null && prev && s.timeMs && prev.timeMs) {
        const dt = (s.timeMs - prev.timeMs) / 1000; // seconds
        if (dt > 0) {
          // Haversine distance in meters
          const R = 6371000;
          const toRad = d => (d * Math.PI) / 180;
          const dLat = toRad(s.lat - prev.lat);
          const dLon = toRad(s.lon - prev.lon);
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(prev.lat)) * Math.cos(toRad(s.lat)) * Math.sin(dLon / 2) ** 2;
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const meters = R * c;
          const mps = meters / dt;
          s.speedKmh = mps * 3.6;
        }
      }
      prev = s;
    }

    res.status(200).json({
      samples,
      totalSamples: samples.length,
      source: videoUrl ? (samples?.[0]?.isoTime ? "embedded+time" : "embedded") : "gpx"
    });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
}

