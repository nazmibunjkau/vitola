import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, Alert, AppState } from 'react-native'
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { collection, collectionGroup, onSnapshot, getDoc, doc, addDoc, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './config/firebase';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import Start from './screens/Start'
import Home from './screens/Home'
import Register from './screens/Register'
import Login from './screens/Login'
import TermsAndConditions from './components/TermsAndConditions'
import BottomTabs from './navigation/BottomTabs';
import useAuth from './hooks/useAuth';
import AccountInfo from './components/AccountInfo';
import Notifications from './components/Notifications';
import Appearance from './components/Appearance';
import DataUsage from './components/DataUsage';
import Privacy from './components/Privacy';
import Support from './components/Support';
import FAQ from './components/FAQ';
import HumidorAddition from './components/HumidorAdditions';
import NavigationScreen from './components/NotificationScreen';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import CigarSearch from './components/CigarSearch';
import Scanner from './screens/Scanner';
import CigarDetails from './screens/CigarDetails'
import AppLoader from './screens/AppLoader'
import Settings from './screens/Settings'
import Upgrade from './screens/Upgrade';
import ProfileSearch from './screens/ProfileSearch';
import ClubAdditions from './components/ClubAdditions';
import Clubs from './screens/Clubs';
import ClubDetails from './components/ClubDetails';
import Sessions from './screens/Sessions';
import Profile from './screens/Profile';
import FullProfile from './screens/FullProfile';
import Aficionado from './components/AficionadoApplication';

const Stack = createStackNavigator()

async function writeEventReminder(userId, clubId, clubName, eventId, eventTitle) {
  const id = `eventReminder_${eventId}_60m`; // stable per event/lead
  const ref = doc(db, 'users', userId, 'notifications', id);
  await setDoc(ref, {
    type: 'eventReminder',
    fromUserId: userId,
    clubId: clubId || null,
    clubName: clubName || 'Vitola Club',
    eventId,
    eventTitle: eventTitle || 'Event',
    timestamp: serverTimestamp(),
    read: false,
  }, { merge: false }); // do NOT merge; we want create-once
}

const ReminderManager = () => {
  console.log('[ReminderMgr] mounted');
  const auth = getAuth();
  const timersRef = useRef({});   
  const firedRef  = useRef({});   
  const isStillMember = async (clubId, uid) => {
    try {
      const mSnap = await getDoc(doc(db, 'clubs', clubId, 'members', uid));
      return mSnap.exists();
    } catch {
      return false;
    }
  };

  const isStillAttending = async (eventRef, uid) => {
    try {
      const attSnap = await getDoc(doc(eventRef, 'attendees', uid));
      return attSnap.exists();
    } catch (e) {
      return false;
    }
  };

  const clearAllTimers = () => {
    console.log('[ReminderMgr] clearAllTimers', Object.keys(timersRef.current));
    Object.values(timersRef.current).forEach(t => { try { clearTimeout(t); } catch {} });
    timersRef.current = {};
  };

  useEffect(() => {
    let unsubAuth, unsubCG, unsubNotifSweep;

    unsubAuth = onAuthStateChanged(auth, (user) => {
      // clean up previous
      try { unsubCG && unsubCG(); } catch {}
      try { unsubNotifSweep && unsubNotifSweep(); } catch {}
      clearAllTimers();
      console.log('[ReminderMgr] auth change', !!user ? 'signed-in' : 'signed-out');

      if (!user) return;

      // One-time cleanup of stale eventReminder notifications (no longer attending)
      try {
        const notifCol = collection(db, 'users', user.uid, 'notifications');
        // lightweight client-side filter (no composite index required)
        // inside your onAuthStateChanged sweep
        unsubNotifSweep = onSnapshot(notifCol, async (ns) => {
          for (const d of ns.docs) {
            const nd = d.data() || {};
            if (nd.type !== 'eventReminder' || !nd.eventId || !nd.clubId) continue;
            try {
              const evRef = doc(db, 'clubs', nd.clubId, 'events', nd.eventId);
              const evSnap = await getDoc(evRef);
              if (!evSnap.exists()) { await deleteDoc(d.ref); continue; }
              const ev = evSnap.data() || {};
              const date = ev.dateISO ? new Date(ev.dateISO) : null;
              const time = ev.timeISO ? new Date(ev.timeISO) : null;
              const eventAt = (() => {
                if (date && !isNaN(date)) {
                  const out = new Date(date);
                  if (time && !isNaN(time)) {
                    out.setHours(time.getHours(), time.getMinutes(), time.getSeconds() || 0, 0);
                  }
                  return out;
                }
                return null;
              })();
              const now = new Date();
              const stillIn  = await isStillAttending(evRef, user.uid);
              const stillMem = await isStillMember(nd.clubId, user.uid);
              if (!eventAt || eventAt <= now || !stillIn || !stillMem) {
                await deleteDoc(d.ref);
              }
            } catch {
              try { await deleteDoc(d.ref); } catch {}
            }
          }
        });
      } catch {}

      // Listen to *all* attendees where doc contains this user (via collectionGroup)
      const cg = collectionGroup(db, 'attendees');
      console.log('[ReminderMgr] subscribing to collectionGroup(attendees)');
      unsubCG = onSnapshot(cg, async (snap) => {
        console.log('[ReminderMgr] attendees snapshot size', snap.size);
        const me = auth.currentUser;
        if (!me) return;

        // stop timers for events that disappeared
        const active = new Set();
        snap.forEach((d) => {
          const data = d.data() || {};
          if (data.uid !== me.uid) return;
          const eventRef = d.ref.parent?.parent; // clubs/{clubId}/events/{eventId}
          if (!eventRef) return;
          active.add(eventRef.path);
        });
        console.log('[ReminderMgr] active event paths', Array.from(active));
        Object.keys(timersRef.current).forEach((path) => {
          if (!active.has(path)) {
            try { clearTimeout(timersRef.current[path]); } catch {}
            delete timersRef.current[path];
            delete firedRef.current[path]; // also forget fired state when user unattends
          }
        });

        // schedule (or reschedule) for changes
        for (const ch of snap.docChanges()) {
          console.log('[ReminderMgr] change', ch.type, ch.doc.ref.path);
          const data = ch.doc.data() || {};
          if (data.uid !== me.uid) continue;
          const eventRef = ch.doc.ref.parent?.parent;
          if (!eventRef) continue;
          const eventPath = eventRef.path;

          if (ch.type === 'removed') {
            if (timersRef.current[eventPath]) {
              try { clearTimeout(timersRef.current[eventPath]); } catch {}
              delete timersRef.current[eventPath];
            }
            delete firedRef.current[eventPath];
            // remove any existing in-app reminder notification for this event
            try {
              const id = `eventReminder_${eventRef.id}_60m`;
              await deleteDoc(doc(db, 'users', me.uid, 'notifications', id));
            } catch {}
            continue;
          }

          try {
            const evSnap = await getDoc(eventRef);
            if (!evSnap.exists()) continue;
            const ev = evSnap.data() || {};

            // Compute final event time from ISO fields
            const date = ev.dateISO ? new Date(ev.dateISO) : null;
            const time = ev.timeISO ? new Date(ev.timeISO) : null;
            const eventAt = (() => {
              if (date && !isNaN(date)) {
                const out = new Date(date);
                if (time && !isNaN(time)) {
                  out.setHours(time.getHours(), time.getMinutes(), time.getSeconds() || 0, 0);
                }
                return out;
              }
              return null;
            })();

            const now = new Date();
            if (!eventAt || eventAt <= now) {
              // Clear any timer we might have had
              if (timersRef.current[eventRef.path]) {
                try { clearTimeout(timersRef.current[eventRef.path]); } catch {}
                delete timersRef.current[eventRef.path];
              }
              // Remove any existing reminder doc for this event
              try {
                const id = `eventReminder_${eventRef.id}_60m`;
                await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'notifications', id));
              } catch {}
              // Optional: clean up a stale attendees doc (allowed by your rules: user can delete their own)
              try {
                await deleteDoc(doc(eventRef, 'attendees', auth.currentUser.uid));
              } catch {}
              // Also forget fired state
              delete firedRef.current[eventRef.path];
              continue; // do nothing else for past events
            }
            console.log('[ReminderMgr] eventAt', eventAt);
            if (!eventAt) continue;

            // Respect user pref (eventReminders)
            let allow = true;
            try {
              const pSnap = await getDoc(doc(db, 'users', me.uid, 'settings', 'notification_prefs'));
              const prefs = pSnap.exists() ? (pSnap.data() || {}) : {};
              if (prefs.eventReminders === false) allow = false;
            } catch { allow = false; }
            console.log('[ReminderMgr] prefs allow?', allow);
            if (!allow) continue;

            // trigger 60m before
            const leadMin = 60;
            const triggerAt = new Date(eventAt.getTime() - leadMin * 60 * 1000);
            console.log('[ReminderMgr] triggerAt', triggerAt, 'now', now);

            // If already due/past → fire once immediately (and log to notifications)
            if (triggerAt <= now) {
              if (!firedRef.current[eventPath]) {
                const stillIn = await isStillAttending(eventRef, me.uid);
                // Also require membership; if clubId isn’t resolvable we treat as not a member.
                const clubId = eventRef.parent?.parent?.id || null;
                const stillMember = clubId ? await isStillMember(clubId, me.uid) : false;

                if (!stillIn || !stillMember) {
                  console.log('[ReminderMgr] skip immediate; not attending or not a member');
                } else {
                  firedRef.current[eventPath] = true;
                  console.log('[ReminderMgr] firing immediately for', eventRef.path);
                  try {
                    await writeEventReminder(
                      me.uid,
                      clubId,
                      ev.clubName || 'Vitola Club',
                      eventRef.id,
                      ev.title || 'Event'
                    );
                  } catch (e) {
                    console.warn('[ReminderMgr] writeEventReminder (immediate) failed', e);
                  }
                  Alert.alert('Event reminder', `${ev.title || 'Event'} starts soon`);
                }
              }
              continue;
            }

            // (Re)schedule
            if (timersRef.current[eventPath]) {
              try { clearTimeout(timersRef.current[eventPath]); } catch {}
              delete timersRef.current[eventPath];
            }
            const delay = Math.min(triggerAt - now, 24 * 60 * 60 * 1000); // cap 24h
            console.log('[ReminderMgr] scheduling', eventRef.path, 'in', delay, 'ms');
            timersRef.current[eventPath] = setTimeout(async () => {
              const me2 = auth.currentUser;
              if (!me2) return;
              // verify still attending at fire time
              const stillIn = await isStillAttending(eventRef, me2.uid);
              const clubId2 = eventRef.parent?.parent?.id || null;
              const stillMember2 = clubId2 ? await isStillMember(clubId2, me2.uid) : false;
              if (!stillIn || !stillMember2) {
                console.log('[ReminderMgr] timer fired but user not attending or not a member; skipping');
                return;
              }
              try {
                await writeEventReminder(
                  me2.uid,
                  eventRef.parent?.parent?.id || null,
                  ev.clubName || 'Vitola Club',
                  eventRef.id,
                  ev.title || 'Event'
                );
              } catch (e) {
                console.warn('[ReminderMgr] writeEventReminder (timer) failed', e);
              }
              Alert.alert('Event reminder', `${ev.title || 'Event'} starts soon`);
              firedRef.current[eventPath] = true;
            }, delay);
          } catch {
            // ignore per-event failures
          }
        }
      });
    });

    return () => {
      console.log('[ReminderMgr] unmount / cleanup');
      try { unsubAuth && unsubAuth(); } catch {}
      try { unsubCG && unsubCG(); } catch {}
      try { unsubNotifSweep && unsubNotifSweep(); } catch {}
      clearAllTimers();
    };
  }, []);

  // (optional) appstate hook (kept for future)
  useEffect(() => {
    const sub = AppState.addEventListener('change', () => {});
    return () => { try { sub.remove(); } catch {} };
  }, []);

  return null;
};

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4b382a" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <ThemeConsumer />
    </ThemeProvider>
  );
}

