import { useEffect, useState } from 'react';
import { doc, getDoc, collection, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase'; // update path as needed
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  TouchableOpacity,
  Dimensions,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');
const BACKGROUND_HEIGHT = height * 0.2;

export default function ClubDetails() {
  const navigation = useNavigation();
  const route = useRoute();
  const { club } = route.params;

  const { theme } = useTheme();

  const [clubData, setClubData] = useState(null);
  const [memberCount, setMemberCount] = useState(0);
  const [backgroundImageUri, setBackgroundImageUri] = useState(null);
  const [profileImageUri, setProfileImageUri] = useState(null);

  useEffect(() => {
    const fetchClubData = async () => {
      try {
        const clubRef = doc(db, 'clubs', club.id);
        const clubSnap = await getDoc(clubRef);
        if (clubSnap.exists()) {
          const data = clubSnap.data();
          setClubData(data);
          setBackgroundImageUri(data.backgroundImage || null);
          setProfileImageUri(data.image || null);
        }

        const membersRef = collection(db, 'clubs', club.id, 'members');
        const membersSnap = await getDocs(membersRef);
        setMemberCount(membersSnap.size); 
      } catch (error) {
        console.error('Error fetching club data:', error);
      }
    };

    fetchClubData();
  }, [club.id]);

  // Handle image picking and store in Firestore
  const handleImagePick = async (type) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'background' ? [3, 1] : [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const uri = result.assets[0].uri;

        const clubRef = doc(db, 'clubs', club.id);
        await updateDoc(clubRef, {
          [type === 'background' ? 'backgroundImage' : 'image']: uri,
        });

        if (type === 'background') {
          setBackgroundImageUri(uri);
        } else {
          setProfileImageUri(uri);
        }
      }
    } catch (error) {
      Alert.alert('Image Upload Error', error.message || String(error));
    }
  };

  // Mock posts array for demonstration
  const mockPosts = [
    {
      id: '1',
      userName: 'Alice Johnson',
      userProfilePicUri: 'https://randomuser.me/api/portraits/women/44.jpg',
      date: '2h ago',
      text: 'Excited for the next meetup! Who else is joining?',
      imageUri: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80',
      liked: true,
      commentCount: 5,
    },
    {
      id: '2',
      userName: 'Bob Lee',
      userProfilePicUri: 'https://randomuser.me/api/portraits/men/32.jpg',
      date: '5h ago',
      text: "Had a great time at last week's event. Thanks to everyone who came!",
      liked: false,
      commentCount: 2,
    },
    {
      id: '3',
      userName: 'Carla Smith',
      userProfilePicUri: 'https://randomuser.me/api/portraits/women/68.jpg',
      date: '1d ago',
      text: 'Here are some photos from our last outdoor picnic!',
      imageUri: 'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=400&q=80',
      liked: false,
      commentCount: 8,
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Back Arrow */}
        <TouchableOpacity style={[styles.backButton, { backgroundColor: theme.primary }]} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.iconOnPrimary} />
        </TouchableOpacity>

        {/* Background Image */}
        <TouchableOpacity onPress={() => handleImagePick('background')}>
          <View style={styles.backgroundImage}>
            {backgroundImageUri ? (
              <Image source={{ uri: backgroundImageUri }} style={styles.backgroundImage} />
            ) : (
              <Text style={[styles.uploadText, { color: theme.text }]}>Upload Background Photo</Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Profile Image */}
        <TouchableOpacity
          onPress={() => handleImagePick('profile')}
          style={styles.profileImageWrapper}
        >
          {profileImageUri ? (
            <Image source={{ uri: profileImageUri }} style={styles.profileImage} />
          ) : (
            <Text style={[styles.uploadText, { color: theme.text }]}>Upload Profile Photo</Text>
          )}
        </TouchableOpacity>

        {/* Club Title and Meta */}
        {clubData && (
          <>
            <Text style={[styles.clubTitle, { color: theme.text }]}>{clubData.name}</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <MaterialIcons name="category" size={16} color={theme.text} style={styles.metaIcon} />
                <Text style={[styles.metaText, { color: theme.text }]}>{clubData.type || 'N/A'}</Text>
              </View>
              <View style={styles.metaItem}>
                <MaterialIcons name="people" size={16} color={theme.text} style={styles.metaIcon} />
                <Text style={[styles.metaText, { color: theme.text }]}>{memberCount.toLocaleString()} members</Text>
              </View>
              <View style={styles.metaItem}>
                <MaterialIcons
                  name={clubData.privacy?.toLowerCase() === 'private' ? 'lock' : 'public'}
                  size={16}
                  color={theme.text}
                  style={styles.metaIcon}
                />
                <Text style={[styles.metaText, { color: theme.text }]}>
                  {clubData.privacy?.toLowerCase() === 'private' ? 'Private' : 'Public'}
                </Text>
              </View>
            </View>
            {clubData.description && (
              <>
                <Text style={[styles.descriptionText, { color: theme.text }]}>
                  {clubData.description}
                </Text>
                <View style={styles.buttonRow}>
                  <View style={styles.buttonWithLabel}>
                    <TouchableOpacity style={[styles.circleButton, { backgroundColor: theme.primary }]}>
                      <Ionicons name="person-add-outline" size={24} color={theme.iconOnPrimary} style={styles.buttonIcon} />
                    </TouchableOpacity>
                    <Text style={[styles.buttonLabel, { color: theme.text }]}>Invite</Text>
                  </View>
                  <View style={styles.buttonWithLabel}>
                    <TouchableOpacity style={[styles.circleButton, { backgroundColor: theme.primary }]}>
                      <Ionicons name="share-social-outline" size={24} color={theme.iconOnPrimary} style={styles.buttonIcon} />
                    </TouchableOpacity>
                    <Text style={[styles.buttonLabel, { color: theme.text }]}>Share</Text>
                  </View>
                </View>

                {/* Upcoming Events Section */}
                <View style={styles.upcomingEventsSection}>
                  <Text style={[styles.upcomingEventsTitle, { color: theme.text }]}>Upcoming Events</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row' }}>
                      {/* Event Card 1 */}
                      <View style={[styles.eventCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <View style={styles.eventRow}>
                          <View style={[styles.eventDateBox, { backgroundColor: theme.primary }]}>
                            <Text style={[styles.eventMonth, { color: theme.iconOnPrimary }]}>JUN</Text>
                            <Text style={[styles.eventDate, { color: theme.iconOnPrimary }]}>15</Text>
                            <Text style={[styles.eventDay, { color: theme.iconOnPrimary }]}>Sat</Text>
                          </View>
                          <View style={styles.eventDetails}>
                            <Text style={[styles.eventTitle, { color: theme.text }]}>Summer Meetup</Text>
                            <Text style={[styles.eventTime, { color: theme.text }]}>3:00 PM - 6:00 PM</Text>
                            <Text style={[styles.eventAttendees, { color: theme.text }]}>24 attendees</Text>
                          </View>
                          <TouchableOpacity style={{ justifyContent: 'center' }}>
                            <Ionicons name="chevron-forward-outline" size={20} color={theme.text} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      {/* Event Card 2 */}
                      <View style={[styles.eventCard, { backgroundColor: theme.card, borderColor: theme.border, marginLeft: 16 }]}>
                        <View style={styles.eventRow}>
                          <View style={[styles.eventDateBox, { backgroundColor: theme.primary }]}>
                            <Text style={[styles.eventMonth, { color: theme.iconOnPrimary }]}>JUL</Text>
                            <Text style={[styles.eventDate, { color: theme.iconOnPrimary }]}>22</Text>
                            <Text style={[styles.eventDay, { color: theme.iconOnPrimary }]}>Mon</Text>
                          </View>
                          <View style={styles.eventDetails}>
                            <Text style={[styles.eventTitle, { color: theme.text }]}>Book Club</Text>
                            <Text style={[styles.eventTime, { color: theme.text }]}>7:00 PM - 9:00 PM</Text>
                            <Text style={[styles.eventAttendees, { color: theme.text }]}>15 attendees</Text>
                          </View>
                          <TouchableOpacity style={{ justifyContent: 'center' }}>
                            <Ionicons name="chevron-forward-outline" size={20} color={theme.text} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      {/* Event Card 3 */}
                      <View style={[styles.eventCard, { backgroundColor: theme.card, borderColor: theme.border, marginLeft: 16 }]}>
                        <View style={styles.eventRow}>
                          <View style={[styles.eventDateBox, { backgroundColor: theme.primary }]}>
                            <Text style={[styles.eventMonth, { color: theme.iconOnPrimary }]}>AUG</Text>
                            <Text style={[styles.eventDate, { color: theme.iconOnPrimary }]}>05</Text>
                            <Text style={[styles.eventDay, { color: theme.iconOnPrimary }]}>Sat</Text>
                          </View>
                          <View style={styles.eventDetails}>
                            <Text style={[styles.eventTitle, { color: theme.text }]}>Outdoor Picnic</Text>
                            <Text style={[styles.eventTime, { color: theme.text }]}>12:00 PM - 3:00 PM</Text>
                            <Text style={[styles.eventAttendees, { color: theme.text }]}>30 attendees</Text>
                          </View>
                          <TouchableOpacity style={{ justifyContent: 'center' }}>
                            <Ionicons name="chevron-forward-outline" size={20} color={theme.text} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </ScrollView>
                </View>

                {/* Divider above create post section */}
                <View
                  style={{
                    borderTopWidth: 0.3,
                    borderTopColor: theme.border,
                    marginHorizontal: 20,
                    marginTop: 25,
                  }}
                />
                {/* Create a new post section */}
                <View
                  style={{
                    paddingTop: 15,
                    marginHorizontal: 20,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Image
                      source={profileImageUri ? { uri: profileImageUri } : require('../img/profile.png')}
                      style={styles.postProfileImage}
                    />
                    <TouchableOpacity
                      style={[
                        styles.postInputPlaceholder,
                        { backgroundColor: theme.background, borderColor: theme.text },
                      ]}
                    >
                      <Text style={[styles.postPlaceholderText, { color: theme.text }]}>Create a new post...</Text>
                      <Ionicons name="add-outline" size={24} color={theme.text} />
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Divider below create post section */}
                <View
                  style={{
                    borderTopWidth: 0.3,
                    borderTopColor: theme.border,
                    marginHorizontal: 20,
                    marginTop: 15,
                  }}
                />
                {/* Mock Posts Section */}
                <View style={{ marginTop: 10 }}>
                  {mockPosts.map((post, idx) => (
                    <View
                      key={post.id}
                      style={[
                        styles.feedPostContainer,
                        { backgroundColor: theme.card, borderColor: theme.border },
                        idx !== 0 && { marginTop: 18 },
                      ]}
                    >
                      {/* Header Row */}
                      <View style={styles.feedPostHeaderRow}>
                        <Image
                          source={post.userProfilePicUri ? { uri: post.userProfilePicUri } : require('../img/profile.png')}
                          style={styles.feedPostProfileImage}
                        />
                        <View style={{ marginLeft: 10, flex: 1 }}>
                          <Text style={[styles.feedPostUserName, { color: theme.text }]}>{post.userName}</Text>
                          <Text style={[styles.feedPostDate, { color: theme.text, opacity: 0.6 }]}>{post.date}</Text>
                        </View>
                      </View>
                      {/* Post Text */}
                      <Text style={[styles.feedPostText, { color: theme.text }]}>{post.text}</Text>
                      {/* Post Image */}
                      {post.imageUri && (
                        <Image
                          source={{ uri: post.imageUri }}
                          style={styles.feedPostImage}
                          resizeMode="cover"
                        />
                      )}
                      {/* Buttons Row */}
                      <View style={styles.feedPostButtonsRow}>
                        <TouchableOpacity style={styles.feedPostButton}>
                          <Ionicons
                            name={post.liked ? 'heart' : 'heart-outline'}
                            size={22}
                            color={post.liked ? theme.primary : theme.text}
                          />
                          <Text
                            style={[
                              styles.feedPostButtonCount,
                              { color: theme.text, marginLeft: 5, fontWeight: post.liked ? 'bold' : 'normal' },
                            ]}
                          >
                            {post.liked ? 'Liked' : 'Like'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.feedPostButton}>
                          <Ionicons name="chatbubble-outline" size={20} color={theme.text} />
                          <Text style={[styles.feedPostButtonCount, { color: theme.text, marginLeft: 5 }]}>
                            {post.commentCount}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 20,        
    left: 20,
    zIndex: 10,
    borderRadius: 20,
    padding: 6,
  },
  backgroundImage: {
    width: '100%',
    height: BACKGROUND_HEIGHT,
    backgroundColor: '#ddd',
    justifyContent: 'center',
  },
  profileImageWrapper: {
    position: 'absolute',
    top: BACKGROUND_HEIGHT - 70, 
    left: 18,
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: '#eee',
    zIndex: 5,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  clubTitle: {
    marginTop: BACKGROUND_HEIGHT - 130,
    marginLeft: 20,
    fontSize: 24,
    fontWeight: 'bold',
  },
  metaRow: {
    flexDirection: 'row',
    marginLeft: 20,
    marginTop: 15,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  metaIcon: {
    marginRight: 4,
  },
  metaText: {
    fontSize: 14,
  },
  uploadText: {
    textAlign: 'center',
    marginTop: 35,
    marginLeft: 35
  },
  descriptionText: {
    fontSize: 15,
    marginLeft: 20,
    marginTop: 12,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 10,
    gap: 40,
  },
  eventCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 260,
    backgroundColor: '#fff',
  },
  buttonWithLabel: {
    alignItems: 'center',
  },
  circleButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonIcon: {
    // No additional styles needed but placeholder if needed
  },
  buttonLabel: {
    marginTop: 6,
    fontSize: 14,
  },
  upcomingEventsSection: {
    marginTop: 20,
    marginHorizontal: 20,
  },
  upcomingEventsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventDateBox: {
    width: 60,
    height: 80,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventMonth: {
    fontSize: 12,
    fontWeight: '600',
  },
  eventDate: {
    fontSize: 28,
    fontWeight: 'bold',
    lineHeight: 32,
  },
  eventDay: {
    fontSize: 12,
    fontWeight: '600',
  },
  eventDetails: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 14,
    marginBottom: 2,
  },
  eventAttendees: {
    fontSize: 14,
  },
  createPostSection: {
    flexDirection: 'row',
    alignItems: 'center',
    // marginTop and marginHorizontal moved to postContainer
    flex: 1,
  },
  postContainer: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 25,
    marginHorizontal: 20,
    backgroundColor: '#fff',
  },
  postProfileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ccc',
  },
  postInputPlaceholder: {
    flex: 1,
    marginLeft: 12,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'center',
  },
  postPlaceholderText: {
    fontSize: 14,
  },
  addIconButton: {
    marginLeft: 12,
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  // --- Feed Post Styles ---
  feedPostContainer: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 0,
    backgroundColor: '#fff',
    // Spacing between posts set in parent
  },
  feedPostHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  feedPostProfileImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ccc',
  },
  feedPostUserName: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  feedPostDate: {
    fontSize: 12,
    marginTop: 2,
  },
  feedPostText: {
    fontSize: 15,
    marginBottom: 6,
    marginTop: 2,
    lineHeight: 20,
  },
  feedPostImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginTop: 6,
    marginBottom: 8,
    backgroundColor: '#eee',
  },
  feedPostButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 30,
  },
  feedPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 22,
  },
  feedPostButtonCount: {
    fontSize: 14,
  },
});