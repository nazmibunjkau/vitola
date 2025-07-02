import * as ImagePicker from 'expo-image-picker';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../config/firebase';
import { Image } from 'react-native';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native'
import React, { useEffect, useState } from "react"
import { SafeAreaView } from 'react-native-safe-area-context'
import { auth } from '../config/firebase';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export default function Profile({ navigation }) {
  const { theme } = useTheme();
  const [fullName, setFullName] = useState("")   
  const [profilePic, setProfilePic] = useState(null)

  useEffect(() => {
    const fetchUser = async () => {
    try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
        const userData = userDoc.data();

        // Safely get name: try fullName, else name, else ''
        setFullName(userData.fullName || userData.name || "");
        setProfilePic(userData.photoURL || null);
        }
    } catch (error) {
        console.error("Error fetching user data:", error);
    }
    };
    fetchUser();
  }, []);

  const handleProfilePicPress = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
    alert('Permission to access media library is required!');
    return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    allowsEditing: true,
    quality: 1,
    });

    if (!result.canceled) {
    const uri = result.assets[0].uri;

    // Clear image first to force re-render if same URI is selected again
    setProfilePic(null);

    try {
        const response = await fetch(uri);
        const blob = await response.blob();

        const storage = getStorage();
        const filename = `${auth.currentUser.uid}_${Date.now()}.jpg`;
        const storageRef = ref(storage, `profile_pictures/${filename}`);

        await uploadBytes(storageRef, blob);

        const downloadURL = await getDownloadURL(storageRef);

        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        photoURL: downloadURL,
        });

        setProfilePic(downloadURL);
        console.log("✅ Profile pic updated with download URL:", downloadURL);
    } catch (error) {
        console.error("❌ Error uploading profile pic:", error);
        alert('Failed to upload profile picture. Please try again.');
    }
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'space-evenly', backgroundColor: theme.background }}>
        <SafeAreaView style={[styles.container, {backgroundColor: theme.background}]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <TouchableOpacity onPress={handleProfilePicPress} style={{ marginTop: 20 }}>
                {profilePic ? (
                <Image
                    source={{ uri: profilePic }}
                    style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: '#ccc',
                    borderWidth: 1,
                    borderColor: '#888',
                    marginRight: 16
                    }}
                />
                ) : (
                <View
                    style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: '#ccc',
                    borderWidth: 1,
                    borderColor: '#888',
                    marginRight: 16,
                    justifyContent: 'center',
                    alignItems: 'center'
                    }}
                >
                    <Text style={{ fontSize: 12, color: '#555' }}>Upload{'\n'}Photo</Text>
                </View>
                )}
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[styles.greeting, { color: theme.primary }]}>{fullName}</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
                    <Ionicons name="settings-outline" size={28} color={theme.primary} />
                </TouchableOpacity>
                </View>
                {/* Stats Row */}
                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <View style={{ alignItems: 'center', marginRight: 24 }}>
                    <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 16 }}>12</Text>
                    <Text style={{ color: theme.placeholder, fontSize: 13 }}>Posts</Text>
                </View>
                <View style={{ alignItems: 'center', marginRight: 24 }}>
                    <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 16 }}>34</Text>
                    <Text style={{ color: theme.placeholder, fontSize: 13 }}>Followers</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 16 }}>56</Text>
                    <Text style={{ color: theme.placeholder, fontSize: 13 }}>Following</Text>
                </View>
                </View>
            </View>
        </View>
        </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
    },
    greeting: {
        fontSize: 30,
        fontWeight: '300',
        fontFamily: 'Avenir, Montserrat, Corbel, URW Gothic, source-sans-pro, sans-serif',
        marginTop: 20,
        marginBottom: 6,
    },
})