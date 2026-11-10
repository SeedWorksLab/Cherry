import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {
  AiState,
  Bean,
  Brew,
  Equipment,
  FlavourTag,
  GrindSetting,
  Method,
  Recipe,
  Roaster,
  Settings,
  Tasting,
} from '../models';
import { getDatabase } from '../database/database';
import {
  clearAiCredentials as clearAiCredentialsRow,
  getAiState,
  updateAiState as updateAiStateRow,
} from '../database/aiState';
import {
  DEFAULT_SETTINGS,
  getSettings,
  updateSettings as updateSettingsRow,
} from '../database/settings';
import {
  createRoaster,
  deleteRoaster,
  getAllRoasters,
  updateRoaster,
} from '../database/roasters';
import type { RoasterInput } from '../database/roasters';
import {
  createBean,
  deleteBean,
  getAllBeans,
  hardDeleteBean,
  setBeanRemainingWeight,
  updateBean,
} from '../database/beans';
import type { BeanInput } from '../database/beans';
import {
  createEquipment,
  deleteEquipment,
  getAllEquipment,
  updateEquipment,
} from '../database/equipment';
import type { EquipmentInput } from '../database/equipment';
import {
  createGrindSetting,
  deleteGrindSetting,
  getAllGrindSettings,
  updateGrindSetting,
} from '../database/grinders';
import type { GrindSettingInput } from '../database/grinders';
import {
  adoptBuiltinRecipe,
  createRecipe,
  deleteRecipe,
  getAllRecipes,
  updateRecipe,
} from '../database/recipes';
import type { RecipeInput } from '../database/recipes';
import { getAllMethods } from '../database/methods';
import { addOtherFlavourTag, getAllFlavourTags } from '../database/flavourTags';
import {
  createBrew,
  deleteBrew,
  getAllBrews,
  updateBrew,
} from '../database/brews';
import type { BrewInput } from '../database/brews';
import {
  createTasting,
  deleteTasting,
  getAllTastings,
  updateTasting,
} from '../database/tastings';
import type { TastingInput } from '../database/tastings';

export interface AppData {
  ready: boolean;
  error: string | null;
  settings: Settings;
  aiState: AiState;
  roasters: Roaster[];
  beans: Bean[];
  equipment: Equipment[];
  grindSettings: GrindSetting[];
  methods: Method[];
  recipes: Recipe[];
  flavourTags: FlavourTag[];
  brews: Brew[];
  tastings: Tasting[];
  refresh: () => Promise<void>;
  saveSettings: (patch: Partial<Settings>) => Promise<void>;
  saveAiState: (patch: Partial<AiState>) => Promise<void>;
  clearAiCredentials: () => Promise<void>;
  addRoaster: (input: RoasterInput) => Promise<number>;
  saveRoaster: (id: number, input: RoasterInput) => Promise<void>;
  removeRoaster: (id: number) => Promise<void>;
  addBean: (input: BeanInput) => Promise<number>;
  saveBean: (id: number, input: BeanInput) => Promise<void>;
  removeBean: (id: number) => Promise<void>;
  hardRemoveBean: (id: number) => Promise<void>;
  setBeanRemaining: (id: number, remainingWeightG: number | null) => Promise<void>;
  addEquipment: (input: EquipmentInput) => Promise<number>;
  saveEquipment: (id: number, input: EquipmentInput) => Promise<void>;
  removeEquipment: (id: number) => Promise<void>;
  addGrindSetting: (input: GrindSettingInput) => Promise<number>;
  saveGrindSetting: (id: number, input: GrindSettingInput) => Promise<void>;
  removeGrindSetting: (id: number) => Promise<void>;
  addRecipe: (input: RecipeInput) => Promise<number>;
  saveRecipe: (id: number, input: RecipeInput) => Promise<void>;
  removeRecipe: (id: number) => Promise<void>;
  adoptRecipe: (builtinId: number) => Promise<number>;
  addFlavourTag: (name: string) => Promise<string>;
  addBrew: (input: BrewInput) => Promise<number>;
  saveBrew: (id: number, input: BrewInput) => Promise<void>;
  removeBrew: (id: number) => Promise<void>;
  addTasting: (input: TastingInput) => Promise<number>;
  saveTasting: (id: number, input: TastingInput) => Promise<void>;
  removeTasting: (id: number) => Promise<void>;
}

