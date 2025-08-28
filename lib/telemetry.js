// lib/telemetry.js
import fetch from "node-fetch";
import gpmfExtract from "gpmf-extract";
import gpmfParse from "gpmf-parser";
import { parseStringPromise } from "xml2js";

/* ------------------- Haversine helper ------------------- */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in m
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* ------------------- GPX Extractor ------------------- */
async function extractFromGpx(gpxUrl) {
  const res = await fetch(gpxUrl);
  if (!res.ok) throw new Error(`Failed to fetch GPX: ${res.statusText}`);

  const xml = await res.text();
  const gpx = await parseStringPromise(xml);

  const trkpts = gpx.gpx.trk[0].trkseg[0].trkpt;
  const samples = [];

  for (let i = 0; i < trkpts.length; i++) {
    const pt = trkpts[i];
    const lat = parseFloat(pt.$.lat);
    const lon = parseFloat(pt.$.lon);
    const alt = parseFloat(pt.ele?.[0] || 0);
    const time = pt.time ? new Date(pt.time[0]).getTime() : i * 1000;

    let speedKmh = 0;
    if (i > 0) {
      const prev = samples[i - 1];
      const dist = haversine(prev.lat, prev.lon, lat, lon);
      const dt = (time - prev.timeMs) / 1000; // seconds
      if (dt > 0) speedKmh = (dist / dt) * 3.6; // m/s → km/h
    }

    samples.push({ lat, lon, alt, speedKmh, timeMs: time });
  }

  return { samples, totalSamples: samples.length, source: "gpx" };
}

/* ------------------- GoPro GPMF Extractor ------------------- */
async function extractFromVideo(videoUrl) {
  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`Failed to fetch video: ${res.statusText}`);

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Extract raw GPMF stream
  const gpmfData = await gpmfExtract(buffer);

  // Parse telemetry
  const parsed = gpmfParse(gpmfData);

  // TODO: adapt to your camera — this is a minimal placeholder
  const samples = parsed
    .filter((item) => item.stream === "GPS5") // GPS5 stream contains GPS data
    .map((item) => {
      return {
        lat: item.value[0],
        lon: item.value[1],
        alt: item.value[2],
        speedKmh: item.value[3],
        timeMs: item.cts * 1000,
      };
    });

  return { samples, totalSamples: samples.length, source: "video" };
}

/* ------------------- Main API Export ------------------- */
export default async function extractTelemetry(url) {
  if (!url) throw new Error("No videoUrl or gpxUrl provided");

  if (url.endsWith(".gpx") || url.includes("gpx")) {
    return extractFromGpx(url);
  } else {
    return extractFromVideo(url);
  }
}
