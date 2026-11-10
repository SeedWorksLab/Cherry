import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import dayjs from 'dayjs';
import { ScreenFade } from '../../components/screen-fade';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { RecordingWaves } from '../../components/recording-waves';
import { ScreenToast } from '../../components/screen-toast';
import { AppDialog } from '../../components/app-dialog';
import { useAppData } from '../../data/DataProvider';
import { useAppTheme } from '../../theme';
import type { VoiceMoment, VoiceSession } from '../../models';
import {
  closeVoiceMoment,
  createVoiceMoment,
  createVoiceSession,
  getMomentsBySession,
  getOpenSessions,
  getVoiceSession,
  markMomentTranscriptFailed,
  setMomentTranscript,
  setVoiceSessionState,
} from '../../database/voiceSessions';
import { meteringLevel, recordedDurationMs } from '../../services/voice-session-service';
import { buildProvider } from '../../ai/provider';
import { transcribeMomentWithProvider } from '../../ai/transcription';
import {
  isLiveTranscriptionAvailable,
  requestSpeechRecognitionPermission,
  startLiveTranscription,
} from '../../ai/speech-recognition';
import type { LiveTranscriptionHandle } from '../../ai/speech-recognition';
import { deleteAudioFile, storeMomentAudio } from '../../utils/audio';

const CAFE_CONTEXT: string[] = [
  'bloom',
  'dose',
  'ratio',
  'V60',
  'Chemex',
  'Kalita',
  'AeroPress',
  'espresso',
  'grinder',
  'french press',
];

const RECORD_SIZE = 112;
const RECORD_AREA_HEIGHT = RECORD_SIZE + 56;

