import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  Divider,
  Snackbar,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import dayjs from 'dayjs';
import { ScreenFade } from '../../components/screen-fade';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { ScreenToast } from '../../components/screen-toast';
import { AppDialog } from '../../components/app-dialog';
import { RatingSelector } from '../../components/rating-selector';
import type { TasteRating } from '../../components/rating-selector';
import { NumberField } from '../../components/number-field';
import { useAppData } from '../../data/DataProvider';
import {
  accessoryEquipment,
  availableMethods,
  brewingVessels,
  otherEquipment,
} from '../../services/equipment-service';
import { useAppTheme } from '../../theme';
import {
  ATTRIBUTE_LEVELS,
  BREW_METHOD_IDS,
  STEP_KIND_IDS,
  VERDICTS,
  type AttributeLevel,
  type Brewer,
  type BrewMethodId,
  type ExtractionQuestion,
  type ExtractionRun,
  type ExtractionTarget,
  type StepKind,
  type Verdict,
  type VoiceMoment,
  type VoiceSession,
} from '../../models';
import {
  attachSessionToBrew,
  getMomentsBySession,
  getVoiceSession,
  setMomentAudioPath,
  setVoiceSessionEnded,
  setVoiceSessionState,
} from '../../database/voiceSessions';
import {
  answerExtractionQuestion,
  completeExtractionRun,
  createExtractionProvenance,
  createExtractionQuestion,
  createExtractionResult,
  createExtractionRun,
  getQuestionsByRun,
  getSucceededRun,
} from '../../database/extractionRuns';
import type { BrewStepInput } from '../../database/brews';
import {
  buildTranscript,
  hasUsableTranscript,
  shouldDeleteAudio,
  transcriptCounts,
} from '../../services/voice-session-service';
import { buildProvider, ProviderError, summarizeText } from '../../ai/provider';
import {
  EXTRACTION_FOLLOWUP_PROMPT_VERSION,
  EXTRACTION_PROMPT_ID,
  EXTRACTION_PROMPT_VERSION,
} from '../../ai/prompts';
import type { ExtractionContext } from '../../ai/prompts';
import {
  brewCandidates,
  matchCatalogue,
  parseExtractionJson,
  runExtraction,
  tastingCandidates,
} from '../../ai/extraction';
import type { ClarifyingQuestionAnswer, ParsedExtraction } from '../../ai/schemas';
import { deleteAudioFile } from '../../utils/audio';

const VERDICT_LABELS: Record<Verdict, string> = {
  liked: 'Liked',
  disliked: 'Disliked',
  unsure: 'Not sure',
};

const ATTRIBUTE_LABELS: Record<AttributeLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

interface Edits {
  methodId: BrewMethodId | null;
  beanId: number | null;
  equipmentIds: number[];
  doseG: number | null;
  waterTotalG: number | null;
  waterTempC: number | null;
  yieldG: number | null;
  totalTimeS: number | null;
  notes: string;
  verdict: Verdict | null;
  overallRating: TasteRating | null;
  attributeAcidity: AttributeLevel | null;
  attributeSweetness: AttributeLevel | null;
  attributeBody: AttributeLevel | null;
  attributeBitterness: AttributeLevel | null;
  attributeFinish: AttributeLevel | null;
  tastingNotes: string;
  includeTasting: boolean;
}

/**
 * Resolves the spoken equipment names against the user's own gear. The vessel
 * and the grinder have their own fields, so a name that already matched one of
 * them is not recorded again as "also used".
 */
function resolveEquipmentIds(parsed: ParsedExtraction, brewers: readonly Brewer[]): number[] {
  const claimed = new Set(
    [parsed.brewerName, parsed.grinderName]
      .filter((name): name is string => name !== null)
      .map((name) => name.toLowerCase())
  );
  const candidates = brewers
    .filter((brewer) => brewer.kind !== 'grinder')
    .map((brewer) => ({ entityId: brewer.id, name: brewer.name }));
  const ids: number[] = [];
  for (const name of parsed.equipmentNames) {
    const match = matchCatalogue(candidates, name);
    if (match && !claimed.has(match.name.toLowerCase()) && !ids.includes(match.entityId)) {
      ids.push(match.entityId);
    }
  }
  return ids;
}

