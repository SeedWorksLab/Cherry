import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Divider, Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BrewMethodId, Brew, GrindUnit } from '../models';
import { GRIND_UNITS } from '../models';
import type { BrewInput } from '../database/brews';
import { useAppData } from '../data/DataProvider';
import { useAppTheme } from '../theme';
import { GRIND_UNIT_LABELS, METHOD_LABELS } from '../utils/labels';
import { todayDate } from '../utils/date';
import { beanNameSnapshot, derivedBrewDuration, brewRatio } from '../services/brew-service';
import { checkHealthyRanges, formatRatio } from '../services/method-service';
import {
  availableMethods,
  compatibleBrewers,
  methodById,
  otherEquipment,
} from '../services/equipment-service';
import { KeyboardAwareScrollView } from './keyboard-aware-scroll-view';
import { DateField } from './date-field';
import { NumberField } from './number-field';
import { OptionField } from './option-field';
import { StepListEditor } from './step-list-editor';
import type { EditableStep } from './step-list-editor';

interface BrewFormProps {
  initial: Brew | null;
  initialSteps: EditableStep[];
  initialEquipmentIds: number[];
  submitting: boolean;
  onSubmit: (input: BrewInput) => Promise<void>;
}

const GRIND_UNIT_OPTIONS = GRIND_UNITS.map((value) => ({
  value,
  label: GRIND_UNIT_LABELS[value],
}));

