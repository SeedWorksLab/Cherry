export const BREW_METHOD_IDS = [
  'v60',
  'chemex',
  'kalita',
  'french-press',
  'aeropress',
  'clever',
  'cold-brew',
  'espresso',
  'moka',
] as const;
export type BrewMethodId = (typeof BREW_METHOD_IDS)[number];

export const METHOD_FAMILIES = ['pour-over', 'immersion', 'pressure', 'cold'] as const;
export type MethodFamily = (typeof METHOD_FAMILIES)[number];

export const EQUIPMENT_KINDS = [
  'dripper',
  'kettle',
  'scale',
  'grinder',
  'press',
  'filter',
  'carafe',
  'portafilter',
  'moka',
  'cup',
  'other',
] as const;
export type EquipmentKind = (typeof EQUIPMENT_KINDS)[number];

export const BEAN_PROCESSES = [
  'washed',
  'natural',
  'honey',
  'anaerobic',
  'carbonic',
  'wet-hulled',
  'experimental',
  'unknown',
] as const;
export type BeanProcess = (typeof BEAN_PROCESSES)[number];

export const ROAST_LEVELS = [
  'light',
  'medium-light',
  'medium',
  'medium-dark',
  'dark',
  'unknown',
] as const;
export type RoastLevel = (typeof ROAST_LEVELS)[number];

export const GRIND_UNITS = ['clicks', 'setting', 'microns', 'notch', 'unknown'] as const;
export type GrindUnit = (typeof GRIND_UNITS)[number];

export const SCALE_MODES = ['timer', 'flow-rate', 'auto-tare', 'ratio', 'espresso'] as const;
export type ScaleMode = (typeof SCALE_MODES)[number];

export const STEP_KIND_IDS = [
  'dose',
  'grind',
  'rinse',
  'preheat',
  'fill_water',
  'fill_grounds',
  'add_water',
  'bloom',
  'pour',
  'stir',
  'swirl',
  'tap',
  'steep',
  'break_crust',
  'skim',
  'press',
  'assemble',
  'heat',
  'plate',
  'drain',
  'extract',
  'stop',
  'wait',
  'custom',
] as const;
export type StepKind = (typeof STEP_KIND_IDS)[number];

export const AGITATION_KINDS = ['stir', 'swirl', 'tap', 'none'] as const;
export type AgitationKind = (typeof AGITATION_KINDS)[number];

export const VOICE_PHASES = ['prep', 'brew', 'finish', 'taste', 'note'] as const;
export type VoicePhase = (typeof VOICE_PHASES)[number];

export const VOICE_SESSION_STATES = [
  'recording',
  'paused',
  'stopped',
  'transcribing',
  'extracting',
  'review',
  'committed',
  'discarded',
] as const;
export type VoiceSessionState = (typeof VOICE_SESSION_STATES)[number];

export const TRANSCRIPTION_ENGINES = ['openai-compatible', 'android', 'manual'] as const;
export type TranscriptionEngine = (typeof TRANSCRIPTION_ENGINES)[number];

export const TRANSCRIPT_STATUSES = ['pending', 'succeeded', 'failed', 'skipped'] as const;
export type TranscriptStatus = (typeof TRANSCRIPT_STATUSES)[number];

export const EXTRACTION_RUN_KINDS = ['extraction', 'narration', 'insight', 'assistance'] as const;
export type ExtractionRunKind = (typeof EXTRACTION_RUN_KINDS)[number];

export const EXTRACTION_RUN_STATUSES = ['pending', 'succeeded', 'failed'] as const;
export type ExtractionRunStatus = (typeof EXTRACTION_RUN_STATUSES)[number];

export const EXTRACTION_TARGETS = ['brew', 'tasting', 'session'] as const;
export type ExtractionTarget = (typeof EXTRACTION_TARGETS)[number];

export const PROVENANCE_SOURCES = ['automated', 'manual', 'assistant'] as const;
export type ProvenanceSource = (typeof PROVENANCE_SOURCES)[number];