function editsFromExtraction(
  parsed: ParsedExtraction,
  defaultMethodId: BrewMethodId | null,
  brewers: readonly Brewer[]
): Edits {
  return {
    methodId: parsed.methodId ?? defaultMethodId,
    beanId: null,
    equipmentIds: resolveEquipmentIds(parsed, brewers),
    doseG: parsed.doseG,
    waterTotalG: parsed.waterTotalG,
    waterTempC: parsed.waterTempC,
    yieldG: parsed.yieldG,
    totalTimeS: parsed.totalTimeS,
    notes: parsed.notes ?? '',
    verdict: parsed.verdict,
    overallRating:
      parsed.overallRating !== null && parsed.overallRating >= 1 && parsed.overallRating <= 5
        ? (parsed.overallRating as TasteRating)
        : null,
    attributeAcidity: parsed.attributeAcidity,
    attributeSweetness: parsed.attributeSweetness,
    attributeBody: parsed.attributeBody,
    attributeBitterness: parsed.attributeBitterness,
    attributeFinish: parsed.attributeFinish,
    tastingNotes: parsed.tastingNotes ?? '',
    includeTasting: tastingCandidates(parsed).length > 0,
  };
}

function stepKind(value: string | null): StepKind | null {
  return value !== null && (STEP_KIND_IDS as readonly string[]).includes(value)
    ? (value as StepKind)
    : value !== null
      ? 'custom'
      : null;
}

