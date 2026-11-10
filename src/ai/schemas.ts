import { ATTRIBUTE_LEVELS, BREW_METHOD_IDS, VERDICTS } from '../models';
import type { AttributeLevel, BrewMethodId, Verdict } from '../models';

export function attributeLevel(value: unknown): AttributeLevel | null {
  return (ATTRIBUTE_LEVELS as readonly string[]).includes(value as string)
    ? (value as AttributeLevel)
    : null;
}

export function verdict(value: unknown): Verdict | null {
  return (VERDICTS as readonly string[]).includes(value as string)
    ? (value as Verdict)
    : null;
}

export function brewMethodId(value: unknown): BrewMethodId | null {
  return (BREW_METHOD_IDS as readonly string[]).includes(value as string)
    ? (value as BrewMethodId)
    : null;
}

/** Coerces a value the model produced into a finite number, or null. */
export function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim().replace(/g|g\/l|ml|c|°c|°$/gi, ''));
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

export function asText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }
  return null;
}

export function ratingOneToFive(value: unknown): number | null {
  const number = asNumber(value);
  return number !== null && number >= 1 && number <= 5 ? Math.round(number) : null;
}

/** The property-by-property extraction contract shown to the model. */
export function extractionSchemaJson(): Record<string, unknown> {
  return {
    method_id: 'string one of ' + BREW_METHOD_IDS.join(', ') + ' or null',
    bean_name: 'string or null',
    brewer_name: 'string or null',
    grinder_name: 'string or null',
    equipment_names: ['names of any other gear used (a scale, kettle, filter, cups)'],
    grind_setting_name: 'string or null',
    dose_g: 'number or null',
    water_total_g: 'number or null',
    water_temp_c: 'number or null',
    yield_g: 'number or null',
    total_time_s: 'number or null',
    notes: 'string or null',
    steps: [
      {
        kind: 'step kind string or null',
        label: 'short label string or null',
        target_water_g: 'number or null',
        pour_duration_s: 'number or null',
        wait_after_s: 'number or null',
        temperature_c: 'number or null',
        note: 'string or null',
      },
    ],
    tasting: {
      verdict: 'one of ' + VERDICTS.join(', ') + ' or null',
      overall_rating: 'integer 1..5 or null',
      attribute_acidity: 'one of ' + ATTRIBUTE_LEVELS.join(', ') + ' or null',
      attribute_sweetness: 'one of ' + ATTRIBUTE_LEVELS.join(', ') + ' or null',
      attribute_body: 'one of ' + ATTRIBUTE_LEVELS.join(', ') + ' or null',
      attribute_bitterness: 'one of ' + ATTRIBUTE_LEVELS.join(', ') + ' or null',
      attribute_finish: 'one of ' + ATTRIBUTE_LEVELS.join(', ') + ' or null',
      flavour_tags: ['flavour tag strings you heard spoken'],
      notes: 'string or null',
    },
    questions: [
      {
        field_path: "the JSON property this question fills, e.g. 'dose_g'",
        question: 'a short clarifying question in one sentence',
        options: ['2 to 4 short candidate answers'],
      },
    ],
    low_confidence: ['property paths you are unsure about or that the user did not say'],
  };
}

/**
 * A candidate value that still needs to be matched, validated and accepted
 * before it is allowed onto a record. Candidates are never the record itself;
 * the review screen and the service layer dispose.
 */
export interface ExtractionCandidate {
  target: 'brew' | 'tasting';
  fieldPath: string;
  label: string;
  value: string | number | boolean | null;
  humanValue: string;
}

export interface StepCandidate {
  kind: string | null;
  label: string | null;
  targetWaterG: number | null;
  pourDurationS: number | null;
  waitAfterS: number | null;
  temperatureC: number | null;
  note: string | null;
}

/** The sanitised, validated shape of one extraction response. */
export interface ParsedExtraction {
  promptVersion: string;
  methodId: BrewMethodId | null;
  beanName: string | null;
  brewerName: string | null;
  grinderName: string | null;
  equipmentNames: string[];
  grindSettingName: string | null;
  doseG: number | null;
  waterTotalG: number | null;
  waterTempC: number | null;
  yieldG: number | null;
  totalTimeS: number | null;
  notes: string | null;
  steps: StepCandidate[];
  verdict: Verdict | null;
  overallRating: number | null;
  attributeAcidity: AttributeLevel | null;
  attributeSweetness: AttributeLevel | null;
  attributeBody: AttributeLevel | null;
  attributeBitterness: AttributeLevel | null;
  attributeFinish: AttributeLevel | null;
  flavourTags: string[];
  tastingNotes: string | null;
  questions: { fieldPath: string; question: string; options: string[] }[];
  lowConfidence: string[];
}

export interface ClarifyingQuestionAnswer {
  fieldPath: string;
  question: string;
  answer: string;
}

export function emptyParsedExtraction(promptVersion: string): ParsedExtraction {
  return {
    promptVersion,
    methodId: null,
    beanName: null,
    brewerName: null,
    grinderName: null,
    equipmentNames: [],
    grindSettingName: null,
    doseG: null,
    waterTotalG: null,
    waterTempC: null,
    yieldG: null,
    totalTimeS: null,
    notes: null,
    steps: [],
    verdict: null,
    overallRating: null,
    attributeAcidity: null,
    attributeSweetness: null,
    attributeBody: null,
    attributeBitterness: null,
    attributeFinish: null,
    flavourTags: [],
    tastingNotes: null,
    questions: [],
    lowConfidence: [],
  };
}