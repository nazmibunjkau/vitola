import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, SafeAreaView, View, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const FAQ_DATA = [
  {
    id: 'scan-1',
    q: 'How do I scan a cigar band?',
    a: 'Open the Scanner tab, align the band within the guide, and hold steady. Use the flash in low light. If detection is unclear, you can still search by name.'
  },
  {
    id: 'privacy-1',
    q: 'What happens to my photos?',
    a: 'Images are sent securely to our detection service only for recognition, then discarded. We do not store them unless you explicitly save to a post or humidor.'
  },
  {
    id: 'clubs-1',
    q: 'How do club invites and membership work?',
    a: 'Club owners can invite users. For public clubs you can join from the club page. Members can like, comment, and attend events.'
  },
  {
    id: 'humidor-1',
    q: 'Is there a limit to humidor entries?',
    a: 'Free plans can add up to 6 cigars (counting quantities). Paid plans have no cap.'
  },
  {
    id: 'notifications-1',
    q: 'How do I manage notifications?',
    a: 'Go to Settings → Notifications to turn on/off likes, comments, follows, and club activity alerts.'
  },
  // Additional FAQs
  {
    id: 'free-vs-paid',
    q: 'What is the difference between free and paid accounts?',
    a: 'Free users can add up to 6 cigars in their humidor and access core features. Paid members get unlimited humidor entries, a verified badge, and enhanced features.'
  },
  {
    id: 'posts',
    q: 'Who can create posts in clubs?',
    a: 'Only members of a club (or its owner) can create posts. Non-members can view public clubs but cannot post until they join.'
  },
  {
    id: 'notif-settings',
    q: 'Can I control which notifications I receive?',
    a: 'Yes. Go to Settings → Notifications to toggle alerts for likes, comments, follows, and club activity. Changes are saved to your profile.'
  },
  {
    id: 'full-profile',
    q: 'What does completing my full profile do?',
    a: 'Completing your full profile helps other members know more about you and your cigar experience.'
  },
  {
    id: 'search',
    q: 'How does search work for clubs and profiles?',
    a: 'The search bar adapts to the active tab. On the Clubs tab it searches only clubs; on the Profiles tab it searches only user profiles.'
  },
];

export default function FAQ() {
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const [openId, setOpenId] = useState(null);

  const colors = useMemo(() => ({
    bg: theme?.background || (isDark ? '#0f0f10' : '#f7f7f8'),
    text: theme?.text || (isDark ? '#ffffff' : '#111111'),
    subtext: theme?.muted || (isDark ? theme.primary : theme.primary),
    card: theme?.card || (isDark ? '#1a1a1c' : '#ffffff'),
    border: theme?.border || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'),
    primary: theme?.primary || (isDark ? '#c58b4b' : '#7a3a0c')
  }), [theme, isDark]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>      
      <View style={[styles.header, { borderBottomColor: colors.border }]}>        
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => navigation.canGoBack() && navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>FAQ</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {FAQ_DATA.map(item => {
          const open = openId === item.id;
          return (
            <View key={item.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>              
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.7}
                onPress={() => setOpenId(open ? null : item.id)}
              >
                <View style={styles.rowLeft}>
                  <MaterialCommunityIcons name="help-circle-outline" size={22} color={colors.primary} style={{ marginRight: 8 }} />
                  <Text style={[styles.question, { color: colors.text }]}>{item.q}</Text>
                </View>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.subtext} />
              </TouchableOpacity>

              {open && (
                <View style={styles.answerWrap}>
                  <Text style={[styles.answer, { color: colors.subtext }]}>{item.a}</Text>
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: Platform.select({ ios: '600', android: '700' }),
  },
  content: {
    padding: 16,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  question: {
    fontSize: 16,
    flexShrink: 1,
  },
  answerWrap: { paddingTop: 6, paddingRight: 6 },
  answer: { fontSize: 14, lineHeight: 20 },
});