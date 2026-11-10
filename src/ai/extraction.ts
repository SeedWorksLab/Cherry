import {
  asNumber,
  asText,
  brewMethodId,
  emptyParsedExtraction,
  ratingOneToFive,
  attributeLevel,
  verdict,
} from './schemas';
import type {
  ClarifyingQuestionAnswer,
  ExtractionCandidate,
  ParsedExtraction,
  StepCandidate,
} from './schemas';
import {
  buildExtractionMessages,
  EXTRACTION_PROMPT_VERSION,
} from './prompts';
import type { ExtractionContext } from './prompts';
import type { AiProvider, TokenUsage } from './provider';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function strList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string').slice(0, 12);
}

function stepList(value: unknown): StepCandidate[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(isPlainObject)
    .slice(0, 30)
    .map((step) => ({
      kind: asText(step.kind),
      label: asText(step.label),
      targetWaterG: asNumber(step.target_water_g),
      pourDurationS: asNumber(step.pour_duration_s),
      waitAfterS: asNumber(step.wait_after_s),
      temperatureC: asNumber(step.temperature_c),
      note: asText(step.note),
    }));
}

function questionList(value: unknown): ParsedExtraction['questions'] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(isPlainObject)
    .slice(0, 3)
    .map((question) => ({
      fieldPath: asText(question.field_path) ?? 'notes',
      question: asText(question.question) ?? 'Could you clarify that?',
      options: strList(question.options).slice(0, 4),
    }));
}

