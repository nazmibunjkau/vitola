// notifications/registerPush.ts
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { db, auth } from '../config/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

// Show alert banners even when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function registerForPushAndSave(): Promise<string | null> {
  // 1) Ask permissions
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  // 2) Get an Expo push token (works in Expo Go on a physical device)
  // Project ID is needed for SDK 49+
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  // 3) Persist under the current user so the backend can find it
  const uid = auth.currentUser?.uid;
  if (!uid) return expoPushToken ?? null;

  // Store in a subcollection to support multiple devices per user
  // /users/{uid}/push_tokens/{expoPushToken}
  await setDoc(
    doc(db, 'users', uid, 'push_tokens', expoPushToken),
    {
      expo: expoPushToken,
      platform: Platform.OS,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return expoPushToken;
}