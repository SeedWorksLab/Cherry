import type {
  BeanProcess,
  BrewMethodId,
  EquipmentKind,
  FlavourCategory,
  GrindUnit,
  RoastLevel,
  ScaleMode,
  StepKind,
  Verdict,
} from '../models';

export const METHOD_LABELS: Record<BrewMethodId, string> = {
  v60: 'V60',
  chemex: 'Chemex',
  kalita: 'Kalita Wave',
  'french-press': 'French Press',
  aeropress: 'AeroPress',
  clever: 'Clever Dripper',
  'cold-brew': 'Cold Brew',
  espresso: 'Espresso',
  moka: 'Moka Pot',
};

export const EQUIPMENT_KIND_LABELS: Record<EquipmentKind, string> = {
  dripper: 'Dripper',
  kettle: 'Kettle',
  scale: 'Scale',
  grinder: 'Grinder',
  press: 'Press',
  filter: 'Filter',
  carafe: 'Carafe',
  portafilter: 'Portafilter',
  moka: 'Moka pot',
  cup: 'Cup',
  other: 'Other',
};

export const SCALE_MODE_LABELS: Record<ScaleMode, string> = {
  timer: 'Timer',
  'flow-rate': 'Flow rate',
  'auto-tare': 'Auto-tare / auto-start',
  ratio: 'Ratio / recipe mode',
  espresso: 'Espresso mode',
};

export const PROCESS_LABELS: Record<BeanProcess, string> = {
  washed: 'Washed',
  natural: 'Natural',
  honey: 'Honey',
  anaerobic: 'Anaerobic',
  carbonic: 'Carbonic',
  'wet-hulled': 'Wet-hulled',
  experimental: 'Experimental',
  unknown: 'Unknown',
};

export const ROAST_LEVEL_LABELS: Record<RoastLevel, string> = {
  light: 'Light',
  'medium-light': 'Medium-light',
  medium: 'Medium',
  'medium-dark': 'Medium-dark',
  dark: 'Dark',
  unknown: 'Unknown',
};

export const GRIND_UNIT_LABELS: Record<GrindUnit, string> = {
  clicks: 'clicks',
  setting: 'setting',
  microns: 'µm',
  notch: 'notch',
  unknown: 'unknown',
};

export const FLAVOUR_CATEGORY_LABELS: Record<FlavourCategory, string> = {
  fruit: 'Fruit',
  floral: 'Floral',
  sweet: 'Sweet',
  nutty_cocoa: 'Nutty / cocoa',
  spice: 'Spice',
  roasted: 'Roasted',
  green_vegetative: 'Green / vegetative',
  sour_fermented: 'Sour / fermented',
  chemical: 'Chemical',
  other: 'Other',
};

export const VERDICT_LABELS: Record<Verdict, string> = {
  liked: 'Liked',
  disliked: 'Disliked',
  unsure: 'Unsure',
};

export const STEP_KIND_LABELS: Record<StepKind, string> = {
  dose: 'Dose',
  grind: 'Grind',
  rinse: 'Rinse',
  preheat: 'Preheat',
  fill_water: 'Fill water',
  fill_grounds: 'Fill grounds',
  add_water: 'Add water',
  bloom: 'Bloom',
  pour: 'Pour',
  stir: 'Stir',
  swirl: 'Swirl',
  tap: 'Tap',
  steep: 'Steep',
  break_crust: 'Break crust',
  skim: 'Skim',
  press: 'Press',
  assemble: 'Assemble',
  heat: 'Heat',
  plate: 'Plate',
  drain: 'Drain',
  extract: 'Extract',
  stop: 'Stop',
  wait: 'Wait',
  custom: 'Custom',
};

export function methodLabel(methodId: BrewMethodId): string {
  return METHOD_LABELS[methodId];
}
