import { StyleSheet, Text, SafeAreaView, View, TouchableOpacity, TextInput, FlatList, Image, Keyboard } from 'react-native';
import React, { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ArrowLeftIcon } from "react-native-heroicons/solid"
import { useTheme } from '../context/ThemeContext'; 
import { getAuth } from 'firebase/auth';
import { doc, getDocs, collection, getDoc, updateDoc, arrayUnion, addDoc, arrayRemove, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase'; 

export default function ProfileSearch({ navigation }) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('Profiles');
  const [searchQuery, setSearchQuery] = useState('');
  const [userSubscription, setUserSubscription] = useState('free');
  const [profiles, setProfiles] = useState([]);
  const [filteredProfiles, setFilteredProfiles] = useState([]);
  const [followedUserIds, setFollowedUserIds] = useState([]);

  const fetchUsers = async () => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const snapshot = await getDocs(collection(db, 'users'));
      let users = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(user => user.id !== currentUser.uid);

      // Exclude already followed users
      const unfollowedUsers = users.filter(user => !followedUserIds.includes(user.id));
      // Shuffle and limit to 100
      users = unfollowedUsers.sort(() => 0.5 - Math.random()).slice(0, 100);

      setProfiles(users);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  // Fetch followed user IDs for the current user
  const fetchFollowedUserIds = async () => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        const following = userDoc.data().following || [];
        setFollowedUserIds(following);
      }
    } catch (err) {
      console.error('Error fetching followed users:', err);
    }
  };

  useEffect(() => {
    const fetchSubscriptionAndData = async () => {
      await fetchSubscription();
      await fetchFollowedUserIds();
    };
    // Moved fetchSubscription out of useEffect so it's accessible here
    async function fetchSubscription() {
      const user = getAuth().currentUser;
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserSubscription(userDoc.data().subscriptionPlan || 'free');
        }
      } catch (e) {
        console.error('Failed to fetch subscription plan:', e);
      }
    }
    fetchSubscriptionAndData();
  }, []);

  useEffect(() => {
    if (followedUserIds) {
      fetchUsers();
    }
  }, [followedUserIds]);

  useEffect(() => {
    const searchProfiles = async () => {
      if (!searchQuery.trim()) {
        setFilteredProfiles(profiles);
        return;
      }
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        const matches = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(user =>
            user.name?.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .filter(user => user.id !== getAuth().currentUser?.uid);
        setFilteredProfiles(matches);
      } catch (err) {
        console.error('Error searching users:', err);
      }
    };

    searchProfiles();
  }, [searchQuery, profiles]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingTop: 10 }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeftIcon width={28} height={28} color={theme.primary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '600', color: theme.text }}>
          Search
        </Text>
        <View style={{ width: 28 }} />
      </View>
      <View style={styles.tabContainer}>
        {['Profiles', 'Clubs'].map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
          >
            <Text style={[styles.tabText, { color: theme.text }]}>{tab}</Text>
            {activeTab === tab && <View style={[styles.activeLine, { backgroundColor: theme.primary }]} />}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchInputWrapper}>
        <Ionicons name="search" size={20} color="#7a6e63" style={styles.searchIcon} />
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder={activeTab === 'Profiles' ? 'Search for a profile...' : 'Search for a club...'}
          placeholderTextColor={theme.placeholder}
          onChangeText={setSearchQuery}
          value={searchQuery}
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearIcon}>
            <Ionicons name="close-circle" size={20} color="#B71C1C" />
          </TouchableOpacity>
        )}
      </View>
      {activeTab === 'Clubs' && (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginTop: 10, marginHorizontal: 16 }}>
            <TouchableOpacity
              style={{
                width: 120,
                marginRight: 10,
                paddingVertical: 6,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: theme.primary,
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="location-outline" size={18} color={theme.primary} style={{ marginRight: 6 }} />
                <Text style={{ color: theme.primary, fontWeight: '500', fontSize: 14 }}>Location</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                width: 120,
                marginLeft: 10,
                paddingVertical: 6,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: theme.primary,
                alignItems: 'center'
              }}
            >
              <Text style={{ color: theme.primary, fontWeight: '500', fontSize: 14 }}>Club Type</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 0.47, backgroundColor: theme.primary, marginTop: 12, alignSelf: 'stretch' }} />
        </>
      )}

      {searchQuery.length > 0 && filteredProfiles.length === 0 && (
        <Text style={{
          textAlign: 'center',
          marginTop: 16,
          fontSize: 16,
          fontWeight: '500',
          color: theme.placeholder
        }}>
          User not found
        </Text>
      )}

      {/* Profile List */}
      {activeTab === 'Profiles' ? (
        <FlatList
          data={filteredProfiles}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10 }}
          renderItem={({ item }) => {
            const isFollowed = followedUserIds.includes(item.id);
            return (
              <View style={[styles.profileRow, { borderColor: theme.border }]}>
                <Image source={{ uri: item.photoURL || 'https://placehold.co/50x50' }} style={styles.profilePic} />
                <Text style={[styles.profileName, { color: theme.text }]}>{item.name || 'Unnamed User'}</Text>
                <TouchableOpacity
                  onPress={async () => {
                    const auth = getAuth();
                    const currentUser = auth.currentUser;
                    if (!currentUser) return;

                    const currentUserId = currentUser.uid;
                    const targetUserId = item.id;

                    try {
                      const currentUserRef = doc(db, 'users', currentUserId);
                      const targetUserRef = doc(db, 'users', targetUserId);

                      if (isFollowed) {
                        await updateDoc(currentUserRef, {
                          following: arrayRemove(targetUserId)
                        });
                        await updateDoc(targetUserRef, {
                          followers: arrayRemove(currentUserId)
                        });
                        setFollowedUserIds(prev => prev.filter(id => id !== targetUserId));
                      } else {
                        await updateDoc(currentUserRef, {
                          following: arrayUnion(targetUserId)
                        });
                        await updateDoc(targetUserRef, {
                          followers: arrayUnion(currentUserId)
                        });

                        const notificationRef = doc(db, 'users', targetUserId, 'notifications', `${currentUserId}`);
                        await setDoc(notificationRef, {
                          type: 'follow',
                          fromUserId: currentUserId,
                          timestamp: new Date(),
                          read: false
                        });

                        setFollowedUserIds(prev => [...prev, targetUserId]);
                      }
                    } catch (error) {
                      console.error('Error updating follow status:', error);
                    }
                  }}
                  style={[
                    styles.followButton,
                    {
                      borderWidth: 1,
                      borderColor: isFollowed ? theme.primary : theme.primary,
                      backgroundColor: isFollowed ? theme.primary : theme.background
                    }
                  ]}
                >
                  <Text style={{ color: isFollowed ? '#fff' : theme.primary }}>
                    {isFollowed ? 'Unfollow' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      ) : (
        <View style={{ flex: 1 }} />
      )}
    {activeTab === 'Clubs' && (
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => {
          if (userSubscription === 'free') {
            navigation.navigate('Upgrade');
          } else {
            navigation.navigate('ClubAdditions');
          }
        }}
      >
        <Ionicons name="add" size={32} color={theme.iconOnPrimary} />
      </TouchableOpacity>
    )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  searchIcon: {
    marginRight: 8
  },
  input: {
    flex: 1,
    fontSize: 16
  },
  clearIcon: {
    marginLeft: 8
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderColor: '#ccc'
  },
  tabButton: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: 12
  },
  tabButtonActive: {
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500'
  },
  activeLine: {
    height: 3,
    width: '100%',
    marginTop: 6,
    borderRadius: 2
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1
  },
  profilePic: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12
  },
  profileName: {
    flex: 1,
    fontSize: 16
  },
  followButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8
  }
});