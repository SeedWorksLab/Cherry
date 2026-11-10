import {
  brewCandidates,
  extractJsonObject,
  matchCatalogue,
  parseExtractionJson,
  resolveExtractionNames,
  runExtraction,
  tastingCandidates,
} from '../../src/ai/extraction';
import type { EntityMatch } from '../../src/ai/extraction';
import type { ExtractionContext } from '../../src/ai/prompts';
import type { AiProvider, ChatMessage, ChatOptions, ChatResult } from '../../src/ai/provider';

const FULL_RESPONSE = {
  method_id: 'v60',
  bean_name: 'Kenya Nyeri',
  brewer_name: 'V60 02',
  grinder_name: 'Comandante',
  equipment_names: ['Timemore scale'],
  grind_setting_name: '22 clicks',
  dose_g: 15,
  water_total_g: 250,
  water_temp_c: 93,
  yield_g: 230,
  total_time_s: 165,
  notes: 'Poured in three stages',
  steps: [
    { kind: 'bloom', label: 'Bloom', target_water_g: 45, pour_duration_s: 10, wait_after_s: 40, note: null },
    { kind: 'pour', label: 'Main pour', target_water_g: 205, pour_duration_s: 45, wait_after_s: 0, note: null },
  ],
  tasting: {
    verdict: 'liked',
    overall_rating: 4,
    attribute_acidity: 'high',
    attribute_sweetness: 'medium',
    attribute_body: 'medium',
    attribute_bitterness: 'low',
    attribute_finish: 'medium',
    flavour_tags: ['blackcurrant', 'citrus'],
    notes: 'Bright and clean',
  },
  questions: [{ field_path: 'water_temp_c', question: 'What temperature?', options: ['90', '93', '96'] }],
  low_confidence: ['total_time_s'],
};

const CONTEXT: ExtractionContext = {
  methods: ['v60', 'aeropress'],
  beans: ['Kenya Nyeri', 'Brazil Cerrado'],
  brewers: ['V60 02', 'Aeropress'],
  grinders: ['Comandante'],
  equipment: ['Timemore scale', 'Fellow Stagg kettle'],
  grindSettings: ['22 clicks'],
  flavourTags: ['Blackcurrant', 'Citrus', 'Chocolate'],
  languageHint: 'en',
};

describe('extractJsonObject', () => {
  it('parses plain JSON', () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips markdown fences', () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('recovers an object surrounded by prose', () => {
    expect(extractJsonObject('Sure! Here you go: {"a":{"b":2}} done.')).toEqual({ a: { b: 2 } });
  });

  it('ignores braces inside strings', () => {
    expect(extractJsonObject('prefix {"a":"}"} suffix')).toEqual({ a: '}' });
  });

  it('returns null when there is no object', () => {
    expect(extractJsonObject('just words')).toBeNull();
  });
});

describe('parseExtractionJson', () => {
  it('sanitises a full response into the domain shape', () => {
    const parsed = parseExtractionJson(JSON.stringify(FULL_RESPONSE));
    expect(parsed).not.toBeNull();
    expect(parsed?.methodId).toBe('v60');
    expect(parsed?.doseG).toBe(15);
    expect(parsed?.equipmentNames).toEqual(['Timemore scale']);
    expect(parsed?.steps).toHaveLength(2);
    expect(parsed?.steps[0]).toEqual({
      kind: 'bloom',
      label: 'Bloom',
      targetWaterG: 45,
      pourDurationS: 10,
      waitAfterS: 40,
      temperatureC: null,
      note: null,
    });
    expect(parsed?.verdict).toBe('liked');
    expect(parsed?.overallRating).toBe(4);
    expect(parsed?.flavourTags).toEqual(['blackcurrant', 'citrus']);
    expect(parsed?.questions).toHaveLength(1);
    expect(parsed?.lowConfidence).toEqual(['total_time_s']);
  });

  it('rejects values the domain does not know', () => {
    const parsed = parseExtractionJson(
      JSON.stringify({ method_id: 'siphon', tasting: { verdict: 'amazing', overall_rating: 9 } })
    );
    expect(parsed?.methodId).toBeNull();
    expect(parsed?.verdict).toBeNull();
    expect(parsed?.overallRating).toBeNull();
  });

  it('returns null for unparseable input', () => {
    expect(parseExtractionJson('nonsense')).toBeNull();
  });
});

