import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from "@react-native-async-storage/async-storage"
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyAxTOP_rcwMsffRwhuCdhM_GDPWca7pq58",
  authDomain: "vitola-32c8b.firebaseapp.com",
  projectId: "vitola-32c8b",
  storageBucket: "vitola-32c8b.appspot.com",
  messagingSenderId: "426221834412",
  appId: "1:426221834412:web:c9e35b4da2149f9b744f09"
};

export const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, { 
  persistence: getReactNativePersistence(AsyncStorage) 
});

export const db = getFirestore(app);
