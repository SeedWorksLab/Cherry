import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Button, Card, Dialog, Divider, List, Portal, Text } from 'react-native-paper';
import { ScreenFade } from '../../components/screen-fade';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { LoadingScreen } from '../../components/loading-screen';
import { AppDialog } from '../../components/app-dialog';
import { ratingLabel } from '../../components/rating-selector';
import { useAppData } from '../../data/DataProvider';
import { useAppTheme } from '../../theme';
import type { BrewStep, Brewer } from '../../models';
import { getBrewSteps } from '../../database/brews';
import { getBrewEquipmentByBrew } from '../../database/brewEquipment';
import { BREWER_KIND_LABELS, VERDICT_LABELS, METHOD_LABELS } from '../../utils/labels';
import { longDateLabel } from '../../utils/date';
import { brewRatio, derivedBrewDuration } from '../../services/brew-service';
import { formatRatio } from '../../services/method-service';
import { summarizeTastings } from '../../services/tasting-service';

export default function BrewDetailScreen() {
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { brews, beans, brewers, tastings, removeBrew } = useAppData();
  const [steps, setSteps] = useState<BrewStep[] | null>(null);
  const [equipmentIds, setEquipmentIds] = useState<number[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const brewId = Number(id);
  const brew = brews.find((candidate) => candidate.id === brewId);

  useEffect(() => {
    let active = true;
    async function load() {
      const [loadedSteps, loadedEquipment] = await Promise.all([
        getBrewSteps(brewId),
        getBrewEquipmentByBrew(brewId),
      ]);
      if (active) {
        setSteps(loadedSteps);
        setEquipmentIds(loadedEquipment.map((row) => row.brewerId));
      }
    }
    if (Number.isFinite(brewId)) {
      void load();
    }
    return () => {
      active = false;
    };
  }, [brewId]);

  if (!brew) {
    return (
      <>
        <Stack.Screen options={{ title: 'Brew' }} />
        <ScreenFade>
          <View style={[styles.center, { padding: theme.spacing[6] }]}>
            <Text variant="bodyLarge">That brew does not exist.</Text>
          </View>
        </ScreenFade>
      </>
    );
  }

  if (steps === null || equipmentIds === null) {
    return <LoadingScreen />;
  }

  const bean = beans.find((candidate) => candidate.id === brew.beanId);
  const beanLabel = bean?.name ?? brew.beanNameSnapshot ?? 'No bean';
  const brewTastings = tastings.filter((tasting) => tasting.brewId === brew.id);
  const summary = summarizeTastings(brewTastings);
  const ratio = formatRatio(brewRatio(brew));
  const duration = derivedBrewDuration(steps, brew.totalTimeS);
  const brewer = brewers.find((candidate) => candidate.id === brew.brewerId) ?? null;
  const grinder = brewers.find((candidate) => candidate.id === brew.grinderId) ?? null;
  const extraEquipment = equipmentIds
    .map((brewerId) => brewers.find((candidate) => candidate.id === brewerId))
    .filter((candidate): candidate is Brewer => candidate !== undefined);

  return (
    <ScreenFade>
      <Stack.Screen options={{ title: METHOD_LABELS[brew.methodId] }} />
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.container, { padding: theme.spacing[4] }]}
      >
        <Card mode="contained" style={styles.headerCard}>
          <Card.Content>
            <Text variant="titleMedium">{METHOD_LABELS[brew.methodId]}</Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {beanLabel} · {longDateLabel(brew.brewDate)}
            </Text>
          </Card.Content>
        </Card>

        <View style={styles.metrics}>
          <Metric label="Dose" value={brew.doseG === null ? '—' : `${brew.doseG} g`} />
          <Metric
            label="Water"
            value={brew.waterTotalG === null ? '—' : `${brew.waterTotalG} g`}
          />
          <Metric label="Yield" value={brew.yieldG === null ? '—' : `${brew.yieldG} g`} />
          <Metric label="Ratio" value={ratio} />
          <Metric
            label="Temp"
            value={brew.waterTempC === null ? '—' : `${brew.waterTempC} °C`}
          />
          <Metric
            label="Time"
            value={duration === null ? '—' : `${duration} s`}
          />
        </View>

        {brew.grindValue !== null ? (
          <List.Item
            title="Grind"
            description={`${brew.grindValue}${brew.grindUnit ? ` ${brew.grindUnit}` : ''}`}
            left={(props) => <List.Icon {...props} icon="cog-outline" />}
          />
        ) : null}

        {brewer !== null || grinder !== null || extraEquipment.length > 0 ? (
          <>
            <Divider style={styles.divider} />
            <Text variant="titleMedium" style={styles.section}>
              Equipment
            </Text>
            {brewer !== null ? (
              <List.Item
                title="Brewer"
                description={brewer.name}
                left={(props) => <List.Icon {...props} icon="coffee-outline" />}
              />
            ) : null}
            {grinder !== null ? (
              <List.Item
                title="Grinder"
                description={grinder.name}
                left={(props) => <List.Icon {...props} icon="cog-outline" />}
              />
            ) : null}
            {extraEquipment.map((item) => (
              <List.Item
                key={item.id}
                title={BREWER_KIND_LABELS[item.kind]}
                description={item.name}
                left={(props) => <List.Icon {...props} icon="scale-balance" />}
              />
            ))}
          </>
        ) : null}

        <Divider style={styles.divider} />
        <View style={styles.tastingHeader}>
          <Text variant="titleMedium">Tastings</Text>
          {summary.primaryRating !== null ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {ratingLabel(summary.primaryRating)}
            </Text>
          ) : null}
        </View>
        {brewTastings.length === 0 ? (
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Not tasted yet.
          </Text>
        ) : (
          brewTastings.map((tasting) => (
            <List.Item
              key={tasting.id}
              title={ratingLabel(tasting.overallRating)}
              description={tastingDescription(tasting)}
              left={(props) => <List.Icon {...props} icon="cup-outline" />}
              onPress={() => router.push(`/tasting/${brew.id}?id=${tasting.id}`)}
            />
          ))
        )}
        <Button
          mode="outlined"
          icon="plus"
          onPress={() => router.push(`/tasting/${brew.id}`)}
          style={styles.addTasting}
        >
          {brewTastings.length === 0 ? 'Add a tasting' : 'Add another tasting'}
        </Button>

        {steps.length > 0 ? (
          <>
            <Divider style={styles.divider} />
            <Text variant="titleMedium" style={styles.section}>
              Steps
            </Text>
            {steps.map((step, index) => (
              <List.Item
                key={step.id}
                title={step.label ?? `Step ${index + 1}`}
                description={stepDescription(step)}
                left={() => (
                  <Text variant="labelLarge" style={styles.stepIndex}>
                    {index + 1}
                  </Text>
                )}
              />
            ))}
          </>
        ) : null}

        {brew.notes ? (
          <>
            <Divider style={styles.divider} />
            <Text variant="titleMedium" style={styles.section}>
              Notes
            </Text>
            <Text variant="bodyMedium">{brew.notes}</Text>
          </>
        ) : null}

        <Divider style={styles.divider} />
        <Button
          mode="contained"
          icon="pencil"
          onPress={() => router.push(`/brew/new?id=${brew.id}`)}
        >
          Edit brew
        </Button>
        <Button
          mode="text"
          textColor={theme.semantic.error}
          icon="delete-outline"
          onPress={() => setConfirmDelete(true)}
          style={styles.delete}
        >
          Delete brew
        </Button>
      </KeyboardAwareScrollView>

      <Portal>
        <AppDialog visible={confirmDelete} onDismiss={() => setConfirmDelete(false)}>
          <Dialog.Title>Delete brew?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              The brew and its tastings are hidden from your history.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              textColor={theme.semantic.error}
              onPress={async () => {
                setConfirmDelete(false);
                await removeBrew(brew.id);
                router.back();
              }}
            >
              Delete
            </Button>
          </Dialog.Actions>
        </AppDialog>
      </Portal>
    </ScreenFade>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.metric}>
      <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
        {label}
      </Text>
      <Text variant="titleMedium">{value}</Text>
    </View>
  );
}

