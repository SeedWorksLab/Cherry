import type { Brewer, BrewMethodId, Method } from '../../src/models';
import {
  accessoryEquipment,
  availableMethods,
  brewingVessels,
  compatibleBrewers,
  methodById,
  methodsForKind,
  otherEquipment,
} from '../../src/services/equipment-service';

const METHODS: readonly Method[] = [
  makeMethod('v60', 'V60', 'dripper'),
  makeMethod('chemex', 'Chemex', 'dripper'),
  makeMethod('kalita', 'Kalita Wave', 'dripper'),
  makeMethod('french-press', 'French Press', 'press'),
  makeMethod('aeropress', 'AeroPress', 'press'),
  makeMethod('clever', 'Clever Dripper', 'dripper'),
  makeMethod('cold-brew', 'Cold Brew', 'carafe'),
  makeMethod('espresso', 'Espresso', 'portafilter'),
  makeMethod('moka', 'Moka Pot', 'moka'),
];

function makeMethod(
  id: BrewMethodId,
  name: string,
  brewerKind: Method['brewerKind']
): Method {
  return {
    id,
    name,
    family: 'pour-over',
    brewerKind,
    supportsPressure: false,
    supportsGrinder: true,
    defaultStepTemplate: null,
    sortOrder: 0,
  };
}

function makeBrewer(
  overrides: Partial<Brewer> & Pick<Brewer, 'name' | 'kind'>
): Brewer {
  return {
    id: overrides.id ?? 1,
    uuid: null,
    manufacturer: null,
    model: null,
    capacityMl: null,
    material: null,
    notes: null,
    isActive: overrides.isActive ?? true,
    sortOrder: 0,
    createdAt: '2026-10-11T09:00:00.000Z',
    updatedAt: null,
    deleted: false,
    ...overrides,
    name: overrides.name,
    kind: overrides.kind,
    methodId: overrides.methodId ?? null,
  };
}

function ids(methods: readonly Method[]): string[] {
  return methods.map((method) => method.id);
}

describe('availableMethods', () => {
  it('keeps every method available when no equipment exists yet', () => {
    expect(ids(availableMethods([], METHODS))).toEqual(ids(METHODS));
  });

  it('keeps every method available when all equipment is inactive', () => {
    const brewers = [makeBrewer({ name: 'Old dripper', kind: 'dripper', isActive: false })];
    expect(ids(availableMethods(brewers, METHODS))).toEqual(ids(METHODS));
  });

  it('unlocks every method of a kind from a generic brewer of that kind', () => {
    const brewers = [makeBrewer({ name: 'V60', kind: 'dripper' })];
    expect(availableMethods(brewers, METHODS).map((m) => m.id)).toEqual([
      'v60',
      'chemex',
      'kalita',
      'clever',
    ]);
  });

  it('only unlocks one method from a brewer that claims its method', () => {
    const brewers = [
      makeBrewer({ id: 1, name: 'Kalita Wave 185', kind: 'dripper', methodId: 'kalita' }),
    ];
    expect(availableMethods(brewers, METHODS).map((m) => m.id)).toEqual(['kalita']);
  });

  it('unlocks a claimed method even across another kind', () => {
    const brewers = [makeBrewer({ id: 1, name: 'Espresso machine', kind: 'portafilter', methodId: 'espresso' })];
    expect(availableMethods(brewers, METHODS).map((m) => m.id)).toEqual(['espresso']);
  });

  it('merges generic and claimed equipment', () => {
    const brewers = [
      makeBrewer({ id: 1, name: 'V60', kind: 'dripper' }),
      makeBrewer({ id: 2, name: 'Moka pot', kind: 'moka', methodId: 'moka' }),
    ];
    expect(ids(availableMethods(brewers, METHODS))).toEqual(['v60', 'chemex', 'kalita', 'clever', 'moka']);
  });

  it('gives a method with a null kind regardless of equipment', () => {
    const methods = [makeMethod('v60', 'Anything', null)];
    const brewers = [makeBrewer({ name: 'Kettle', kind: 'kettle' })];
    expect(ids(availableMethods(brewers, methods))).toEqual(['v60']);
  });
});

