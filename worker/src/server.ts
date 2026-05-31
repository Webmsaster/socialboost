import express from "express";
import { randomUUID } from "node:crypto";
import { renderVideo, type RenderRequest } from "./render.js";
import { uploadVideo } from "./storage.js";

const PORT = Number(process.env.PORT) || 8080;
const TOKEN = process.env.RENDER_API_TOKEN;

// Internal DoS caps. The Next.js route already limits scenes to 8, but this
// worker is a separate deployable and must protect itself against malformed or
// hostile payloads (huge scene counts, oversized dimensions).
const MAX_SCENES = 12;
const MAX_DIMENSION = 1920;
const VALID_ASPECTS = ["9:16", "16:9", "1:1"] as const;

if (!TOKEN) {
  console.error("RENDER_API_TOKEN is required");
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: "20mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

app.post("/render", async (req, res) => {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = req.body as Partial<RenderRequest> & {
    userId?: string;
    width?: unknown;
    height?: unknown;
  };
  if (
    !body ||
    typeof body !== "object" ||
    typeof body.userId !== "string" ||
    !body.userId ||
    !Array.isArray(body.scenes) ||
    body.scenes.length === 0
  ) {
    return res.status(400).json({ error: "Missing userId or scenes" });
  }

  // Reject obviously malformed scenes (each must be an object with a string URL).
  const scenesValid = body.scenes.every(
    (s) => s && typeof s === "object" && typeof (s as { imageUrl?: unknown }).imageUrl === "string",
  );
  if (!scenesValid) {
    return res.status(400).json({ error: "Malformed scene: imageUrl required" });
  }

  // Cap scene count to protect the worker from DoS via huge render jobs.
  if (body.scenes.length > MAX_SCENES) {
    return res
      .status(413)
      .json({ error: `Too many scenes: ${body.scenes.length} (max ${MAX_SCENES})` });
  }

  // Validate aspect if provided (drives output dimensions).
  if (body.aspect !== undefined && !VALID_ASPECTS.includes(body.aspect)) {
    return res.status(400).json({ error: `Invalid aspect: ${String(body.aspect)}` });
  }

  // If explicit dimensions are supplied, keep them within sane bounds.
  for (const [name, value] of [
    ["width", body.width],
    ["height", body.height],
  ] as const) {
    if (value === undefined) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > MAX_DIMENSION) {
      return res
        .status(400)
        .json({ error: `Invalid ${name}: must be 1..${MAX_DIMENSION}` });
    }
  }

  const renderId = randomUUID();
  console.log(`[${renderId}] render start, scenes=${body.scenes.length}, user=${body.userId}`);

  try {
    const mp4Path = await renderVideo({
      scenes: body.scenes,
      voiceoverDataUrl: body.voiceoverDataUrl,
      aspect: body.aspect ?? "9:16",
      brandName: body.brandName,
    });
    const publicUrl = await uploadVideo(mp4Path, body.userId);
    console.log(`[${renderId}] render done: ${publicUrl}`);
    res.json({ videoUrl: publicUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Render failed";
    console.error(`[${renderId}] render error:`, msg);
    res.status(500).json({ error: msg });
  }
});

app.listen(PORT, () => {
  console.log(`SocialBoost video worker listening on :${PORT}`);
});
