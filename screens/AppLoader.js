// screens/AppLoader.js
import { View, ActivityIndicator } from 'react-native';
import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { getDoc, doc } from 'firebase/firestore';
import { auth } from '../config/firebase';
import { db } from '../config/firebase';

export default function AppLoader() {
  const navigation = useNavigation();

  useEffect(() => {
    const loadUserData = async () => {
      const user = auth.currentUser;
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          // Optional: cache data in context or global state here
          navigation.replace('MainApp'); // goes to BottomTabs > Home
        } else {
          // If no user data, fallback or redirect
          navigation.replace('MainApp');
        }
      }
    };

    loadUserData();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#4b382a" />
    </View>
  );
}