const DataContext = createContext<AppData | null>(null);

const EMPTY_AI_STATE: AiState = {
  llmBaseUrl: null,
  llmApiKey: null,
  llmModel: null,
  sttEngine: 'manual',
  sttBaseUrl: null,
  sttApiKey: null,
  sttModel: null,
  sttLanguage: null,
  enabled: false,
  lastError: null,
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [aiState, setAiState] = useState<AiState>(EMPTY_AI_STATE);
  const [roasters, setRoasters] = useState<Roaster[]>([]);
  const [beans, setBeans] = useState<Bean[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [grindSettings, setGrindSettings] = useState<GrindSetting[]>([]);
  const [methods, setMethods] = useState<Method[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [flavourTags, setFlavourTags] = useState<FlavourTag[]>([]);
  const [brews, setBrews] = useState<Brew[]>([]);
  const [tastings, setTastings] = useState<Tasting[]>([]);

  const refresh = useCallback(async () => {
    try {
      const db = await getDatabase();
      const [
        nextSettings,
        nextAiState,
        nextRoasters,
        nextBeans,
        nextEquipment,
        nextGrindSettings,
        nextMethods,
        nextRecipes,
        nextFlavourTags,
        nextBrews,
        nextTastings,
      ] = await Promise.all([
        getSettings(db),
        getAiState(db),
        getAllRoasters(db),
        getAllBeans(db),
        getAllEquipment(db),
        getAllGrindSettings(db),
        getAllMethods(db),
        getAllRecipes(db),
        getAllFlavourTags(db),
        getAllBrews(db),
        getAllTastings(db),
      ]);
      setSettings(nextSettings);
      setAiState(nextAiState);
      setRoasters(nextRoasters);
      setBeans(nextBeans);
      setEquipment(nextEquipment);
      setGrindSettings(nextGrindSettings);
      setMethods(nextMethods);
      setRecipes(nextRecipes);
      setFlavourTags(nextFlavourTags);
      setBrews(nextBrews);
      setTastings(nextTastings);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load local data');
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      await refresh();
      if (active) {
        setReady(true);
      }
    }
    void initialize();
    return () => {
      active = false;
    };
  }, [refresh]);

  const saveSettings = useCallback(async (patch: Partial<Settings>) => {
    const db = await getDatabase();
    const next = await updateSettingsRow(patch, db);
    setSettings(next);
  }, []);

  const saveAiState = useCallback(async (patch: Partial<AiState>) => {
    const db = await getDatabase();
    const next = await updateAiStateRow(patch, db);
    setAiState(next);
  }, []);

  const clearAiCredentials = useCallback(async () => {
    const db = await getDatabase();
    const next = await clearAiCredentialsRow(db);
    setAiState(next);
  }, []);

  const value = useMemo<AppData>(
    () => ({
      ready,
      error,
      settings,
      aiState,
      roasters,
      beans,
      equipment,
      grindSettings,
      methods,
      recipes,
      flavourTags,
      brews,
      tastings,
      refresh,
      saveSettings,
      saveAiState,
      clearAiCredentials,
      addRoaster: async (input) => {
        const db = await getDatabase();
        const id = await createRoaster({ ...input, sortOrder: roasters.length }, db);
        await refresh();
        return id;
      },
      saveRoaster: async (id, input) => {
        const db = await getDatabase();
        await updateRoaster(id, input, db);
        await refresh();
      },
      removeRoaster: async (id) => {
        const db = await getDatabase();
        await deleteRoaster(id, db);
        await refresh();
      },
      addBean: async (input) => {
        const db = await getDatabase();
        const id = await createBean({ ...input, sortOrder: beans.length }, db);
        await refresh();
        return id;
      },
      saveBean: async (id, input) => {
        const db = await getDatabase();
        await updateBean(id, input, db);
        await refresh();
      },
      removeBean: async (id) => {
        const db = await getDatabase();
        await deleteBean(id, db);
        await refresh();
      },
      hardRemoveBean: async (id) => {
        const db = await getDatabase();
        await hardDeleteBean(id, db);
        await refresh();
      },
      setBeanRemaining: async (id, remainingWeightG) => {
        const db = await getDatabase();
        await setBeanRemainingWeight(id, remainingWeightG, db);
        await refresh();
      },
      addEquipment: async (input) => {
        const db = await getDatabase();
        const id = await createEquipment({ ...input, sortOrder: equipment.length }, db);
        await refresh();
        return id;
      },
      saveEquipment: async (id, input) => {
        const db = await getDatabase();
        await updateEquipment(id, input, db);
        await refresh();
      },
      removeEquipment: async (id) => {
        const db = await getDatabase();
        await deleteEquipment(id, db);
        await refresh();
      },
      addGrindSetting: async (input) => {
        const db = await getDatabase();
        const id = await createGrindSetting(input, db);
        await refresh();
        return id;
      },
      saveGrindSetting: async (id, input) => {
        const db = await getDatabase();
        await updateGrindSetting(id, input, db);
        await refresh();
      },
      removeGrindSetting: async (id) => {
        const db = await getDatabase();
        await deleteGrindSetting(id, db);
        await refresh();
      },
      addRecipe: async (input) => {
        const db = await getDatabase();
        const id = await createRecipe(input, db);
        await refresh();
        return id;
      },
      saveRecipe: async (id, input) => {
        const db = await getDatabase();
        await updateRecipe(id, input, db);
        await refresh();
      },
      removeRecipe: async (id) => {
        const db = await getDatabase();
        await deleteRecipe(id, db);
        await refresh();
      },
      adoptRecipe: async (builtinId) => {
        const db = await getDatabase();
        const id = await adoptBuiltinRecipe(builtinId, db);
        await refresh();
        return id;
      },
      addFlavourTag: async (name) => {
        const db = await getDatabase();
        const id = await addOtherFlavourTag(name, db);
        await refresh();
        return id;
      },
      addBrew: async (input) => {
        const db = await getDatabase();
        const id = await createBrew(input, db);
        if (input.beanId !== null && input.doseG !== null) {
          const bean = beans.find((candidate) => candidate.id === input.beanId);
          if (bean && bean.isActive && bean.remainingWeightG !== null) {
            await setBeanRemainingWeight(
              bean.id,
              Math.max(0, bean.remainingWeightG - input.doseG),
              db
            );
          }
        }
        await refresh();
        return id;
      },
      saveBrew: async (id, input) => {
        const db = await getDatabase();
        await updateBrew(id, input, db);
        await refresh();
      },
      removeBrew: async (id) => {
        const db = await getDatabase();
        await deleteBrew(id, db);
        await refresh();
      },
      addTasting: async (input) => {
        const db = await getDatabase();
        const id = await createTasting(input, db);
        await refresh();
        return id;
      },
      saveTasting: async (id, input) => {
        const db = await getDatabase();
        await updateTasting(id, input, db);
        await refresh();
      },
      removeTasting: async (id) => {
        const db = await getDatabase();
        await deleteTasting(id, db);
        await refresh();
      },
    }),
    [
      ready,
      error,
      settings,
      aiState,
      roasters,
      beans,
      equipment,
      grindSettings,
      methods,
      recipes,
      flavourTags,
      brews,
      tastings,
      refresh,
      saveSettings,
      saveAiState,
      clearAiCredentials,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useAppData(): AppData {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useAppData must be used within a DataProvider');
  }
  return context;
}
