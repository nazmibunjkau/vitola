import React, { useEffect, useState, useRef, useCallback } from "react"
import { StyleSheet, SafeAreaView, Text, View, TouchableOpacity, Image, Dimensions, ScrollView, TextInput, Modal, Pressable, Alert, Share } from "react-native"
import { useFocusEffect } from '@react-navigation/native';
import { auth, db } from "../config/firebase"
import { onAuthStateChanged, getAuth } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, updateDoc, arrayUnion, arrayRemove, doc as firestoreDoc, deleteDoc } from "firebase/firestore";
import logo from '../img/logo.png';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Home({ navigation }) {
    const { theme } = useTheme();
    const [firstName, setFirstName] = useState("")
    const [activities, setActivities] = useState([]);
    const [userProfiles, setUserProfiles] = useState({}); 
    const isFirstLoad = useRef(true);
    const [commentInput, setCommentInput] = useState({});
    const [showCommentInput, setShowCommentInput] = useState({});
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedPost, setSelectedPost] = useState(null);
    const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
    const ellipsisRefs = useRef({});

    // Fetch current user first name for greeting
    useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          if (isFirstLoad.current) {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const data = docSnap.data();
              const name = data.name || user.displayName || "User";
              setFirstName(name.split(' ')[0]);
            } else {
              setFirstName(user.displayName?.split(' ')[0] || "User");
            }
            isFirstLoad.current = false;
          } else {
            setFirstName(user.displayName?.split(' ')[0] || "User");
          }
        } else {
          setFirstName("User");
        }
      });
      return () => unsubscribe();
    }, []);

    useFocusEffect(
      useCallback(() => {
        const checkVisitCount = async () => {
          try {
            // Get subscription status from Firestore
            const userRef = doc(db, 'users', auth.currentUser.uid);
            const userSnap = await getDoc(userRef);
            const userData = userSnap.exists() ? userSnap.data() : {};
            const subscription = userData.subscriptionPlan || 'free';

            // Only show Upgrade.js if user is on free plan
            if (subscription === 'free') {
              const countStr = await AsyncStorage.getItem('homeVisitCount');
              const count = parseInt(countStr, 10) || 0;
              const newCount = count + 1;
              await AsyncStorage.setItem('homeVisitCount', newCount.toString());

              if (newCount % 6 === 0) {
                navigation.navigate('Upgrade');
              }
            }
          } catch (err) {
            console.error('Error tracking home visits or fetching subscription:', err);
          }
        };

        checkVisitCount();
      }, [])
    );

    // Fetch user activities and user profiles for each post author
    useEffect(() => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;

      const q = query(
        collection(db, "user_activities"),
        where("user_id", "==", user.uid),
        orderBy("date", "desc")
      );

      const unsubscribePosts = onSnapshot(q, async (querySnapshot) => {
        const postsList = [];
        const userIdsSet = new Set();

        querySnapshot.forEach(doc => {
          const data = { id: doc.id, ...doc.data() };
          // Ensure comments array exists
          if (!data.comments) data.comments = [];
          postsList.push(data);
          userIdsSet.add(data.user_id);
        });

        setActivities(postsList);

        // Fetch all user profiles for userIds found in posts
        const userProfilesMap = {};
        await Promise.all(Array.from(userIdsSet).map(async (userId) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
              userProfilesMap[userId] = userDoc.data();
            }
          } catch (err) {
            console.error("Error fetching user profile for ", userId, err);
          }
        }));

        setUserProfiles(userProfilesMap);
      });

      return () => unsubscribePosts();
    }, []);

    const handleDeletePost = (postId) => {
      Alert.alert(
        "Delete Post",
        "Are you sure you want to delete this post? This action cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteDoc(firestoreDoc(db, "user_activities", postId));
                setActivities(prev => prev.filter(post => post.id !== postId));
                setModalVisible(false);
              } catch (err) {
                Alert.alert("Error", "Could not delete post.");
              }
            }
          }
        ]
      );
    };

    const handleUnfollow = (userId) => {
      // TODO: Add your unfollow logic here
      setModalVisible(false);
      Alert.alert("Unfollowed", "You have unfollowed this user.");
    };

    // Report handler
    const handleReport = () => {
      setModalVisible(false);
      Alert.alert("Reported", "Thank you for reporting this post.");
    };

    // Like/unlike post handler
    const handleLike = async (postId, currentUserId) => {
      const postRef = firestoreDoc(db, "user_activities", postId);
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

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.bellButton}
                onPress={() => navigation.navigate('ProfileSearch')}
              >
                <Ionicons name="person-add" size={28} marginLeft={20} color={theme.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.upgradeButton,
                  { backgroundColor: theme.primary, shadowColor: theme.text },
                ]}
                onPress={() => navigation.navigate('Upgrade')}
              >
                <Image
                  source={logo}
                  style={[
                    styles.upgradeLogo,
                    { backgroundColor: theme.background },
                  ]}
                />
                <Text style={[styles.upgradeText, { color: theme.background }]}>Upgrade</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.bellButton}
                onPress={() => navigation.navigate('NotificationScreen')}
              >
                <Ionicons name="notifications-outline" size={28} color={theme.primary} />
              </TouchableOpacity>
            </View>
            <View style={{ height: 1, backgroundColor: theme.placeholder, marginTop: 20, width: '100%' }} />
            <View style={{ paddingHorizontal: 30, marginTop: 20 }}>
              {activities.length === 0 ? (
                <Text style={{ color: theme.text, textAlign: "center" }}>No activities yet</Text>
              ) : ( 
                activities.map((activity) => {  
                  const userProfile = userProfiles[activity.user_id] || {};
                  const isCurrentUser = activity.user_id === auth.currentUser?.uid;
                  return (
                    <View key={activity.id} style={{ padding: 12, marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Image
                            source={{ uri: userProfile.photoURL || 'https://placehold.co/40x40' }}
                            style={{ width: 40, height: 40, borderRadius: 20, marginRight: 10 }}
                          />
                          <View>
                            <Text style={{ color: theme.text, fontWeight: '600', marginBottom: 6 }}>{activity.user_name || 'Unknown User'}</Text>
                            <Text style={{ fontSize: 12, color: theme.placeholder, marginBottom: 12 }}>
                              {(() => {
                                if (!activity.date?.toDate) return '';
                                const postDate = activity.date.toDate();
                                const now = new Date();
                                const isToday = postDate.toDateString() === now.toDateString();
                                const yesterday = new Date();
                                yesterday.setDate(now.getDate() - 1);
                                const isYesterday = postDate.toDateString() === yesterday.toDateString();
                                const timeString = postDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                                const dateString = isToday
                                  ? `Today at ${timeString}`
                                  : isYesterday
                                  ? `Yesterday at ${timeString}`
                                  : postDate.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` at ${timeString}`;
                                // Use activity.location directly, fallback to 'Unknown Location'
                                return `${dateString} • ${activity.location || 'Unknown Location'}`;
                              })()}
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          ref={ref => { if (ref) ellipsisRefs.current[activity.id] = ref; }}
                          style={{ padding: 4 }}
                          onPress={() => {
                            ellipsisRefs.current[activity.id]?.measureInWindow((x, y, width, height) => {
                              setPopupPosition({ top: y + height + 4, left: x - 60 }); // Shift further left (was -20)
                              setSelectedPost(activity);
                              setModalVisible(true);
                            });
                          }}
                        >
                          <Ionicons name="ellipsis-vertical" size={22} color={theme.text} />
                        </TouchableOpacity>
                      </View>
                      <Text style={{ fontWeight: "bold", color: theme.text, fontSize: 22, marginBottom: 12 }}>
                        {activity.title}
                      </Text>
                      <Text style={{ color: theme.text, marginTop: 4, marginBottom: 16 }}>{activity.description}</Text>
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
                      {activity.media && (
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
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center' }}
                            onPress={async () => {
                              try {
                                const shareMessage = `${activity.title}\n\n${activity.description}\n\n${activity.media || ''}`;
                                await Share.share({
                                  message: shareMessage
                                });
                              } catch (error) {
                                console.error('Error sharing post:', error);
                              }
                            }}
                          >
                            <Ionicons name="share-social-outline" size={20} color={theme.text} />
                            <Text style={{ marginLeft: 6, color: theme.text }}>Share</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      {/* Add this lighter separator line below the icons and above the first comment */}
                      <View style={{ height: 1, backgroundColor: theme.inputBackground || "#e6ded7", opacity: 0.7, marginTop: 10, marginBottom: 6, width: '100%' }} />
                      {/* Comment input box */}
                      {showCommentInput[activity.id] && (
                        <View style={{ marginTop: 10, position: 'relative', justifyContent: 'center' }}>
                          <TextInput
                            style={{
                              backgroundColor: theme.inputBackground || '#eee',
                              borderRadius: 6,
                              paddingHorizontal: 12,
                              paddingRight: 38, // enough space for the button
                              paddingVertical: 8,
                              color: theme.text,
                              minHeight: 36, // ensure input is at least as tall as the button
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
                                const postRef = firestoreDoc(db, "user_activities", activity.id);
                                await updateDoc(postRef, {
                                  comments: arrayUnion({
                                    userId: auth.currentUser.uid,
                                    userName: auth.currentUser.displayName || "Anonymous",
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
                              width: 32,
                              height: 28,
                              borderRadius: 30,
                              backgroundColor: theme.primary,
                              shadowColor: "#000",
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: 0.12,
                              shadowRadius: 1,
                              elevation: 1,
                              minHeight: 36
                            }}
                          >
                            <Ionicons name="arrow-up" size={20} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      )}
                      {activity.comments && activity.comments.length > 0 && (
                        <View style={{ marginTop: 12 }}>
                          {activity.comments.map((comment, index) => (
                            <View key={index} style={{ marginBottom: 16 }}>
                              {/* Increased marginBottom from 8 to 16 */}
                              <Text style={{ fontWeight: '600', color: theme.text }}>{comment.userName || 'User'}</Text>
                              <Text style={{ color: theme.text }}>{comment.text}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                      <View style={{ height: 1, backgroundColor: theme.placeholder, marginTop: 12, position: 'relative', left: -42, width: Dimensions.get('window').width }} />
                      {/* Modal for post options */}
                      <Modal
                        animationType="fade"
                        transparent={true}
                        visible={modalVisible && selectedPost?.id === activity.id}
                        onRequestClose={() => setModalVisible(false)}
                      >
                        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
                          <View
                            style={[
                              styles.popup,
                              {
                                backgroundColor: theme.inputBackground || "#fff",
                                position: "absolute",
                                top: popupPosition.top,
                                left: popupPosition.left,
                                zIndex: 1000,
                              },
                            ]}
                          >
                            <TouchableOpacity
                              style={styles.popupOption}
                              onPress={handleReport}
                            >
                              <Text style={{ color: "#d32f2f", fontWeight: "400", fontSize: 16 }}>Report</Text>
                            </TouchableOpacity>
                            {isCurrentUser ? (
                              <TouchableOpacity
                                style={styles.popupOption}
                                onPress={() => handleDeletePost(activity.id)}
                              >
                                <Text style={{ color: theme.primary, fontWeight: "400", fontSize: 16 }}>Delete</Text>
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity
                                style={styles.popupOption}
                                onPress={() => handleUnfollow(activity.user_id)}
                              >
                                <Text style={{ color: theme.text, fontWeight: "400", fontSize: 16 }}>Unfollow</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </Pressable>
                      </Modal>
                    </View>
                  )
                })
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 80,
        paddingHorizontal: 30,
        backgroundColor: '#fff'
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      flexWrap: 'nowrap', // prevents wrapping that breaks layout
    },
    textBlockContainer: {
      flexShrink: 1,
      flexGrow: 1,
      minWidth: 0,
      marginRight: 8,
      marginLeft: 18,
    },
    greeting: {
      fontSize: 30,
      fontWeight: '300',
      fontFamily: 'Avenir, Montserrat, Corbel, URW Gothic, source-sans-pro, sans-serif',
      color: '#4b382a',
      marginTop: 20,
      marginBottom: 6,
      maxWidth: '100%',
    },
    subtext: {
      fontSize: 16,
      fontWeight: '400',
      fontFamily: 'Avenir, Montserrat, Corbel, URW Gothic, source-sans-pro, sans-serif',
      color: '#7a5e47',
      marginTop: 12,
      maxWidth: '100%',
    },
    bellButton: {
      padding: 10,
      marginRight: 20,
      alignSelf: 'center', 
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    popup: {
      borderRadius: 16,
      paddingVertical: 8,
      paddingHorizontal: 0,
      alignItems: 'flex-start',
      backgroundColor: "#fff",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
    popupOption: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: '100%',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
    alignSelf: 'center',
  },
  upgradeLogo: {
    width: 32,
    height: 32,
    marginRight: 10,
    borderRadius: 11,
  },
  upgradeText: {
    fontWeight: '400',
    fontSize: 16,
  },
})