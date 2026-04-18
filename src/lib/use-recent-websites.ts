"use client";

import useSWR from "swr";
import { createClient } from "./supabase/client";

/**
 * Pull the most recently used website URLs from the current user's posts.
 * Any post whose `topic` starts with http(s):// is treated as a website-
 * sourced post (see /bulk URL mode and /create website flow). We dedupe and
 * rank by most-recent-use so the first suggestion is the one the user most
 * likely wants again.
 *
 * Client-only hook — returns an empty list until the user is authenticated
 * and the fetch resolves. Shares the SWR cache across the app, so multiple
 * input fields on the same page don't hit the database more than once.
 */
export function useRecentWebsites(limit = 20): string[] {
  const { data } = useSWR<string[]>(
    "recent-websites",
    async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: rows } = await supabase
        .from("posts")
        .select("topic, created_at")
        .eq("user_id", user.id)
        .like("topic", "http%")
        .order("created_at", { ascending: false })
        .limit(200);

      if (!rows) return [];

      const seen = new Set<string>();
      const ordered: string[] = [];
      for (const r of rows) {
        const topic = (r as { topic: string }).topic;
        if (!/^https?:\/\//i.test(topic)) continue;
        if (seen.has(topic)) continue;
        seen.add(topic);
        ordered.push(topic);
        if (ordered.length >= limit) break;
      }
      return ordered;
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  );

  return data ?? [];
}
