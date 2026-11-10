import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Divider, List, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenFade } from '../../components/screen-fade';
import { KeyboardAwareScrollView } from '../../components/keyboard-aware-scroll-view';
import { EmptyState } from '../../components/empty-state';
import { CherryLogo } from '../../components/cherry-logo';
import { Greeter } from '../../components/greeter';
import { StatCard, StatCardRow } from '../../components/stat-card';
import { useAppData } from '../../data/DataProvider';
import { useAppTheme } from '../../theme';
import { activeBeans, beanFreshness } from '../../services/bean-service';
import { averageRatingOfRecentBrews, countBrewsSince } from '../../services/brew-service';
import { primaryRating } from '../../services/tasting-service';
import { greetingForDay } from '../../services/greeting-service';
import { METHOD_LABELS } from '../../utils/labels';
import { dayLabel, daysBetween, startOfWeekDate, todayDate } from '../../utils/date';

const RECENT_LIMIT = 5;
const RATING_WINDOW = 10;

function relativeDay(isoDate: string): string {
  const today = todayDate();
  if (isoDate === today) {
    return 'Today';
  }
  if (daysBetween(isoDate, today) === 1) {
    return 'Yesterday';
  }
  return dayLabel(isoDate);
}

export default function OverviewScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { brews, beans, tastings } = useAppData();

  const weekCount = useMemo(
    () => countBrewsSince(brews, startOfWeekDate()),
    [brews]
  );
  const recentAverage = useMemo(
    () => averageRatingOfRecentBrews(brews, tastings, RATING_WINDOW),
    [brews, tastings]
  );
  const recent = brews.slice(0, RECENT_LIMIT);
  const rotation = useMemo(() => activeBeans(beans), [beans]);
  const greeting = useMemo(() => greetingForDay(todayDate()), []);

  return (
    <ScreenFade>
      <KeyboardAwareScrollView
        contentContainerStyle={[
          styles.container,
          { padding: theme.spacing[4], paddingTop: insets.top + theme.spacing[4] },
        ]}
      >
        <View style={styles.brand}>
          <CherryLogo size={40} />
          <Text variant="titleLarge" style={styles.wordmark}>
            Cherry
          </Text>
        </View>

        <Greeter greeting={greeting} />

        <Text variant="titleMedium" style={styles.section}>
          Recent brews
        </Text>
        {recent.length === 0 ? (
          <EmptyState
            icon={
              <MaterialCommunityIcons
                name="filter-outline"
                size={48}
                color={theme.colors.onSurfaceVariant}
              />
            }
            message="No brews yet. Log one by hand to start your history."
            actionLabel="Log a brew"
            onAction={() => router.push('/brew/new')}
          />
        ) : (
          recent.map((brew) => {
            const rating = primaryRating(
              tastings.filter((tasting) => tasting.brewId === brew.id)
            );
            const beanName = brew.beanNameSnapshot ?? 'No bean';
            return (
              <List.Item
                key={brew.id}
                title={METHOD_LABELS[brew.methodId]}
                description={`${beanName} · ${relativeDay(brew.brewDate)} · ${
                  rating === null ? 'Not rated' : `${rating} / 5`
                }`}
                left={(props) => <List.Icon {...props} icon="coffee-outline" />}
                onPress={() => router.push(`/brew/${brew.id}`)}
              />
            );
          })
        )}

        <View style={styles.stats}>
          <StatCardRow>
            <StatCard
              label="This week"
              value={brews.length === 0 ? null : weekCount}
              format={(value) => String(Math.round(value))}
              sub="brews logged"
            />
            <StatCard
              label="Last ten"
              value={recentAverage}
              format={(value) => value.toFixed(1)}
              sub="average rating"
            />
          </StatCardRow>
        </View>

        <Divider style={styles.divider} />
        <Text variant="titleMedium" style={styles.section}>
          Beans in rotation
        </Text>
        {rotation.length === 0 ? (
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            No active beans. Add one to track freshness and weight.
          </Text>
        ) : (
          rotation.map((bean) => {
            const freshness = beanFreshness(bean.roastDate);
            const roast =
              freshness.daysSinceRoast === null
                ? 'No roast date'
                : `${freshness.daysSinceRoast} d since roast`;
            return (
              <List.Item
                key={bean.id}
                title={bean.name}
                description={roast}
                left={(props) => <List.Icon {...props} icon="coffee" />}
                right={(props) => <List.Icon {...props} icon="chevron-right" />}
                onPress={() => router.push(`/bean/${bean.id}`)}
              />
            );
          })
        )}
        <Button
          mode="text"
          icon="plus"
          onPress={() => router.push('/bean/new')}
          style={styles.addBean}
        >
          Add a bean
        </Button>
      </KeyboardAwareScrollView>
    </ScreenFade>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingBottom: 96,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  wordmark: {
    marginLeft: 10,
    fontWeight: '700',
  },
  section: {
    marginTop: 8,
    marginBottom: 4,
  },
  stats: {
    marginTop: 12,
  },
  divider: {
    marginVertical: 16,
  },
  addBean: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
});
