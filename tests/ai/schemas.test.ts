import {
  asNumber,
  asText,
  attributeLevel,
  brewMethodId,
  emptyParsedExtraction,
  extractionSchemaJson,
  ratingOneToFive,
  verdict,
} from '../../src/ai/schemas';

describe('asText', () => {
  it('trims non-empty strings and rejects everything else', () => {
    expect(asText('  Kenya Nyeri  ')).toBe('Kenya Nyeri');
    expect(asText('   ')).toBeNull();
    expect(asText(42)).toBeNull();
    expect(asText(null)).toBeNull();
  });
});

describe('asNumber', () => {
  it('keeps finite numbers', () => {
    expect(asNumber(15)).toBe(15);
    expect(asNumber(0)).toBe(0);
  });

  it('parses a spoken string with a unit attached', () => {
    expect(asNumber('15g')).toBe(15);
    expect(asNumber('250 ml')).toBe(250);
    expect(asNumber('93°C')).toBe(93);
  });

  it('rejects non-positive numbers and unparseable text', () => {
    expect(asNumber('-5')).toBeNull();
    expect(asNumber('a lot')).toBeNull();
    expect(asNumber(null)).toBeNull();
  });
});

describe('ratingOneToFive', () => {
  it('rounds values within range', () => {
    expect(ratingOneToFive(4)).toBe(4);
    expect(ratingOneToFive('3')).toBe(3);
    expect(ratingOneToFive(4.4)).toBe(4);
  });

  it('rejects values outside 1..5', () => {
    expect(ratingOneToFive(0)).toBeNull();
    expect(ratingOneToFive(6)).toBeNull();
  });
});

describe('enum validators', () => {
  it('accepts known verdicts and rejects others', () => {
    expect(verdict('liked')).toBe('liked');
    expect(verdict('delicious')).toBeNull();
  });

  it('accepts known attribute levels', () => {
    expect(attributeLevel('low')).toBe('low');
    expect(attributeLevel('medium')).toBe('medium');
    expect(attributeLevel('extreme')).toBeNull();
  });

  it('accepts known brew methods', () => {
    expect(brewMethodId('v60')).toBe('v60');
    expect(brewMethodId('siphon')).toBeNull();
  });
});

describe('emptyParsedExtraction', () => {
  it('returns a complete, null-filled shape tagged with its prompt version', () => {
    const parsed = emptyParsedExtraction('1');
    expect(parsed.promptVersion).toBe('1');
    expect(parsed.methodId).toBeNull();
    expect(parsed.doseG).toBeNull();
    expect(parsed.equipmentNames).toEqual([]);
    expect(parsed.steps).toEqual([]);
    expect(parsed.flavourTags).toEqual([]);
    expect(parsed.questions).toEqual([]);
    expect(parsed.lowConfidence).toEqual([]);
  });
});

describe('extractionSchemaJson', () => {
  it('lists the known brewing methods and tasting enumerations', () => {
    const schema = extractionSchemaJson();
    expect(String(schema.method_id)).toContain('v60');
    expect(String(schema.method_id)).toContain('null');
    expect(Array.isArray(schema.steps)).toBe(true);
    expect(Array.isArray(schema.equipment_names)).toBe(true);
    expect(schema.tasting).toBeDefined();
  });
});