function tastingDescription(tasting: {
  verdict: keyof typeof VERDICT_LABELS | null;
  tastedAt: string | null;
  notes: string | null;
}): string {
  const parts: string[] = [];
  if (tasting.verdict !== null) {
    parts.push(VERDICT_LABELS[tasting.verdict]);
  }
  if (tasting.tastedAt !== null) {
    parts.push(longDateLabel(tasting.tastedAt));
  }
  if (tasting.notes) {
    parts.push(tasting.notes);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Logged';
}

function stepDescription(step: BrewStep): string {
  const parts: string[] = [];
  if (step.pourWaterG !== null) {
    parts.push(`${step.pourWaterG} g`);
  }
  if (step.targetWaterG !== null) {
    parts.push(`to ${step.targetWaterG} g`);
  }
  if (step.pourDurationS !== null) {
    parts.push(`${step.pourDurationS} s pour`);
  }
  if (step.waitAfterS !== null) {
    parts.push(`wait ${step.waitAfterS} s`);
  }
  if (step.agitationCount !== null) {
    parts.push(`${step.agitationCount} agitations`);
  }
  if (step.temperatureC !== null) {
    parts.push(`${step.temperatureC} °C`);
  }
  if (step.note) {
    parts.push(step.note);
  }
  return parts.length > 0 ? parts.join(' · ') : '—';
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCard: {
    marginBottom: 16,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  metric: {
    width: '33%',
    marginBottom: 12,
  },
  tastingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  addTasting: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  section: {
    marginTop: 8,
    marginBottom: 4,
  },
  stepIndex: {
    minWidth: 28,
    textAlign: 'center',
    marginTop: 12,
    opacity: 0.6,
  },
  divider: {
    marginVertical: 16,
  },
  delete: {
    marginTop: 8,
  },
});
