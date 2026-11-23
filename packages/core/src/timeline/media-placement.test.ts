import { describe, expect, it } from "vitest";
import type { Project } from "../types";
import { resolveMediaPlacement } from "./timeline-placement";

type T = { id: string; type: "video" | "audio" | "text"; locked?: boolean; busy?: boolean };

function project(tracks: T[]): Project {
  return {
    id: "p",
    name: "p",
    createdAt: 0,
    modifiedAt: 0,
    settings: { width: 1080, height: 1920, frameRate: 30, sampleRate: 48_000, channels: 2 },
    mediaLibrary: { items: [] },
    timeline: {
      duration: 10,
      tracks: tracks.map((t) => ({
        id: t.id,
        name: t.id,
        type: t.type,
        mode: "standard",
        locked: t.locked ?? false,
        hidden: false,
        muted: false,
        solo: false,
        transitions: [],
        clips: t.busy ? [{ id: `${t.id}-clip`, mediaId: "m", trackId: t.id, startTime: 0, duration: 10 }] : [],
      })),
    },
  } as unknown as Project;
}

const base = { startTime: 1, duration: 3, newTrackId: "new" };
const tiktok = [
  { id: "Main", type: "video" as const },
  { id: "Sound", type: "audio" as const },
];

describe("resolveMediaPlacement", () => {
  it("sends a video dropped on the audio track to the video track", () => {
    expect(resolveMediaPlacement(project(tiktok), { ...base, mediaType: "video", targetTrackId: "Sound" }))
      .toEqual({ trackId: "Main", startTime: 1 });
  });

  it("sends audio dropped on the video track to the audio track", () => {
    expect(resolveMediaPlacement(project(tiktok), { ...base, mediaType: "audio", targetTrackId: "Main" }))
      .toEqual({ trackId: "Sound", startTime: 1 });
  });

  it("puts an image on the video track when dropped outside any track", () => {
    expect(resolveMediaPlacement(project(tiktok), { ...base, mediaType: "image" }))
      .toEqual({ trackId: "Main", startTime: 1 });
  });

  it("prefers the main (bottom) video track and the first audio track when dropped outside", () => {
    const tracks = [
      { id: "Titles", type: "text" as const },
      { id: "B-roll", type: "video" as const },
      { id: "Main", type: "video" as const },
      { id: "Dialogue", type: "audio" as const },
      { id: "Music", type: "audio" as const },
    ];
    expect(resolveMediaPlacement(project(tracks), { ...base, mediaType: "video" }).trackId).toBe("Main");
    expect(resolveMediaPlacement(project(tracks), { ...base, mediaType: "audio" }).trackId).toBe("Dialogue");
  });

  it("keeps the track it was dropped on when the type matches and it is free", () => {
    const tracks = [{ id: "V2", type: "video" as const }, ...tiktok];
    expect(resolveMediaPlacement(project(tracks), { ...base, mediaType: "video", targetTrackId: "Main" }))
      .toEqual({ trackId: "Main", startTime: 1 });
  });

  it("uses another free track of the same type when the dropped one is busy", () => {
    const tracks = [{ id: "V2", type: "video" as const }, { id: "Main", type: "video" as const, busy: true }];
    expect(resolveMediaPlacement(project(tracks), { ...base, mediaType: "video", targetTrackId: "Main" }))
      .toEqual({ trackId: "V2", startTime: 1 });
  });

  it("creates a new video track above the video tracks when all are busy", () => {
    const tracks = [{ id: "Main", type: "video" as const, busy: true }, { id: "Sound", type: "audio" as const }];
    expect(resolveMediaPlacement(project(tracks), { ...base, mediaType: "video" }))
      .toEqual({ trackId: "new", startTime: 1, createdTrack: { id: "new", position: 0, type: "video" } });
  });

  it("creates an audio track (not a video one) after the audio tracks when needed", () => {
    const tracks = [
      { id: "Main", type: "video" as const },
      { id: "Sound", type: "audio" as const, busy: true },
      { id: "Captions", type: "text" as const },
    ];
    expect(resolveMediaPlacement(project(tracks), { ...base, mediaType: "audio", targetTrackId: "Main" }))
      .toEqual({ trackId: "new", startTime: 1, createdTrack: { id: "new", position: 2, type: "audio" } });
  });

  it("skips locked tracks", () => {
    const tracks = [{ id: "Main", type: "video" as const, locked: true }, { id: "Sound", type: "audio" as const }];
    expect(resolveMediaPlacement(project(tracks), { ...base, mediaType: "video", targetTrackId: "Main" }).createdTrack?.type)
      .toBe("video");
  });
});
