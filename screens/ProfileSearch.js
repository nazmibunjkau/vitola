import { StyleSheet, Text, SafeAreaView, View, TouchableOpacity, TextInput, FlatList, Image, Keyboard } from 'react-native';
import React, { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ArrowLeftIcon } from "react-native-heroicons/solid"
import { useTheme } from '../context/ThemeContext'; 
import { getAuth } from 'firebase/auth';
import { doc, getDocs, collection, getDoc } from 'firebase/firestore';
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
          .filter(user => user.id !== currentUser.uid); // exclude self

      // Shuffle and limit to 100
      users = users.sort(() => 0.5 - Math.random()).slice(0, 100);

      setProfiles(users);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  useEffect(() => {
    const fetchSubscription = async () => {
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
    };
    fetchSubscription();
    fetchUsers();
  }, []);

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
      <View style={{ paddingHorizontal: 10, paddingTop: 10 }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeftIcon width={28} height={28} color={theme.primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.tabContainer}>
        {['Profiles', 'Clubs'].map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => {
              if (tab === 'Clubs' && userSubscription === 'free') {
                navigation.navigate('Upgrade');
              } else {
                setActiveTab(tab);
              }
            }}
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
          placeholder="Search for a profile..."
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
                onPress={() => {
                  if (isFollowed) {
                    setFollowedUserIds(prev => prev.filter(id => id !== item.id));
                    // Optionally perform unfollow logic here
                  } else {
                    setFollowedUserIds(prev => [...prev, item.id]);
                    // Optionally perform follow logic here
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
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