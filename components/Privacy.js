import { StyleSheet, Text, SafeAreaView, ScrollView, View, TouchableOpacity } from 'react-native'
import React from 'react'
import { useTheme } from '../context/ThemeContext'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'

export default function Privacy() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const colors = {
    background: theme.background,
    text: theme.text,
    border: theme.border,
  };

  const textColor = { color: colors.text }
  const sectionTitle = { color: colors.text, fontSize: 18, fontWeight: '600', marginTop: 20, marginBottom: 8 }
  const paragraph = { color: colors.text, fontSize: 14, lineHeight: 20 }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Privacy Policy</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={sectionTitle}>Introduction</Text>
        <Text style={paragraph}>
          Welcome to our Privacy Policy. Your privacy is important to us, and we are committed to protecting your personal information.
        </Text>

        <Text style={sectionTitle}>Information We Collect</Text>
        <Text style={paragraph}>
          We collect information you provide directly to us, such as when you create an account, update your profile, or communicate with us.
        </Text>

        <Text style={sectionTitle}>How We Use Information</Text>
        <Text style={paragraph}>
          We use the information we collect to provide, maintain, and improve our services, communicate with you, and ensure security.
        </Text>

        <Text style={sectionTitle}>Sharing of Information</Text>
        <Text style={paragraph}>
          We do not share your personal information with third parties except as necessary to provide our services or comply with legal obligations.
        </Text>

        <Text style={sectionTitle}>Data Security</Text>
        <Text style={paragraph}>
          We implement reasonable security measures to protect your information from unauthorized access and disclosure.
        </Text>

        <Text style={sectionTitle}>Your Rights</Text>
        <Text style={paragraph}>
          You have the right to access, correct, or delete your personal information. Please contact us if you wish to exercise these rights.
        </Text>

        <Text style={sectionTitle}>Changes to This Policy</Text>
        <Text style={paragraph}>
          We may update this Privacy Policy from time to time. We encourage you to review it periodically for any changes.
        </Text>

        <Text style={sectionTitle}>Contact Us</Text>
        <Text style={paragraph}>
          If you have any questions or concerns about this Privacy Policy, please contact us at support@vitola.com.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 12,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
})