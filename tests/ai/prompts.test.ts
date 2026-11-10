import {
  buildExtractionMessages,
  EMPTY_EXTRACTION_CONTEXT,
  EXTRACTION_FOLLOWUP_PROMPT_VERSION,
  EXTRACTION_PROMPT_ID,
  EXTRACTION_PROMPT_VERSION,
} from '../../src/ai/prompts';
import type { ExtractionContext } from '../../src/ai/prompts';

const CONTEXT: ExtractionContext = {
  methods: ['v60'],
  beans: ['Kenya Nyeri'],
  brewers: ['V60 02'],
  grinders: ['Comandante'],
  equipment: ['Timemore scale'],
  grindSettings: ['22 clicks'],
  flavourTags: ['Blackcurrant'],
  languageHint: 'en',
};

describe('prompt versioning', () => {
  it('exposes a stable id and version', () => {
    expect(EXTRACTION_PROMPT_ID).toBe('extraction');
    expect(EXTRACTION_PROMPT_VERSION).toBe('3');
    expect(EXTRACTION_FOLLOWUP_PROMPT_VERSION).toBe('3-followup');
  });
});

describe('buildExtractionMessages', () => {
  it('produces a system and a user message', () => {
    const messages = buildExtractionMessages({
      transcript: 'fifteen grams',
      context: CONTEXT,
      knownBrew: null,
      answers: [],
      followUp: false,
    });
    expect(messages.map((message) => message.role)).toEqual(['system', 'user']);
  });

  it('includes the catalogue and the transcript', () => {
    const user = buildExtractionMessages({
      transcript: 'fifteen grams to two fifty',
      context: CONTEXT,
      knownBrew: null,
      answers: [],
      followUp: false,
    })[1].content;

    expect(user).toContain('Kenya Nyeri');
    expect(user).toContain('Timemore scale');
    expect(user).toContain('equipment_names');
    expect(user).toContain('fifteen grams to two fifty');
    expect(user).toContain('This is a new brew');
  });

  it('lists clarifying answers on a follow-up', () => {
    const user = buildExtractionMessages({
      transcript: 'fifteen grams',
      context: CONTEXT,
      knownBrew: 'dose 15 g',
      answers: [{ fieldPath: 'water_temp_c', question: 'temp?', answer: '93' }],
      followUp: true,
    })[1].content;

    expect(user).toContain('water_temp_c: 93');
    expect(user).toContain('The brew already on the record');
  });

  it('notes an empty catalogue', () => {
    const user = buildExtractionMessages({
      transcript: 'hello',
      context: EMPTY_EXTRACTION_CONTEXT,
      knownBrew: null,
      answers: [],
      followUp: false,
    })[1].content;
    expect(user).toContain('(none saved yet)');
  });
});
