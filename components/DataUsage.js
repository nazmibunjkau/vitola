import { View, SafeAreaView, StyleSheet, TouchableOpacity, Text, TextInput, Linking, Alert, ScrollView } from "react-native"
import React from 'react'
import { ArrowLeftIcon } from "react-native-heroicons/solid"
import { useTheme } from '../context/ThemeContext';

export default function DataUsage({ navigation }) {
  const { theme } = useTheme();

  const handleRequestExport = () => {
    // Placeholder – wire to backend export job later
    Alert.alert('Request submitted', 'We\'ll start preparing your export. You can close this screen.');
  };
  const handleDeleteAccount = () => {
    // Placeholder – navigate to your existing account deletion flow if you have one
    Alert.alert('Delete account', 'This will permanently delete your account and data after a grace period.');
  };
  const openPolicy = () => Linking.openURL('https://yourdomain.com/privacy');
  const openDataSafety = () => Linking.openURL('https://yourdomain.com/data-safety');

  return (
    <ScrollView style={styles(theme).container}>
      <SafeAreaView className="flex">
        <View style={styles(theme).headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles(theme).backButton}>
            <ArrowLeftIcon {...styles(theme).leftArrow} />
          </TouchableOpacity>
          <Text style={styles(theme).headerText}>Data Usage</Text>
        </View>
        <View style={styles(theme).subSection}>
          <Text style={styles(theme).subHeading}>Download personal data</Text>
          <Text style={styles(theme).subText}>It could take a few weeks to prepare your data. Once it is ready, your data will be available to download for 30 days.</Text>
          <Text style={styles(theme).subTextHeader}>Why we collect data?</Text>
          <Text style={styles(theme).subText}>We collect data to provide a better user experience, improve our services, and ensure the security of our platform which complies with applicable laws and regulations. We don't sell your personal information. Learn more about our practices in our Privacy Policy.</Text>
        </View>

        <View style={styles(theme).divider} />

        <View style={styles(theme).subSection}>
          <Text style={styles(theme).subHeading}>Your privacy rights</Text>
          <Text style={styles(theme).bullet}>Access & Portability – request a copy of your personal data (JSON/CSV).</Text>
          <Text style={styles(theme).bullet}>Deletion – delete your account and associated data from within the app.</Text>
          <Text style={styles(theme).bullet}>Correction – update profile information at any time.</Text>
          <Text style={styles(theme).bullet}>Consent Controls – manage notification and analytics preferences in Settings.</Text>
        </View>

        <View style={styles(theme).subSection}>
          <Text style={styles(theme).subHeading}>Verification & timing</Text>
          <Text style={styles(theme).subText}>For security, we may ask you to re‑authenticate before fulfilling a request. Exports are typically ready within 30 days and available to download for 30 days after they are ready.</Text>
          <Text style={styles(theme).subText}>Exports include your profile, posts, activity, and account metadata. Content removed before completion may not appear in the export.</Text>
        </View>

        <View style={styles(theme).subSection}>
          <TouchableOpacity style={styles(theme).primaryButton} onPress={handleRequestExport}>
            <Text style={styles(theme).primaryButtonText}>Request my data export</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles(theme).dangerButton} onPress={handleDeleteAccount}>
            <Text style={styles(theme).dangerButtonText}>Delete my account & data</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
            <TouchableOpacity onPress={openPolicy}>
              <Text style={styles(theme).link}>Privacy Policy</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={openDataSafety}>
              <Text style={styles(theme).link}>Data & Safety Practices</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </ScrollView>
  )
}

const styles = (theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background
    },
    backButton: {
        marginTop: 10,
    },
    leftArrow: {
        width: 30,
        height: 30,
        color: theme.text
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
      marginLeft: 16,
    },
    headerText: {
      fontSize: 20,
      fontWeight: '600',
      fontFamily: 'Avenir, Montserrat, Corbel, URW Gothic, source-sans-pro, sans-serif',
      color: theme.text,
      marginLeft: 26,
      marginTop: 10,
    },
    subSection: {
      marginTop: 30,
      marginHorizontal: 20,
    },
    subHeading: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 16,
      fontFamily: 'Avenir, Montserrat, Corbel, URW Gothic, source-sans-pro, sans-serif',
    },
    subText: {
      fontSize: 14,
      fontWeight: '400',
      color: theme.text,
      marginBottom: 16,
      fontFamily: 'Avenir, Montserrat, Corbel, URW Gothic, source-sans-pro, sans-serif',
    },
    subTextHeader: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 16,
      fontFamily: 'Avenir, Montserrat, Corbel, URW Gothic, source-sans-pro, sans-serif',
    },
  // Existing styles above
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.border,
    marginTop: 16,
  },
  bullet: {
    fontSize: 14,
    fontWeight: '400',
    color: theme.text,
    marginBottom: 10,
    fontFamily: 'Avenir, Montserrat, Corbel, URW Gothic, source-sans-pro, sans-serif',
  },
  primaryButton: {
    backgroundColor: theme.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: theme.onPrimary || theme.background,
    fontWeight: '600',
    fontSize: 16,
  },
  dangerButton: {
    backgroundColor: theme.danger || '#C0392B',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  dangerButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  link: {
    color: theme.link || theme.primary,
    textDecorationLine: 'underline',
    fontSize: 14,
  },
})