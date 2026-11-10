import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, Switch, Text, TextInput } from 'react-native-paper';
import type { BrewMethodId, Equipment, EquipmentKind, ScaleMode } from '../models';
import { EQUIPMENT_KINDS, SCALE_MODES } from '../models';
import type { EquipmentInput } from '../database/equipment';
import { useAppData } from '../data/DataProvider';
import { useAppTheme } from '../theme';
import { EQUIPMENT_KIND_LABELS, METHOD_LABELS, SCALE_MODE_LABELS } from '../utils/labels';
import { methodsForKind } from '../services/equipment-service';
import { KeyboardAwareScrollView } from './keyboard-aware-scroll-view';
import { NumberField } from './number-field';
import { OptionField } from './option-field';

interface EquipmentFormProps {
  initial: Equipment | null;
  defaultKind?: EquipmentKind;
  submitting: boolean;
  onSubmit: (input: EquipmentInput) => Promise<void>;
}

const KIND_OPTIONS = EQUIPMENT_KINDS.map((value) => ({
  value,
  label: EQUIPMENT_KIND_LABELS[value],
}));

export function EquipmentForm({
  initial,
  defaultKind = 'dripper',
  submitting,
  onSubmit,
}: EquipmentFormProps) {
  const theme = useAppTheme();
  const { methods } = useAppData();
  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState<EquipmentKind>(initial?.kind ?? defaultKind);
  const [methodId, setMethodId] = useState<BrewMethodId | null>(initial?.methodId ?? null);
  const [manufacturer, setManufacturer] = useState(initial?.manufacturer ?? '');
  const [model, setModel] = useState(initial?.model ?? '');
  const [capacityMl, setCapacityMl] = useState<number | null>(initial?.capacityMl ?? null);
  const [material, setMaterial] = useState(initial?.material ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [scalePrecisionG, setScalePrecisionG] = useState<number | null>(
    initial?.scalePrecisionG ?? null
  );
  const [scaleCapacityG, setScaleCapacityG] = useState<number | null>(
    initial?.scaleCapacityG ?? null
  );
  const [scaleModes, setScaleModes] = useState<ScaleMode[]>(initial?.scaleModes ?? []);
  const [grinderClicksPerRevolution, setGrinderClicksPerRevolution] = useState<number | null>(
    initial?.grinderClicksPerRevolution ?? null
  );
  const [grinderMicronPerClick, setGrinderMicronPerClick] = useState<number | null>(
    initial?.grinderMicronPerClick ?? null
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  const kindMethods = methodsForKind(kind, methods);
  const methodOptions = kindMethods.map((method) => ({
    value: method.id,
    label: METHOD_LABELS[method.id],
  }));

  const isScale = kind === 'scale';
  const isGrinder = kind === 'grinder';

  const toggleMode = (mode: ScaleMode) => {
    setScaleModes((current) =>
      current.includes(mode) ? current.filter((value) => value !== mode) : [...current, mode]
    );
  };

  const handleSubmit = async () => {
    if (name.trim() === '') {
      setError('Give the equipment a name.');
      return;
    }
    setError(null);
    await onSubmit({
      name: name.trim(),
      kind,
      methodId,
      manufacturer: emptyToNull(manufacturer),
      model: emptyToNull(model),
      capacityMl: isScale || isGrinder ? null : capacityMl,
      material: emptyToNull(material),
      notes: emptyToNull(notes),
      scalePrecisionG: isScale ? scalePrecisionG : null,
      scaleCapacityG: isScale ? scaleCapacityG : null,
      scaleModes: isScale ? scaleModes : null,
      grinderClicksPerRevolution: isGrinder ? grinderClicksPerRevolution : null,
      grinderMicronPerClick: isGrinder ? grinderMicronPerClick : null,
      isActive,
      sortOrder: initial?.sortOrder ?? 0,
    });
  };

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={[styles.container, { padding: theme.spacing[4] }]}
    >
      <TextInput
        label="Name"
        mode="outlined"
        value={name}
        onChangeText={setName}
        error={Boolean(error)}
        autoFocus={initial === null}
      />
      <View style={styles.field}>
        <OptionField<EquipmentKind>
          label="Kind"
          value={kind}
          options={KIND_OPTIONS}
          onChange={(value) => {
            const next = value ?? defaultKind;
            setKind(next);
            if (methodId !== null && !methodsForKind(next, methods).some((m) => m.id === methodId)) {
              setMethodId(null);
            }
          }}
          nullable={false}
        />
      </View>
      {methodOptions.length > 0 ? (
        <View style={styles.field}>
          <OptionField<BrewMethodId>
            label="Brew method"
            value={methodId}
            options={methodOptions}
            onChange={setMethodId}
            emptyLabel="Not tied to a method"
          />
        </View>
      ) : null}
      <TextInput
        label="Manufacturer"
        mode="outlined"
        value={manufacturer}
        onChangeText={setManufacturer}
        style={styles.field}
      />
      <TextInput
        label="Model"
        mode="outlined"
        value={model}
        onChangeText={setModel}
        style={styles.field}
      />
      {!isScale && !isGrinder ? (
        <View style={styles.field}>
          <NumberField label="Capacity" value={capacityMl} onChange={setCapacityMl} unit="ml" />
        </View>
      ) : null}
      {isScale ? (
        <>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <NumberField
                label="Precision"
                value={scalePrecisionG}
                onChange={setScalePrecisionG}
                unit="g"
              />
            </View>
            <View style={styles.gridItem}>
              <NumberField
                label="Capacity"
                value={scaleCapacityG}
                onChange={setScaleCapacityG}
                unit="g"
              />
            </View>
          </View>
          <Text variant="titleSmall" style={styles.groupTitle}>
            Modes
          </Text>
          <View style={styles.chips} accessibilityRole="list">
            {SCALE_MODES.map((mode) => {
              const selected = scaleModes.includes(mode);
              return (
                <Chip
                  key={mode}
                  selected={selected}
                  showSelectedCheck={false}
                  onPress={() => toggleMode(mode)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={SCALE_MODE_LABELS[mode]}
                  testID={`scale-mode-${mode}`}
                  style={styles.chip}
                >
                  {SCALE_MODE_LABELS[mode]}
                </Chip>
              );
            })}
          </View>
        </>
      ) : null}
      {isGrinder ? (
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <NumberField
              label="Clicks per revolution"
              value={grinderClicksPerRevolution}
              onChange={setGrinderClicksPerRevolution}
              integer
            />
          </View>
          <View style={styles.gridItem}>
            <NumberField
              label="Microns per click"
              value={grinderMicronPerClick}
              onChange={setGrinderMicronPerClick}
              unit="µm"
            />
          </View>
        </View>
      ) : null}
      <TextInput
        label="Material"
        mode="outlined"
        value={material}
        onChangeText={setMaterial}
        style={styles.field}
      />
      <TextInput
        label="Notes"
        mode="outlined"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
        style={styles.field}
      />
      <View style={styles.switchRow}>
        <Text variant="bodyLarge">Active</Text>
        <Switch value={isActive} onValueChange={setIsActive} />
      </View>
      {error ? (
        <Text variant="bodySmall" style={{ color: theme.semantic.error }}>
          {error}
        </Text>
      ) : null}
      <Button
        mode="contained"
        onPress={handleSubmit}
        loading={submitting}
        disabled={submitting}
        style={styles.submit}
      >
        {initial ? 'Save equipment' : 'Add equipment'}
      </Button>
    </KeyboardAwareScrollView>
  );
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  field: {
    marginTop: 12,
  },
  groupTitle: {
    marginTop: 16,
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  gridItem: {
    flex: 1,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    marginBottom: 4,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  submit: {
    marginTop: 24,
  },
});
