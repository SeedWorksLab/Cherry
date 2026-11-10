import type { BrewMethodId, Equipment, EquipmentKind, Method } from '../models';

/**
 * The brew methods the user can actually brew today, from their equipment.
 *
 * A method is available when an active brewer claims it by name (`methodId`)
 * or when an active brewer of the method's kind exists without being bound to
 * a specific method. With no equipment at all, every method stays available so
 * a brand-new user is never blocked from logging their first brew.
 */
export function availableMethods(
  equipment: readonly Equipment[],
  methods: readonly Method[]
): Method[] {
  const active = equipment.filter((item) => item.isActive);
  if (active.length === 0) {
    return [...methods];
  }
  return methods.filter((method) => isMethodAvailable(method, active));
}

function isMethodAvailable(method: Method, active: readonly Equipment[]): boolean {
  if (method.brewerKind === null) {
    return true;
  }
  const claimed = active.some((item) => item.methodId === method.id);
  if (claimed) {
    return true;
  }
  return active.some((item) => item.methodId === null && item.kind === method.brewerKind);
}

/** Methods whose brewer kind matches the given kind, for an equipment item's own picker. */
export function methodsForKind(kind: EquipmentKind, methods: readonly Method[]): Method[] {
  return methods.filter((method) => method.brewerKind === kind);
}

/** Equipment that pairs with the given method: bound to it, or generic of its kind. */
export function compatibleBrewers(
  equipment: readonly Equipment[],
  method: Method
): Equipment[] {
  return equipment.filter(
    (item) =>
      item.methodId === method.id ||
      (item.methodId === null && item.kind === method.brewerKind)
  );
}

export function methodById(
  id: BrewMethodId | null,
  methods: readonly Method[]
): Method | null {
  if (id === null) {
    return null;
  }
  return methods.find((method) => method.id === id) ?? null;
}

/**
 * The active gear a brew can additionally be logged with, in catalogue order.
 * The grinder has its own field on a brew, so it is never offered here, and
 * anything already chosen (the brewer, the grinder, an id picked earlier) is
 * excluded by the caller.
 */
export function otherEquipment(
  equipment: readonly Equipment[],
  excludedIds: readonly number[] = []
): Equipment[] {
  const excluded = new Set(excludedIds);
  return equipment.filter(
    (item) => item.isActive && item.kind !== 'grinder' && !excluded.has(item.id)
  );
}

const ACCESSORY_KINDS: readonly EquipmentKind[] = ['scale', 'kettle', 'filter', 'cup'];

/**
 * Scales, kettles, filters and cups: the gear that is neither the brewing
 * vessel nor the grinder, and so can only be captured as "also used"
 * (idea.txt §7.3). This is the accessory catalogue the extraction prompt is
 * given so a spoken name like "my Timemore" can be resolved.
 */
export function accessoryEquipment(equipment: readonly Equipment[]): Equipment[] {
  return equipment.filter((item) => item.isActive && ACCESSORY_KINDS.includes(item.kind));
}

/**
 * The active gear a brew is actually brewed in: every kind that is not a
 * grinder or an accessory. This keeps a scale out of the extraction prompt's
 * "brewers" list, so a spoken name can only resolve as a brewer when it is one.
 */
export function brewingVessels(equipment: readonly Equipment[]): Equipment[] {
  return equipment.filter(
    (item) =>
      item.isActive && item.kind !== 'grinder' && !ACCESSORY_KINDS.includes(item.kind)
  );
}
