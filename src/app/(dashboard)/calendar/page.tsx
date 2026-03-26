"use client";

import { useEffect, useState, useCallback, useMemo, DragEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { toast } from "sonner";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  parseISO,
} from "date-fns";

interface Post {
  id: string;
  platform: string;
  topic: string;
  content: string;
  hashtags: string[];
  tone: string;
  status: string;
  scheduled_for: string | null;
  created_at: string;
}

const PLATFORM_COLORS: Record<string, string> = {
  linkedin: "bg-blue-600 text-white",
  facebook: "bg-blue-500 text-white",
  instagram: "bg-pink-500 text-white",
  pinterest: "bg-red-500 text-white",
  twitter: "bg-sky-500 text-white",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  scheduled: "default",
  published: "outline",
  failed: "destructive",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();
  const supabase = createClient();

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load posts");
    } else if (data) {
      setPosts(data);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Calculate calendar grid days (Mon-Sun weeks)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  // Group scheduled posts by date string
  const postsByDate = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const post of posts) {
      if (post.scheduled_for) {
        const dateKey = format(parseISO(post.scheduled_for), "yyyy-MM-dd");
        const existing = map.get(dateKey) ?? [];
        existing.push(post);
        map.set(dateKey, existing);
      }
    }
    return map;
  }, [posts]);

  // Unscheduled draft posts
  const draftPosts = useMemo(() => {
    return posts.filter((p) => p.status === "draft" && !p.scheduled_for);
  }, [posts]);

  // Posts for selected day
  const selectedDayPosts = useMemo(() => {
    if (!selectedDay) return [];
    const dateKey = format(selectedDay, "yyyy-MM-dd");
    return postsByDate.get(dateKey) ?? [];
  }, [selectedDay, postsByDate]);

  // Navigation
  const goToPrevMonth = () => setCurrentMonth((prev) => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentMonth((prev) => addMonths(prev, 1));
  const goToToday = () => {
    setCurrentMonth(new Date());
    setSelectedDay(new Date());
  };

  // Drag and Drop handlers
  const handleDragStart = (e: DragEvent<HTMLDivElement>, post: Post) => {
    e.dataTransfer.setData("text/plain", post.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, dateKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverDate(dateKey);
  };

  const handleDragLeave = () => {
    setDragOverDate(null);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>, targetDate: Date) => {
    e.preventDefault();
    setDragOverDate(null);

    const postId = e.dataTransfer.getData("text/plain");
    if (!postId) return;

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    // Use noon in the user's local timezone, then convert to UTC
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const day = targetDate.getDate();
    const newScheduledFor = new Date(year, month, day, 12, 0, 0, 0);
    const isoString = newScheduledFor.toISOString();

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, scheduled_for: isoString, status: "scheduled" }
          : p
      )
    );

    const { error } = await supabase
      .from("posts")
      .update({ scheduled_for: isoString, status: "scheduled" })
      .eq("id", postId);

    if (error) {
      toast.error("Failed to reschedule post");
      // Revert optimistic update
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, scheduled_for: post.scheduled_for, status: post.status }
            : p
        )
      );
    } else {
      toast.success(`Post moved to ${format(targetDate, "MMM d, yyyy")}`);
    }
  };

  const handleDayClick = (day: Date) => {
    setSelectedPost(null);
    setSelectedDay((prev) => (prev && isSameDay(prev, day) ? null : day));
  };

  const handlePostClick = (post: Post) => {
    setSelectedPost((prev) => (prev?.id === post.id ? null : post));
  };

  const getPlatformColor = (platform: string): string => {
    return PLATFORM_COLORS[platform.toLowerCase()] ?? "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">{t("calendar.title")}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPrevMonth}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <h2 className="min-w-[160px] text-center text-lg font-semibold">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <Button variant="outline" size="sm" onClick={goToNextMonth}>
            <ChevronRightIcon />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-96 items-center justify-center">
          <div className="text-muted-foreground">Loading calendar...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
          {/* Calendar Grid */}
          <Card className="overflow-x-auto">
            <CardContent className="p-0 min-w-[640px]">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 border-b bg-muted/50">
                {WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day) => {
                  const dateKey = format(day, "yyyy-MM-dd");
                  const dayPosts = postsByDate.get(dateKey) ?? [];
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isDragOver = dragOverDate === dateKey;
                  const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
                  const isTodayDate = isToday(day);

                  return (
                    <div
                      key={dateKey}
                      className={`
                        relative min-h-[100px] border-b border-r p-1.5 transition-colors
                        ${isCurrentMonth ? "bg-card" : "bg-muted/30"}
                        ${isDragOver ? "bg-primary/10 ring-2 ring-inset ring-primary/40" : ""}
                        ${isSelected ? "bg-accent" : ""}
                        cursor-pointer hover:bg-accent/50
                      `}
                      onClick={() => handleDayClick(day)}
                      onDragOver={(e) => handleDragOver(e, dateKey)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, day)}
                    >
                      {/* Day number */}
                      <div className="mb-1 flex items-center justify-between">
                        <span
                          className={`
                            inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium
                            ${isTodayDate ? "bg-primary text-primary-foreground" : ""}
                            ${!isCurrentMonth ? "text-muted-foreground/50" : "text-foreground"}
                          `}
                        >
                          {format(day, "d")}
                        </span>
                        {dayPosts.length > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            {dayPosts.length}
                          </span>
                        )}
                      </div>

                      {/* Post badges (max 3 shown, with overflow indicator) */}
                      <div className="flex flex-col gap-0.5">
                        {dayPosts.slice(0, 3).map((post) => (
                          <div
                            key={post.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, post)}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePostClick(post);
                            }}
                            className={`
                              truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight
                              cursor-grab active:cursor-grabbing
                              ${getPlatformColor(post.platform)}
                              hover:opacity-80 transition-opacity
                            `}
                            title={`${post.platform}: ${post.topic}`}
                          >
                            {post.topic || post.platform}
                          </div>
                        ))}
                        {dayPosts.length > 3 && (
                          <span className="text-[10px] text-muted-foreground pl-1">
                            +{dayPosts.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Selected Day Details */}
            {selectedDay && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {format(selectedDay, "EEEE, MMMM d, yyyy")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedDayPosts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No posts scheduled for this day. Drag a draft here to schedule it.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {selectedDayPosts.map((post) => (
                        <div
                          key={post.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, post)}
                          onClick={() => handlePostClick(post)}
                          className={`
                            cursor-pointer rounded-lg border p-3 transition-colors
                            hover:bg-accent/50
                            ${selectedPost?.id === post.id ? "border-primary bg-accent" : ""}
                          `}
                        >
                          <div className="mb-1.5 flex items-center gap-2">
                            <span
                              className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${getPlatformColor(post.platform)}`}
                            >
                              {post.platform}
                            </span>
                            <Badge variant={STATUS_VARIANTS[post.status] ?? "secondary"} className="text-[10px]">
                              {post.status}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium leading-snug">
                            {post.topic}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {post.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Post Detail Panel */}
            {selectedPost && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Post Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${getPlatformColor(selectedPost.platform)}`}
                      >
                        {selectedPost.platform}
                      </span>
                      <Badge variant={STATUS_VARIANTS[selectedPost.status] ?? "secondary"}>
                        {selectedPost.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Topic</p>
                      <p className="text-sm">{selectedPost.topic}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Tone</p>
                      <p className="text-sm capitalize">{selectedPost.tone}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Content</p>
                      <p className="whitespace-pre-wrap text-sm">{selectedPost.content}</p>
                    </div>
                    {selectedPost.hashtags && selectedPost.hashtags.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Hashtags</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {selectedPost.hashtags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-[10px]">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedPost.scheduled_for && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Scheduled For</p>
                        <p className="text-sm">
                          {format(parseISO(selectedPost.scheduled_for), "PPp")}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Created</p>
                      <p className="text-sm">
                        {format(parseISO(selectedPost.created_at), "PPp")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Draft Posts (Unscheduled) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Unscheduled Drafts ({draftPosts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {draftPosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No unscheduled drafts. Create a new post first.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {draftPosts.map((post) => (
                      <div
                        key={post.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, post)}
                        onClick={() => handlePostClick(post)}
                        className={`
                          cursor-grab rounded-lg border border-dashed p-2.5 transition-colors
                          hover:bg-accent/50 active:cursor-grabbing
                          ${selectedPost?.id === post.id ? "border-primary bg-accent" : ""}
                        `}
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${getPlatformColor(post.platform)}`}
                          >
                            {post.platform}
                          </span>
                        </div>
                        <p className="text-sm font-medium leading-snug">{post.topic}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                          {post.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline SVG icons to avoid extra dependencies
function ChevronLeftIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
