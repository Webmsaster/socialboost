"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const platforms = ["linkedin", "facebook", "instagram", "pinterest", "twitter"] as const;
const tones = ["professional", "casual", "inspirational", "humorous", "educational"] as const;
const languages = ["English", "German", "French", "Spanish"] as const;

interface Template {
  id: string;
  name: string;
  platform: string;
  tone: string;
  topic: string;
  language: string;
  created_at: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<string>("linkedin");
  const [tone, setTone] = useState<string>("professional");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("English");

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setTemplates(data);
    }
    load();
  }, [supabase]);

  function resetForm() {
    setName("");
    setPlatform("linkedin");
    setTone("professional");
    setTopic("");
    setLanguage("English");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("templates")
      .insert({
        user_id: user.id,
        name: name.trim(),
        platform,
        tone,
        topic: topic.trim(),
        language,
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to create template");
    } else if (data) {
      setTemplates((prev) => [data, ...prev]);
      resetForm();
      setShowForm(false);
      toast.success("Template created");
    }

    setLoading(false);
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("templates").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete template");
    } else {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Template deleted");
    }
  }

  function handleUse(id: string) {
    router.push(`/create?template=${id}`);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Templates</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Create Template"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New Template</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="template-name">Template Name</Label>
                <Input
                  id="template-name"
                  placeholder="e.g. Weekly LinkedIn Update"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {platforms.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tone</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tones.map((tn) => (
                        <SelectItem key={tn} value={tn}>
                          {tn.charAt(0).toUpperCase() + tn.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((lang) => (
                        <SelectItem key={lang} value={lang}>
                          {lang}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-topic">Default Topic / Prompt</Label>
                <Textarea
                  id="template-topic"
                  placeholder="e.g. Share a tip about productivity for remote workers"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={3}
                />
              </div>

              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Save Template"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {templates.length === 0 ? (
        <p className="text-muted-foreground">
          No templates yet. Create your first template to speed up content creation.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold truncate">{template.name}</h3>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {new Date(template.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {template.platform.charAt(0).toUpperCase() + template.platform.slice(1)}
                  </Badge>
                  <Badge variant="outline">
                    {template.tone.charAt(0).toUpperCase() + template.tone.slice(1)}
                  </Badge>
                  <Badge variant="outline">{template.language}</Badge>
                </div>
                {template.topic && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {template.topic}
                  </p>
                )}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => handleUse(template.id)}>
                    Use Template
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleDelete(template.id)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