export default function ReviewScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ session: string }>();
  const sessionId = Number(params.session);

  const {
    settings,
    aiState,
    methods,
    beans,
    brewers,
    grindSettings,
    flavourTags,
    refresh,
    addBrew,
    addTasting,
    removeBrew,
  } = useAppData();

  const [session, setSession] = useState<VoiceSession | null>(null);
  const [moments, setMoments] = useState<VoiceMoment[]>([]);
  const [transcriptText, setTranscriptText] = useState('');
  const [stage, setStage] = useState<'loading' | 'extracting' | 'review'>('loading');
  const [parsed, setParsed] = useState<ParsedExtraction | null>(null);
  const [activeRun, setActiveRun] = useState<ExtractionRun | null>(null);
  const [questions, setQuestions] = useState<ExtractionQuestion[]>([]);
  const [edits, setEdits] = useState<Edits | null>(null);

  const availableMethodIds = useMemo(
    () => availableMethods(brewers, methods).map((method) => method.id),
    [brewers, methods]
  );
  const [answerDrafts, setAnswerDrafts] = useState<Record<number, string>>({});
  const [transcriptDraft, setTranscriptDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [undoState, setUndoState] = useState<{ brewId: number; show: boolean } | null>(null);
  const editsInitialised = useRef(false);
  const statesRef = useRef({ settings, aiState, brewers });

  useEffect(() => {
    statesRef.current = { settings, aiState, brewers };
  }, [settings, aiState, brewers]);

  const context: ExtractionContext = useMemo(
    () => ({
      methods: methods.map((method) => method.name),
      beans: beans.map((bean) => bean.name),
      brewers: brewingVessels(brewers).map((brewer) => brewer.name),
      grinders: brewers.filter((brewer) => brewer.kind === 'grinder').map((brewer) => brewer.name),
      equipment: accessoryEquipment(brewers).map((brewer) => brewer.name),
      grindSettings: grindSettings.map((setting) => setting.name),
      flavourTags: flavourTags.map((tag) => tag.name),
      languageHint: aiState.sttLanguage,
    }),
    [methods, beans, brewers, grindSettings, flavourTags, aiState.sttLanguage]
  );

  const loadRunData = useCallback(async (run: ExtractionRun) => {
    const [nextQuestions] = await Promise.all([getQuestionsByRun(run.id)]);
    const reparsed = run.responseJson ? parseExtractionJson(run.responseJson) : null;
    setActiveRun(run);
    setParsed(reparsed);
    if (reparsed) {
      const current = statesRef.current;
      const nextEdits = editsFromExtraction(reparsed, current.settings.defaultMethodId, current.brewers);
      if (!editsInitialised.current) {
        editsInitialised.current = true;
        setEdits(nextEdits);
      }
    }
    setQuestions(nextQuestions);
    const drafts: Record<number, string> = {};
    for (const question of nextQuestions) {
      if (question.answer) {
        drafts[question.id] = question.answer;
      }
    }
    setAnswerDrafts(drafts);
  }, []);

  const runExtractionForSession = useCallback(
    async (overrideTranscript?: string, answers?: ClarifyingQuestionAnswer[]) => {
      const current = statesRef.current;
      const provider = buildProvider(current.aiState);
      const model = current.aiState.llmModel;
      if (provider === null || model === null) {
        setToast('Configure an AI provider to extract a record');
        return null;
      }
      const text = (overrideTranscript ?? transcriptDraft).trim();
      setStage('extracting');
      let runId: number | null = null;
      try {
        const followUp = Boolean(answers && answers.length > 0);
        runId = await createExtractionRun({
          sessionId,
          brewId: null,
          kind: 'extraction',
          promptId: EXTRACTION_PROMPT_ID,
          promptVersion: followUp ? EXTRACTION_FOLLOWUP_PROMPT_VERSION : EXTRACTION_PROMPT_VERSION,
          model,
          status: 'pending',
          requestSummary: summarizeText(text, 200),
          responseJson: null,
          error: null,
          inputTokens: null,
          outputTokens: null,
          costEstimateCents: null,
        });
        const outcome = await runExtraction({
          provider,
          model,
          transcript: text,
          context,
          answers: answers ?? [],
        });
        await completeExtractionRun(runId, {
          status: 'succeeded',
          responseJson: outcome.text,
          inputTokens: outcome.usage?.inputTokens ?? null,
          outputTokens: outcome.usage?.outputTokens ?? null,
        });
        for (const candidate of [...brewCandidates(outcome.parsed), ...tastingCandidates(outcome.parsed)]) {
          await createExtractionResult(runId, {
            target: candidate.target,
            targetId: null,
            fieldPath: candidate.fieldPath,
            valueJson: JSON.stringify(candidate.value),
            confidence: null,
          });
        }
        for (let index = 0; index < outcome.parsed.questions.length; index += 1) {
          const question = outcome.parsed.questions[index];
          await createExtractionQuestion(runId, {
            fieldPath: question.fieldPath,
            question: question.question,
            optionsJson: question.options.length ? JSON.stringify(question.options) : null,
            sortOrder: index,
          });
        }
        const run = await getSucceededRun(sessionId, 'extraction');
        if (run) {
          await loadRunData(run);
        }
        setStage('review');
        return run;
      } catch (error) {
        const message =
          error instanceof ProviderError ? error.message : 'The extraction could not be completed';
        if (runId !== null) {
          await completeExtractionRun(runId, { status: 'failed', error: message }).catch(
            () => undefined
          );
        }
        setStage('review');
        setToast(message);
        return null;
      }
    },
    [context, sessionId, transcriptDraft, loadRunData]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [loadedSession, loadedMoments] = await Promise.all([
        getVoiceSession(sessionId),
        getMomentsBySession(sessionId),
      ]);
      if (cancelled || loadedSession === null) {
        return;
      }
      setSession(loadedSession);
      setMoments(loadedMoments);
      const text = buildTranscript(loadedMoments);
      setTranscriptText(text);
      setTranscriptDraft(text);

      const existingRun = await getSucceededRun(sessionId, 'extraction');
      if (existingRun && existingRun.responseJson) {
        await loadRunData(existingRun);
        setStage('review');
        return;
      }

      if (!hasUsableTranscript(loadedMoments)) {
        setStage('review');
        return;
      }

      const provider = buildProvider(statesRef.current.aiState);
      if (provider === null || statesRef.current.aiState.llmModel === null) {
        setStage('review');
        return;
      }

      const run = await runExtractionForSession(text);
      if (run && statesRef.current.settings.aiAutoAccept) {
        const autoParse = run.responseJson ? parseExtractionJson(run.responseJson) : null;
        if (
          autoParse &&
          autoParse.questions.length === 0 &&
          autoParse.lowConfidence.length === 0 &&
          (autoParse.methodId !== null || statesRef.current.settings.defaultMethodId !== null)
        ) {
          await commit(autoParse, run.id, true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const providerConfigured = useMemo(
    () => buildProvider(aiState) !== null && aiState.llmModel !== null,
    [aiState]
  );

  const counts = useMemo(() => transcriptCounts(moments), [moments]);
  const resolved = useMemo(() => {
    if (parsed === null) {
      return null;
    }
    const grinders = brewers.filter((brewer) => brewer.kind === 'grinder');
    const vessels = brewingVessels(brewers);
    const bean = parsed.beanName ? matchCatalogue(beans.map((b) => ({ entityId: b.id, name: b.name })), parsed.beanName) : null;
    const brewer = parsed.brewerName
      ? matchCatalogue(vessels.map((b) => ({ entityId: b.id, name: b.name })), parsed.brewerName)
      : null;
    const grinder = parsed.grinderName
      ? matchCatalogue(grinders.map((g) => ({ entityId: g.id, name: g.name })), parsed.grinderName)
      : null;
    const grindSetting = parsed.grindSettingName
      ? matchCatalogue(grindSettings.map((g) => ({ entityId: g.id, name: g.name })), parsed.grindSettingName)
      : null;
    return { bean, brewer, grinder, grindSetting, grinders, vessels };
  }, [parsed, beans, brewers, grindSettings]);

  const beanMatch = resolved?.bean ?? null;
  const brewerMatch = resolved?.brewer ?? null;
  const grinderMatch = resolved?.grinder ?? null;
  const grindSettingMatch = resolved?.grindSetting ?? null;

  const equipmentOptions = useMemo(
    () => otherEquipment(brewers, brewerMatch === null ? [] : [brewerMatch.entityId]),
    [brewers, brewerMatch]
  );

  function valueChanged(fieldPath: string): boolean {
    if (edits === null || parsed === null) {
      return false;
    }
    switch (fieldPath) {
      case 'dose_g':
        return edits.doseG !== parsed.doseG;
      case 'water_total_g':
        return edits.waterTotalG !== parsed.waterTotalG;
      case 'water_temp_c':
        return edits.waterTempC !== parsed.waterTempC;
      case 'yield_g':
        return edits.yieldG !== parsed.yieldG;
      case 'total_time_s':
        return edits.totalTimeS !== parsed.totalTimeS;
      case 'notes':
        return edits.notes !== (parsed.notes ?? '');
      case 'verdict':
        return edits.verdict !== parsed.verdict;
      case 'overall_rating':
        return edits.overallRating !== parsed.overallRating;
      case 'tasting.notes':
        return edits.tastingNotes !== (parsed.tastingNotes ?? '');
      default:
        return false;
    }
  }

  async function commit(parsedToCommit: ParsedExtraction, runId: number | null, byAutoAccept: boolean) {
    if (session === null) {
      return;
    }
    const draftEdits = byAutoAccept
      ? editsFromExtraction(parsedToCommit, statesRef.current.settings.defaultMethodId, statesRef.current.brewers)
      : edits;
    if (draftEdits === null) {
      return;
    }
    if (draftEdits.methodId === null) {
      setToast('Pick a brewing method before saving');
      return;
    }

    setBusy(true);
    try {
      const endedAt = dayjs().toISOString();
      const steps: BrewStepInput[] = parsedToCommit.steps.map((step) => ({
        kind: stepKind(step.kind),
        label: step.label,
        targetWaterG: step.targetWaterG,
        pourWaterG: null,
        pourDurationS: step.pourDurationS,
        waitAfterS: step.waitAfterS,
        agitationCount: null,
        agitationKind: null,
        temperatureC: step.temperatureC,
        note: step.note,
      }));

      const beanId = draftEdits.beanId ?? beanMatch?.entityId ?? null;
      const brewId = await addBrew({
        methodId: draftEdits.methodId,
        brewerId: brewerMatch?.entityId ?? null,
        beanId,
        planId: null,
        recommendationId: null,
        voiceSessionId: session.id,
        brewDate: dayjs(session.startedAt).format('YYYY-MM-DD'),
        startedAt: session.startedAt,
        endedAt,
        doseG: draftEdits.doseG,
        waterTotalG: draftEdits.waterTotalG,
        waterTempC: draftEdits.waterTempC,
        yieldG: draftEdits.yieldG,
        grinderId: grinderMatch?.entityId ?? null,
        grindSettingId: grindSettingMatch?.entityId ?? null,
        grindValue: null,
        grindUnit: null,
        totalTimeS: draftEdits.totalTimeS,
        beanNameSnapshot: beanMatch?.name ?? parsedToCommit.beanName,
        notes: draftEdits.notes.trim() === '' ? null : draftEdits.notes.trim(),
        steps,
        equipmentIds: draftEdits.equipmentIds,
      });

      await attachSessionToBrew(session.id, brewId);

      let tastingId: number | null = null;
      if (draftEdits.includeTasting) {
        const matchedTagIds = flavourTags
          .filter((tag) =>
            parsedToCommit.flavourTags.some(
              (name) => tag.name.toLowerCase() === name.toLowerCase()
            )
          )
          .map((tag) => tag.id);
        tastingId = await addTasting({
          brewId,
          verdict: draftEdits.verdict,
          overallRating: draftEdits.overallRating,
          tastedAt: endedAt,
          temperatureC: null,
          attributeAcidity: draftEdits.attributeAcidity,
          attributeSweetness: draftEdits.attributeSweetness,
          attributeBody: draftEdits.attributeBody,
          attributeBitterness: draftEdits.attributeBitterness,
          attributeFinish: draftEdits.attributeFinish,
          scaAroma: null,
          scaFlavour: null,
          scaAftertaste: null,
          scaAcidity: null,
          scaBody: null,
          scaBalance: null,
          scaUniformity: null,
          scaCleanCup: null,
          scaSweetness: null,
          scaOverall: null,
          notes: draftEdits.tastingNotes.trim() === '' ? null : draftEdits.tastingNotes.trim(),
          flavourTagIds: matchedTagIds,
        });
      }

      if (runId !== null) {
        await recordProvenance(runId, {
          brewId,
          tastingId,
          parsed: parsedToCommit,
          draftEdits,
          byAutoAccept,
        });
      }

      for (const moment of moments) {
        if (moment.audioPath && shouldDeleteAudio(statesRef.current.settings.audioRetention, 'committed')) {
          deleteAudioFile(moment.audioPath);
          await setMomentAudioPath(moment.id, null);
        }
      }

      await setVoiceSessionEnded(session.id, 'committed', endedAt);
      await refresh();

      if (byAutoAccept) {
        setUndoState({ brewId, show: true });
      }
      router.replace({ pathname: '/brew/[id]', params: { id: String(brewId) } });
    } catch {
      setToast('Could not save the brew from this session');
      setBusy(false);
    }
  }

  async function recordProvenance(
    runId: number,
    input: {
      brewId: number;
      tastingId: number | null;
      parsed: ParsedExtraction;
      draftEdits: Edits;
      byAutoAccept: boolean;
    }
  ) {
    const { brewId, tastingId, parsed: source, draftEdits } = input;
    const targets: { target: ExtractionTarget; targetId: number | null; candidates: { fieldPath: string; value: unknown }[] }[] = [
      { target: 'brew', targetId: brewId, candidates: brewCandidates(source) },
    ];
    if (tastingId !== null) {
      targets.push({ target: 'tasting', targetId: tastingId, candidates: tastingCandidates(source) });
    }
    for (const group of targets) {
      for (const candidate of group.candidates) {
        const path = group.target === 'tasting' && candidate.fieldPath === 'notes' ? 'tasting.notes' : candidate.fieldPath;
        await createExtractionProvenance(runId, {
          target: group.target,
          targetId: group.targetId,
          fieldPath: path,
          source: input.byAutoAccept ? 'automated' : valueChanged(path) ? 'manual' : 'automated',
          accepted: true,
        });
      }
    }
    if (beanMatch) {
      await createExtractionProvenance(runId, {
        target: 'brew',
        targetId: brewId,
        fieldPath: 'bean_id',
        source: 'automated',
        accepted: true,
      });
    }
    if (draftEdits.beanId !== null && !beanMatch) {
      await createExtractionProvenance(runId, {
        target: 'brew',
        targetId: brewId,
        fieldPath: 'bean_id',
        source: 'manual',
        accepted: true,
      });
    }
    if (draftEdits.equipmentIds.length > 0) {
      await createExtractionProvenance(runId, {
        target: 'brew',
        targetId: brewId,
        fieldPath: 'equipment_ids',
        source: source.equipmentNames.length > 0 ? 'automated' : 'manual',
        accepted: true,
      });
    }
  }

  async function handleAnswerQuestions() {
    if (questions.length === 0) {
      return;
    }
    setBusy(true);
    try {
      for (const question of questions) {
        if (answerDrafts[question.id] !== undefined && answerDrafts[question.id].trim() !== '') {
          await answerExtractionQuestion(question.id, answerDrafts[question.id].trim());
        }
      }
    } catch {
      setToast('Could not store your answers');
      setBusy(false);
      return;
    }
    const answers: ClarifyingQuestionAnswer[] = questions
      .map((question) => ({
        fieldPath: question.fieldPath,
        question: question.question,
        answer: answerDrafts[question.id] ?? '',
      }))
      .filter((answer) => answer.answer.trim() !== '');
    if (answers.length === 0) {
      setToast('Answer at least one question first');
      setBusy(false);
      return;
    }
    await runExtractionForSession(transcriptText, answers);
    setBusy(false);
  }

  async function handleReExtract() {
    setBusy(true);
    setTranscriptText(transcriptDraft.trim());
    await runExtractionForSession(transcriptDraft.trim());
    setBusy(false);
  }

  async function handleUndo() {
    const target = undoState;
    if (target === null || session === null) {
      return;
    }
    setUndoState(null);
    await removeBrew(target.brewId);
    await attachSessionToBrew(session.id, null);
    await setVoiceSessionState(session.id, 'review');
    router.replace({ pathname: '/record/review', params: { session: String(session.id) } });
  }

  async function handleDiscard() {
    if (session === null) {
      return;
    }
    setConfirmDiscard(false);
    setBusy(true);
    try {
      for (const moment of moments) {
        if (moment.audioPath) {
          deleteAudioFile(moment.audioPath);
        }
      }
      await setVoiceSessionEnded(session.id, 'discarded', dayjs().toISOString());
      await refresh();
      router.back();
    } catch {
      setToast('Could not discard this session');
      setBusy(false);
    }
  }

  const candidates = parsed === null ? [] : [...brewCandidates(parsed), ...tastingCandidates(parsed)];

  if (stage === 'loading') {
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
          <Text variant="bodyMedium">This session could not be found.</Text>
          <Button mode="contained" style={styles.spacedButton} onPress={() => router.back()}>
            Back
          </Button>
        </View>
      </ScreenFade>
    );
  }

  if (stage === 'extracting') {
    return (
      <ScreenFade>
        <View style={styles.center}>
          <Text variant="titleMedium">Reading your brew from the transcript…</Text>
          <Text variant="bodySmall" style={styles.subtitle}>
            This only ever goes to the AI provider you configured.
          </Text>
          <View style={styles.pillar}>
            <View style={[styles.pillarInner, { backgroundColor: theme.colors.primary }]} />
          </View>
        </View>
      </ScreenFade>
    );
  }

  const hasTranscript = hasUsableTranscript(moments);
  const numericFields: { fieldPath: string; label: string; unit: string; value: number | null; set: (v: number | null) => void }[] =
    edits === null
      ? []
      : [
          { fieldPath: 'dose_g', label: 'Dose', unit: 'g', value: edits.doseG, set: (v) => setEdits({ ...edits, doseG: v }) },
          { fieldPath: 'water_total_g', label: 'Water', unit: 'g', value: edits.waterTotalG, set: (v) => setEdits({ ...edits, waterTotalG: v }) },
          { fieldPath: 'water_temp_c', label: 'Temperature', unit: '°C', value: edits.waterTempC, set: (v) => setEdits({ ...edits, waterTempC: v }) },
          { fieldPath: 'yield_g', label: 'Yield', unit: 'g', value: edits.yieldG, set: (v) => setEdits({ ...edits, yieldG: v }) },
          { fieldPath: 'total_time_s', label: 'Total time', unit: 's', value: edits.totalTimeS, set: (v) => setEdits({ ...edits, totalTimeS: v }) },
        ];

  return (
    <ScreenFade>
      <KeyboardAwareScrollView contentContainerStyle={styles.container}>
        <Text variant="titleLarge" style={styles.title}>
          Review and save
        </Text>
        <Text variant="bodySmall" style={styles.subtitle}>
          {moments.length} {moments.length === 1 ? 'moment' : 'moments'} · {counts.succeeded} transcribed
          {counts.failed > 0 ? ` · ${counts.failed} not recognised` : ''}
        </Text>

        {!providerConfigured && hasTranscript ? (
          <Card mode="outlined" style={styles.card}>
            <Card.Content>
              <Text variant="bodyMedium">
                No AI provider is configured, so nothing can be extracted from your transcript.
                You can still log this brew by hand.
              </Text>
              <Button
                mode="contained"
                style={styles.spacedButton}
                onPress={() => router.replace('/brew/new')}
                testID="review-manual"
              >
                Log by hand
              </Button>
            </Card.Content>
          </Card>
        ) : null}

        {parsed === null ? (
          <Card mode="outlined" style={styles.card}>
            <Card.Content>
              <Text variant="bodyMedium">
                {hasTranscript
                  ? 'Add a provider in Settings → AI provider to extract a record from this transcript. You can log it by hand instead.'
                  : 'Nothing could be transcribed from this session. You can still log the brew by hand.'}
              </Text>
              <Button
                mode="contained"
                style={styles.spacedButton}
                onPress={() => router.replace('/brew/new')}
                testID="review-manual"
              >
                Log by hand
              </Button>
            </Card.Content>
          </Card>
        ) : (
          <>
            <Card mode="outlined" style={styles.card}>
              <Card.Title title="Transcript" />
              <Card.Content>
                <TextInput
                  mode="outlined"
                  multiline
                  numberOfLines={5}
                  value={transcriptDraft}
                  onChangeText={setTranscriptDraft}
                  label="Spoken notes (editable)"
                  testID="review-transcript"
                />
                {transcriptText !== transcriptDraft.trim() ? (
                  <Button
                    mode="text"
                    icon="refresh"
                    onPress={handleReExtract}
                    loading={busy}
                    disabled={busy}
                    style={styles.spacedButton}
                    testID="review-re-extract"
                  >
                    Re-extract from edited transcript
                  </Button>
                ) : null}
              </Card.Content>
            </Card>

            <Card mode="outlined" style={styles.card}>
              <Card.Title
                title="Brew"
                subtitle={`${candidates.filter((c) => c.target === 'brew').length} details heard in your words`}
              />
              <Card.Content>
                <Text variant="labelMedium">Method</Text>
                <View style={styles.chipRow}>
                  {BREW_METHOD_IDS.filter(
                    (id) => availableMethodIds.includes(id) || id === edits?.methodId
                  ).map((id) => {
                    const method = methods.find((m) => m.id === id);
                    return (
                      <Chip
                        key={id}
                        selected={edits?.methodId === id}
                        onPress={() => setEdits((current) => (current ? { ...current, methodId: id } : current))}
                        style={styles.chip}
                        testID={`review-method-${id}`}
                      >
                        {method?.name ?? id}
                      </Chip>
                    );
                  })}
                </View>

                {beanMatch !== null ? (
                  <>
                    <Divider style={styles.divider} />
                    <Text variant="bodySmall">Bean</Text>
                    <Chip selected icon="check" style={styles.chip} testID="review-bean">
                      {beanMatch.name}
                    </Chip>
                  </>
                ) : null}

                {equipmentOptions.length > 0 ? (
                  <>
                    <Divider style={styles.divider} />
                    <Text variant="labelMedium">Also used</Text>
                    <View style={styles.chipRow}>
                      {equipmentOptions.map((brewer) => {
                        const selected = edits?.equipmentIds.includes(brewer.id) ?? false;
                        return (
                          <Chip
                            key={brewer.id}
                            selected={selected}
                            showSelectedCheck={false}
                            onPress={() =>
                              setEdits((current) => {
                                if (current === null) {
                                  return current;
                                }
                                const has = current.equipmentIds.includes(brewer.id);
                                return {
                                  ...current,
                                  equipmentIds: has
                                    ? current.equipmentIds.filter((id) => id !== brewer.id)
                                    : [...current.equipmentIds, brewer.id],
                                };
                              })
                            }
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: selected }}
                            accessibilityLabel={brewer.name}
                            style={styles.chip}
                            testID={`review-equipment-${brewer.id}`}
                          >
                            {brewer.name}
                          </Chip>
                        );
                      })}
                    </View>
                  </>
                ) : null}

                {parsed.notes !== null || edits?.notes !== undefined ? (
                  <>
                    <Divider style={styles.divider} />
                    <TextInput
                      mode="outlined"
                      multiline
                      numberOfLines={2}
                      label="Notes"
                      value={edits?.notes ?? ''}
                      onChangeText={(text) => setEdits((current) => (current ? { ...current, notes: text } : current))}
                      testID="review-brew-notes"
                    />
                  </>
                ) : null}

                {numericFields.length > 0 ? (
                  <>
                    <Divider style={styles.divider} />
                    {numericFields.map((field) => (
                      <View key={field.fieldPath} style={styles.field}>
                        <NumberField
                          label={field.label}
                          unit={field.unit}
                          value={field.value}
                          onChange={field.set}
                        />
                      </View>
                    ))}
                  </>
                ) : null}

                {parsed.steps.length > 0 ? (
                  <>
                    <Divider style={styles.divider} />
                    <Text variant="bodySmall">{parsed.steps.length} step{parsed.steps.length === 1 ? '' : 's'} will be saved.</Text>
                  </>
                ) : null}
              </Card.Content>
            </Card>

            <Card mode="outlined" style={styles.card}>
              <Card.Title
                title="Taste"
                subtitle={edits?.includeTasting ? 'A tasting will be saved with this brew' : 'No tasting will be saved'}
              />
              <Card.Content>
                <View style={styles.switchRow}>
                  <Text variant="bodyMedium">Log a tasting for this brew</Text>
                  <Switch
                    value={edits?.includeTasting ?? false}
                    onValueChange={(value) => setEdits((current) => (current ? { ...current, includeTasting: value } : current))}
                    testID="review-include-tasting"
                  />
                </View>

                {edits?.includeTasting ? (
                  <>
                    <Text variant="labelMedium" style={styles.sectionLabel}>
                      Overall
                    </Text>
                    <View style={styles.chipRow}>
                      {VERDICTS.map((verdict) => (
                        <Chip
                          key={verdict}
                          selected={edits.verdict === verdict}
                          onPress={() => setEdits({ ...edits, verdict })}
                          style={styles.chip}
                          testID={`review-verdict-${verdict}`}
                        >
                          {VERDICT_LABELS[verdict]}
                        </Chip>
                      ))}
                    </View>
                    <View style={styles.ratingRow}>
                      <RatingSelector
                        value={edits.overallRating}
                        onChange={(rating) => setEdits({ ...edits, overallRating: rating })}
                      />
                    </View>

                    <Text variant="labelMedium" style={styles.sectionLabel}>
                      Characteristics
                    </Text>
                    {(
                      [
                        ['attributeAcidity', 'Acidity'],
                        ['attributeSweetness', 'Sweetness'],
                        ['attributeBody', 'Body'],
                        ['attributeBitterness', 'Bitterness'],
                        ['attributeFinish', 'Finish'],
                      ] as const
                    ).map(([key, label]) => (
                      <View key={key} style={styles.attributeRow}>
                        <Text variant="bodySmall" style={styles.attributeLabel}>
                          {label}
                        </Text>
                        <View style={styles.chipRow}>
                          {ATTRIBUTE_LEVELS.map((level) => (
                            <Chip
                              key={level}
                              selected={edits[key] === level}
                              onPress={() => setEdits({ ...edits, [key]: level })}
                              style={styles.chip}
                              testID={`review-${key}-${level}`}
                            >
                              {ATTRIBUTE_LABELS[level]}
                            </Chip>
                          ))}
                        </View>
                      </View>
                    ))}

                    <Divider style={styles.divider} />
                    <TextInput
                      mode="outlined"
                      multiline
                      numberOfLines={2}
                      label="Tasting notes"
                      value={edits.tastingNotes}
                      onChangeText={(text) => setEdits({ ...edits, tastingNotes: text })}
                      testID="review-tasting-notes"
                    />
                  </>
                ) : null}
              </Card.Content>
            </Card>

            {questions.length > 0 ? (
              <Card mode="elevated" style={styles.card}>
                <Card.Title title="A few clarifying questions" subtitle="One round, up to three questions" />
                <Card.Content>
                  {questions.map((question) => (
                    <View key={question.id} style={styles.questionBlock}>
                      <Text variant="bodyMedium">{question.question}</Text>
                      {(() => {
                        const options = question.optionsJson ? (JSON.parse(question.optionsJson) as string[]) : [];
                        return options.length > 0 ? (
                          <View style={styles.chipRow}>
                            {options.map((option) => (
                              <Chip
                                key={option}
                                selected={answerDrafts[question.id] === option}
                                onPress={() =>
                                  setAnswerDrafts((current) => ({ ...current, [question.id]: option }))
                                }
                                style={styles.chip}
                              >
                                {option}
                              </Chip>
                            ))}
                          </View>
                        ) : null;
                      })()}
                      <TextInput
                        mode="outlined"
                        label="Your answer"
                        value={answerDrafts[question.id] ?? ''}
                        onChangeText={(text) => setAnswerDrafts((current) => ({ ...current, [question.id]: text }))}
                        style={styles.field}
                        testID={`review-answer-${question.id}`}
                      />
                    </View>
                  ))}
                  <Button
                    mode="contained-tonal"
                    icon="chat-question-outline"
                    onPress={handleAnswerQuestions}
                    loading={busy}
                    disabled={busy}
                    style={styles.spacedButton}
                    testID="review-answer-submit"
                  >
                    Use my answers
                  </Button>
                </Card.Content>
              </Card>
            ) : null}
          </>
        )}

        <Button
          mode="contained"
          icon="content-save-outline"
          onPress={() => {
            if (parsed !== null && activeRun !== null && edits !== null) {
              void commit(parsed, activeRun.id, false);
            } else if (parsed !== null && edits !== null) {
              void commit(parsed, null, false);
            } else if (hasTranscript) {
              setToast('Nothing to save yet — add a provider or log by hand');
            } else {
              setToast('Nothing was recorded to save');
            }
          }}
          loading={busy}
          disabled={busy || edits === null || session === null}
          style={styles.commitButton}
          testID="review-commit"
        >
          Save brew{edits?.includeTasting ? ' and tasting' : ''}
        </Button>

        <Button
          mode="text"
          icon="delete-outline"
          onPress={() => setConfirmDiscard(true)}
          style={styles.spacedButton}
          testID="review-discard"
        >
          Discard session
        </Button>

        <AppDialog visible={confirmDiscard} onDismiss={() => setConfirmDiscard(false)}>
          <AppDialog.Title>Discard this session?</AppDialog.Title>
          <AppDialog.Content>
            <Text variant="bodyMedium">
              The recordings and transcript are deleted. This cannot be undone.
            </Text>
          </AppDialog.Content>
          <AppDialog.Actions>
            <Button onPress={() => setConfirmDiscard(false)}>Keep it</Button>
            <Button onPress={handleDiscard} disabled={busy}>
              Discard
            </Button>
          </AppDialog.Actions>
        </AppDialog>

        <ScreenToast visible={toast !== null} message={toast} onDismiss={() => setToast(null)} duration={4000} />

        <Snackbar
          visible={undoState?.show ?? false}
          onDismiss={() => setUndoState(null)}
          duration={6000}
          action={{ label: 'Undo', onPress: handleUndo }}
        >
          Brew saved{edits?.includeTasting ? ' with tasting' : ''}.
        </Snackbar>
      </KeyboardAwareScrollView>
    </ScreenFade>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 48,
  },
  title: {
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 2,
    opacity: 0.7,
  },
  card: {
    marginTop: 16,
  },
  spacedButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    marginRight: 0,
  },
  divider: {
    marginVertical: 14,
  },
  field: {
    marginTop: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    marginTop: 14,
  },
  ratingRow: {
    marginTop: 8,
  },
  attributeRow: {
    marginTop: 8,
  },
  attributeLabel: {
    opacity: 0.8,
  },
  questionBlock: {
    marginBottom: 16,
  },
  commitButton: {
    marginTop: 24,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  pillar: {
    marginTop: 24,
  },
  pillarInner: {
    height: 4,
    width: 160,
    borderRadius: 2,
  },
});