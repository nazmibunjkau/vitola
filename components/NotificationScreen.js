import { StyleSheet, Text, SafeAreaView, FlatList, View, TouchableOpacity, Image, RefreshControl } from 'react-native';
import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs, writeBatch, where, deleteDoc, doc } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { auth, db } from '../config/firebase';
import { useTheme } from '../context/ThemeContext'; 
import { ArrowLeftIcon } from "react-native-heroicons/solid"
import { Swipeable } from 'react-native-gesture-handler';
import moment from 'moment';

export default function NotificationScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const { theme } = useTheme();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState(new Set());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const userId = auth.currentUser.uid;
    const q = query(
      collection(db, 'users', userId, 'notifications'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data = await Promise.all(snapshot.docs.map(async doc => {
        const notif = { id: doc.id, ...doc.data() };
        if (notif.fromUserId) {
          try {
            const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', notif.fromUserId)));
            if (!userDoc.empty) {
              const userData = userDoc.docs[0].data();
              notif.fromUserName = userData.name || 'Someone';
              notif.fromUserPhoto = userData.photoURL || null;
            } else {
              notif.fromUserName = 'Someone';
              notif.fromUserPhoto = null;
            }
          } catch (e) {
            notif.fromUserName = 'Someone';
            notif.fromUserPhoto = null;
          }
        }
        return notif;
      }));

      // Filter out duplicate follow notifications from the same user
      const seenFollows = new Set();
      const filteredData = data.filter((notif) => {
        if (notif.type === 'follow') {
          if (!notif.fromUserId) return true;
          if (seenFollows.has(notif.fromUserId)) return false;
          seenFollows.add(notif.fromUserId);
          return true;
        }
        // Always include likes/comments/etc.
        return true;
      });

      const sortedData = filteredData.sort((a, b) => {
        if (a.timestamp && b.timestamp) {
          return b.timestamp.seconds - a.timestamp.seconds;
        }
        return 0;
      });

      setNotifications(sortedData);
    });

    return unsubscribe;
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const markNotificationsAsRead = async () => {
        const userId = auth.currentUser.uid;
        const q = query(
          collection(db, 'users', userId, 'notifications'),
          where('read', '==', false)
        );
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.forEach(doc => {
          batch.update(doc.ref, { read: true });
        });
        await batch.commit();
      };

      markNotificationsAsRead();
    }, [])
  );

  const renderItem = ({ item }) => {
    const userId = auth.currentUser.uid;

    const handleDelete = async () => {
      const notifRef = doc(db, 'users', userId, 'notifications', item.id);
      await deleteDoc(notifRef);
    };

    const isSelected = selectedNotifications.has(item.id);

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
          source={{ uri: item.fromUserPhoto || 'https://placehold.co/40x40' }}
          style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.text, { fontWeight: 'bold', color: theme.primary }]}>
            {item.type === 'like' ? 'New Like' : item.type === 'comment' ? 'New Comment' : 'New Follower'}
          </Text>
          <Text style={styles.text}>
            {item.type === 'like' && `${item.fromUserName} liked your post!`}
            {item.type === 'comment' && `${item.fromUserName} commented: "${item.commentText}"`}
            {item.type === 'follow' && `${item.fromUserName} started following you.`}
          </Text>
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
        <View style={[styles.item, { flexDirection: 'row', alignItems: 'center' }]}>
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
                const q = query(
                  collection(db, 'users', userId, 'notifications'),
                  orderBy('timestamp', 'desc')
                );
                const snapshot = await getDocs(q);
                const data = await Promise.all(snapshot.docs.map(async doc => {
                  const notif = { id: doc.id, ...doc.data() };
                  if (notif.fromUserId) {
                    try {
                      const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', notif.fromUserId)));
                      if (!userDoc.empty) {
                        const userData = userDoc.docs[0].data();
                        notif.fromUserName = userData.name || 'Someone';
                        notif.fromUserPhoto = userData.photoURL || null;
                      } else {
                        notif.fromUserName = 'Someone';
                        notif.fromUserPhoto = null;
                      }
                    } catch (e) {
                      notif.fromUserName = 'Someone';
                      notif.fromUserPhoto = null;
                    }
                  }
                  return notif;
                }));

                const seen = new Map();
                const filteredData = data.filter((notif) => {
                  if (notif.type !== 'follow') return true;
                  if (!notif.fromUserId) return true;
                  if (seen.has(notif.fromUserId)) return false;
                  seen.set(notif.fromUserId, true);
                  return true;
                });

                const sortedData = filteredData.sort((a, b) => {
                  if (a.timestamp && b.timestamp) {
                    return b.timestamp.seconds - a.timestamp.seconds;
                  }
                  return 0;
                });

                setNotifications(sortedData);
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