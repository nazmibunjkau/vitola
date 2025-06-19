import { View, SafeAreaView, StyleSheet, TouchableOpacity, Text, TextInput } from "react-native"
import React from 'react'
import { ArrowLeftIcon } from "react-native-heroicons/solid"
import { useTheme } from '../context/ThemeContext';

export default function DataUsage({ navigation }) {
  const { theme } = useTheme();
  return (
    <View style={styles(theme).container}>
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
      </SafeAreaView>
    </View> 
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
      marginTop: 50,
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
})