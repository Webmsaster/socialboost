"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n";
import { toast } from "sonner";

const platforms = ["linkedin", "facebook", "instagram", "pinterest", "twitter"] as const;
const tones = ["professional", "casual", "inspirational", "humorous", "educational"] as const;

export default function CreatePage() {
  const [platform, setPlatform] = useState<string>("linkedin");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<string>("professional");
  const [language, setLanguage] = useState("English");
  const [result, setResult] = useState<{ content: string; hashtags: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { t } = useLanguage();
  const supabase = createClient();

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, topic, tone, language }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Generation failed");
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    const fullText = result.hashtags.length > 0
      ? `${result.content}\n\n${result.hashtags.map((h) => `#${h}`).join(" ")}`
      : result.content;
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave() {
    if (!result) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("posts").insert({
      user_id: user.id,
      platform,
      topic,
      tone,
      content: result.content,
      hashtags: result.hashtags,
      status: "draft",
    });

    if (error) {
      toast.error("Failed to save");
    } else {
      toast.success(t("create.saved"));
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">{t("create.title")}</h1>

      <form onSubmit={handleGenerate} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("create.platform")}</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {platforms.map((p) => (
                  <SelectItem key={p} value={p}>{t(`platform.${p}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("create.tone")}</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {tones.map((tn) => (
                  <SelectItem key={tn} value={tn}>{t(`tone.${tn}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("create.language")}</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="English">English</SelectItem>
              <SelectItem value="German">Deutsch</SelectItem>
              <SelectItem value="French">Francais</SelectItem>
              <SelectItem value="Spanish">Espanol</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t("create.topic")}</Label>
          <Textarea
            placeholder={t("create.topicPlaceholder")}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={4}
            required
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full md:w-auto">
          {loading ? t("create.generating") : t("create.generate")}
        </Button>
      </form>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {t("create.result")}
              <Badge variant="secondary">{platform}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="whitespace-pre-wrap rounded-lg bg-muted p-4 text-sm">
              {result.content}
              {result.hashtags.length > 0 && (
                <>
                  <br /><br />
                  <span className="text-primary">
                    {result.hashtags.map((h) => `#${h}`).join(" ")}
                  </span>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCopy}>
                {copied ? t("create.copied") : t("create.copy")}
              </Button>
              <Button variant="outline" onClick={handleSave}>
                {t("create.save")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
