"use client";

import { useState } from "react";
import { Play } from "lucide-react";

function extractYouTubeId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.slice(1).split("/")[0] || null;
    }
    if (url.hostname.includes("youtube.com")) {
      return url.searchParams.get("v") || url.pathname.split("/").pop() || null;
    }
  } catch {
    return null;
  }

  return null;
}

export function DemoYouTube({ videoIdOrUrl }: { videoIdOrUrl?: string }) {
  const [playing, setPlaying] = useState(false);
  const videoId = videoIdOrUrl ? extractYouTubeId(videoIdOrUrl) : null;

  if (!videoId) {
    return (
      <div className="flex aspect-video w-full items-center justify-center bg-muted text-sm text-muted-foreground">
        Set <code className="mx-1 rounded bg-background px-1.5 py-0.5 text-xs">NEXT_PUBLIC_DEMO_YOUTUBE_ID</code> to
        enable the demo video.
      </div>
    );
  }

  if (playing) {
    return (
      <iframe
        className="aspect-video w-full bg-black"
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
        title="Daxch product demo"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="group relative aspect-video w-full overflow-hidden bg-black text-left"
      aria-label="Play demo video"
    >
      <img
        src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
        onError={(e) => {
          e.currentTarget.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-black/10" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_32px_-8px_oklch(var(--primary)/0.6)] transition-transform group-hover:scale-105">
          <Play className="ml-1 h-7 w-7 fill-current" />
        </span>
      </div>
    </button>
  );
}
