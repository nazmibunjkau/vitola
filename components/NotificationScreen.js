import { StyleSheet, Text, SafeAreaView, FlatList, View, TouchableOpacity, Image, RefreshControl } from 'react-native';
import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs, writeBatch, where, deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { auth, db } from '../config/firebase';
import { useTheme } from '../context/ThemeContext'; 
import { ArrowLeftIcon, CheckBadgeIcon } from "react-native-heroicons/solid"
import { Swipeable } from 'react-native-gesture-handler';
import moment from 'moment';

export default function NotificationScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const { theme } = useTheme();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [ownerClubIds, setOwnerClubIds] = useState(new Set());

  // --- START: User subcollection notification logic (per Firestore rules) ---
  const subNotifsRef = React.useRef([]);
  useEffect(() => {
    const userId = auth.currentUser.uid;

    const enrich = async (rows) => {
      const data = await Promise.all(rows.map(async d => {
        const notif = { ...d };
        if (notif.fromUserId && notif.type !== 'eventReminder') {
          try {
            const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', notif.fromUserId)));
            if (!userDoc.empty) {
              const userData = userDoc.docs[0].data();
              notif.fromUserName = userData.name || userData.displayName || userData.fullName || 'Someone';
              notif.fromUserPhoto = userData.photoURL || userData.image || null;
              notif.fromUserIsVerified = (userData.subscriptionPlan === 'paid') || (userData.verified === true);
            } else {
              notif.fromUserName = 'Someone';
              notif.fromUserPhoto = null;
              notif.fromUserIsVerified = false;
            }
          } catch (e) {
            notif.fromUserName = 'Someone';
            notif.fromUserPhoto = null;
            notif.fromUserIsVerified = false;
          }
        }
        return notif;
      }));

      // Deduplicate follow notifications (same user)
      const seenFollows = new Set();
      const filteredData = data.filter((notif) => {
        if (notif.type === 'follow') {
          if (!notif.fromUserId) return true;
          if (seenFollows.has(notif.fromUserId)) return false;
          seenFollows.add(notif.fromUserId);
          return true;
        }
        return true;
      });

      const withTs = filteredData.filter(n => !!n.timestamp);
      const sortedData = withTs.sort((a, b) => {
        if (a.timestamp && b.timestamp) {
          const aSec = a.timestamp.seconds || (a.timestamp.toDate ? Math.floor(a.timestamp.toDate().getTime()/1000) : 0);
          const bSec = b.timestamp.seconds || (b.timestamp.toDate ? Math.floor(b.timestamp.toDate().getTime()/1000) : 0);
          return bSec - aSec;
        }
        return 0;
      });
      return sortedData;
    };

    const subQ = query(collection(db, 'users', userId, 'notifications'), orderBy('timestamp', 'desc'));
    const subUnsub = onSnapshot(subQ, async (snapshot) => {
      const rows = snapshot.docs.map(doc => ({ id: doc.id, __source: 'sub', ...doc.data() }));
      subNotifsRef.current = rows;
      const enriched = await enrich(rows);
      setNotifications(enriched);
    });

    return () => { try { subUnsub(); } catch {} };
  }, []);
  // --- END: User subcollection notification logic ---

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const qMine = query(collection(db, 'clubs'), where('createdBy', '==', userId));
    const unsub = onSnapshot(qMine, (snap) => {
      const s = new Set();
      snap.forEach((d) => s.add(d.id));
      setOwnerClubIds(s);
    });
    return () => { try { unsub(); } catch {} };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const markNotificationsAsRead = async () => {
        const userId = auth.currentUser.uid;
        const qSubUnread = query(collection(db, 'users', userId, 'notifications'), where('read','==', false));
        const snapSub = await getDocs(qSubUnread);
        const batch = writeBatch(db);
        snapSub.forEach(doc => batch.update(doc.ref, { read: true }));
        await batch.commit();
      };
      markNotificationsAsRead();
    }, [])
  );

  const renderItem = ({ item }) => {
    const userId = auth.currentUser.uid;
    const iOwnThisClub = item?.clubId ? ownerClubIds.has(item.clubId) : false;
    const isSelected = selectedNotifications.has(item.id);

    const isAttendShim = item.type === 'comment' && item.commentText === '__eventAttend__';

    const handleDelete = async () => {
      const notifRef = doc(db, 'users', userId, 'notifications', item.id);
      await deleteDoc(notifRef);
    };

    const handleAcceptInvite = async () => {
      try {
        if (!item?.clubId) return;
        const userId = auth.currentUser.uid;
        // 1) Join the club (create membership doc where memberId == uid)
        const memberRef = doc(db, 'clubs', item.clubId, 'members', userId);
        await setDoc(memberRef, {
          joinedAt: new Date(),
          uid: userId,
        }, { merge: true });

        // 1b) Also reflect membership under the user's joined_clubs
        const joinedRef = doc(db, 'users', userId, 'joined_clubs', item.clubId);
        await setDoc(joinedRef, {
          clubId: item.clubId,
          clubName: item.clubName || '',
          joinedAt: new Date(),
        }, { merge: true });

        // 2) Mark the in-app invite as accepted if it exists (deterministic id)
        const inviteId = `${item.clubId}_${item.fromUserId || 'unknown'}`; // matches sender-based id
        try {
          const inviteRef = doc(db, 'users', userId, 'invites', inviteId);
          await updateDoc(inviteRef, { status: 'accepted' });
        } catch (e) { /* ignore if not present or no permission */ }

        // 3) Remove the notification
        const notifRef = doc(db, 'users', userId, 'notifications', item.id);
        await deleteDoc(notifRef);
      } catch (e) {
        console.warn('Accept invite error:', e);
      }
    };

    const handleDeclineInvite = async () => {
      try {
        const userId = auth.currentUser.uid;
        // Try to mark invite declined if exists
        if (item?.clubId && item?.fromUserId) {
          const inviteId = `${item.clubId}_${item.fromUserId}`;
          try {
            const inviteRef = doc(db, 'users', userId, 'invites', inviteId);
            await updateDoc(inviteRef, { status: 'declined' });
          } catch (e) { /* ignore */ }
        }
        // Remove the notification
        const notifRef = doc(db, 'users', userId, 'notifications', item.id);
        await deleteDoc(notifRef);
      } catch (e) {
        console.warn('Decline invite error:', e);
      }
    };

    const handleOwnerAccept = async () => {
      try {
        if (!item?.clubId || !item?.fromUserId) return;
        const batch = writeBatch(db);
        // Add requester as member under the club
        batch.set(doc(db, 'clubs', item.clubId, 'members', item.fromUserId), {
          joinedAt: new Date(),
          addedBy: userId,
          role: 'member',
        });
        // Mirror membership under requester joined_clubs
        batch.set(doc(db, 'users', item.fromUserId, 'joined_clubs', item.clubId), {
          clubId: item.clubId,
          clubName: item.clubName || '',
          joinedAt: new Date(),
          role: 'member',
          addedBy: userId,
        });
        // Remove/mark this notification so it doesn't show again
        batch.delete(doc(db, 'users', userId, 'notifications', item.id));
        await batch.commit();
      } catch (e) {
        console.warn('Owner accept (join request) error:', e);
      }
    };

    const handleOwnerReject = async () => {
      try {
        // Simply remove the notification (or update read:true if you prefer)
        const notifRef = doc(db, 'users', userId, 'notifications', item.id);
        await deleteDoc(notifRef);
      } catch (e) {
        console.warn('Owner reject (join request) error:', e);
      }
    };

    const RightActions = () => (
      <TouchableOpacity
        style={{
          backgroundColor: 'red',
          justifyContent: 'center',
          alignItems: 'center',
          width: 80,
          height: '100%',
          borderRadius: 6,
          marginBottom: 8,
          marginHorizontal: 10
        }}
        onPress={handleDelete}
      >
        <Text style={{ color: 'white', fontWeight: 'bold' }}>Delete</Text>
      </TouchableOpacity>
    );

    const headerTitle =
      isAttendShim ? 'New Event Attendee' :
      item.type === 'like' ? 'New Like' :
      item.type === 'comment' ? 'New Comment' :
      item.type === 'invite' ? (iOwnThisClub ? 'Join Request' : 'Club Invite') :
      item.type === 'eventReminder' ? 'Event Reminder' :
      item.type === 'eventAttend' ? 'New Event Attendee' :
      'New Follower';

    const NotificationContent = (
      <TouchableOpacity
        onPress={() => {
          if (selectMode) {
            const updated = new Set(selectedNotifications);
            if (isSelected) {
              updated.delete(item.id);
            } else {
              updated.add(item.id);
            }
            setSelectedNotifications(updated);
          }
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          opacity: selectMode && !isSelected ? 0.6 : 1,
          backgroundColor: theme.background,
        }}
      >
        {selectMode && (
          <View style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: theme.primary,
            backgroundColor: isSelected ? theme.primary : 'white',
            marginRight: 12
          }} />
        )}
        <Image
          source={{ uri: item.type === 'eventReminder'
          ? 'https://placehold.co/40x40?text=%F0%9F%93%85'
          : (item.fromUserPhoto || 'https://placehold.co/40x40') }}
          style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.text, { fontWeight: 'bold', color: theme.primary }]}>
            {headerTitle}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Name + badge */}
            {item.type !== 'eventReminder' && !!item.fromUserName && (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.text, { color: theme.primary, fontWeight: '300' }]} numberOfLines={1}>
                  {item.fromUserName}
                </Text>
                {item.fromUserIsVerified ? (
                  <CheckBadgeIcon width={16} height={16} color={theme.primary} style={{ marginLeft: 4 }} />
                ) : null}
              </View>
            )}
            {/* Trailing message depending on type */}
            {item.type === 'like' && (
              <Text style={[styles.text, { color: theme.primary }]}>{' '}liked your post!</Text>
            )}
            {isAttendShim && (
              <>
                <Text style={[styles.text, { color: theme.primary }]}>{' '}is attending your event </Text>
                <Text style={[styles.text, { color: theme.primary, fontWeight: '300' }]}>
                  {item.eventTitle || item.clubName || 'Event'}
                </Text>
                <Text style={[styles.text, { color: theme.primary }]}>.</Text>
              </>
            )}
            {item.type === 'comment' && !isAttendShim && (
              <>
                <Text style={[styles.text, { color: theme.primary }]}>{' '}commented: </Text>
                <Text style={[styles.text, { color: theme.primary }]}>
                  {item.commentText}
                </Text>
              </>
            )}
            {item.type === 'follow' && (
              <Text style={[styles.text, { color: theme.primary }]}>{' '}started following you.</Text>
            )}
            {item.type === 'invite' && (
              iOwnThisClub ? (
                <>
                  <Text style={[styles.text, { color: theme.primary }]}>{' '}requested to join your club: </Text>
                  <Text style={[styles.text, { color: theme.primary, fontWeight: '300' }]}>{item.clubName || 'a club'}</Text>
                  <Text style={[styles.text, { color: theme.primary }]}>.</Text>
                </>
              ) : (
                <>
                  <Text style={[styles.text, { color: theme.primary }]}>{' '}invited you to join </Text>
                  <Text style={[styles.text, { color: theme.primary, fontWeight: '300' }]}>{item.clubName || 'a club'}</Text>
                  <Text style={[styles.text, { color: theme.primary }]}>.</Text>
                </>
              )
            )}
            {item.type === 'eventReminder' && (
              <>
                <Text style={[styles.text, { color: theme.primary }]}>{' '}Reminder: </Text>
                <Text style={[styles.text, { color: theme.primary, fontWeight: '300' }]}>
                  {item.eventTitle || 'Event'}
                </Text>
                <Text style={[styles.text, { color: theme.primary }]}>{' '}starts soon.</Text>
              </>
            )}
            {item.type === 'eventAttend' && (
              <>
                <Text style={[styles.text, { color: theme.primary }]}>{' '}is attending your event </Text>
                <Text style={[styles.text, { color: theme.primary, fontWeight: '300' }]}>
                  {item.eventTitle || item.clubName || 'Event'}
                </Text>
                <Text style={[styles.text, { color: theme.primary }]}>.</Text>
              </>
            )}
            
            {/* If there was no fromUserName (fallback), show generic text */}
            {!item.fromUserName && item.type !== 'invite' && item.type !== 'eventReminder' && (
              <Text style={[styles.text, { color: theme.primary }]}>
                {item.type === 'like' && 'Someone liked your post!'}
                {item.type === 'comment' && `Someone commented: "${item.commentText}"`}
                {item.type === 'follow' && 'Someone started following you.'}
              </Text>
            )}
          </View>
          {item.type === 'invite' && (
            <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginTop: 8, marginBottom: 8 }}>
              {iOwnThisClub ? (
                <>
                  <TouchableOpacity
                    onPress={handleOwnerReject}
                    style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: theme.primary, marginHorizontal: 3 }}
                  >
                    <Text style={{ color: theme.primary, fontWeight: '600' }}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleOwnerAccept}
                    style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: theme.primary, marginHorizontal: 3 }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Accept</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    onPress={handleDeclineInvite}
                    style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: theme.primary, marginHorizontal: 3 }}
                  >
                    <Text style={{ color: theme.primary, fontWeight: '600' }}>Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleAcceptInvite}
                    style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: theme.primary, marginHorizontal: 3 }}
                  >
                    <Text style={{ color: theme.background, fontWeight: '600' }}>Accept</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
          {item.timestamp && (
            <Text style={[styles.text, { fontSize: 13, color: '#888' }]}>
              {moment(item.timestamp.toDate()).format('MMMM D, YYYY')}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );

    return (
      <Swipeable renderRightActions={RightActions}>
        <View style={[styles.item, { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.background }]}>
          {NotificationContent}
        </View>
      </Swipeable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ flex: 1, paddingTop: 10, paddingHorizontal: 10 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            width: '100%',
            paddingHorizontal: 10,
            paddingTop: 0,
            marginBottom: 0,
          }}
        >
          <View style={{ width: 65, justifyContent: 'center', alignItems: 'flex-start' }}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
              <ArrowLeftIcon width={28} height={28} color={theme.primary} />
            </TouchableOpacity>
          </View>

          <Text
            style={{
              flex: 1,
              fontSize: 18,
              fontWeight: '600',
              color: theme.text,
              textAlign: 'center',
            }}
            numberOfLines={1}
          >
            Notifications
          </Text>

          <View style={{ width: 70, justifyContent: 'center', alignItems: 'flex-end' }}>
            <TouchableOpacity
              onPress={() => setSelectMode(!selectMode)}
              style={{
                borderWidth: 1,
                borderColor: theme.primary,
                borderRadius: 16,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text style={{ color: theme.primary, fontWeight: '600' }}>
                {selectMode ? 'Cancel' : 'Select'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <FlatList
          style={{ flex: 1, marginTop: 20 }}
          data={notifications}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.emptyText}>No notifications yet.</Text>}
          refreshing={refreshing}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            const userId = auth.currentUser.uid;
            const subQ = query(collection(db, 'users', userId, 'notifications'), orderBy('timestamp', 'desc'));
            const snapSub = await getDocs(subQ);
            const subRows = snapSub.docs.map(doc => ({ id: doc.id, __source: 'sub', ...doc.data() }));
            // Reuse enrich from live listener for consistent rendering
            const enrich = async (rows) => {
              const data = await Promise.all(rows.map(async d => {
                const notif = { ...d };
                if (notif.fromUserId && notif.type !== 'eventReminder') {
                  try {
                    const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', notif.fromUserId)));
                    if (!userDoc.empty) {
                      const userData = userDoc.docs[0].data();
                      notif.fromUserName = userData.name || userData.displayName || userData.fullName || 'Someone';
                      notif.fromUserPhoto = userData.photoURL || userData.image || null;
                      notif.fromUserIsVerified = (userData.subscriptionPlan === 'paid') || (userData.verified === true);
                    } else {
                      notif.fromUserName = 'Someone';
                      notif.fromUserPhoto = null;
                      notif.fromUserIsVerified = false;
                    }
                  } catch (e) {
                    notif.fromUserName = 'Someone';
                    notif.fromUserPhoto = null;
                    notif.fromUserIsVerified = false;
                  }
                }
                return notif;
              }));
              const seenFollows = new Set();
              const filteredData = data.filter((notif) => {
                if (notif.type === 'follow') {
                  if (!notif.fromUserId) return true;
                  if (seenFollows.has(notif.fromUserId)) return false;
                  seenFollows.add(notif.fromUserId);
                  return true;
                }
                return true;
              });
              const withTs = filteredData.filter(n => !!n.timestamp);
              const sortedData = withTs.sort((a, b) => {
                if (a.timestamp && b.timestamp) {
                  const aSec = a.timestamp.seconds || (a.timestamp.toDate ? Math.floor(a.timestamp.toDate().getTime()/1000) : 0);
                  const bSec = b.timestamp.seconds || (b.timestamp.toDate ? Math.floor(b.timestamp.toDate().getTime()/1000) : 0);
                  return bSec - aSec;
                }
                return 0;
              });
              return sortedData;
            };
            const enriched = await enrich(subRows);
            setNotifications(enriched);
            setRefreshing(false);
          }}
            />
          }
        />
      </View>
      {selectMode && selectedNotifications.size > 0 && (
        <TouchableOpacity
          onPress={async () => {
            try {
              const userId = auth.currentUser.uid;
              const batch = writeBatch(db);
              selectedNotifications.forEach((notifId) => {
                const notifRef = doc(db, 'users', userId, 'notifications', notifId);
                batch.delete(notifRef);
              });
              await batch.commit();
              setSelectedNotifications(new Set());
              setSelectMode(false);
            } catch (err) {
              console.error("Error deleting selected notifications:", err);
            }
          }}
          style={{
            margin: 16,
            padding: 12,
            borderRadius: 8,
            backgroundColor: '#ff4444',
            alignItems: 'center'
          }}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Delete</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  item: {
    padding: 12,
    borderBottomColor: '#ccc',
    borderBottomWidth: 1,
    backgroundColor: 'white',
    marginHorizontal: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  text: {
    fontSize: 16,
    fontWeight: '300',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#888'
  }
});