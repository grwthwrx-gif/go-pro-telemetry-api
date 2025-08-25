import { Buffer } from "buffer";

// Simplified placeholder parser
// Later replace with full gopro-telemetry code if needed
export async function parseTelemetry(buffer) {
  return {
    streams: [
      {
        name: "GPS5",
        samples: [
          { value: [51.71765, -3.38487, 443.67, 5.0], cts: 100 },
          { value: [51.71766, -3.38486, 445.00, 8.0], cts: 200 },
          { value: [51.71767, -3.38485, 446.30, 12.0], cts: 300 }
        ]
      }
    ]
  };
}
