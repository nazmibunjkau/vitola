import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from "react"
import { SafeAreaView } from 'react-native-safe-area-context'
import { auth } from '../config/firebase';
import { signOut } from 'firebase/auth';
import { useTheme } from '../context/ThemeContext';
import { ArrowLeftIcon } from "react-native-heroicons/solid"

export default function Settings({ navigation }) {
  const { theme } = useTheme();
  const [fullName, setFullName] = useState("")
  const [emailAddress, setEmailAddress] = useState("")

  const handleLogout = async () => {
    await signOut(auth);
  }

  const handleOptionPress = (label) => {
    switch (label) {
      case 'Account Information':
        navigation.navigate('AccountInfo');
        break;
      case 'Notifications':
        navigation.navigate('Notifications');
        break;
      case 'App Appearance':
        navigation.navigate('Appearance');
        break;
      case 'Data Usage':
        navigation.navigate('DataUsage');
        break;
      case 'Security':
        navigation.navigate('Security');
        break;
      case 'Privacy':
        navigation.navigate('Privacy');
        break;
      case 'Support':
        navigation.navigate('Support');
        break;
      case 'FAQ':
        navigation.navigate('FAQ');
        break;
      case 'Aficionado Badge':
        navigation.navigate('Aficionado');
        break;
      default:
        break;
    }
  };
  
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();

          // Safely get name: try fullName, else name, else ''
          setFullName(userData.fullName || userData.name || "");
          setEmailAddress(userData.email || "");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    fetchUser();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'space-evenly', backgroundColor: theme.background }}>
      <SafeAreaView style={[styles.container, {backgroundColor: theme.background}]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          {/* Back Arrow Icon */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ marginRight: 16, marginTop: 10, padding: 4 }}
          >
            <ArrowLeftIcon width={28} height={28} color={theme.primary} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.greeting, { color: theme.primary }]}>{fullName}</Text>
            <Text style={[styles.email, { color: theme.primary }]}>{emailAddress}</Text>
          </View>
        </View>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <View style={[styles.optionBox, {backgroundColor: theme.accent}]}>
            {[
              { label: "Account Information", icon: "person-outline" },
              { label: "Aficionado Badge", icon: "ribbon-outline" },
              { label: "Notifications", icon: "notifications-outline" },
              { label: "App Appearance", icon: "color-palette-outline" },
              { label: "Data Usage", icon: "cloud-outline" },
              { label: "Security", icon: "shield-checkmark-outline" },
              { label: "Privacy", icon: "lock-closed-outline" },
              { label: "Support", icon: "help-circle-outline" },
              { label: "FAQ", icon: "help-buoy-outline" },
            ].map(({ label, icon }) => (
              <TouchableOpacity key={label} style={styles.optionRow} onPress={() => handleOptionPress(label)}>
                <View style={styles.rowLeft}>
                  <Ionicons name={icon} size={20} color={theme.primary} style={styles.optionIcon} />
                  <Text style={[styles.optionLabel, {color: theme.primary}]}>{label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.primary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SafeAreaView>
      <TouchableOpacity style={[styles.logoutButton, {backgroundColor: theme.primary}]}
        onPress={handleLogout}
      >
        <Text style={[styles.logoutButtonText, {color: theme.background}]}>Logout</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
    },
    greeting: {
        fontSize: 34,
        fontWeight: '300',
        fontFamily: 'Avenir, Montserrat, Corbel, URW Gothic, source-sans-pro, sans-serif',
        marginTop: 20,
        marginBottom: 6,
    },
    email: {
        fontSize: 18,
        fontWeight: '400',
        fontFamily: 'Avenir, Montserrat, Corbel, URW Gothic, source-sans-pro, sans-serif',
    }, 
    logoutButton: {
        paddingVertical: 10,
        borderRadius: 16,
        paddingHorizontal: 16,
        marginBottom: 30,
        alignSelf: 'center',
        width: '90%',
    },
    logoutButtonText: {
        fontSize: 16,
        fontWeight: '400',
        fontFamily: 'Avenir, Montserrat, Corbel, URW Gothic, source-sans-pro, sans-serif',
        textAlign: 'center',
    },
    optionBox: {
      borderRadius: 16,
      marginHorizontal: 20,
      paddingVertical: 10,
    },
    optionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    optionLabel: {
      fontSize: 16,
      fontWeight: '400',
      fontFamily: 'Avenir, Montserrat, Corbel, URW Gothic, source-sans-pro, sans-serif',
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    optionIcon: {
      marginRight: 12,
    },
})