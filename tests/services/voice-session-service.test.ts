import type { VoiceMoment } from '../../src/models';
import {
  allMomentsResolved,
  buildTranscript,
  formatTranscriptStatus,
  hasUsableTranscript,
  meteringLevel,
  recordedDurationMs,
  shouldDeleteAudio,
  transcriptCounts,
} from '../../src/services/voice-session-service';

function moment(partial: Partial<VoiceMoment>): VoiceMoment {
  return {
    id: partial.id ?? 1,
    uuid: partial.uuid ?? null,
    sessionId: partial.sessionId ?? 1,
    phase: partial.phase ?? null,
    startOffsetMs: partial.startOffsetMs ?? 0,
    durationMs: partial.durationMs ?? null,
    audioPath: partial.audioPath ?? null,
    transcript: partial.transcript ?? null,
    transcriptConfidence: partial.transcriptConfidence ?? null,
    transcriptEngine: partial.transcriptEngine ?? null,
    transcriptStatus: partial.transcriptStatus ?? null,
    createdAt: partial.createdAt ?? '2026-10-01T00:00:00.000Z',
    updatedAt: partial.updatedAt ?? null,
  };
}

describe('buildTranscript', () => {
  it('keeps only succeeded, non-blank moments in offset order, without phase tags', () => {
    const moments = [
      moment({ id: 3, startOffsetMs: 30_000, transcript: 'pour done', transcriptStatus: 'succeeded' }),
      moment({ id: 1, startOffsetMs: 0, transcript: 'fifteen grams', transcriptStatus: 'succeeded' }),
      moment({ id: 2, startOffsetMs: 10_000, transcript: '   ', transcriptStatus: 'succeeded' }),
      moment({ id: 4, startOffsetMs: 20_000, transcript: 'this failed', transcriptStatus: 'failed' }),
    ];

    expect(buildTranscript(moments)).toBe('fifteen grams\npour done');
    expect(buildTranscript([])).toBe('');
  });
});

describe('recordedDurationMs', () => {
  it('sums closed moment durations plus the open moment so far', () => {
    const moments = [moment({ id: 1, durationMs: 4_000 }), moment({ id: 2, durationMs: 6_500 })];
    expect(recordedDurationMs(moments)).toBe(10_500);
    expect(recordedDurationMs(moments, 1_500)).toBe(12_000);
  });

  it('ignores moments whose duration is still unknown', () => {
    const moments = [moment({ id: 1, durationMs: null }), moment({ id: 2, durationMs: 2_000 })];
    expect(recordedDurationMs(moments)).toBe(2_000);
    expect(recordedDurationMs([], 0)).toBe(0);
  });

  it('never counts a negative open duration', () => {
    expect(recordedDurationMs([], -500)).toBe(0);
  });
});

describe('meteringLevel', () => {
  it('maps silence and the floor to zero', () => {
    expect(meteringLevel(undefined)).toBe(0);
    expect(meteringLevel(-160)).toBe(0);
    expect(meteringLevel(-60)).toBe(0);
  });

  it('maps full scale and beyond to one', () => {
    expect(meteringLevel(0)).toBe(1);
    expect(meteringLevel(5)).toBe(1);
  });

  it('interpolates between the floor and full scale', () => {
    expect(meteringLevel(-30)).toBeCloseTo(0.5, 5);
  });
});

describe('transcriptCounts', () => {
  it('tallies each status, treating null as pending', () => {
    const moments = [
      moment({ id: 1, transcriptStatus: 'succeeded' }),
      moment({ id: 2, transcriptStatus: 'succeeded' }),
      moment({ id: 3, transcriptStatus: 'failed' }),
      moment({ id: 4, transcriptStatus: 'skipped' }),
      moment({ id: 5, transcriptStatus: 'pending' }),
      moment({ id: 6, transcriptStatus: null }),
    ];
    expect(transcriptCounts(moments)).toEqual({ succeeded: 2, failed: 1, skipped: 1, pending: 2 });
  });

  it('is all zeroes for no moments', () => {
    expect(transcriptCounts([])).toEqual({ succeeded: 0, failed: 0, skipped: 0, pending: 0 });
  });
});

describe('allMomentsResolved', () => {
  it('requires at least one moment and no open status', () => {
    expect(allMomentsResolved([])).toBe(false);
    expect(allMomentsResolved([moment({ transcriptStatus: null })])).toBe(false);
    expect(allMomentsResolved([moment({ transcriptStatus: 'pending' })])).toBe(false);
    expect(allMomentsResolved([moment({ transcriptStatus: 'succeeded' })])).toBe(true);
  });
});

describe('hasUsableTranscript', () => {
  it('is true only when some moment holds real text', () => {
    expect(hasUsableTranscript([moment({ transcript: 'hi', transcriptStatus: 'succeeded' })])).toBe(true);
    expect(hasUsableTranscript([moment({ transcript: '   ', transcriptStatus: 'succeeded' })])).toBe(false);
    expect(hasUsableTranscript([moment({ transcript: 'hi', transcriptStatus: 'failed' })])).toBe(false);
  });
});

describe('formatTranscriptStatus', () => {
  it('labels every status and the absence of one', () => {
    expect(formatTranscriptStatus('succeeded')).toBe('Transcribed');
    expect(formatTranscriptStatus('failed')).toBe('Failed');
    expect(formatTranscriptStatus('skipped')).toBe('Skipped');
    expect(formatTranscriptStatus('pending')).toBe('Pending');
    expect(formatTranscriptStatus(null)).toBe('—');
  });
});

describe('shouldDeleteAudio', () => {
  it('keeps audio forever under the keep policy', () => {
    expect(shouldDeleteAudio('keep', 'committed')).toBe(false);
    expect(shouldDeleteAudio('keep', 'review')).toBe(false);
  });

  it('deletes after commit only once the session is committed', () => {
    expect(shouldDeleteAudio('delete-after-commit', 'review')).toBe(false);
    expect(shouldDeleteAudio('delete-after-commit', 'committed')).toBe(true);
  });

  it('deletes after transcription once review begins', () => {
    expect(shouldDeleteAudio('delete-after-transcribe', 'committed')).toBe(false);
    expect(shouldDeleteAudio('delete-after-transcribe', 'review')).toBe(true);
  });
});
