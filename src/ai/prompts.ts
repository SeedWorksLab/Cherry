import type { ChatMessage } from './provider';
import { extractionSchemaJson } from './schemas';
import type { ClarifyingQuestionAnswer } from './schemas';
import { summarizeText } from './provider';

export const EXTRACTION_PROMPT_ID = 'extraction';
export const EXTRACTION_PROMPT_VERSION = '3';
export const EXTRACTION_FOLLOWUP_PROMPT_VERSION = '3-followup';

export interface ExtractionContext {
  methods: string[];
  beans: string[];
  brewers: string[];
  grinders: string[];
  equipment: string[];
  grindSettings: string[];
  flavourTags: string[];
  languageHint: string | null;
}

export const EMPTY_EXTRACTION_CONTEXT: ExtractionContext = {
  methods: [],
  beans: [],
  brewers: [],
  grinders: [],
  equipment: [],
  grindSettings: [],
  flavourTags: [],
  languageHint: null,
};

export interface ExtractionRequestInput {
  transcript: string;
  context: ExtractionContext;
  knownBrew: string | null;
  answers: ClarifyingQuestionAnswer[];
  followUp: boolean;
}

function catalogueLine(label: string, items: string[]): string {
  return items.length === 0 ? `${label}: (none saved yet)` : `${label}: ${items.join(', ')}`;
}

function roleInstruction(followUp: boolean): string {
  return followUp
    ? `The user answered clarifying questions after your first attempt. Incorporate every answer and return the full object again.`
    : `Extract a coffee journal entry from the transcript.`;
}

/**
 * The versioned extraction prompt. The prompt version is recorded on the
 * extraction_run so any future change is traceable (idea.txt §5.3).
 */
export function buildExtractionMessages(input: ExtractionRequestInput): ChatMessage[] {
  const schemaJson = JSON.stringify(extractionSchemaJson(), null, 2);
  const { context } = input;

  const user = [
    roleInstruction(input.followUp),
    '',
    'Return ONLY a single JSON object. No markdown fences, no prose, no comments.',
    'Leave a property null when it was not spoken and cannot be inferred. Only fill fields you are confident about; put anything uncertain into low_confidence.',
    'Ask for a missing essential detail with a question (up to 3) rather than guessing.',
    'The transcript is one continuous recording of a brew. It mixes setup, the pour, the finish and the tasting in whatever order they were spoken; read each sentence on its own sense to decide what it describes.',
    'Name equipment from the catalogue: the brewing vessel in brewer_name, the grinder in grinder_name, and any other gear you heard (a scale, kettle, filter, cups) in equipment_names.',
    '',
    'The object shape you must obey (every key optional, value types as shown):',
    '```json',
    schemaJson,
    '```',
    '',
    'Your catalogue:',
    catalogueLine('Methods', context.methods),
    catalogueLine('Beans', context.beans),
    catalogueLine('Brewers', context.brewers),
    catalogueLine('Grinders', context.grinders),
    catalogueLine('Other equipment', context.equipment),
    catalogueLine('Grind settings', context.grindSettings),
    catalogueLine('Flavour tags', context.flavourTags),
    '',
    input.knownBrew === null
      ? 'This is a new brew; nothing is known yet.'
      : `The brew already on the record:\n${input.knownBrew}`,
    input.answers.length > 0
      ? [
          '',
          'Clarifying answers you must use:',
          ...input.answers.map((answer) => `- ${answer.fieldPath}: ${answer.answer}`),
        ].join('\n')
      : '',
    '',
    'Transcript (numbers are as spoken unless a unit was given):',
    '```',
    summarizeText(input.transcript, 18_000),
    '```',
  ].join('\n');

  return [
    {
      role: 'system',
      content:
        'You are the extraction step of an offline-first voice coffee journal. ' +
        'You never invent facts, never write to storage, and your output is always treated ' +
        'as a candidate for the user to confirm.',
    },
    { role: 'user', content: user },
  ];
}