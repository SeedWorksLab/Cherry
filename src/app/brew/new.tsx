import React, { useEffect, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { LoadingScreen } from '../../components/loading-screen';
import { BrewForm } from '../../components/brew-form';
import type { EditableStep } from '../../components/step-list-editor';
import { useAppData } from '../../data/DataProvider';
import { getBrewSteps } from '../../database/brews';
import { getBrewEquipmentByBrew } from '../../database/brewEquipment';

export default function NewBrewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { ready, brews, addBrew, saveBrew } = useAppData();
  const [steps, setSteps] = useState<EditableStep[] | null>(null);
  const [equipmentIds, setEquipmentIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const brewId = id ? Number(id) : null;
  const existing = brewId === null ? null : brews.find((brew) => brew.id === brewId) ?? null;

  useEffect(() => {
    let active = true;
    async function load() {
      if (brewId === null) {
        setSteps([]);
        setEquipmentIds([]);
        return;
      }
      const [loaded, loadedEquipment] = await Promise.all([
        getBrewSteps(brewId),
        getBrewEquipmentByBrew(brewId),
      ]);
      if (active) {
        setSteps(
          loaded.map((step) => ({
            kind: step.kind,
            label: step.label,
            targetWaterG: step.targetWaterG,
            pourWaterG: step.pourWaterG,
            pourDurationS: step.pourDurationS,
            waitAfterS: step.waitAfterS,
            agitationCount: step.agitationCount,
            agitationKind: step.agitationKind,
            temperatureC: step.temperatureC,
            note: step.note,
          }))
        );
        setEquipmentIds(loadedEquipment.map((row) => row.brewerId));
      }
    }
    if (ready) {
      void load();
    }
    return () => {
      active = false;
    };
  }, [ready, brewId]);

  if (!ready || steps === null) {
    return <LoadingScreen />;
  }

  return (
    <>
      <Stack.Screen options={{ title: existing ? 'Edit brew' : 'Log a brew' }} />
      <BrewForm
        initial={existing}
        initialSteps={steps}
        initialEquipmentIds={equipmentIds}
        submitting={submitting}
        onSubmit={async (input) => {
          setSubmitting(true);
          try {
            if (existing) {
              await saveBrew(existing.id, input);
            } else {
              await addBrew(input);
            }
            router.back();
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </>
  );
}
