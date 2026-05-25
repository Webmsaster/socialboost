import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_VIDEO_BUCKET ?? "generated-videos";

if (!URL || !KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

export async function uploadVideo(localPath: string, userId: string): Promise<string> {
  const buffer = await readFile(localPath);
  const fileName = `${userId}/${Date.now()}-${basename(localPath)}`;

  const { error } = await supabase.storage.from(BUCKET).upload(fileName, buffer, {
    contentType: "video/mp4",
    upsert: false,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}