function nowIso(): string {
  return dayjs().toISOString();
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function isRecent(enabledAt: string, thresholdMinutes: number): boolean {
  const enabled = Date.parse(enabledAt);
  return Number.isFinite(enabled) && Date.now() - enabled <= thresholdMinutes * 60_000;
}

export default function RecordScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { settings, aiState, refresh } = useAppData();

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 150);

  const [session, setSession] = useState<VoiceSession | null>(null);
  const [moments, setMoments] = useState<VoiceMoment[]>([]);
  const [paused, setPaused] = useState(false);
  const [openMomentId, setOpenMomentId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [openStartedAt, setOpenStartedAt] = useState<number | null>(null);
  const [, setNowTick] = useState(0);
  const liveHandleRef = useRef<LiveTranscriptionHandle | null>(null);

  const engine = aiState.sttEngine;
  const liveAvailable = engine === 'android' && isLiveTranscriptionAvailable() && Platform.OS !== 'web';
  const recording = openMomentId !== null;

  const reloadSessionData = useCallback(async (sessionId: number) => {
    const nextMoments = await getMomentsBySession(sessionId);
    setMoments(nextMoments);
  }, []);

  useEffect(() => {
    if (!navigation.canGoBack()) {
      router.replace('/');
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await setAudioModeAsync({ allowsRecording: true, interruptionMode: 'doNotMix' });
        await AudioModule.requestRecordingPermissionsAsync();
        if (aiState.sttEngine === 'android') {
          await requestSpeechRecognitionPermission();
        }
        const open = await getOpenSessions();
        const latest = open[0];

        if (latest) {
          if (latest.state === 'review' || latest.state === 'transcribing' || latest.state === 'extracting') {
            router.replace({ pathname: '/record/review', params: { session: String(latest.id) } });
            return;
          }
          const lastActive = latest.updatedAt ?? latest.endedAt ?? latest.startedAt;
          if (isRecent(lastActive, settings.sessionResumeThresholdMinutes)) {
            await setVoiceSessionState(latest.id, 'paused');
            const resumed = await getVoiceSession(latest.id);
            setSession(resumed ?? latest);
            await reloadSessionData(latest.id);
            setPaused(true);
            if (!cancelled) {
              setReady(true);
            }
            return;
          }
        }

        const id = await createVoiceSession({
          brewId: null,
          planId: null,
          state: 'paused',
          startedAt: nowIso(),
          endedAt: null,
          defaultPhase: null,
          engine: aiState.sttEngine,
          language: aiState.sttLanguage,
        });
        const created = await getVoiceSession(id);
        if (!cancelled && created) {
          setSession(created);
          setPaused(true);
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setToast('Could not start a recording session');
          setReady(true);
        }
      }
    })();
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sessionId = session?.id ?? null;
  const metering = meteringLevel(recorderState.metering);

  async function openNextMoment() {
    if (sessionId === null || session === null) {
      return;
    }
    const startOffsetMs = Math.max(0, dayjs().valueOf() - dayjs(session.startedAt).valueOf());
    const id = await createVoiceMoment({
      sessionId,
      phase: null,
      startOffsetMs,
      durationMs: null,
      audioPath: null,
      transcript: null,
      transcriptConfidence: null,
      transcriptEngine: null,
      transcriptStatus: 'pending',
    });
    setOpenStartedAt(dayjs().valueOf());
    setOpenMomentId(id);

    try {
      await recorder.prepareToRecordAsync({ isMeteringEnabled: true });
      recorder.record();
    } catch {
      setToast('Could not start recording');
      setOpenStartedAt(null);
      setOpenMomentId(null);
      return;
    }

    if (liveAvailable) {
      liveHandleRef.current = startLiveTranscription({
        language: aiState.sttLanguage,
        contextualStrings: CAFE_CONTEXT,
        onError: () => setToast('On-device speech recognition was interrupted'),
      });
    }
  }

  async function closeCurrentMoment() {
    if (openMomentId === null || sessionId === null) {
      return;
    }
    const momentId = openMomentId;
    const startedAt = openStartedAt ?? dayjs().valueOf();
    setOpenMomentId(null);
    setOpenStartedAt(null);
    setBusy(true);
    try {
      const durationMs = Math.max(0, dayjs().valueOf() - startedAt);

      let liveText: { text: string; confidence: number | null } | null = null;
      if (liveAvailable && liveHandleRef.current) {
        liveText = await liveHandleRef.current.stop();
        liveHandleRef.current = null;
      }

      await recorder.stop();
      const recordedUri = recorder.uri;
      const audioPath = recordedUri ? await storeMomentAudio(recordedUri, sessionId, momentId) : null;

      await closeVoiceMoment(momentId, durationMs, audioPath ?? '', engine === 'manual' ? 'skipped' : 'pending');

      if (liveText) {
        await setMomentTranscript(momentId, liveText.text, liveText.confidence, 'android');
      } else if (engine === 'android') {
        await markMomentTranscriptFailed(momentId, 'android');
      }
      await reloadSessionData(sessionId);
    } catch {
      setToast('Could not save this moment');
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    if (sessionId === null || session === null) {
      return;
    }
    setPaused(false);
    await setVoiceSessionState(sessionId, 'recording');
    await openNextMoment();
  }

  async function pauseRecording() {
    if (openMomentId !== null) {
      await closeCurrentMoment();
    }
    setPaused(true);
    if (sessionId !== null) {
      await setVoiceSessionState(sessionId, 'paused');
    }
  }

  async function handleRecordPress() {
    if (busy) {
      return;
    }
    if (recording) {
      await pauseRecording();
      return;
    }
    await startRecording();
  }

  async function handleFinish() {
    if (busy) {
      return;
    }
    if (sessionId === null) {
      return;
    }
    setBusy(true);
    try {
      if (openMomentId !== null) {
        await closeCurrentMoment();
      }
      await setVoiceSessionState(sessionId, 'transcribing');

      const pending = await getMomentsBySession(sessionId);
      const provider = buildProvider(aiState);
      let failedCount = 0;
      for (const moment of pending) {
        if (moment.transcriptStatus === 'succeeded' || moment.transcriptStatus === 'skipped') {
          continue;
        }
        if (engine === 'openai-compatible') {
          if (provider === null) {
            await markMomentTranscriptFailed(moment.id, engine);
            failedCount += 1;
            continue;
          }
          try {
            const result = await transcribeMomentWithProvider(provider, aiState.sttModel, aiState.sttLanguage, {
              uri: moment.audioPath,
              mimeType: 'audio/m4a',
              fileName: `moment-${moment.id}.m4a`,
            });
            await setMomentTranscript(moment.id, result.text, result.confidence, STT_ENGINE_NAME);
          } catch {
            await markMomentTranscriptFailed(moment.id, engine);
            failedCount += 1;
          }
        } else if (moment.transcriptStatus !== 'failed') {
          await markMomentTranscriptFailed(moment.id, engine);
          failedCount += 1;
        }
      }

      await setVoiceSessionState(sessionId, 'review');
      if (failedCount === pending.length && pending.length > 0) {
        setToast('Transcription failed entirely; you can type the notes in review');
      }
      router.replace({ pathname: '/record/review', params: { session: String(sessionId) } });
    } catch {
      setToast('Could not finish this session');
      setBusy(false);
    }
  }

  async function handleDiscard() {
    if (sessionId === null) {
      return;
    }
    setConfirmDiscard(false);
    setBusy(true);
    try {
      if (openMomentId !== null) {
        liveHandleRef.current?.abort();
        try {
          await recorder.stop();
        } catch {
          // recorder may already be stopped
        }
        const recordedUri = recorder.uri;
        if (recordedUri) {
          deleteAudioFile(recordedUri);
        }
        setOpenStartedAt(null);
        setOpenMomentId(null);
      }
      for (const moment of moments) {
        if (moment.audioPath) {
          deleteAudioFile(moment.audioPath);
        }
      }
      await setVoiceSessionState(sessionId, 'discarded');
      await refresh();
      router.back();
    } catch {
      setToast('Could not discard the session');
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <ScreenFade>
        <View style={styles.center} />
      </ScreenFade>
    );
  }
  if (session === null) {
    return (
      <ScreenFade>
        <View style={styles.center}>
          <Text variant="bodyMedium">No recording session.</Text>
          <Button mode="contained" style={styles.topAction} onPress={() => router.back()}>
            Close
          </Button>
        </View>
      </ScreenFade>
    );
  }

  const openDurationMs = recording && openStartedAt !== null ? Math.max(0, dayjs().valueOf() - openStartedAt) : 0;
  const recordedSeconds = Math.floor(recordedDurationMs(moments, openDurationMs) / 1000);
  const statusLabel = recording ? 'Recording' : paused && moments.length > 0 ? 'Paused' : 'Ready';
  const iconName = recording ? 'pause' : paused && moments.length > 0 ? 'play' : 'microphone';
  const buttonBackground = recording ? theme.colors.primary : theme.colors.primaryContainer;
  const iconColor = recording ? theme.colors.onPrimary : theme.colors.onPrimaryContainer;

  return (
    <ScreenFade>
      <KeyboardAwareScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
        ]}
      >
        <View style={styles.header}>
          <Text variant="titleMedium" style={styles.headerTitle}>
            {statusLabel}
          </Text>
          <IconButton
            icon="close"
            onPress={() => setConfirmDiscard(true)}
            accessibilityLabel="Discard recording session"
            testID="record-discard"
          />
        </View>

        <View style={styles.timerBlock}>
          <Text variant="displayMedium" style={[styles.timer, { color: theme.colors.onSurface }]}>
            {formatClock(recordedSeconds)}
          </Text>
          <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Recorded
          </Text>
        </View>

        <View style={styles.recordArea}>
          <RecordingWaves
            level={metering}
            active={recording}
            size={RECORD_SIZE}
            color={theme.colors.primary}
          />
          <Pressable
            onPress={handleRecordPress}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ busy }}
            accessibilityLabel={
              recording
                ? 'Pause recording'
                : paused && moments.length > 0
                  ? 'Resume recording'
                  : 'Start recording'
            }
            testID="record-mic"
          >
            <View
              style={[
                styles.micButton,
                { width: RECORD_SIZE, height: RECORD_SIZE, borderRadius: RECORD_SIZE / 2, backgroundColor: buttonBackground },
              ]}
            >
              <MaterialCommunityIcons name={iconName} size={48} color={iconColor} />
            </View>
          </Pressable>
        </View>

        <Text variant="bodySmall" style={styles.hint}>
          {recording
            ? 'Tap to pause. Ramble freely — nothing needs to be precise.'
            : paused && moments.length > 0
              ? 'Tap to keep recording, or send when you are done.'
              : 'Tap to start. Pause any time, then send.'}
        </Text>

        <View style={styles.actions}>
          <Button
            mode="contained"
            icon="send"
            onPress={handleFinish}
            loading={busy}
            disabled={busy || (!recording && moments.length === 0)}
            style={styles.action}
            testID="record-send"
          >
            Send
          </Button>
        </View>

        <Button
          mode="text"
          onPress={() => router.replace('/brew/new')}
          style={styles.manualLink}
          testID="record-manual"
        >
          Log by hand instead
        </Button>

        <AppDialog visible={confirmDiscard} onDismiss={() => setConfirmDiscard(false)}>
          <AppDialog.Title>Discard this session?</AppDialog.Title>
          <AppDialog.Content>
            <Text variant="bodyMedium">
              The session and its recordings are deleted. This cannot be undone.
            </Text>
          </AppDialog.Content>
          <AppDialog.Actions>
            <Button onPress={() => setConfirmDiscard(false)}>Keep recording</Button>
            <Button onPress={handleDiscard} disabled={busy}>
              Discard
            </Button>
          </AppDialog.Actions>
        </AppDialog>

        <ScreenToast visible={toast !== null} message={toast} onDismiss={() => setToast(null)} />
      </KeyboardAwareScrollView>
    </ScreenFade>
  );
}

const STT_ENGINE_NAME = 'openai-compatible';

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontWeight: '700',
  },
  timerBlock: {
    alignItems: 'center',
    marginTop: 24,
  },
  timer: {
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  recordArea: {
    alignItems: 'center',
    justifyContent: 'center',
    height: RECORD_AREA_HEIGHT,
    marginTop: 32,
  },
  micButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    marginTop: 8,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
  },
  action: {
    flex: 1,
  },
  manualLink: {
    marginTop: 16,
    alignSelf: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topAction: {
    marginTop: 16,
  },
});