describe('methodsForKind', () => {
  it('lists only the methods that expect that kind', () => {
    expect(methodsForKind('dripper', METHODS).map((m) => m.id)).toEqual([
      'v60',
      'chemex',
      'kalita',
      'clever',
    ]);
    expect(methodsForKind('portafilter', METHODS).map((m) => m.id)).toEqual(['espresso']);
    expect(methodsForKind('kettle', METHODS)).toEqual([]);
  });
});

describe('compatibleBrewers', () => {
  const v60 = METHODS[0];
  const brewers = [
    makeBrewer({ id: 1, name: 'Kalita Wave', kind: 'dripper', methodId: 'kalita' }),
    makeBrewer({ id: 2, name: 'V60', kind: 'dripper' }),
    makeBrewer({ id: 3, name: 'French press', kind: 'press' }),
    makeBrewer({ id: 4, name: 'Weird v60', kind: 'other', methodId: 'v60' }),
  ];

  it('pairs a method with its own brewer and kind-compatible ones', () => {
    const compatible = compatibleBrewers(brewers, v60);
    expect(compatible.map((brewer) => brewer.name)).toEqual([
      'V60',
      'Weird v60',
    ]);
  });
});

describe('methodById', () => {
  it('finds a method by id', () => {
    expect(methodById('kalita', METHODS)?.name).toBe('Kalita Wave');
  });

  it('returns null for null or unknown ids', () => {
    expect(methodById(null, METHODS)).toBeNull();
    expect(methodById('v60', [])).toBeNull();
  });
});

describe('otherEquipment', () => {
  const brewers = [
    makeBrewer({ id: 1, name: 'V60 02', kind: 'dripper' }),
    makeBrewer({ id: 2, name: 'Comandante', kind: 'grinder' }),
    makeBrewer({ id: 3, name: 'Timemore scale', kind: 'scale' }),
    makeBrewer({ id: 4, name: 'Fellow Stagg', kind: 'kettle' }),
    makeBrewer({ id: 5, name: 'Retired scale', kind: 'scale', isActive: false }),
  ];

  it('offers every active, non-grinder item, in catalogue order', () => {
    expect(otherEquipment(brewers).map((brewer) => brewer.name)).toEqual([
      'V60 02',
      'Timemore scale',
      'Fellow Stagg',
    ]);
  });

  it('excludes the ids the caller already chose', () => {
    expect(otherEquipment(brewers, [1, 3]).map((brewer) => brewer.name)).toEqual([
      'Fellow Stagg',
    ]);
  });
});

describe('accessoryEquipment', () => {
  const brewers = [
    makeBrewer({ id: 1, name: 'V60 02', kind: 'dripper' }),
    makeBrewer({ id: 2, name: 'Comandante', kind: 'grinder' }),
    makeBrewer({ id: 3, name: 'Timemore scale', kind: 'scale' }),
    makeBrewer({ id: 4, name: 'Fellow Stagg', kind: 'kettle' }),
    makeBrewer({ id: 5, name: 'V60 filter', kind: 'filter' }),
    makeBrewer({ id: 6, name: 'Retired cup', kind: 'cup', isActive: false }),
  ];

  it('keeps only active scales, kettles, filters and cups', () => {
    expect(accessoryEquipment(brewers).map((brewer) => brewer.name)).toEqual([
      'Timemore scale',
      'Fellow Stagg',
      'V60 filter',
    ]);
  });
});

describe('brewingVessels', () => {
  const brewers = [
    makeBrewer({ id: 1, name: 'V60 02', kind: 'dripper' }),
    makeBrewer({ id: 2, name: 'French press', kind: 'press' }),
    makeBrewer({ id: 3, name: 'Comandante', kind: 'grinder' }),
    makeBrewer({ id: 4, name: 'Timemore scale', kind: 'scale' }),
    makeBrewer({ id: 5, name: 'Retired dripper', kind: 'dripper', isActive: false }),
  ];

  it('keeps active gear that is neither a grinder nor an accessory', () => {
    expect(brewingVessels(brewers).map((brewer) => brewer.name)).toEqual([
      'V60 02',
      'French press',
    ]);
  });
});