/** Pulls the outermost JSON object out of whatever the model wrapped it in. */
export function extractJsonObject(text: string): unknown {
  let trimmed = text.trim();
  trimmed = trimmed.replace(/^```(?:json)?\s*/i, '');
  trimmed = trimmed.replace(/\s*```$/i, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to brace scanning
  }
  const start = trimmed.indexOf('{');
  if (start === -1) {
    return null;
  }
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(trimmed.slice(start, index + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export function parseExtractionJson(text: string): ParsedExtraction | null {
  const raw = extractJsonObject(text);
  if (!isPlainObject(raw)) {
    return null;
  }

  const tasting = isPlainObject(raw.tasting) ? raw.tasting : {};
  const parsed = emptyParsedExtraction(EXTRACTION_PROMPT_VERSION);
  const lowConfidence = strList(raw.low_confidence);

  parsed.methodId = brewMethodId(raw.method_id);
  parsed.beanName = asText(raw.bean_name);
  parsed.brewerName = asText(raw.brewer_name);
  parsed.grinderName = asText(raw.grinder_name);
  parsed.equipmentNames = strList(raw.equipment_names);
  parsed.grindSettingName = asText(raw.grind_setting_name);
  parsed.doseG = asNumber(raw.dose_g);
  parsed.waterTotalG = asNumber(raw.water_total_g);
  parsed.waterTempC = asNumber(raw.water_temp_c);
  parsed.yieldG = asNumber(raw.yield_g);
  parsed.totalTimeS = asNumber(raw.total_time_s);
  parsed.notes = asText(raw.notes);
  parsed.steps = stepList(raw.steps);
  parsed.verdict = verdict(tasting.verdict);
  parsed.overallRating = ratingOneToFive(tasting.overall_rating);
  parsed.attributeAcidity = attributeLevel(tasting.attribute_acidity);
  parsed.attributeSweetness = attributeLevel(tasting.attribute_sweetness);
  parsed.attributeBody = attributeLevel(tasting.attribute_body);
  parsed.attributeBitterness = attributeLevel(tasting.attribute_bitterness);
  parsed.attributeFinish = attributeLevel(tasting.attribute_finish);
  parsed.flavourTags = strList(tasting.flavour_tags);
  parsed.tastingNotes = asText(tasting.notes);
  parsed.questions = questionList(raw.questions);
  parsed.lowConfidence = lowConfidence;

  return parsed;
}

export interface BrewCandidate {
  fieldPath: string;
  label: string;
  value: string | number | boolean | null;
}

const BREW_CANDIDATE_DEFS: { fieldPath: string; label: string; pick(p: ParsedExtraction): string | number | boolean | null }[] = [
  { fieldPath: 'method_id', label: 'Method', pick: (p) => p.methodId },
  { fieldPath: 'bean_name', label: 'Bean', pick: (p) => p.beanName },
  { fieldPath: 'brewer_name', label: 'Brewer', pick: (p) => p.brewerName },
  { fieldPath: 'grinder_name', label: 'Grinder', pick: (p) => p.grinderName },
  { fieldPath: 'equipment_names', label: 'Equipment', pick: (p) => (p.equipmentNames.length ? p.equipmentNames.join(', ') : null) },
  { fieldPath: 'grind_setting_name', label: 'Grind setting', pick: (p) => p.grindSettingName },
  { fieldPath: 'dose_g', label: 'Dose', pick: (p) => p.doseG },
  { fieldPath: 'water_total_g', label: 'Water', pick: (p) => p.waterTotalG },
  { fieldPath: 'water_temp_c', label: 'Temperature', pick: (p) => p.waterTempC },
  { fieldPath: 'yield_g', label: 'Yield', pick: (p) => p.yieldG },
  { fieldPath: 'total_time_s', label: 'Total time', pick: (p) => p.totalTimeS },
  { fieldPath: 'notes', label: 'Notes', pick: (p) => p.notes },
];

const TASTING_CANDIDATE_DEFS: { fieldPath: string; label: string; pick(p: ParsedExtraction): string | number | boolean | null }[] = [
  { fieldPath: 'verdict', label: 'Verdict', pick: (p) => p.verdict },
  { fieldPath: 'overall_rating', label: 'Rating', pick: (p) => p.overallRating },
  { fieldPath: 'attribute_acidity', label: 'Acidity', pick: (p) => p.attributeAcidity },
  { fieldPath: 'attribute_sweetness', label: 'Sweetness', pick: (p) => p.attributeSweetness },
  { fieldPath: 'attribute_body', label: 'Body', pick: (p) => p.attributeBody },
  { fieldPath: 'attribute_bitterness', label: 'Bitterness', pick: (p) => p.attributeBitterness },
  { fieldPath: 'attribute_finish', label: 'Finish', pick: (p) => p.attributeFinish },
  { fieldPath: 'flavour_tags', label: 'Flavours', pick: (p) => (p.flavourTags.length ? p.flavourTags.join(', ') : null) },
  { fieldPath: 'notes', label: 'Notes', pick: (p) => p.tastingNotes },
];

function present(p: ParsedExtraction, def: (typeof BREW_CANDIDATE_DEFS)[number]): ExtractionCandidate | null {
  const value = def.pick(p);
  if (value === null) {
    return null;
  }
  return {
    target: 'brew',
    fieldPath: def.fieldPath,
    label: def.label,
    value,
    humanValue: String(value),
  };
}

export function brewCandidates(parsed: ParsedExtraction): ExtractionCandidate[] {
  const seen = new Set<string>();
  const candidates: ExtractionCandidate[] = [];
  for (const def of BREW_CANDIDATE_DEFS) {
    if (seen.has(def.fieldPath)) {
      continue;
    }
    seen.add(def.fieldPath);
    const candidate = present(parsed, def);
    if (candidate) {
      candidates.push(candidate);
    }
  }
  return candidates;
}

export function tastingCandidates(parsed: ParsedExtraction): ExtractionCandidate[] {
  const candidates: ExtractionCandidate[] = [];
  for (const def of TASTING_CANDIDATE_DEFS) {
    const picked = def.pick(parsed);
    if (picked === null) {
      continue;
    }
    candidates.push({
      target: 'tasting',
      fieldPath: def.fieldPath,
      label: def.label,
      value: picked,
      humanValue: String(picked),
    });
  }
  return candidates;
}

export interface EntityMatch {
  entityId: number;
  name: string;
}

export function matchCatalogue(items: EntityMatch[], spokenName: string): EntityMatch | null {
  const query = spokenName.trim().toLowerCase();
  if (query === '') {
    return null;
  }
  const exact = items.find((item) => item.name.toLowerCase() === query);
  if (exact) {
    return exact;
  }
  const normalized = query.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const best = items.reduce<{ item: EntityMatch | null; score: number }>(
    (acc, item) => {
      const candidate = item.name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ');
      if (candidate.includes(normalized) || normalized.includes(candidate)) {
        const score = Math.abs(candidate.length - normalized.length);
        if (score < acc.score) {
          return { item, score };
        }
      }
      return acc;
    },
    { item: null, score: Number.POSITIVE_INFINITY }
  );
  return best.item;
}

export interface ResolvedExtraction {
  parsed: ParsedExtraction;
  bean: EntityMatch | null;
  brewer: EntityMatch | null;
  grinder: EntityMatch | null;
  equipment: EntityMatch[];
  grindSetting: EntityMatch | null;
  matchedMethodName: string | null;
  flavourTagIds: string[];
  unmatchedFlavourTags: string[];
}

export function resolveExtractionNames(parsed: ParsedExtraction, context: ExtractionContext): ResolvedExtraction {
  const beans: EntityMatch[] = context.beans.map((name, index) => ({ entityId: index + 1, name }));
  const brewers: EntityMatch[] = context.brewers.map((name, index) => ({ entityId: index + 1, name }));
  const grinders: EntityMatch[] = context.grinders.map((name, index) => ({ entityId: index + 1, name }));
  const equipment: EntityMatch[] = context.equipment.map((name, index) => ({ entityId: index + 1, name }));
  const grindSettings: EntityMatch[] = context.grindSettings.map((name, index) => ({ entityId: index + 1, name }));

  const flavourTagSet = new Set(context.flavourTags.map((tag) => tag.toLowerCase()));
  const flavourTagIds = parsed.flavourTags
    .filter((tag) => flavourTagSet.has(tag.toLowerCase()))
    .map((tag) => context.flavourTags[context.flavourTags.findIndex((known) => known.toLowerCase() === tag.toLowerCase())]);

  const claimed = new Set(
    [parsed.brewerName, parsed.grinderName]
      .filter((name): name is string => name !== null)
      .map((name) => name.toLowerCase())
  );

  return {
    parsed,
    bean: parsed.beanName === null ? null : matchCatalogue(beans, parsed.beanName),
    brewer: parsed.brewerName === null ? null : matchCatalogue(brewers, parsed.brewerName),
    grinder: parsed.grinderName === null ? null : matchCatalogue(grinders, parsed.grinderName),
    equipment: parsed.equipmentNames
      .map((name) => matchCatalogue(equipment, name))
      .filter((match): match is EntityMatch => match !== null && !claimed.has(match.name.toLowerCase())),
    grindSetting: parsed.grindSettingName === null
      ? null
      : matchCatalogue(grindSettings, parsed.grindSettingName),
    matchedMethodName:
      parsed.methodId === null ? null : context.methods.find((name) => name === parsed.methodId) ?? parsed.methodId,
    flavourTagIds,
    unmatchedFlavourTags: parsed.flavourTags.filter((tag) => !flavourTagSet.has(tag.toLowerCase())),
  };
}

export interface RunExtractionOptions {
  provider: AiProvider;
  model: string;
  transcript: string;
  context: ExtractionContext;
  knownBrew?: string | null;
  answers?: ClarifyingQuestionAnswer[];
}

export interface ExtractionOutcome {
  text: string;
  parsed: ParsedExtraction;
  usage: TokenUsage | null;
}

/** One network operation; the run's audit row is the caller's job (idea.txt §17). */
export async function runExtraction(options: RunExtractionOptions): Promise<ExtractionOutcome> {
  const answers = options.answers ?? [];
  const followUp = answers.length > 0;
  const messages = buildExtractionMessages({
    transcript: options.transcript,
    context: options.context,
    knownBrew: options.knownBrew ?? null,
    answers,
    followUp,
  });
  const result = await options.provider.chat(messages, {
    model: options.model,
    temperature: 0.2,
    maxTokens: 1500,
    json: true,
  });
  const parsed = parseExtractionJson(result.text);
  if (parsed === null) {
    throw new Error('The provider response could not be read as a record.');
  }
  return { text: result.text, parsed, usage: result.usage };
}