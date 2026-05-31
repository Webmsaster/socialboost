import express from "express";
import { randomUUID } from "node:crypto";
import { renderVideo, type RenderRequest } from "./render.js";
import { uploadVideo } from "./storage.js";

const PORT = Number(process.env.PORT) || 8080;
const TOKEN = process.env.RENDER_API_TOKEN;

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

  const body = req.body as Partial<RenderRequest> & { userId?: string };
  if (!body.userId || !Array.isArray(body.scenes) || body.scenes.length === 0) {
    return res.status(400).json({ error: "Missing userId or scenes" });
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
