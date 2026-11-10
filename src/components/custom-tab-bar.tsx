import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/tabs';
import type { ComponentProps } from 'react';
import { useAppTheme } from '../theme';

const TAB_ICONS: Record<string, ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  index: 'home-outline',
  log: 'notebook-outline',
  equipment: 'scale',
  learn: 'lightbulb-outline',
  settings: 'cog-outline',
};

function TabItem({
  icon,
  label,
  isFocused,
  onPress,
  onLongPress,
  theme,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  theme: ReturnType<typeof useAppTheme>;
}) {
  const color = isFocused ? theme.colors.primary : theme.colors.onSurfaceVariant;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabItem}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
    >
      <View
        style={[
          styles.tabIndicator,
          {
            backgroundColor: isFocused ? theme.colors.primaryContainer : 'transparent',
            borderRadius: theme.radii.xl,
            paddingHorizontal: theme.spacing[4],
            paddingVertical: theme.spacing[1],
          },
        ]}
      >
        <MaterialCommunityIcons name={icon} color={color} size={24} />
      </View>
      <Text variant="labelSmall" style={[styles.tabLabel, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function CustomTabBar({ state, navigation, descriptors, insets }: BottomTabBarProps) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outlineVariant,
          paddingTop: theme.spacing[1],
          paddingBottom: theme.spacing[2] + insets.bottom,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const rawLabel = options.tabBarLabel ?? options.title ?? route.name;
        const label = typeof rawLabel === 'string' ? rawLabel : route.name;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        return (
          <TabItem
            key={route.key}
            icon={TAB_ICONS[route.name] ?? 'circle-outline'}
            label={label}
            isFocused={isFocused}
            onPress={onPress}
            onLongPress={onLongPress}
            theme={theme}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tabLabel: {
    marginTop: 2,
  },
});