describe('brewCandidates and tastingCandidates', () => {
  it('emits only the populated fields', () => {
    const parsed = parseExtractionJson(JSON.stringify(FULL_RESPONSE));
    expect(parsed).not.toBeNull();
    if (parsed === null) {
      return;
    }
    const brew = brewCandidates(parsed);
    const paths = brew.map((candidate) => candidate.fieldPath);
    expect(paths).toContain('dose_g');
    expect(paths).toContain('bean_name');
    expect(paths).toContain('equipment_names');
    expect(brew.every((candidate) => candidate.target === 'brew')).toBe(true);

    const tasting = tastingCandidates(parsed);
    expect(tasting.map((c) => c.fieldPath)).toContain('overall_rating');
    expect(tasting.every((candidate) => candidate.target === 'tasting')).toBe(true);
  });

  it('is empty when nothing was extracted', () => {
    const parsed = parseExtractionJson('{}');
    expect(parsed).not.toBeNull();
    if (parsed === null) {
      return;
    }
    expect(brewCandidates(parsed)).toEqual([]);
    expect(tastingCandidates(parsed)).toEqual([]);
  });
});

describe('matchCatalogue', () => {
  const items: EntityMatch[] = [
    { entityId: 1, name: 'Kenya Nyeri' },
    { entityId: 2, name: 'Brazil Cerrado' },
  ];

  it('matches case-insensitively and exactly', () => {
    expect(matchCatalogue(items, 'kenya nyeri')).toEqual({ entityId: 1, name: 'Kenya Nyeri' });
  });

  it('matches a fuzzy substring', () => {
    expect(matchCatalogue(items, 'cerrado')).toEqual({ entityId: 2, name: 'Brazil Cerrado' });
  });

  it('returns null for blank or unrelated input', () => {
    expect(matchCatalogue(items, '   ')).toBeNull();
    expect(matchCatalogue(items, 'Ethiopia Guji')).toBeNull();
  });
});

describe('resolveExtractionNames', () => {
  it('matches catalogue entities and keeps unmatched flavour tags separate', () => {
    const parsed = parseExtractionJson(JSON.stringify(FULL_RESPONSE));
    expect(parsed).not.toBeNull();
    if (parsed === null) {
      return;
    }
    const resolved = resolveExtractionNames(parsed, CONTEXT);
    expect(resolved.bean?.name).toBe('Kenya Nyeri');
    expect(resolved.brewer?.name).toBe('V60 02');
    expect(resolved.grinder?.name).toBe('Comandante');
    expect(resolved.equipment.map((match) => match.name)).toEqual(['Timemore scale']);
    expect(resolved.matchedMethodName).toBe('v60');
    expect(resolved.flavourTagIds).toEqual(['Blackcurrant', 'Citrus']);
    expect(resolved.unmatchedFlavourTags).toEqual([]);
  });
});

describe('runExtraction', () => {
  function fakeProvider(text: string, usage: ChatResult['usage'] = null): AiProvider {
    return {
      async chat(_messages: ChatMessage[], _options: ChatOptions): Promise<ChatResult> {
        return { text, usage };
      },
      async transcribeAudio() {
        return { text: '', confidence: null };
      },
    };
  }

  it('returns the parsed record and usage', async () => {
    const outcome = await runExtraction({
      provider: fakeProvider(JSON.stringify(FULL_RESPONSE), { inputTokens: 100, outputTokens: 50 }),
      model: 'gpt-x',
      transcript: 'fifteen grams to two fifty',
      context: CONTEXT,
    });
    expect(outcome.parsed.doseG).toBe(15);
    expect(outcome.usage).toEqual({ inputTokens: 100, outputTokens: 50 });
  });

  it('throws when the response is not a record', async () => {
    await expect(
      runExtraction({
        provider: fakeProvider('I could not understand that'),
        model: 'gpt-x',
        transcript: 'hello',
        context: CONTEXT,
      })
    ).rejects.toThrow();
  });
});