export function BrewForm({
  initial,
  initialSteps,
  initialEquipmentIds,
  submitting,
  onSubmit,
}: BrewFormProps) {
  const theme = useAppTheme();
  const { brewers, beans, grindSettings, settings, methods } = useAppData();

  const methodOptions = availableMethods(brewers, methods).map((method) => ({
    value: method.id,
    label: METHOD_LABELS[method.id],
  }));
  if (
    initial?.methodId !== null &&
    initial?.methodId !== undefined &&
    !methodOptions.some((option) => option.value === initial.methodId)
  ) {
    methodOptions.push({ value: initial.methodId, label: METHOD_LABELS[initial.methodId] });
  }

  const [methodId, setMethodId] = useState<BrewMethodId>(
    initial?.methodId ?? settings.defaultMethodId ?? availableMethods(brewers, methods)[0]?.id ?? 'v60'
  );
  const [brewDate, setBrewDate] = useState(initial?.brewDate ?? todayDate());
  const [beanId, setBeanId] = useState<number | null>(initial?.beanId ?? null);
  const [brewerId, setBrewerId] = useState<number | null>(initial?.brewerId ?? null);
  const [equipmentIds, setEquipmentIds] = useState<number[]>(initialEquipmentIds);
  const [doseG, setDoseG] = useState<number | null>(initial?.doseG ?? null);
  const [waterTotalG, setWaterTotalG] = useState<number | null>(
    initial?.waterTotalG ?? null
  );
  const [yieldG, setYieldG] = useState<number | null>(initial?.yieldG ?? null);
  const [waterTempC, setWaterTempC] = useState<number | null>(initial?.waterTempC ?? null);
  const [totalTimeS, setTotalTimeS] = useState<number | null>(initial?.totalTimeS ?? null);
  const [grinderId, setGrinderId] = useState<number | null>(initial?.grinderId ?? null);
  const [grindSettingId, setGrindSettingId] = useState<number | null>(
    initial?.grindSettingId ?? null
  );
  const [grindValue, setGrindValue] = useState<number | null>(initial?.grindValue ?? null);
  const [grindUnit, setGrindUnit] = useState<GrindUnit | null>(initial?.grindUnit ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [steps, setSteps] = useState<EditableStep[]>(initialSteps);

  const beanOptions = beans
    .filter((bean) => bean.isActive || bean.id === beanId)
    .map((bean) => ({ value: bean.id, label: bean.name }));
  const brewerOptions = useMemo(() => {
    const method = methodById(methodId, methods);
    const compatible = method === null ? [] : compatibleBrewers(brewers, method);
    const compatibleIds = new Set(compatible.map((brewer) => brewer.id));
    const keepCurrent = brewers.filter(
      (brewer) => brewer.id === brewerId && !compatibleIds.has(brewer.id)
    );
    return [...compatible, ...keepCurrent].map((brewer) => ({
      value: brewer.id,
      label: brewer.name,
    }));
  }, [brewers, methods, methodId, brewerId]);
  const grinderOptions = brewers
    .filter((brewer) => brewer.kind === 'grinder')
    .map((brewer) => ({ value: brewer.id, label: brewer.name }));
  const settingOptions = grindSettings
    .filter((setting) => grinderId === null || setting.brewerId === grinderId)
    .map((setting) => ({ value: setting.id, label: setting.name }));

  const equipmentOptions = useMemo(
    () => otherEquipment(brewers, brewerId === null ? [] : [brewerId]),
    [brewers, brewerId]
  );

  const toggleEquipment = (id: number) => {
    setEquipmentIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  };

  const selectedBean = beans.find((bean) => bean.id === beanId) ?? null;
  const ratio = formatRatio(brewRatio({ doseG, waterTotalG }));
  const duration = derivedBrewDuration(steps, totalTimeS);
  const violations = checkHealthyRanges(methodId, {
    doseG,
    waterTotalG,
    waterTempC,
    totalTimeS,
  });

  const handleSubmit = async () => {
    const snapshot =
      selectedBean !== null
        ? beanNameSnapshot(selectedBean)
        : initial?.beanId === beanId
          ? initial.beanNameSnapshot
          : null;

    await onSubmit({
      methodId,
      brewerId,
      beanId,
      planId: initial?.planId ?? null,
      recommendationId: initial?.recommendationId ?? null,
      voiceSessionId: initial?.voiceSessionId ?? null,
      brewDate,
      startedAt: initial?.startedAt ?? null,
      endedAt: initial?.endedAt ?? null,
      doseG,
      waterTotalG,
      waterTempC,
      yieldG,
      grinderId,
      grindSettingId,
      grindValue,
      grindUnit,
      totalTimeS,
      beanNameSnapshot: snapshot,
      notes: notes.trim() === '' ? null : notes.trim(),
      steps,
      equipmentIds,
    });
  };

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={[styles.container, { padding: theme.spacing[4] }]}
    >
      <OptionField<BrewMethodId>
        label="Method"
        value={methodId}
        options={methodOptions}
        onChange={(value) => {
          const next = value ?? 'v60';
          setMethodId(next);
          setBrewerId((current) => {
            if (current === null) {
              return current;
            }
            const method = methodById(next, methods);
            if (method === null) {
              return current;
            }
            return compatibleBrewers(brewers, method).some((brewer) => brewer.id === current)
              ? current
              : null;
          });
        }}
        nullable={false}
      />
      {brewers.length === 0 ? (
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}
        >
          No equipment yet — add some in the Equipment tab to narrow this list to what you own.
        </Text>
      ) : null}
      <View style={styles.field}>
        <DateField label="Brew date" value={brewDate} onChange={(value) => setBrewDate(value ?? todayDate())} />
      </View>

      <View style={styles.summary}>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {ratio} · {duration === null ? '— s' : `${duration} s`}
        </Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.gridItem}>
          <NumberField label="Dose" value={doseG} onChange={setDoseG} unit="g" />
        </View>
        <View style={styles.gridItem}>
          <NumberField label="Water" value={waterTotalG} onChange={setWaterTotalG} unit="g" />
        </View>
        <View style={styles.gridItem}>
          <NumberField label="Yield" value={yieldG} onChange={setYieldG} unit="g" />
        </View>
        <View style={styles.gridItem}>
          <NumberField
            label="Temperature"
            value={waterTempC}
            onChange={setWaterTempC}
            unit="°C"
          />
        </View>
        <View style={styles.gridItem}>
          <NumberField
            label="Total time"
            value={totalTimeS}
            onChange={setTotalTimeS}
            unit="s"
            integer
          />
        </View>
      </View>

      {violations.length > 0 ? (
        <Card mode="outlined" style={styles.warnCard}>
          <Card.Content>
            <View style={styles.warnHeader}>
              <MaterialCommunityIcons
                name="alert-outline"
                size={20}
                color={theme.semantic.warning}
              />
              <Text variant="titleSmall" style={styles.warnTitle}>
                Worth a second look
              </Text>
            </View>
            {violations.map((violation) => (
              <Text key={violation.knob} variant="bodySmall" style={styles.warnText}>
                {violation.reason}
              </Text>
            ))}
          </Card.Content>
        </Card>
      ) : null}

      <Divider style={styles.divider} />
      <Text variant="titleSmall" style={styles.groupTitle}>
        Brew with
      </Text>
      <OptionField<number>
        label="Bean"
        value={beanId}
        options={beanOptions}
        onChange={setBeanId}
        emptyLabel="Not set"
      />
      <View style={styles.field}>
        <OptionField<number>
          label="Brewer"
          value={brewerId}
          options={brewerOptions}
          onChange={setBrewerId}
          emptyLabel="Not set"
        />
      </View>
      {equipmentOptions.length > 0 ? (
        <View>
          <Text variant="bodySmall" style={styles.equipmentLabel}>
            Also used
          </Text>
          <View style={styles.chips}>
            {equipmentOptions.map((brewer) => {
              const selected = equipmentIds.includes(brewer.id);
              return (
                <Chip
                  key={brewer.id}
                  selected={selected}
                  showSelectedCheck={false}
                  onPress={() => toggleEquipment(brewer.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={brewer.name}
                  style={styles.chip}
                  testID={`equipment-${brewer.id}`}
                >
                  {brewer.name}
                </Chip>
              );
            })}
          </View>
        </View>
      ) : null}

      <Divider style={styles.divider} />
      <Text variant="titleSmall" style={styles.groupTitle}>
        Grind
      </Text>
      <OptionField<number>
        label="Grinder"
        value={grinderId}
        options={grinderOptions}
        onChange={setGrinderId}
        emptyLabel="Not set"
      />
      <View style={styles.field}>
        <OptionField<number>
          label="Grind setting"
          value={grindSettingId}
          options={settingOptions}
          onChange={setGrindSettingId}
          emptyLabel="Not set"
        />
      </View>
      <View style={styles.grid}>
        <View style={styles.gridItem}>
          <NumberField label="Grind value" value={grindValue} onChange={setGrindValue} />
        </View>
        <View style={styles.gridItem}>
          <OptionField<GrindUnit>
            label="Unit"
            value={grindUnit}
            options={GRIND_UNIT_OPTIONS}
            onChange={setGrindUnit}
            emptyLabel="Not set"
          />
        </View>
      </View>

      <Divider style={styles.divider} />
      <Text variant="titleSmall" style={styles.groupTitle}>
        Steps
      </Text>
      <StepListEditor steps={steps} onChange={setSteps} />

      <Divider style={styles.divider} />
      <TextInput
        label="Notes"
        mode="outlined"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
      />
      <Button
        mode="contained"
        onPress={handleSubmit}
        loading={submitting}
        disabled={submitting}
        style={styles.submit}
      >
        {initial ? 'Save brew' : 'Log brew'}
      </Button>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  field: {
    marginTop: 12,
  },
  equipmentLabel: {
    marginTop: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    marginRight: 0,
  },
  summary: {
    marginTop: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  gridItem: {
    width: '50%',
    paddingRight: 6,
    marginTop: 12,
  },
  warnCard: {
    marginTop: 12,
  },
  warnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  warnTitle: {
    marginLeft: 6,
  },
  warnText: {
    marginTop: 2,
  },
  divider: {
    marginVertical: 16,
  },
  groupTitle: {
    marginBottom: 10,
  },
  submit: {
    marginTop: 24,
  },
});
