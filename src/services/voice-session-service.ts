import type {
  AudioRetentionPolicy,
  TranscriptStatus,
  VoiceMoment,
  VoiceSessionState,
} from '../models';

/** The transcript handed to the extraction prompt: succeeded, non-blank, in order. */
export function buildTranscript(moments: VoiceMoment[]): string {
  return [...moments]
    .sort((a, b) => a.startOffsetMs - b.startOffsetMs || a.id - b.id)
    .filter((moment) => moment.transcriptStatus === 'succeeded' && moment.transcript !== null)
    .map((moment) => (moment.transcript ?? '').trim())
    .filter((text) => text !== '')
    .join('\n');
}

/**
 * The recorded audio length: every closed moment's duration plus however long
 * the open moment has been running. Time spent paused is never counted.
 */
export function recordedDurationMs(moments: VoiceMoment[], openDurationMs = 0): number {
  const closed = moments.reduce((total, moment) => total + (moment.durationMs ?? 0), 0);
  return closed + Math.max(0, openDurationMs);
}

const METERING_FLOOR_DB = -60;

/** Maps expo-audio's dBFS metering (about -160..0) onto a 0..1 display level. */
export function meteringLevel(meteringDb: number | undefined): number {
  if (meteringDb === undefined || !Number.isFinite(meteringDb)) {
    return 0;
  }
  if (meteringDb >= 0) {
    return 1;
  }
  if (meteringDb <= METERING_FLOOR_DB) {
    return 0;
  }
  return (meteringDb - METERING_FLOOR_DB) / -METERING_FLOOR_DB;
}

export interface TranscriptCounts {
  succeeded: number;
  failed: number;
  skipped: number;
  pending: number;
}

export function transcriptCounts(moments: VoiceMoment[]): TranscriptCounts {
  const counts: TranscriptCounts = { succeeded: 0, failed: 0, skipped: 0, pending: 0 };
  for (const moment of moments) {
    switch (moment.transcriptStatus) {
      case 'succeeded':
        counts.succeeded += 1;
        break;
      case 'failed':
        counts.failed += 1;
        break;
      case 'skipped':
        counts.skipped += 1;
        break;
      default:
        counts.pending += 1;
    }
  }
  return counts;
}

/** Every moment has been written, closed and either transcribed or skipped. */
export function allMomentsResolved(moments: VoiceMoment[]): boolean {
  return (
    moments.length > 0 &&
    moments.every(
      (moment) =>
        moment.transcriptStatus === 'succeeded' ||
        moment.transcriptStatus === 'failed' ||
        moment.transcriptStatus === 'skipped'
    )
  );
}

export function hasUsableTranscript(moments: VoiceMoment[]): boolean {
  return moments.some(
    (moment) =>
      moment.transcriptStatus === 'succeeded' &&
      moment.transcript !== null &&
      moment.transcript.trim() !== ''
  );
}

export function formatTranscriptStatus(status: TranscriptStatus | null): string {
  switch (status) {
    case 'succeeded':
      return 'Transcribed';
    case 'failed':
      return 'Failed';
    case 'skipped':
      return 'Skipped';
    case 'pending':
      return 'Pending';
    default:
      return '—';
  }
}

/**
 * The audio retention policy decides when every moment's file may be deleted.
 * Deleting happens after the file has been consumed — a committed record, or a
 * finished transcription the user is about to review.
 */
export function shouldDeleteAudio(
  retention: AudioRetentionPolicy,
  state: VoiceSessionState
): boolean {
  if (retention === 'keep') {
    return false;
  }
  if (retention === 'delete-after-commit') {
    return state === 'committed';
  }
  return state === 'review';
}