export const PLAN_STATUSES = ['planned', 'active', 'brewed', 'abandoned'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const RECIPE_SOURCES = ['builtin', 'own', 'recommendation'] as const;
export type RecipeSource = (typeof RECIPE_SOURCES)[number];

export const RECOMMENDATION_MODES = ['safe', 'curious', 'adventurous'] as const;
export type RecommendationMode = (typeof RECOMMENDATION_MODES)[number];

export const RECOMMENDATION_STATUSES = [
  'proposed',
  'accepted',
  'declined',
  'brewed',
  'superseded',
  'expired',
] as const;
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

export const FLAW_SOURCES = ['canonical', 'history', 'assistance'] as const;
export type FlawSource = (typeof FLAW_SOURCES)[number];

export const VERDICTS = ['liked', 'disliked', 'unsure'] as const;
export type Verdict = (typeof VERDICTS)[number];

export const ATTRIBUTE_LEVELS = ['low', 'medium', 'high'] as const;
export type AttributeLevel = (typeof ATTRIBUTE_LEVELS)[number];

export const FLAVOUR_CATEGORIES = [
  'fruit',
  'floral',
  'sweet',
  'nutty_cocoa',
  'spice',
  'roasted',
  'green_vegetative',
  'sour_fermented',
  'chemical',
  'other',
] as const;
export type FlavourCategory = (typeof FLAVOUR_CATEGORIES)[number];

export const AUDIO_RETENTION_POLICIES = [
  'keep',
  'delete-after-commit',
  'delete-after-transcribe',
] as const;
export type AudioRetentionPolicy = (typeof AUDIO_RETENTION_POLICIES)[number];

export const REMINDER_KINDS = ['bean_freshness', 'low_bean', 'unlogged_session'] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

export const THEME_MODES = ['light', 'dark', 'system'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export interface Settings {
  themeMode: ThemeMode;
  defaultMethodId: BrewMethodId | null;
  audioRetention: AudioRetentionPolicy;
  sessionResumeThresholdMinutes: number;
  notificationsEnabled: boolean;
  unloggedSessionPromptMinutes: number;
  beanFreshnessWarningDays: number;
  lowBeanThresholdG: number;
  tutorialSeen: boolean;
  lastSeenRelease: string | null;
  aiAutoAccept: boolean;
}

export interface AiState {
  llmBaseUrl: string | null;
  llmApiKey: string | null;
  llmModel: string | null;
  sttEngine: TranscriptionEngine;
  sttBaseUrl: string | null;
  sttApiKey: string | null;
  sttModel: string | null;
  sttLanguage: string | null;
  enabled: boolean;
  lastError: string | null;
}

export interface Method {
  id: BrewMethodId;
  name: string;
  family: MethodFamily;
  brewerKind: EquipmentKind | null;
  supportsPressure: boolean;
  supportsGrinder: boolean;
  defaultStepTemplate: string | null;
  sortOrder: number;
}

export interface HealthyRange {
  min: number | null;
  max: number | null;
}

export interface MethodHealthyRanges {
  doseG: HealthyRange;
  ratio: HealthyRange;
  waterTempC: HealthyRange;
  totalTimeS: HealthyRange;
  bloomWaterRatio: HealthyRange | null;
  bloomWaitS: HealthyRange | null;
  pourCount: HealthyRange | null;
}

export interface MethodGuide {
  methodId: BrewMethodId;
  summary: string;
  technique: readonly string[];
  healthy: MethodHealthyRanges;
  requiredStepKinds: readonly StepKind[];
  canonicalRecipeName: string;
}

export interface FlavourTag {
  id: string;
  name: string;
  category: FlavourCategory;
  isSeeded: boolean;
  sortOrder: number;
}

export interface Roaster {
  id: number;
  uuid: string | null;
  name: string;
  location: string | null;
  url: string | null;
  notes: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
  deleted: boolean;
}

export interface Bean {
  id: number;
  uuid: string | null;
  name: string;
  roasterId: number | null;
  originCountry: string | null;
  originRegion: string | null;
  farm: string | null;
  producer: string | null;
  varietal: string | null;
  process: BeanProcess | null;
  altitudeM: number | null;
  roastLevel: RoastLevel | null;
  roastDate: string | null;
  purchasedDate: string | null;
  openedDate: string | null;
  finishedDate: string | null;
  bagWeightG: number | null;
  remainingWeightG: number | null;
  priceCents: number | null;
  currency: string | null;
  notes: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
  deleted: boolean;
}

export interface Equipment {
  id: number;
  uuid: string | null;
  name: string;
  kind: EquipmentKind;
  methodId: BrewMethodId | null;
  manufacturer: string | null;
  model: string | null;
  capacityMl: number | null;
  material: string | null;
  notes: string | null;
  scalePrecisionG: number | null;
  scaleCapacityG: number | null;
  scaleModes: ScaleMode[] | null;
  grinderClicksPerRevolution: number | null;
  grinderMicronPerClick: number | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
  deleted: boolean;
}

export interface GrindSetting {
  id: number;
  uuid: string | null;
  brewerId: number;
  name: string;
  selectionLabel: string | null;
  stepCount: number | null;
  isZeroBased: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
  deleted: boolean;
}

export interface Step {
  id: number;
  uuid: string | null;
  stepIndex: number;
  kind: StepKind | null;
  label: string | null;
  targetWaterG: number | null;
  pourWaterG: number | null;
  pourDurationS: number | null;
  waitAfterS: number | null;
  agitationCount: number | null;
  agitationKind: AgitationKind | null;
  temperatureC: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface RecipeStep extends Step {
  recipeId: number;
}

export interface PlanStep extends Step {
  planId: number;
}

export interface BrewStep extends Step {
  brewId: number;
}

export interface Recipe {
  id: number;
  uuid: string | null;
  name: string;
  methodId: BrewMethodId;
  brewerId: number | null;
  beanId: number | null;
  source: RecipeSource;
  parentRecipeId: number | null;
  isBuiltin: boolean;
  doseG: number | null;
  waterTotalG: number | null;
  waterTempC: number | null;
  grinderId: number | null;
  grindSettingId: number | null;
  grindValue: number | null;
  grindUnit: GrindUnit | null;
  expectedTotalTimeS: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
  deleted: boolean;
}

export interface Plan {
  id: number;
  uuid: string | null;
  name: string | null;
  methodId: BrewMethodId;
  brewerId: number | null;
  beanId: number | null;
  recipeId: number | null;
  recommendationId: number | null;
  status: PlanStatus;
  targetDate: string | null;
  doseG: number | null;
  waterTotalG: number | null;
  waterTempC: number | null;
  grinderId: number | null;
  grindSettingId: number | null;
  grindValue: number | null;
  grindUnit: GrindUnit | null;
  expectedTotalTimeS: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
  deleted: boolean;
}

export interface PlanEvent {
  id: number;
  uuid: string | null;
  planId: number;
  kind: string;
  field: string | null;
  previousValue: string | null;
  newValue: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface Recommendation {
  id: number;
  uuid: string | null;
  methodId: BrewMethodId | null;
  baseBrewId: number | null;
  baseRecipeId: number | null;
  mode: RecommendationMode;
  status: RecommendationStatus;
  proposedJson: string | null;
  rationaleJson: string | null;
  narrative: string | null;
  flawFirst: boolean;
  flawSource: FlawSource | null;
  declinedReason: string | null;
  plannedForDate: string | null;
  createdAt: string;
  updatedAt: string | null;
  deleted: boolean;
}

export interface RecommendationDiff {
  id: number;
  uuid: string | null;
  recommendationId: number;
  knob: string;
  currentValue: string | null;
  proposedValue: string | null;
  sensitivity: number | null;
  confidence: number | null;
  n: number | null;
  reason: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface VoiceSession {
  id: number;
  uuid: string | null;
  brewId: number | null;
  planId: number | null;
  state: VoiceSessionState;
  startedAt: string;
  endedAt: string | null;
  defaultPhase: VoicePhase | null;
  engine: TranscriptionEngine | null;
  language: string | null;
  createdAt: string;
  updatedAt: string | null;
  deleted: boolean;
}

export interface VoiceMoment {
  id: number;
  uuid: string | null;
  sessionId: number;
  phase: VoicePhase | null;
  startOffsetMs: number;
  durationMs: number | null;
  audioPath: string | null;
  transcript: string | null;
  transcriptConfidence: number | null;
  transcriptEngine: string | null;
  transcriptStatus: TranscriptStatus | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface PhaseMarker {
  id: number;
  uuid: string | null;
  sessionId: number;
  phase: VoicePhase;
  offsetMs: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface ExtractionRun {
  id: number;
  uuid: string | null;
  sessionId: number | null;
  brewId: number | null;
  kind: ExtractionRunKind;
  promptId: string | null;
  promptVersion: string | null;
  model: string | null;
  status: ExtractionRunStatus;
  requestSummary: string | null;
  responseJson: string | null;
  error: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costEstimateCents: number | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface ExtractionResult {
  id: number;
  uuid: string | null;
  runId: number;
  target: ExtractionTarget | null;
  targetId: number | null;
  fieldPath: string;
  valueJson: string | null;
  confidence: number | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface ExtractionQuestion {
  id: number;
  uuid: string | null;
  runId: number;
  fieldPath: string;
  question: string;
  optionsJson: string | null;
  answer: string | null;
  answeredAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface ExtractionProvenance {
  id: number;
  uuid: string | null;
  runId: number;
  target: ExtractionTarget | null;
  targetId: number | null;
  fieldPath: string;
  source: ProvenanceSource;
  accepted: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface Brew {
  id: number;
  uuid: string | null;
  methodId: BrewMethodId;
  brewerId: number | null;
  beanId: number | null;
  planId: number | null;
  recommendationId: number | null;
  voiceSessionId: number | null;
  brewDate: string;
  startedAt: string | null;
  endedAt: string | null;
  doseG: number | null;
  waterTotalG: number | null;
  waterTempC: number | null;
  yieldG: number | null;
  grinderId: number | null;
  grindSettingId: number | null;
  grindValue: number | null;
  grindUnit: GrindUnit | null;
  totalTimeS: number | null;
  beanNameSnapshot: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
  deleted: boolean;
}

export interface BrewEquipment {
  id: number;
  uuid: string | null;
  brewId: number;
  brewerId: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface Tasting {
  id: number;
  uuid: string | null;
  brewId: number;
  verdict: Verdict | null;
  overallRating: number | null;
  tastedAt: string | null;
  temperatureC: number | null;
  attributeAcidity: AttributeLevel | null;
  attributeSweetness: AttributeLevel | null;
  attributeBody: AttributeLevel | null;
  attributeBitterness: AttributeLevel | null;
  attributeFinish: AttributeLevel | null;
  scaAroma: number | null;
  scaFlavour: number | null;
  scaAftertaste: number | null;
  scaAcidity: number | null;
  scaBody: number | null;
  scaBalance: number | null;
  scaUniformity: number | null;
  scaCleanCup: number | null;
  scaSweetness: number | null;
  scaOverall: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string | null;
  deleted: boolean;
}

export interface TastingFlavourTag {
  id: number;
  uuid: string | null;
  tastingId: number;
  tagId: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface Insight {
  id: number;
  uuid: string | null;
  kind: string;
  scope: string | null;
  title: string | null;
  body: string | null;
  score: number | null;
  confidence: number | null;
  evidenceJson: string | null;
  dismissed: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface Reminder {
  id: number;
  uuid: string | null;
  kind: ReminderKind;
  beanId: number | null;
  brewId: number | null;
  dueAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}
