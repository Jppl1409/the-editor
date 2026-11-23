import type { Project } from "../types";
import { getTrackItems, isStandardTrack } from "./timeline-items";

/**
 * "overlap" keeps the item on the requested track even when occupied, for
 * interactions that resolve the overlap themselves afterwards (clip drag drop).
 */
type TimelinePlacementPolicy = "gap" | "stack-above" | "overlap";

interface TimelinePlacementRequest {
  readonly targetTrackId: string;
  readonly startTime: number;
  readonly duration: number;
  readonly policy: TimelinePlacementPolicy;
  readonly excludeItemIds?: readonly string[];
  readonly newTrackId?: string;
}

type TimelinePlacementResult =
  | {
      readonly ok: true;
      readonly trackId: string;
      readonly startTime: number;
      readonly createdTrack?: { readonly id: string; readonly position: number };
    }
  | {
      readonly ok: false;
      readonly reason: "track-not-found" | "track-locked" | "overlap";
    };

const PLACEMENT_EPSILON = 0.0001;

function timelineIntervalsOverlap(
  leftStart: number,
  leftDuration: number,
  rightStart: number,
  rightDuration: number,
): boolean {
  const leftEnd = leftStart + leftDuration;
  const rightEnd = rightStart + rightDuration;
  return (
    leftStart < rightEnd - PLACEMENT_EPSILON &&
    rightStart < leftEnd - PLACEMENT_EPSILON
  );
}

function isTimelineIntervalClear(
  project: Project,
  trackId: string,
  startTime: number,
  duration: number,
  excludeItemIds: readonly string[] = [],
): boolean {
  const excluded = new Set(excludeItemIds);
  return getTrackItems(project, trackId).every(
    (item) =>
      excluded.has(item.id) ||
      !timelineIntervalsOverlap(
        startTime,
        duration,
        item.startTime,
        item.duration,
      ),
  );
}

/** Resolve the destination row without mutating the project. */
export function resolveTimelinePlacement(
  project: Project,
  request: TimelinePlacementRequest,
): TimelinePlacementResult {
  const targetIndex = project.timeline.tracks.findIndex(
    (track) => track.id === request.targetTrackId,
  );
  if (targetIndex < 0) return { ok: false, reason: "track-not-found" };

  const target = project.timeline.tracks[targetIndex];
  if (target.locked && request.policy === "gap") {
    return { ok: false, reason: "track-locked" };
  }

  const startTime = Math.max(0, request.startTime);
  if (request.policy === "overlap") {
    if (target.locked) return { ok: false, reason: "track-locked" };
    return { ok: true, trackId: target.id, startTime };
  }
  if (
    !target.locked &&
    isTimelineIntervalClear(
      project,
      target.id,
      startTime,
      request.duration,
      request.excludeItemIds,
    )
  ) {
    return { ok: true, trackId: target.id, startTime };
  }

  if (request.policy === "gap") return { ok: false, reason: "overlap" };

  for (let index = targetIndex - 1; index >= 0; index -= 1) {
    const candidate = project.timeline.tracks[index];
    if (
      !candidate.locked &&
      isStandardTrack(candidate) &&
      isTimelineIntervalClear(
        project,
        candidate.id,
        startTime,
        request.duration,
        request.excludeItemIds,
      )
    ) {
      return { ok: true, trackId: candidate.id, startTime };
    }
  }

  const newTrackId = request.newTrackId ?? `track-${crypto.randomUUID()}`;
  return {
    ok: true,
    trackId: newTrackId,
    startTime,
    createdTrack: { id: newTrackId, position: targetIndex },
  };
}

/**
 * The Editor: escolhe a trilha certa para uma mídia solta na timeline.
 * Áudio vai para trilha de áudio; vídeo e imagem vão para trilha de vídeo (imagem também aceita
 * trilha de imagem). Tenta primeiro a trilha onde soltou, depois as outras do mesmo tipo que
 * estiverem livres naquele trecho; se nenhuma servir, cria uma trilha nova do tipo certo.
 */
export function resolveMediaPlacement(
  project: Project,
  request: {
    readonly mediaType: "video" | "audio" | "image";
    readonly targetTrackId?: string;
    readonly startTime: number;
    readonly duration: number;
    readonly newTrackId: string;
  },
): {
  readonly trackId: string;
  readonly startTime: number;
  readonly createdTrack?: {
    readonly id: string;
    readonly position: number;
    readonly type: "video" | "audio";
  };
} {
  const tracks = project.timeline.tracks;
  const startTime = Math.max(0, request.startTime);
  const wantedType = request.mediaType === "audio" ? "audio" : "video";
  const fits = (type: string) =>
    type === wantedType || (request.mediaType === "image" && type === "image");
  const requested = tracks.find((track) => track.id === request.targetTrackId);
  // Vídeo: da trilha de baixo (a principal) para cima. Áudio: de cima para baixo.
  const sameType = tracks.filter((track) => track !== requested && fits(track.type));
  if (wantedType === "video") sameType.reverse();
  const candidates = [
    ...(requested && fits(requested.type) ? [requested] : []),
    ...sameType,
  ];
  for (const track of candidates) {
    if (!track.locked && isTimelineIntervalClear(project, track.id, startTime, request.duration)) {
      return { trackId: track.id, startTime };
    }
  }
  // Nova trilha: vídeo fica acima das trilhas de vídeo; áudio vai depois da última de áudio.
  let position: number;
  if (wantedType === "video") {
    const firstVideo = tracks.findIndex((track) => fits(track.type));
    position = firstVideo >= 0 ? firstVideo : 0;
  } else {
    let lastAudio = -1;
    tracks.forEach((track, index) => { if (track.type === "audio") lastAudio = index; });
    position = lastAudio >= 0 ? lastAudio + 1 : tracks.length;
  }
  return {
    trackId: request.newTrackId,
    startTime,
    createdTrack: { id: request.newTrackId, position, type: wantedType },
  };
}
