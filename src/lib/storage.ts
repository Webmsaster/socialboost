import { createClient } from "@supabase/supabase-js";
import { captureError } from "./logger";

const BUCKET = "generated-images";

function getStorageAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Downloads an image from a URL and uploads it to Supabase Storage.
 * Returns the public URL of the persisted image.
 * Falls back to the original URL if upload fails.
 */
export async function persistImage(
  temporaryUrl: string,
  userId: string
): Promise<string> {
  try {
    let buffer: Buffer;
    let contentType = "image/png";
    const dataUrlMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(temporaryUrl);
    if (dataUrlMatch) {
      contentType = dataUrlMatch[1];
      buffer = Buffer.from(dataUrlMatch[2], "base64");
    } else {
      const response = await fetch(temporaryUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
      }
      const blob = await response.blob();
      buffer = Buffer.from(await blob.arrayBuffer());
    }

    const ext = contentType.split("/")[1]?.split("+")[0] || "png";
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const supabase = getStorageAdmin();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, buffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    return data.publicUrl;
  } catch (error) {
    captureError("Image persistence failed, falling back to temporary URL", error, { userId });
    return temporaryUrl;
  }
}
