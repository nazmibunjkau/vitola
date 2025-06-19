import { View, SafeAreaView, StyleSheet, TouchableOpacity, Text, TextInput, Keyboard, TouchableWithoutFeedback } from "react-native"
import { ArrowLeftIcon } from "react-native-heroicons/solid"
import React, { useEffect, useState } from 'react'
import { auth } from "../config/firebase"
import { useTheme } from '../context/ThemeContext';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';

export default function AccountInfo({ navigation }) {
  const { theme } = useTheme();
  const [fullName, setFullName] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      const user = auth.currentUser;
      if (user) {
        await user.reload();
        const name = user.displayName || "User";
        const email = user.email || "No email provided";
        setFullName(name);
        setEmailAddress(email);
      }
    };
    fetchUser();
  }, []);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accesible={false}>
      <View style={styles(theme).container}>
        <SafeAreaView className="flex">
          <View style={styles(theme).headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles(theme).backButton}>
              <ArrowLeftIcon {...styles(theme).leftArrow} />
            </TouchableOpacity>
            <Text style={styles(theme).headerText}>Account Information</Text>
          </View>
          <View style={styles(theme).subSection}>
            <Text style={styles(theme).subHeading}>Contact Information</Text>
            <Text style={styles(theme).label}>Name</Text>
            <TextInput
              style={styles(theme).input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your name"
              editable={false}
            />
          </View>
          <View style={styles(theme).subSection}>
            <Text style={styles(theme).subHeading}>Account Information</Text>
            <Text style={styles(theme).label}>Email Address</Text>
            <TextInput
              style={styles(theme).input}
              value={emailAddress}
              onChangeText={setEmailAddress}
              editable={false}
            />
          </View>
          <View style={styles(theme).subSection}>
            <Text style={styles(theme).subHeading}>Change Password</Text>
            <Text style={styles(theme).label}>Old Password</Text>
            <TextInput
              style={styles(theme).input}
              placeholder="Enter old password"
              secureTextEntry
              value={oldPassword}
              onChangeText={setOldPassword}
            />
            <Text style={styles(theme).label}>New Password</Text>
            <TextInput
              style={styles(theme).input}
              placeholder="Enter new password"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <Text style={styles(theme).label}>Confirm Password</Text>
            <TextInput
              style={styles(theme).input}
              placeholder="Re-enter new password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            {oldPassword !== '' && (
              <TouchableOpacity
                style={{
                  backgroundColor: theme.primary,
                  padding: 12,
                  borderRadius: 8,
                  alignItems: 'center',
                }}
                onPress={async () => {
                  try {
                    const user = auth.currentUser;
                    if (!user) return;

                    const credentials = EmailAuthProvider.credential(
                      user.email,
                      oldPassword
                    );
                    await reauthenticateWithCredential(user, credentials);
                    if (newPassword === confirmPassword) {
                      await updatePassword(user, newPassword);
                      alert('Password updated successfully.');
                      setOldPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                    } else {
                      alert('New passwords do not match.');
                    }
                  } catch (error) {
                    alert('Error updating password: ' + error.message);
                  }
                }}
              >
                <Text style={{ color: theme.background, fontWeight: 'bold' }}>Submit</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </View>
    </TouchableWithoutFeedback>
  );
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
    label: {
      fontSize: 14,
      color: theme.text,
      marginBottom: 6,
      fontWeight: '500',
    },
    input: {
      borderBottomWidth: 1,
      borderBottomColor: theme.accent,
      paddingVertical: 10,
      marginBottom: 16,
      color: theme.text,
    },
    phoneContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
      marginBottom: 16,
    },
    callingCode: {
      marginHorizontal: 8,
      color: theme.text,
      fontSize: 16,
    },
    phoneInput: {
      flex: 1,
      fontSize: 16,
      color: theme.accent,
      borderBottomWidth: 1,
      borderBottomColor: theme.accent,
      paddingVertical: 6,
    }
})