import * as ImagePicker from 'expo-image-picker';
import { doc, updateDoc, getDoc, arrayUnion, arrayRemove, collection, getDocs, query, orderBy, where, onSnapshot } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../config/firebase';
import { Image } from 'react-native';
import { StyleSheet, View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native'
import React, { useEffect, useState } from "react"
import { SafeAreaView } from 'react-native-safe-area-context'
import { auth } from '../config/firebase';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export default function Profile({ navigation, route }) {
  const { theme } = useTheme();
  const [fullName, setFullName] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const [bio, setBio] = useState("");
  const [editingBio, setEditingBio] = useState(false);
  const [activities, setActivities] = useState([]);
  const [commentInput, setCommentInput] = useState({});
  const [showCommentInput, setShowCommentInput] = useState({});
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [postsCount, setPostsCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [clubs, setClubs] = useState([]);

  useEffect(() => {
    // Fetch clubs the user has joined
    const fetchClubs = async () => {
      try {
        const clubsRef = collection(db, 'clubs');
        const snapshot = await getDocs(clubsRef);
        const userClubs = [];

        for (const docSnap of snapshot.docs) {
          const clubId = docSnap.id;
          const memberDocRef = doc(db, 'clubs', clubId, 'members', auth.currentUser.uid);
          const memberDocSnap = await getDoc(memberDocRef);

          if (memberDocSnap.exists()) {
            const data = docSnap.data();
            userClubs.push({
              id: clubId,
              name: data.name,
              image: data.image,
            });
          }
        }

        setClubs(userClubs);
      } catch (err) {
        console.error("Error fetching joined clubs:", err);
      }
    };
    fetchClubs();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'users', auth.currentUser.uid), async (userDoc) => {
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setFullName(userData.fullName || userData.name || "");
        setProfilePic(userData.photoURL || null);
        setBio(userData.bio || "");
        setFollowersCount(Array.isArray(userData.followers) ? userData.followers.length : 0);
        setFollowingCount(Array.isArray(userData.following) ? userData.following.length : 0);

        const postsQuery = query(collection(db, 'user_activities'), where('user_id', '==', auth.currentUser.uid));
        const postsSnapshot = await getDocs(postsQuery);
        setPostsCount(postsSnapshot.size);

        if (route?.params?.userId) {
          setIsFollowing(userData.following?.includes(route.params.userId));
        }
      }
    });

    return () => unsubscribe();
  }, [route?.params?.userId]);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const q = collection(db, "user_activities");
        const snapshot = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (!auth.currentUser?.uid) return;
        const activitiesArr = [];
        const querySnapshot = await getDocs(query(q, where("user_id", "==", auth.currentUser.uid), orderBy("date", "desc")));
        querySnapshot.forEach(docSnap => {
          const data = { id: docSnap.id, ...docSnap.data() };
          if (!data.comments) data.comments = [];
          activitiesArr.push(data);
        });
        setActivities(activitiesArr);
      } catch (err) {
        console.error("Error fetching user activities:", err);
      }
    };
    fetchActivities();
  }, []);

  const handleLike = async (postId, currentUserId) => {
    const postRef = doc(db, "user_activities", postId);
    const activity = activities.find(act => act.id === postId);
    const hasLiked = activity.likes?.includes(currentUserId);

    try {
      await updateDoc(postRef, {
        likes: hasLiked ? arrayRemove(currentUserId) : arrayUnion(currentUserId)
      });
    } catch (err) {
      console.error("Error updating like:", err);
    }
  };

  const handleProfilePicPress = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
    alert('Permission to access media library is required!');
    return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    allowsEditing: true,
    quality: 1,
    });

    if (!result.canceled) {
    const uri = result.assets[0].uri;

    // Clear image first to force re-render if same URI is selected again
    setProfilePic(null);

    try {
        const response = await fetch(uri);
        const blob = await response.blob();

        const storage = getStorage();
        const filename = `${auth.currentUser.uid}_${Date.now()}.jpg`;
        const storageRef = ref(storage, `profile_pictures/${filename}`);

        await uploadBytes(storageRef, blob);

        const downloadURL = await getDownloadURL(storageRef);

        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        photoURL: downloadURL,
        });

        setProfilePic(downloadURL);
        console.log("✅ Profile pic updated with download URL:", downloadURL);
    } catch (error) {
        console.error("❌ Error uploading profile pic:", error);
        alert('Failed to upload profile picture. Please try again.');
    }
    }
  };

  const handleSaveBio = async () => {
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { bio });
      setEditingBio(false);
    } catch (error) {
      console.error("Error saving bio:", error);
      setEditingBio(false);
    }
  };

  return (
    
    <View style={{ flex: 1, justifyContent: 'space-evenly', backgroundColor: theme.background }}>
        <SafeAreaView style={[styles.container, {backgroundColor: theme.background}]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <TouchableOpacity onPress={handleProfilePicPress} style={{ marginTop: 20 }}>
                    {profilePic ? (
                    <Image
                        source={{ uri: profilePic }}
                        style={{
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        backgroundColor: '#ccc',
                        borderWidth: 1,
                        borderColor: '#888',
                        marginRight: 16
                        }}
                    />
                    ) : (
                    <View
                        style={{
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        backgroundColor: '#ccc',
                        borderWidth: 1,
                        borderColor: '#888',
                        marginRight: 16,
                        justifyContent: 'center',
                        alignItems: 'center'
                        }}
                    >
                        <Text style={{ fontSize: 12, color: '#555' }}>Upload{'\n'}Photo</Text>
                    </View>
                    )}
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[styles.greeting, { color: theme.primary }]}>{fullName}</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
                        <Ionicons name="settings-outline" size={28} color={theme.primary} />
                    </TouchableOpacity>
                    </View>
                    {/* Stats Row */}
                    <View style={{ flexDirection: 'row', marginTop: 8 }}>
                        <View style={{ alignItems: 'center', marginRight: 24 }}>
                            <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 16 }}>{postsCount}</Text>
                            <Text style={{ color: theme.placeholder, fontSize: 13 }}>Posts</Text>
                        </View>
                        <View style={{ alignItems: 'center', marginRight: 24 }}>
                            <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 16 }}>{followersCount}</Text>
                            <Text style={{ color: theme.placeholder, fontSize: 13 }}>Followers</Text>
                        </View>
                        <View style={{ alignItems: 'center' }}>
                            <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 16 }}>{followingCount}</Text>
                            <Text style={{ color: theme.placeholder, fontSize: 13 }}>Following</Text>
                        </View>
                    </View>
                    {/* Bio Section */}
                    <View style={{ marginTop: 18 }}>
                        {editingBio ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TextInput
                                style={{
                                flex: 1,
                                backgroundColor: theme.inputBackground || '#eee',
                                color: theme.text,
                                borderRadius: 8,
                                padding: 8,
                                fontSize: 15,
                                borderWidth: 1,
                                borderColor: theme.placeholder,
                                }}
                                value={bio}
                                onChangeText={setBio}
                                placeholder="Write something about yourself..."
                                placeholderTextColor={theme.placeholder}
                                multiline
                                maxLength={200}
                            />
                            <TouchableOpacity
                                onPress={handleSaveBio}
                                style={{ marginLeft: 8, padding: 6 }}
                            >
                                <Ionicons name="checkmark" size={22} color={theme.primary} />
                            </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ color: theme.text, fontSize: 15, flex: 1 }}>
                                {bio ? bio : <Text style={{ color: theme.placeholder }}>No bio yet.</Text>}
                            </Text>
                            <TouchableOpacity
                                onPress={() => setEditingBio(true)}
                                style={{ marginLeft: 8, padding: 6 }}
                            >
                                <Ionicons name="pencil" size={18} color={theme.primary} />
                            </TouchableOpacity>
                            </View>
                        )}
                    </View>
                    {/* Follow Button (centered, only for other users) */}
                    {auth.currentUser?.uid !== route?.params?.userId && (
                      <View style={{ alignItems: 'center', marginTop: 18 }}>
                        <TouchableOpacity
                          style={{
                            backgroundColor: isFollowing ? theme.background : theme.primary,
                            borderRadius: 8,
                            paddingVertical: 10,
                            paddingHorizontal: 40,
                            alignItems: 'center',
                            width: 180,
                            borderWidth: 1,
                            borderColor: theme.primary,
                          }}
                          onPress={async () => {
                            try {
                              const currentUserRef = doc(db, 'users', auth.currentUser.uid);
                              const targetUserRef = doc(db, 'users', route.params.userId);

                              if (isFollowing) {
                                await updateDoc(currentUserRef, {
                                  following: arrayRemove(route.params.userId),
                                });
                                await updateDoc(targetUserRef, {
                                  followers: arrayRemove(auth.currentUser.uid),
                                });
                                setIsFollowing(false);
                              } else {
                                await updateDoc(currentUserRef, {
                                  following: arrayUnion(route.params.userId),
                                });
                                await updateDoc(targetUserRef, {
                                  followers: arrayUnion(auth.currentUser.uid),
                                });
                                setIsFollowing(true);
                              }

                              // Refresh counts
                              const updatedUserDoc = await getDoc(currentUserRef);
                              if (updatedUserDoc.exists()) {
                                const updatedData = updatedUserDoc.data();
                                setFollowingCount(Array.isArray(updatedData.following) ? updatedData.following.length : 0);
                              }
                              const updatedTargetDoc = await getDoc(targetUserRef);
                              if (updatedTargetDoc.exists()) {
                                const updatedTargetData = updatedTargetDoc.data();
                                setFollowersCount(Array.isArray(updatedTargetData.followers) ? updatedTargetData.followers.length : 0);
                              }
                            } catch (err) {
                              alert('Failed to update follow status.');
                            }
                          }}
                        >
                          <Text style={{ color: isFollowing ? theme.primary : theme.background, fontWeight: 'bold', fontSize: 16 }}>
                            {isFollowing ? "Unfollow" : "Follow"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                </View>
            </View>
            <View style={{ height: 1, backgroundColor: theme.placeholder, marginVertical: 16, width: '100%' }} />
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Cigar Clubs Section */}
                <View style={{ marginTop: 10, marginBottom: 24 }}>
                  <Text style={{ color: theme.primary, fontWeight: 'bold', fontSize: 20, marginBottom: 12 }}>
                    Cigar Clubs
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {clubs.length === 0 ? (
                      <Text style={{ color: theme.placeholder, fontSize: 14, marginTop: 12 }}>No clubs yet</Text>
                    ) : (
                      clubs.map(club => (
                        <TouchableOpacity
                          key={club.id}
                          style={{ alignItems: 'center', marginRight: 24 }}
                          onPress={() => navigation.navigate('ClubDetails', { club })}
                        >
                          <Image
                            source={{ uri: club.image || 'https://placehold.co/60x60?text=Club' }}
                            style={{
                              width: 60,
                              height: 60,
                              borderRadius: 30,
                              backgroundColor: '#ccc',
                              marginBottom: 6,
                            }}
                          />
                          <Text style={{ color: theme.text, fontSize: 14, textAlign: 'center', maxWidth: 70 }}>
                            {club.name}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                </View>
                {/* User Posts */}
                <View style={{ marginTop: 10 }}>
                    <Text style={{ color: theme.primary, fontWeight: 'bold', fontSize: 20, marginBottom: 12 }}>Your Posts</Text>
                    {activities.length === 0 ? (
                    <Text style={{ color: theme.text, textAlign: "center" }}>No posts yet</Text>
                    ) : (
                    activities.map((activity, idx) => (
                        <React.Fragment key={activity.id}>
                            <View key={activity.id} style={{ padding: 12, marginBottom: 8, backgroundColor: theme.inputBackground || '#eee', borderRadius: 10 }}>
                                <Text style={{ fontWeight: "bold", color: theme.text, fontSize: 20, marginBottom: 8 }}>
                                    {activity.title}
                                </Text>
                                <Text style={{ color: theme.text, marginBottom: 10 }}>{activity.description}</Text>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                                    <View style={{ alignItems: 'flex-start', flex: 1 }}>
                                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.text }}>Accessories</Text>
                                    <Text style={{ fontSize: 12, color: theme.placeholder }}>{activity.gearUsed || "N/A"}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-start', flex: 1 }}>
                                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.text }}>Drink Pairing</Text>
                                    <Text style={{ fontSize: 12, color: theme.placeholder }}>{activity.drinkPairing || "N/A"}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-start', flex: 1 }}>
                                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.text }}>Session Feel</Text>
                                    <Text style={{ fontSize: 12, color: theme.placeholder }}>{activity.sessionFeeling || "N/A"}</Text>
                                    </View>
                                </View>
                                {activity.media && (
                                    <View style={{ marginTop: 10, width: '100%', aspectRatio: 1 }}>
                                    <Image
                                        source={{ uri: activity.media }}
                                        style={{ width: '100%', height: '100%', borderRadius: 10 }}
                                        resizeMode="contain"
                                    />
                                    </View>
                                )}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 }}>
                                    <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center' }}
                                    onPress={() => handleLike(activity.id, auth.currentUser?.uid)}
                                    >
                                    <Ionicons
                                        name={activity.likes?.includes(auth.currentUser?.uid) ? "heart" : "heart-outline"}
                                        size={20}
                                        color={activity.likes?.includes(auth.currentUser?.uid) ? theme.primary : theme.text}
                                    />
                                    <Text style={{ marginLeft: 6, color: activity.likes?.includes(auth.currentUser?.uid) ? theme.primary : theme.text }}>
                                        {activity.likes?.length >= 1 ? activity.likes.length : 'Like'}
                                    </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center' }}
                                    onPress={() =>
                                        setShowCommentInput(prev => ({
                                        ...prev,
                                        [activity.id]: !prev[activity.id]
                                        }))
                                    }
                                    >
                                    <Ionicons name="chatbubble-outline" size={20} color={theme.text} />
                                    <Text style={{ marginLeft: 6, color: theme.text }}>Comment</Text>
                                    </TouchableOpacity>
                                </View>
                                {/* Comment input box */}
                                {showCommentInput[activity.id] && (
                                    <View style={{ marginTop: 10, position: 'relative', justifyContent: 'center' }}>
                                    <TextInput
                                        style={{
                                        backgroundColor: theme.inputBackground || '#eee',
                                        borderRadius: 6,
                                        paddingHorizontal: 12,
                                        paddingRight: 38,
                                        paddingVertical: 8,
                                        color: theme.text,
                                        minHeight: 36,
                                        }}
                                        placeholder="Write a comment..."
                                        placeholderTextColor={theme.placeholder}
                                        value={commentInput[activity.id] || ''}
                                        onChangeText={text =>
                                        setCommentInput(prev => ({
                                            ...prev,
                                            [activity.id]: text
                                        }))
                                        }
                                    />
                                    <TouchableOpacity
                                        onPress={async () => {
                                        const comment = commentInput[activity.id];
                                        if (!comment?.trim()) return;

                                        try {
                                            const postRef = doc(db, "user_activities", activity.id);
                                            await updateDoc(postRef, {
                                            comments: arrayUnion({
                                                userId: auth.currentUser.uid,
                                                userName: fullName || "Anonymous",
                                                text: comment.trim(),
                                                createdAt: new Date()
                                            })
                                            });
                                            setCommentInput(prev => ({ ...prev, [activity.id]: '' }));
                                        } catch (err) {
                                            console.error("Error adding comment:", err);
                                        }
                                        }}
                                        style={{
                                        position: 'absolute',
                                        right: 6,
                                        top: 0,
                                        bottom: 0,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        zIndex: 2,
                                        width: 28,
                                        height: 28,
                                        borderRadius: 14,
                                        backgroundColor: theme.primary,
                                        shadowColor: "#000",
                                        shadowOffset: { width: 0, height: 1 },
                                        shadowOpacity: 0.12,
                                        shadowRadius: 1,
                                        elevation: 1,
                                        }}
                                    >
                                        <Ionicons name="arrow-up" size={15} color="#fff" />
                                    </TouchableOpacity>
                                    </View>
                                )}
                                {activity.comments && activity.comments.length > 0 && (
                                    <View style={{ marginTop: 12 }}>
                                        {activity.comments.map((comment, index) => (
                                            <View key={index} style={{ marginBottom: 8 }}>
                                            <Text style={{ fontWeight: '600', color: theme.text }}>{comment.userName || 'User'}</Text>
                                            <Text style={{ color: theme.text }}>{comment.text}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                            {/* Separator line between posts, except after the last post */}
                            {idx < activities.length - 1 && (
                                <View style={{ height: 1, backgroundColor: theme.placeholder, marginVertical: 10, width: '100%' }} />
                            )}
                        </React.Fragment>
                    )))}
                </View>
            </ScrollView>
        </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
    },
    greeting: {
        fontSize: 30,
        fontWeight: '300',
        fontFamily: 'Avenir, Montserrat, Corbel, URW Gothic, source-sans-pro, sans-serif',
        marginTop: 20,
        marginBottom: 6,
    },
})