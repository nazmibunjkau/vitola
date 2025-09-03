import React, { useEffect, useState, useCallback, memo, useMemo } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, Switch, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { useTheme } from '../context/ThemeContext';
import { ArrowLeftIcon } from 'react-native-heroicons/solid';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const DEFAULT_PREFS = {
  likes: true,
  comments: true,
  follows: true,
  invites: true,
  eventReminders: true,
  attendeeJoins: true,
  marketing: true,
  newFeatures: true,
};

const STORAGE_KEY = 'notification_prefs_v1';

// simple deep-equal for our flat prefs object
const isEqualPrefs = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const Row = memo(function Row({ label, value, onValueChange, last, theme, isDark }) {
  return (
    <View
      style={[
        styles.row,
        { borderBottomColor: theme.border },
        last && { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 4 },
      ]}
    >
      <Text style={[styles.rowLabel, { color: theme.text }]} numberOfLines={2}>
        {label}
      </Text>
      <Switch
        value={!!value}
        onValueChange={onValueChange}
        thumbColor={isDark ? theme.card : '#fff'}
        trackColor={{ false: isDark ? '#444' : '#bbb', true: theme.primary }}
        ios_backgroundColor={isDark ? '#444' : '#bbb'}
      />
    </View>
  );
});

export default function Notifications({ navigation }) {
  const { theme, isDark } = useTheme();

  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedPrefs, setLastSavedPrefs] = useState(DEFAULT_PREFS);

  const makeToggle = useCallback((key) => () => {
    setPrefs((prev) => {
      const next = { ...prev };
      next[key] = !prev[key];
      return next;
    });
  }, []);

  const loadPrefs = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      let local = raw ? JSON.parse(raw) : null;

      const uid = auth.currentUser?.uid;
      let remote = null;
      if (uid) {
        const snap = await getDoc(doc(db, 'users', uid, 'settings', 'notification_prefs'));
        if (snap.exists()) remote = snap.data();
      }

      const merged = { ...DEFAULT_PREFS, ...(remote || {}), ...(local || {}) };
      setPrefs(merged);
      setLastSavedPrefs(merged);
    } catch {
      setPrefs(DEFAULT_PREFS);
      setLastSavedPrefs(DEFAULT_PREFS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  const onSave = useCallback(async () => {
    try {
      setSaving(true);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      const uid = auth.currentUser?.uid;
      if (uid) {
        await setDoc(
          doc(db, 'users', uid, 'settings', 'notification_prefs'),
          { ...prefs, updatedAt: serverTimestamp() },
          { merge: true }
        );
      }
      setLastSavedPrefs(prefs);
      Alert.alert('Saved', 'Your notification preferences were updated.');
    } catch (e) {
      Alert.alert('Error', 'Could not save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [prefs]);

  const onReset = () => {
    setPrefs({ ...DEFAULT_PREFS });
  };

  const isDirty = useMemo(() => !isEqualPrefs(prefs, lastSavedPrefs), [prefs, lastSavedPrefs]);

  const confirmLeave = useCallback((proceed) => {
    Alert.alert(
      'Unsaved changes',
      'You have unsaved notification changes. Save before leaving?',
      [
        { text: 'Save', onPress: () => { onSave().then(() => proceed()); } },
        { text: 'Discard', style: 'destructive', onPress: () => proceed() },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [onSave]);

  const handleBack = useCallback(() => {
    // Let the central beforeRemove guard handle prompting once.
    navigation.goBack();
  }, [navigation]);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (!isDirty || saving) return; // nothing to do
      e.preventDefault();
      confirmLeave(() => navigation.dispatch(e.data.action));
    });
    return unsub;
  }, [navigation, isDirty, saving, confirmLeave]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <TouchableOpacity onPress={handleBack} style={{ paddingRight: 16 }}>
          <ArrowLeftIcon width={30} height={30} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Notifications</Text>
        <View style={{ width: 24, height: 24 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Section: Activity */}
        <Text style={[styles.sectionTitle, { color: theme.primary }]} accessibilityRole="header">
          Activity
        </Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Row label="Likes on my posts" value={prefs.likes} onValueChange={makeToggle('likes')} theme={theme} isDark={isDark} />
          <Row label="Comments on my posts" value={prefs.comments} onValueChange={makeToggle('comments')} theme={theme} isDark={isDark} />
          <Row label="New followers" value={prefs.follows} onValueChange={makeToggle('follows')} last theme={theme} isDark={isDark} />
        </View>

        {/* Section: Clubs & Events */}
        <Text style={[styles.sectionTitle, { color: theme.primary }]} accessibilityRole="header">
          Clubs &amp; Events
        </Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Row label="Club invites" value={prefs.invites} onValueChange={makeToggle('invites')} theme={theme} isDark={isDark} />
          <Row label="Event reminders" value={prefs.eventReminders} onValueChange={makeToggle('eventReminders')} theme={theme} isDark={isDark} />
          <Row label="When attendees join my event" value={prefs.attendeeJoins} onValueChange={makeToggle('attendeeJoins')} last theme={theme} isDark={isDark} />
        </View>

        {/* Section: From Vitola */}
        <Text style={[styles.sectionTitle, { color: theme.primary }]} accessibilityRole="header">
          From Vitola
        </Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Row label="Product updates & new features" value={prefs.newFeatures} onValueChange={makeToggle('newFeatures')} theme={theme} isDark={isDark} />
          <Row label="Tips, promotions & news" value={prefs.marketing} onValueChange={makeToggle('marketing')} last theme={theme} isDark={isDark} />
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={onReset}
            disabled={saving}
            style={[
              styles.secondaryBtn,
              {
                borderColor: theme.primary,
                backgroundColor: isDark ? theme.primary : theme.background,
              },
            ]}
          >
            <Text style={[styles.secondaryText, { color: theme.primary }]}>Reset to defaults</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onSave}
            disabled={saving || loading}
            style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
          >
            <Text style={[styles.primaryText, { color: theme.background || '#fff' }]}>
              {saving ? 'Saving…' : 'Save preferences'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.footnote, { color: theme.primary }]}>
          You can also manage system push permissions in your device settings.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'Avenir, Montserrat, Corbel, URW Gothic, source-sans-pro, sans-serif',
    letterSpacing: 0.2,
  },
  scroll: { flex: 1 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 8,
    letterSpacing: 0.6,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  row: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: 16,
    flexShrink: 1,
    paddingRight: 12,
  },
  actions: {
    gap: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  primaryBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '600',
  },
  footnote: {
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
  },
});