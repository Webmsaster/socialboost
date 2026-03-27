"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

const platforms = [
  { id: "linkedin", name: "LinkedIn", icon: "in" },
  { id: "facebook", name: "Facebook", icon: "f" },
  { id: "instagram", name: "Instagram", icon: "ig" },
  { id: "pinterest", name: "Pinterest", icon: "P" },
  { id: "twitter", name: "Twitter/X", icon: "X" },
];

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [platform, setPlatform] = useState("linkedin");
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ content: string; hashtags: string[] } | null>(null);

  async function handleGenerate() {
    if (!topic.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, topic, tone: "professional", language: "English" }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      } else {
        toast.error("Generation failed. Try again.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-lg mx-4">
        <CardContent className="pt-8 pb-6 px-8">
          {step === 0 && (
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold">S</div>
              <h2 className="text-2xl font-bold">Welcome to SocialBoost!</h2>
              <p className="text-muted-foreground">Create AI-powered social media content in seconds. Let&apos;s get you started with your first post.</p>
              <Button onClick={() => setStep(1)} className="w-full mt-4">Let&apos;s go</Button>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-center">Choose your primary platform</h2>
              <div className="grid grid-cols-5 gap-2">
                {platforms.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPlatform(p.id)}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs font-medium transition-colors ${platform === p.id ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}
                  >
                    <span className="text-lg font-bold">{p.icon}</span>
                    {p.name}
                  </button>
                ))}
              </div>
              <Button onClick={() => setStep(2)} className="w-full">Next</Button>
            </div>
          )}
          {step === 2 && !result && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-center">Generate your first post</h2>
              <p className="text-sm text-muted-foreground text-center">What should the post be about?</p>
              <Textarea
                placeholder="e.g. 5 tips for better remote work productivity..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={3}
              />
              <Button onClick={handleGenerate} className="w-full" disabled={generating || !topic.trim()}>
                {generating ? "Generating..." : "Generate Post"}
              </Button>
            </div>
          )}
          {step === 2 && result && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-center">Your first post is ready!</h2>
              <div className="rounded-lg border bg-muted/30 p-4 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                {result.content}
                {result.hashtags?.length > 0 && (
                  <p className="mt-2 text-primary">{result.hashtags.map((h) => `#${h}`).join(" ")}</p>
                )}
              </div>
              <Button onClick={onComplete} className="w-full">Go to Dashboard</Button>
            </div>
          )}
          {step > 0 && !result && (
            <button onClick={() => setStep(step - 1)} className="mt-3 text-xs text-muted-foreground hover:text-foreground w-full text-center">
              Back
            </button>
          )}
          <button onClick={onComplete} className="mt-2 text-xs text-muted-foreground hover:text-foreground w-full text-center">
            Skip onboarding
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
