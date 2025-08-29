import { StyleSheet, Text, SafeAreaView, View, TouchableOpacity, TextInput, FlatList, Image, Keyboard, Modal, TouchableWithoutFeedback } from 'react-native';
import React, { useState, useEffect, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { MaterialIcons } from '@expo/vector-icons';
import { ArrowLeftIcon } from "react-native-heroicons/solid"
import { useTheme } from '../context/ThemeContext'; 
import { getAuth } from 'firebase/auth';
import { doc, getDocs, collection, getDoc, updateDoc, arrayUnion, arrayRemove, setDoc, deleteDoc, collectionGroup, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase'; 

export default function ProfileSearch({ navigation }) {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('Profiles');
  const [profileQuery, setProfileQuery] = useState('');
  const [clubQuery, setClubQuery] = useState('');
  const [userSubscription, setUserSubscription] = useState('free');
  const [profiles, setProfiles] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [filteredProfiles, setFilteredProfiles] = useState([]);
  const [followedUserIds, setFollowedUserIds] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [allClubs, setAllClubs] = useState([]);
  const [filteredClubs, setFilteredClubs] = useState([]);
  const [joinedClubIds, setJoinedClubIds] = useState([]);
  const [followBusy, setFollowBusy] = useState({}); // { [userId]: boolean }
  const [unsubscribeFollowing, setUnsubscribeFollowing] = useState(null);
  // Club filters
  const [selectedLocation, setSelectedLocation] = useState(null); // string | null
  const [selectedType, setSelectedType] = useState(null); // string | null
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');

  const [typeQuery, setTypeQuery] = useState('');
  // Base clubs list considering current query and location (but not type)
  const baseClubsForTypes = useMemo(() => {
    if (activeTab !== 'Clubs') return [];
    // When there is a search query or location filter, base the type list on the full set
    const source = (clubQuery?.trim() || selectedLocation) ? allClubs : clubs;
    let list = source;
    const q = (clubQuery || '').trim().toLowerCase();
    if (q) {
      list = list.filter(c => (c.name || '').toLowerCase().includes(q));
    }
    if (selectedLocation) {
      list = list.filter(c => (c.location || '') === selectedLocation);
    }
    return list;
  }, [activeTab, clubs, allClubs, clubQuery, selectedLocation]);

  // Unique club types present in the current list
  const availableTypes = useMemo(() => {
    const set = new Set();
    baseClubsForTypes.forEach(c => {
      const t = c.type;
      if (Array.isArray(t)) {
        t.forEach(x => x && set.add(String(x)));
      } else if (t) {
        set.add(String(t));
      }
    });
    return Array.from(set).sort((a,b) => a.localeCompare(b));
  }, [baseClubsForTypes]);

  // Type options filtered by the type query
  const filteredTypes = useMemo(() => {
    if (!typeQuery.trim()) return availableTypes;
    const q = typeQuery.toLowerCase();
    return availableTypes.filter(t => t.toLowerCase().includes(q));
  }, [availableTypes, typeQuery]);

  const uniqueLocations = useMemo(() => {
    const set = new Set((clubs || []).map(c => (c.location || '').trim()).filter(Boolean));
    return Array.from(set).sort((a,b) => a.localeCompare(b));
  }, [clubs]);

  const filteredLocations = useMemo(() => {
    if (!locationQuery.trim()) return uniqueLocations;
    const q = locationQuery.toLowerCase();
    return uniqueLocations.filter(loc => loc.toLowerCase().includes(q));
  }, [uniqueLocations, locationQuery]);
  useEffect(() => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const unsub = onSnapshot(
      collection(db, 'users', currentUser.uid, 'following'),
      (snap) => {
        const ids = snap.docs.map(d => d.id);
        setFollowedUserIds(ids);
        // If you want newly-followed profiles to disappear immediately from the list:
        setProfiles(prev => prev.filter(u => !ids.includes(u.id)));
      }
    );

    setUnsubscribeFollowing(() => unsub);
    return () => unsub();
  }, []);

  const fetchUsers = async () => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const everyoneElse = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.id !== currentUser.uid);

      // Store the full list for search (includes followed folks)
      setAllProfiles(everyoneElse);

      // Suggestions list excludes already-followed users
      const suggestions = everyoneElse
        .filter(u => !followedUserIds.includes(u.id))
        .sort(() => 0.5 - Math.random())
        .slice(0, 100);

      setProfiles(suggestions);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchClubs = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'clubs'));
      const withCounts = await Promise.all(
        snapshot.docs.map(async d => {
          const memberSnap = await getDocs(collection(db, 'clubs', d.id, 'members'));
          return { id: d.id, ...d.data(), memberCount: memberSnap.size };
        })
      );

      // Store the full list for search (includes already-joined clubs)
      setAllClubs(withCounts);

      // Suggestions list excludes clubs the user already joined
      const suggestions = withCounts
        .filter(c => !joinedClubIds.includes(c.id))
        .sort(() => 0.5 - Math.random())
        .slice(0, 100);

      setClubs(suggestions);
    } catch (err) {
      console.error('Error fetching clubs:', err);
    }
  };

  // Fetch followed user IDs for the current user
  const fetchFollowedUserIds = async () => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const snap = await getDocs(collection(db, 'users', currentUser.uid, 'following'));
      const ids = snap.docs.map(d => d.id);
      setFollowedUserIds(ids);
    } catch (err) {
      console.error('Error fetching followed users:', err);
    }
  };

  const fetchJoinedClubIds = async () => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const snapshot = await getDocs(collectionGroup(db, 'members'));
      const joinedIds = snapshot.docs
        .filter(doc => doc.id === currentUser.uid)
        .map(doc => doc.ref.parent.parent.id); // get clubId from /clubs/{clubId}/members/{uid}
      setJoinedClubIds(joinedIds);
    } catch (err) {
      console.error('Error fetching joined clubs:', err);
    }
  };

  useEffect(() => {
    const fetchSubscriptionAndData = async () => {
      await fetchSubscription();
      await fetchFollowedUserIds();
      await fetchJoinedClubIds();
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
    if (joinedClubIds) {
      fetchClubs();
    }
  }, [joinedClubIds]);

  // Profiles search effect
  useEffect(() => {
    if (activeTab === 'Profiles') {
      if (!profileQuery.trim()) {
        // No query -> show suggestions (unfollowed only)
        setFilteredProfiles(profiles);
      } else {
        // Query -> search across *all* profiles (including already followed)
        const q = profileQuery.toLowerCase();
        const filtered = allProfiles.filter(user => (user.name || '').toLowerCase().includes(q));
        setFilteredProfiles(filtered);
      }
    }
  }, [profileQuery, profiles, allProfiles, activeTab]);

  // Clubs search + filters effect
  useEffect(() => {
    if (activeTab !== 'Clubs') return;

    const source = (clubQuery?.trim() || selectedLocation || selectedType) ? allClubs : clubs;

    const byQuery = (list) => {
      if (!clubQuery.trim()) return list;
      const q = clubQuery.toLowerCase();
      return list.filter(club => club.name?.toLowerCase().includes(q));
    };

    const byLocation = (list) => {
      if (!selectedLocation) return list;
      return list.filter(club => (club.location || '') === selectedLocation);
    };

    const byType = (list) => {
      if (!selectedType) return list;
      const t = (club) => club.type;
      return list.filter(club => {
        const val = t(club);
        if (Array.isArray(val)) return val.includes(selectedType);
        return (val || '') === selectedType;
      });
    };

    const next = byQuery(byType(byLocation(source)));
    setFilteredClubs(next);
  }, [activeTab, clubQuery, clubs, allClubs, selectedLocation, selectedType]);

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

      <View style={[styles.searchInputWrapper, { backgroundColor: theme.inputBackground }]}>
        <Ionicons name="search" size={20} color={theme.searchPlaceholder} style={styles.searchIcon} />
        <TextInput
          style={[styles.input, { color: theme.searchText || theme.text }]}
          placeholder={activeTab === 'Profiles' ? 'Search for a profile...' : 'Search for a club...'}
          placeholderTextColor={theme.searchPlaceholder}
          onChangeText={activeTab === 'Profiles' ? setProfileQuery : setClubQuery}
          value={activeTab === 'Profiles' ? profileQuery : clubQuery}
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        {(activeTab === 'Profiles' ? profileQuery : clubQuery).length > 0 && (
          <TouchableOpacity onPress={() => (activeTab === 'Profiles' ? setProfileQuery : setClubQuery)('')} style={styles.clearIcon}>
            <Ionicons name="close-circle" size={20} color="#B71C1C" />
          </TouchableOpacity>
        )}
      </View>
      {activeTab === 'Clubs' && (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginTop: 10, marginHorizontal: 16 }}>
            {/* Location Filter */}
            <View
              style={{
                width: 160,
                marginRight: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: theme.primary,
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}
            >
              <TouchableOpacity
                onPress={() => setShowLocationModal(true)}
                style={{ paddingVertical: 6, width: '100%', alignItems: 'center', justifyContent: 'center' }}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="location-outline" size={18} color={theme.primary} style={{ marginRight: 6 }} />
                  <Text style={{ color: theme.primary, fontWeight: '500', fontSize: 14 }}>
                    {selectedLocation ? selectedLocation : 'Location'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Club Type Filter */}
            <View
              style={{
                width: 160,
                marginLeft: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: theme.primary,
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}
            >
              <TouchableOpacity
                onPress={() => setShowTypeModal(true)}
                style={{ paddingVertical: 6, width: '100%', alignItems: 'center', justifyContent: 'center' }}
                activeOpacity={0.8}
              >
                <Text style={{ color: theme.primary, fontWeight: '500', fontSize: 14 }}>
                  {selectedType ? selectedType : 'Club Type'}
                </Text>
              </TouchableOpacity>
            </View>
            {(selectedLocation || selectedType) && (
              <TouchableOpacity
                onPress={() => { setSelectedLocation(null); setSelectedType(null); setTypeQuery(''); setLocationQuery(''); }}
                style={{ marginLeft: 8, paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center' }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Clear filters"
              >
                <Ionicons name="close-circle" size={22} color="#d32f2f" />
              </TouchableOpacity>
            )}
          </View>
          <View style={{ height: 0.47, backgroundColor: theme.primary, marginTop: 12, alignSelf: 'stretch' }} />
          {/* Location Picker Modal */}
          <Modal visible={showLocationModal} transparent animationType="slide" onRequestClose={() => setShowLocationModal(false)}>
            <TouchableWithoutFeedback onPress={() => setShowLocationModal(false)}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
                {/* Stop propagation inside sheet */}
                <TouchableWithoutFeedback onPress={() => {}}>
                  <View style={{ backgroundColor: theme.background, maxHeight: '60%', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }}>
                    <View style={{ alignItems: 'center', paddingVertical: 6 }}>
                      <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border }} />
                    </View>
                    <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginBottom: 10 }}>Choose Location</Text>

                    {/* Search bar */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10 }}>
                      <Ionicons name="search" size={18} color={theme.text} style={{ marginRight: 6 }} />
                      <TextInput
                        value={locationQuery}
                        onChangeText={setLocationQuery}
                        placeholder="Search location..."
                        placeholderTextColor={theme.placeholder}
                        style={{ flex: 1, color: theme.text, fontSize: 15 }}
                        returnKeyType="search"
                      />
                      {locationQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setLocationQuery('')}>
                          <Ionicons name="close-circle" size={18} color={theme.text} />
                        </TouchableOpacity>
                      )}
                    </View>

                    <FlatList
                      data={[...(selectedLocation ? ['Clear location'] : []), ...filteredLocations]}
                      keyExtractor={(item, idx) => item + idx}
                      keyboardShouldPersistTaps="handled"
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          onPress={() => {
                            if (item === 'Clear location') setSelectedLocation(null); else setSelectedLocation(item);
                            setShowLocationModal(false);
                            setLocationQuery('');
                          }}
                          style={{ paddingVertical: 12 }}
                        >
                          <Text style={{ color: item === 'Clear location' ? '#d32f2f' : theme.text, fontSize: 16 }}>{item}</Text>
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>

          {/* Club Type Picker Modal */}
          <Modal visible={showTypeModal} transparent animationType="slide" onRequestClose={() => setShowTypeModal(false)}>
            <TouchableWithoutFeedback onPress={() => setShowTypeModal(false)}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
                <TouchableWithoutFeedback onPress={() => {}}>
                  <View style={{ backgroundColor: theme.background, maxHeight: '60%', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }}>
                    <View style={{ alignItems: 'center', paddingVertical: 6 }}>
                      <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border }} />
                    </View>
                    <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginBottom: 10 }}>Choose Club Type</Text>

                    {/* Search bar for types */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10 }}>
                      <Ionicons name="search" size={18} color={theme.text} style={{ marginRight: 6 }} />
                      <TextInput
                        value={typeQuery}
                        onChangeText={setTypeQuery}
                        placeholder="Search club type..."
                        placeholderTextColor={theme.placeholder}
                        style={{ flex: 1, color: theme.text, fontSize: 15 }}
                        returnKeyType="search"
                      />
                      {typeQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setTypeQuery('')}>
                          <Ionicons name="close-circle" size={18} color={theme.text} />
                        </TouchableOpacity>
                      )}
                    </View>

                    <FlatList
                      data={[...(selectedType ? ['Clear type'] : []), ...filteredTypes]}
                      keyExtractor={(item, idx) => item + idx}
                      ListEmptyComponent={() => (
                        <Text style={{ color: theme.placeholder, textAlign: 'center', paddingVertical: 16 }}>No types found</Text>
                      )}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          onPress={() => {
                            if (item === 'Clear type') setSelectedType(null); else setSelectedType(item);
                            setShowTypeModal(false);
                            setTypeQuery('');
                          }}
                          style={{ paddingVertical: 12 }}
                        >
                          <Text style={{ color: item === 'Clear type' ? '#d32f2f' : theme.text, fontSize: 16 }}>{item}</Text>
                        </TouchableOpacity>
                      )}
                    />
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>
        </>
      )}

      {activeTab === 'Profiles' && profileQuery.length > 0 && filteredProfiles.length === 0 && (
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
              <TouchableOpacity
                style={[styles.profileRow, { borderColor: theme.border }]}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('Profile', { userId: item.id, fromOutside: true })}
              >
                <Image source={{ uri: item.photoURL || 'https://placehold.co/50x50' }} style={styles.profilePic} />
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <Text
                      style={[styles.profileName, { color: theme.text }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {item.name ?? 'Unnamed User'}
                    </Text>
                    {item?.subscriptionPlan === 'paid' && (
                      <MaterialIcons
                        name="verified"
                        size={16}
                        color={theme.primary}
                        style={{ marginLeft: 6 }}
                        accessibilityLabel="Verified account"
                      />
                    )}
                  </View>
                  {/* The Follow/Unfollow button remains as-is below */}
                </View>
                <TouchableOpacity
                  onPress={async () => {
                  const auth = getAuth();
                  const currentUser = auth.currentUser;
                  if (!currentUser) return;

                  const currentUserId = currentUser.uid;
                  const targetUserId = item.id;

                  if (followBusy[targetUserId]) return; // prevent double taps
                  setFollowBusy(b => ({ ...b, [targetUserId]: true }));

                  const isCurrentlyFollowed = followedUserIds.includes(targetUserId);

                  // Optimistic UI: update local state immediately
                  setFollowedUserIds(prev => (
                    isCurrentlyFollowed ? prev.filter(id => id !== targetUserId) : [...prev, targetUserId]
                  ));
                  if (!isCurrentlyFollowed) {
                    // Hide from list right away if you prefer to remove followed users
                    setProfiles(prev => prev.filter(u => u.id !== targetUserId));
                  }

                  // Subcollection refs
                  const myFollowingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
                  const theirFollowersRef = doc(db, 'users', targetUserId, 'followers', currentUserId);

                  try {
                    if (isCurrentlyFollowed) {
                      // UNFOLLOW: delete both sides
                      await deleteDoc(myFollowingRef);
                      await deleteDoc(theirFollowersRef);
                    } else {
                      // FOLLOW: create both sides
                      const payload = { since: new Date() };
                      await setDoc(myFollowingRef, payload);
                      await setDoc(theirFollowersRef, payload);
                    }
                  } catch (e) {
                    console.error('Error toggling follow subcollection:', e);
                    // revert optimistic change on hard failure
                    setFollowedUserIds(prev => (
                      isCurrentlyFollowed ? [...prev, targetUserId] : prev.filter(id => id !== targetUserId)
                    ));
                    setFollowBusy(b => ({ ...b, [targetUserId]: false }));
                    return;
                  }

                  // Optional: create a notification on follow (same as before)
                  if (!isCurrentlyFollowed) {
                    try {
                      const notificationRef = doc(db, 'users', targetUserId, 'notifications', `follow_${currentUserId}`);
                      await setDoc(notificationRef, {
                        type: 'follow',
                        fromUserId: currentUserId,
                        timestamp: new Date(),
                        read: false,
                      }, { merge: false });
                    } catch (e) {
                      console.warn('Failed to create follow notification:', e);
                    }
                  }

                  setFollowBusy(b => ({ ...b, [targetUserId]: false }));
                  }}
                  disabled={!!followBusy[item.id]}
                  style={[
                    styles.followButton,
                    {
                      borderWidth: 1,
                      borderColor: isFollowed ? theme.primary : theme.primary,
                      backgroundColor: isFollowed ? theme.primary : theme.primary
                    }
                  ]}
                >
                  <Text style={{ color: isFollowed ? theme.background : theme.background }}>
                    {isFollowed ? 'Unfollow' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        <View style={{ flex: 1 }} />
      )}
    {activeTab === 'Clubs' && (
      <>
        <FlatList
          data={((clubQuery.length > 0) || selectedLocation || selectedType) ? filteredClubs : clubs}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 0, paddingBottom: 500 }}
          renderItem={({ item }) => {
            const isJoined = joinedClubIds.includes(item.id);
            return (
              <TouchableOpacity
                style={[styles.profileRow, { borderColor: theme.border }]}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('ClubDetails', { club: item })}
              >
                <Image source={{ uri: item.image || 'https://placehold.co/50x50' }} style={styles.profilePic} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.profileName, { color: theme.text }]}>{item.name || 'Unnamed Club'}</Text>
                  <Text style={{ color: theme.placeholder, fontSize: 13 }}>
                    {item.memberCount?.toLocaleString()} members • {item.location || 'Unknown'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={async () => {
                    const auth = getAuth();
                    const currentUser = auth.currentUser;
                    if (!currentUser) return;

                    const userId = currentUser.uid;
                    const clubId = item.id;

                    try {
                      const userClubRef = doc(db, 'users', userId, 'joined_clubs', clubId);
                      const clubMemberRef = doc(db, 'clubs', clubId, 'members', userId);

                      if (isJoined) {
                        await deleteDoc(userClubRef);
                        await deleteDoc(clubMemberRef);
                        setJoinedClubIds(prev => prev.filter(id => id !== clubId));
                      } else {
                        await setDoc(userClubRef, { joinedAt: new Date() });
                        await setDoc(clubMemberRef, { role: 'member', joinedAt: new Date() });
                        setJoinedClubIds(prev => [...prev, clubId]);
                      }
                    } catch (error) {
                      console.error('Error updating join status:', error);
                    }
                  }}
                  style={[
                    styles.followButton,
                    {
                      borderWidth: 1,
                      borderColor: isJoined ? theme.primary : theme.primary,
                      backgroundColor: isJoined ? theme.primary : theme.background
                    }
                  ]}
                >
                  <Text style={{ color: isJoined ? theme.background : theme.primary }}>
                    {isJoined ? 'Leave' : 'Join'}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
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
      </>
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
    // backgroundColor is now set dynamically via theme
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
    fontSize: 16,
    flexShrink: 1,
    minWidth: 0
  },
  followButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8
  }
});