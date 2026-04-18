"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableSkeleton } from "@/components/loading-skeleton";
import { useLanguage } from "@/lib/i18n";
import { useRecentWebsites } from "@/lib/use-recent-websites";
import { toast } from "sonner";

interface ContentSeries {
  id: string;
  name: string;
  platform: string;
  tone: string;
  topic_template: string;
  frequency: string;
  day_of_week: number | null;
  preferred_time: string;
  is_active: boolean;
  last_generated_at: string | null;
  created_at: string;
  website_url: string | null;
}

const platforms = ["linkedin", "facebook", "instagram", "pinterest", "twitter"] as const;
const tones = ["professional", "casual", "inspirational", "humorous", "educational"] as const;
const frequencies = ["daily", "weekly", "biweekly", "monthly"] as const;
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function SeriesPage() {
  const [seriesList, setSeriesList] = useState<ContentSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const recentWebsites = useRecentWebsites();
  const { t } = useLanguage();

  // Form state
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<string>("linkedin");
  const [tone, setTone] = useState<string>("professional");
  const [topicTemplate, setTopicTemplate] = useState("");
  const [frequency, setFrequency] = useState<string>("weekly");
  const [dayOfWeek, setDayOfWeek] = useState<string>("1");
  const [preferredTime, setPreferredTime] = useState("09:00");
  const [websiteUrl, setWebsiteUrl] = useState("");

  useEffect(() => {
    loadSeries();
  }, []);

  async function loadSeries() {
    setLoading(true);
    try {
      const res = await fetch("/api/series");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to load series");
        return;
      }
      const data = await res.json();
      setSeriesList(data.series || []);
    } catch {
      toast.error("Failed to load series");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName("");
    setPlatform("linkedin");
    setTone("professional");
    setTopicTemplate("");
    setFrequency("weekly");
    setDayOfWeek("1");
    setPreferredTime("09:00");
    setWebsiteUrl("");
    setShowForm(false);
  }

  async function handleCreate() {
    if (!name.trim() || !topicTemplate.trim()) {
      toast.error(t("series.missingFields"));
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          platform,
          tone,
          topicTemplate,
          frequency,
          dayOfWeek: parseInt(dayOfWeek),
          preferredTime,
          websiteUrl: websiteUrl.trim() || undefined,
        }),
      });

      if (res.ok) {
        toast.success(t("series.created"));
        resetForm();
        loadSeries();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create series");
      }
    } catch {
      toast.error("Failed to create series");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    setTogglingId(id);
    try {
      const res = await fetch("/api/series", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !isActive }),
      });
      if (res.ok) {
        setSeriesList((prev) =>
          prev.map((s) => (s.id === id ? { ...s, is_active: !isActive } : s))
        );
        toast.success(!isActive ? t("series.activated") : t("series.paused"));
      }
    } catch {
      toast.error("Failed to update series");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleRunNow(id: string) {
    setRunningId(id);
    try {
      const res = await fetch("/api/series/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        toast.success("Post generated — check History");
        setSeriesList((prev) =>
          prev.map((s) =>
            s.id === id ? { ...s, last_generated_at: new Date().toISOString() } : s
          )
        );
      } else {
        const data = await res.json().catch(() => ({}));
        if (data.error === "limit_reached") {
          toast.error("Monthly generation limit reached");
        } else {
          toast.error(data.detail || data.error || "Failed to generate");
        }
      }
    } catch {
      toast.error("Failed to generate");
    } finally {
      setRunningId(null);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch("/api/series", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setSeriesList((prev) => prev.filter((s) => s.id !== id));
        toast.success(t("series.deleted"));
      }
    } catch {
      toast.error("Failed to delete series");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("series.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("series.description")}</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? t("series.cancel") : t("series.create")}
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{t("series.newSeries")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("series.name")}</Label>
                <Input
                  placeholder={t("series.namePlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("series.platform")}</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {platforms.map((p) => (
                      <SelectItem key={p} value={p}>{t(`platform.${p}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("series.topicTemplate")}</Label>
              <Textarea
                placeholder={t("series.topicPlaceholder")}
                value={topicTemplate}
                onChange={(e) => setTopicTemplate(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">{t("series.topicHint")}</p>
            </div>

            <div className="space-y-2">
              <Label>Website URL (optional)</Label>
              <Input
                type="url"
                placeholder="https://yoursite.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                list="recent-websites-series"
              />
              {recentWebsites.length > 0 && (
                <datalist id="recent-websites-series">
                  {recentWebsites.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              )}
              <p className="text-xs text-muted-foreground">
                If set, each generated post is tailored to this site: we scrape title, description, and headings once per day and feed them to the AI so every post ends with a natural CTA back to your site.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <Label>{t("series.tone")}</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {tones.map((t_) => (
                      <SelectItem key={t_} value={t_}>{t(`tone.${t_}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("series.frequency")}</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {frequencies.map((f) => (
                      <SelectItem key={f} value={f}>{t(`series.freq.${f}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("series.dayOfWeek")}</Label>
                <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {dayNames.map((d, i) => (
                      <SelectItem key={d} value={String(i)}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("series.time")}</Label>
                <Input
                  type="time"
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                />
              </div>
            </div>

            <Button onClick={handleCreate} disabled={creating} className="w-full sm:w-auto">
              {creating ? "..." : t("series.save")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Series List */}
      {loading ? (
        <TableSkeleton rows={3} />
      ) : seriesList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{t("series.empty")}</p>
            {!showForm && (
              <Button className="mt-4" onClick={() => setShowForm(true)}>
                {t("series.create")}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {seriesList.map((series) => (
            <Card key={series.id} className={!series.is_active ? "opacity-60" : ""}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{series.name}</h3>
                      <Badge variant={series.is_active ? "default" : "secondary"}>
                        {series.is_active ? t("series.active") : t("series.pausedLabel")}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{t(`platform.${series.platform}`)}</Badge>
                      <Badge variant="outline" className="capitalize">{series.tone}</Badge>
                      <Badge variant="outline">{t(`series.freq.${series.frequency}`)}</Badge>
                      {series.day_of_week !== null && (
                        <Badge variant="outline">{dayNames[series.day_of_week]}</Badge>
                      )}
                      <Badge variant="outline">{series.preferred_time}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{series.topic_template}</p>
                    {series.website_url && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Site:</span>{" "}
                        <a
                          href={series.website_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-primary hover:underline break-all"
                        >
                          {series.website_url}
                        </a>
                      </p>
                    )}
                    {series.last_generated_at && (
                      <p className="text-xs text-muted-foreground">
                        {t("series.lastGenerated")}: {new Date(series.last_generated_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="default"
                      size="sm"
                      disabled={runningId === series.id}
                      onClick={() => handleRunNow(series.id)}
                    >
                      {runningId === series.id ? "..." : "Run now"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={togglingId === series.id}
                      onClick={() => handleToggle(series.id, series.is_active)}
                    >
                      {series.is_active ? t("series.pause") : t("series.activate")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleDelete(series.id)}
                    >
                      {t("series.delete")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