function ThemeConsumer() {
  const theme = useTheme();
  const { user } = useAuth();

  return (
    <>
      <ReminderManager />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user ? (
            <>
              <Stack.Screen name="AppLoader" component={AppLoader} />
              <Stack.Screen name="MainApp" component={BottomTabs} />
              <Stack.Screen name="AccountInfo" component={AccountInfo} />
              <Stack.Screen name="Notifications" component={Notifications} />
              <Stack.Screen name="Appearance" component={Appearance} />
              <Stack.Screen name="DataUsage" component={DataUsage} />
              <Stack.Screen name="Privacy" component={Privacy} />
              <Stack.Screen name="Support" component={Support} />
              <Stack.Screen name="FAQ" component={FAQ} />
              <Stack.Screen name='TermsAndConditions' component={TermsAndConditions} />
              <Stack.Screen name='HumidorAdditions' component={HumidorAddition}/>
              <Stack.Screen name='NotificationScreen' component={NavigationScreen}/>
              <Stack.Screen name='CigarSearch' component={CigarSearch} />
              <Stack.Screen name='Scanner' component={Scanner} />
              <Stack.Screen name='CigarDetails' component={CigarDetails} />
              <Stack.Screen name='Settings' component={Settings} />
              <Stack.Screen name='Upgrade' component={Upgrade} />
              <Stack.Screen name='ProfileSearch' component={ProfileSearch} />
              <Stack.Screen name='ClubAdditions' component={ClubAdditions} />
              <Stack.Screen name='Clubs' component={Clubs} />
              <Stack.Screen name='ClubDetails' component={ClubDetails} />
              <Stack.Screen name='Sessions' component={Sessions} />
              <Stack.Screen name='Profile' component={Profile} />
              <Stack.Screen name='FullProfile' component={FullProfile} />
              <Stack.Screen name='Aficionado' component={Aficionado} />
            </>
          ) : (
            <>
              <Stack.Screen name='Start' component={Start} />
              <Stack.Screen name='Register' component={Register} />
              <Stack.Screen name='Login' component={Login} />
              <Stack.Screen name='TermsAndConditions' component={TermsAndConditions} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
