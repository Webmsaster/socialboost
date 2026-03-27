import { createClient } from "@/lib/supabase/server";

const BUCKET = "generated-images";

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
    const response = await fetch(temporaryUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }

    const blob = await response.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());
    const ext = "png";
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const supabase = await createClient();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, buffer, {
        contentType: "image/png",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    return data.publicUrl;
  } catch (error) {
    console.error("Image persistence failed, using temporary URL:", error);
    return temporaryUrl;
  }
}
