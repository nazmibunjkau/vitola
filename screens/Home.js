import React, { useEffect, useState, useRef, useCallback } from "react"
import { StyleSheet, TouchableWithoutFeedback, SafeAreaView, Text, View, TouchableOpacity, Image, Dimensions, ScrollView, TextInput, Alert, Share, RefreshControl, Modal } from "react-native"
import { useFocusEffect } from '@react-navigation/native';
import { auth, db } from "../config/firebase"
import { onAuthStateChanged, getAuth } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext';
import { doc, getDoc, collection, query, where, setDoc, orderBy, addDoc, onSnapshot, updateDoc, arrayUnion, arrayRemove, doc as firestoreDoc, deleteDoc, getDocs } from "firebase/firestore";
import logo from '../img/logo.png';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function Home({ navigation }) {
    const { theme } = useTheme();
    const [firstName, setFirstName] = useState("");
    const [activities, setActivities] = useState([]);
    const [userProfiles, setUserProfiles] = useState({}); 
    const [following, setFollowing] = useState([]);
    const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
    const isFirstLoad = useRef(true);
    const [commentInput, setCommentInput] = useState({});
    const [showCommentInput, setShowCommentInput] = useState({});
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedPost, setSelectedPost] = useState(null);
    const ellipsisRefs = useRef({});
    const [refreshing, setRefreshing] = useState(false);
    const [selectedComment, setSelectedComment] = useState(null);
    const [commentOptionsVisible, setCommentOptionsVisible] = useState(false);
    const [commentsByPost, setCommentsByPost] = useState({});
    const commentListeners = useRef({});
    // Add state for paid user
    const [isPaidUser, setIsPaidUser] = useState(false);

    const onRefresh = useCallback(async () => {
      setRefreshing(true);
      try {
        if (typeof fetchFollowingAndPosts === 'function') {
          await fetchFollowingAndPosts();
        }
      } catch (err) {
        console.error('Error refreshing:', err);
      }
      setRefreshing(false);
    }, []);

    const fetchCommentsForActivity = async (activityId) => {
      const commentsRef = collection(db, "user_activities", activityId, "comments");
      const q = query(commentsRef, orderBy("createdAt", "asc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };

    // Fetch current user first name for greeting
    useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user && isFirstLoad.current) {
          const docRef = doc(db, "users", user.uid);
          const unsubUser = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              const name = data.name || user.displayName || "User";
              setFirstName(name.split(' ')[0]);
              setFollowing(data.following || []);
            }
          });

          const notificationsRef = collection(db, 'users', user.uid, 'notifications');
          const q = query(notificationsRef, where('read', '==', false));
          const unsubNotifications = onSnapshot(q, (snapshot) => {
            setHasUnreadNotifications(!snapshot.empty);
          });

          isFirstLoad.current = false;
          return () => {
            unsubUser();
            unsubNotifications();
          };
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
            // Set paid user state
            setIsPaidUser(subscription !== 'free');

            // Only show Upgrade.js if user is on free plan
            if (subscription === 'free') {
              const countStr = await AsyncStorage.getItem('homeVisitCount');
              const count = parseInt(countStr, 10) || 0;
              const newCount = count + 1;
              await AsyncStorage.setItem('homeVisitCount', newCount.toString());

              if (newCount % 10 === 0) {
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

    useEffect(() => {
      const q = query(collection(db, "user_activities"), orderBy("date", "desc"));
      const unsubscribe = onSnapshot(q, async (querySnapshot) => {
        const postsList = [];
        const userIdsSet = new Set();
        const newCommentListeners = {};

        for (const docSnap of querySnapshot.docs) {
          const postData = { id: docSnap.id, ...docSnap.data() };
          if (following.includes(postData.user_id) || postData.user_id === auth.currentUser?.uid) {
            userIdsSet.add(postData.user_id);
            // Fetch comments for this post
            postData.comments = await fetchCommentsForActivity(postData.id);
            postsList.push(postData);

            // Set up a real-time listener for comments
            if (!commentListeners.current[postData.id]) {
              const commentsRef = collection(db, "user_activities", postData.id, "comments");
              newCommentListeners[postData.id] = onSnapshot(
                query(commentsRef, orderBy("createdAt", "asc")),
                (snapshot) => {
                  setCommentsByPost(prev => ({
                    ...prev,
                    [postData.id]: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                  }));
                }
              );
            }
          }
        }
        // Clean up old listeners
        Object.keys(commentListeners.current).forEach(postId => {
          if (!postsList.find(post => post.id === postId)) {
            commentListeners.current[postId] && commentListeners.current[postId]();
            delete commentListeners.current[postId];
          }
        });

        commentListeners.current = { ...commentListeners.current, ...newCommentListeners };
        setActivities(postsList);

        const userProfilesMap = {};
        await Promise.all(Array.from(userIdsSet).map(async (userId) => {
          try {
            const userSnap = await getDoc(doc(db, 'users', userId));
            if (userSnap.exists()) {
              userProfilesMap[userId] = userSnap.data();
            }
          } catch (err) {
            console.error("Error fetching profile for:", userId, err);
          }
        }));
        setUserProfiles(userProfilesMap);
      });
      return () => {
        unsubscribe();
        // Clean up all comment listeners
        Object.values(commentListeners.current).forEach(unsub => unsub && unsub());
        commentListeners.current = {};
      };
    }, [following]);

    const handleUnfollow = async (targetUserId) => {
      const functions = getFunctions();
      const unfollow = httpsCallable(functions, 'unfollowUser');
      await unfollow({ targetUserId });
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
        if (!hasLiked && activity.user_id !== currentUserId) {
          // Only notify if it's a new like and not your own post
          const notifRef = doc(collection(db, 'users', activity.user_id, 'notifications'));
          await setDoc(notifRef, {
            type: 'like',
            fromUserId: currentUserId,
            postId: activity.id,
            timestamp: new Date(),
            read: false,
          });
        }
      } catch (err) {
        console.error("Error updating like:", err);
      }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
          <ScrollView 
            contentContainerStyle={{ paddingBottom: 40 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.primary}
              />
            }
          >
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.bellButton}
                onPress={() => navigation.navigate('ProfileSearch')}
              >
                <Ionicons name="person-add" size={28} marginLeft={20} color={theme.primary} />
              </TouchableOpacity>

              {/* Upgrade button or logo depending on subscription */}
              {isPaidUser ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 30 }}>
                  <Image
                    source={logo}
                    style={[
                      styles.paidUpgradeLogo,
                      { backgroundColor: theme.background, marginRight: -10 },
                    ]}
                  />
                  <Text style={{ color: theme.primary, fontWeight: '300', fontSize: 28 }}>Vitola</Text>
                </View>
              ) : (
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
              )}

              <TouchableOpacity
                style={styles.bellButton}
                onPress={() => navigation.navigate('NotificationScreen')}
              >
                <Ionicons name="notifications-outline" size={28} color={theme.primary} />
                {hasUnreadNotifications && (
                  <View style={{
                    position: 'absolute',
                    top: 2,
                    right: -2,
                    backgroundColor: 'red',
                    width: 10,
                    height: 10,
                    borderRadius: 5
                  }} />
                )}
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
                            // If already open for this post, close it
                            if (modalVisible && selectedPost && selectedPost.id === activity.id) {
                              setModalVisible(false);
                              setSelectedPost(null);
                              return;
                            }
                            setSelectedPost(activity);
                            setModalVisible(true);
                          }}
                        >
                          <Ionicons name="ellipsis-vertical" size={22} color={theme.text} />
                        </TouchableOpacity>
                        {/* Popup Modal for post options */}
                        <Modal
                          animationType="slide"
                          transparent={true}
                          visible={modalVisible}
                          onRequestClose={() => setModalVisible(false)}
                        >
                          <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
                            <View style={{
                              flex: 1,
                              justifyContent: 'flex-end',
                              backgroundColor: 'rgba(0,0,0,0.4)',
                            }}>
                              <TouchableWithoutFeedback>
                                <View style={{
                                  backgroundColor: theme.background,
                                  borderTopLeftRadius: 16,
                                  borderTopRightRadius: 16,
                                  paddingHorizontal: 20,
                                  paddingTop: 12,
                                  paddingBottom: 40,
                                }}>
                                  {selectedPost && (
                                    <View style={{ marginBottom: 10 }}>
                                      {selectedPost.user_id === auth.currentUser?.uid ? (
                                        <>
                                          <TouchableOpacity
                                            style={styles.popupOption}
                                            onPress={() => {
                                              setModalVisible(false);
                                              navigation.navigate('EditPost', { post: selectedPost });
                                            }}
                                          >
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                              <Ionicons name="create-outline" size={20} color={theme.primary} style={{ marginRight: 12 }} />
                                              <Text style={{ color: theme.primary, fontWeight: 'bold' }}>Edit Post</Text>
                                            </View>
                                          </TouchableOpacity>
                                          <TouchableOpacity
                                            style={styles.popupOption}
                                            onPress={() => {
                                              setModalVisible(false);
                                              handleDeletePost(selectedPost.id, selectedPost.user_id);
                                            }}
                                          >
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                              <Ionicons name="trash-outline" size={20} color="#d32f2f" style={{ marginRight: 12 }} />
                                              <Text style={{ color: "#d32f2f", fontWeight: "bold" }}>Delete Post</Text>
                                            </View>
                                          </TouchableOpacity>
                                        </>
                                      ) : (
                                        <>
                                          <TouchableOpacity
                                            style={styles.popupOption}
                                            onPress={() => {
                                              setModalVisible(false);
                                              handleReport();
                                            }}
                                          >
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                              <Ionicons name="flag-outline" size={20} color={theme.primary} style={{ marginRight: 12 }} />
                                              <Text style={{ color: theme.primary }}>Report</Text>
                                            </View>
                                          </TouchableOpacity>
                                          {following.includes(selectedPost.user_id) ? (
                                            <TouchableOpacity
                                              style={styles.popupOption}
                                              onPress={async () => {
                                                setModalVisible(false);
                                                try {
                                                  const currentUserRef = doc(db, 'users', auth.currentUser.uid);
                                                  const targetUserRef = doc(db, 'users', selectedPost.user_id);

                                                  await updateDoc(currentUserRef, {
                                                    following: arrayRemove(selectedPost.user_id),
                                                  });

                                                  await updateDoc(targetUserRef, {
                                                    followers: arrayRemove(auth.currentUser.uid),
                                                  });

                                                  // Update local following state
                                                  setFollowing(prev => prev.filter(uid => uid !== selectedPost.user_id));

                                                  // Optional: Notify Profile screen to update count (if using global state or context)
                                                  // Example: useEventEmitter or state manager to trigger profile refetch

                                                  Alert.alert("Unfollowed", "You have unfollowed this user.");
                                                } catch (err) {
                                                  console.error("Unfollow error:", err);  // Add console for debugging
                                                  Alert.alert("Error", "Could not unfollow user.");
                                                }
                                              }}
                                            >
                                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Ionicons name="person-remove-outline" size={20} color="#d32f2f" style={{ marginRight: 12 }} />
                                                <Text style={{ color: "#d32f2f" }}>Unfollow</Text>
                                              </View>
                                            </TouchableOpacity>
                                          ) : (
                                            <TouchableOpacity
                                              style={styles.popupOption}
                                              onPress={async () => {
                                                setModalVisible(false);
                                                try {
                                                  const currentUserRef = doc(db, 'users', auth.currentUser.uid);
                                                  const targetUserRef = doc(db, 'users', selectedPost.user_id);
                                                  await updateDoc(currentUserRef, {
                                                    following: arrayUnion(selectedPost.user_id),
                                                  });
                                                  await updateDoc(targetUserRef, {
                                                    followers: arrayUnion(auth.currentUser.uid),
                                                  });
                                                  setFollowing(prev => [...prev, selectedPost.user_id]);
                                                  Alert.alert("Followed", "You are now following this user.");
                                                } catch (err) {
                                                  Alert.alert("Error", "Could not follow user.");
                                                }
                                              }}
                                            >
                                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Ionicons name="person-add-outline" size={20} color={theme.primary} style={{ marginRight: 12 }} />
                                                <Text style={{ color: theme.primary }}>Follow</Text>
                                              </View>
                                            </TouchableOpacity>
                                          )}
                                        </>
                                      )}
                                      <TouchableOpacity
                                        style={styles.popupOption}
                                        onPress={() => setModalVisible(false)}
                                      >
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                          <Ionicons name="close-outline" size={20} color={theme.text} style={{ marginRight: 12 }} />
                                          <Text style={{ color: theme.text }}>Cancel</Text>
                                        </View>
                                      </TouchableOpacity>
                                    </View>
                                  )}
                                </View>
                              </TouchableWithoutFeedback>
                            </View>
                          </TouchableWithoutFeedback>
                        </Modal>
                      </View>
                      <Text style={{ fontWeight: "bold", color: theme.text, fontSize: 22, marginBottom: 12 }}>
                        {activity.title}
                      </Text>
                      <Text style={{ color: theme.text, marginTop: 4, marginBottom: 16 }}>{activity.description}</Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                        <View style={{ alignItems: 'flex-start', flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.text }}>Accessories</Text>
                          <Text style={{ fontSize: 14, color: theme.placeholder }}>{activity.gearUsed || "N/A"}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-start', flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.text }}>Drink Pairing</Text>
                          <Text style={{ fontSize: 14, color: theme.placeholder }}>{activity.drinkPairing || "N/A"}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-start', flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.text }}>Session Feel</Text>
                          <Text style={{ fontSize: 14, color: theme.placeholder }}>{activity.sessionFeeling || "N/A"}</Text>
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
                                setCommentInput(prev => ({ ...prev, [activity.id]: '' }));
                                await addDoc(collection(db, "user_activities", activity.id, "comments"), {
                                  userId: auth.currentUser.uid,
                                  userName: auth.currentUser.displayName || "Anonymous",
                                  text: comment.trim(),
                                  createdAt: new Date()
                                });
                                if (activity.user_id !== auth.currentUser.uid) {
                                  const notifRef = doc(collection(db, 'users', activity.user_id, 'notifications'));
                                  await setDoc(notifRef, {
                                    type: 'comment',
                                    fromUserId: auth.currentUser.uid,
                                    postId: activity.id,
                                    commentText: comment.trim(),
                                    timestamp: new Date(),
                                    read: false,
                                  });
                                }
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
                      {commentsByPost[activity.id] && commentsByPost[activity.id].length > 0 && (
                        <View style={{ marginTop: 12 }}>
                          {commentsByPost[activity.id].map((comment, index) => {
                            const isCommentOwner = comment.userId === auth.currentUser?.uid;
                            const isPostOwner = activity.user_id === auth.currentUser?.uid;
                            const isOwnComment = isCommentOwner || isPostOwner;
                            return (
                              <View key={index} style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontWeight: '600', color: theme.text }}>{comment.userName || 'User'}</Text>
                                  <Text style={{ color: theme.text }}>{comment.text}</Text>
                                </View>
                                {isOwnComment && (
                                  <TouchableOpacity onPress={() => {
                                    setSelectedComment({ activityId: activity.id, comment });
                                    setCommentOptionsVisible(true);
                                  }}>
                                    <Ionicons name="ellipsis-horizontal" size={20} color={theme.text} />
                                  </TouchableOpacity>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      )}
                      <View style={{ height: 1, backgroundColor: theme.placeholder, marginTop: 12, position: 'relative', left: -42, width: Dimensions.get('window').width }} />
                      {/* Modal for post options */}
                      <Modal
                        animationType="slide"
                        transparent={true}
                        visible={commentOptionsVisible}
                        onRequestClose={() => setCommentOptionsVisible(false)}
                      >
                        <TouchableWithoutFeedback onPress={() => setCommentOptionsVisible(false)}>
                          <View style={{
                            flex: 1,
                            justifyContent: 'flex-end',
                            backgroundColor: 'rgba(0,0,0,0.4)',
                          }}>
                            <TouchableWithoutFeedback>
                              <View style={{
                                backgroundColor: theme.inputBackground || "#fff",
                                borderTopLeftRadius: 16,
                                borderTopRightRadius: 16,
                                paddingHorizontal: 20,
                                paddingTop: 24,
                                paddingBottom: 40,
                              }}>
                                {/* ✅ Report Option - only shown if current user is NOT the commenter */}
                                {auth.currentUser?.uid !== selectedComment?.comment?.userId && (
                                  <TouchableOpacity
                                    onPress={() => {
                                      Alert.alert("Reported", "Thank you for reporting this comment.");
                                      setCommentOptionsVisible(false);
                                    }}
                                    style={{ paddingVertical: 16 }}
                                  >
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                      <Ionicons name="flag-outline" size={20} color={theme.primary} style={{ marginRight: 12 }} />
                                      <Text style={{ color: theme.primary, fontSize: 16 }}>Report</Text>
                                    </View>
                                  </TouchableOpacity>
                                )}

                                {/* ✅ Delete Option - only shown if commenter or post owner */}
                                {(auth.currentUser?.uid === selectedComment?.comment?.userId ||
                                  auth.currentUser?.uid === activity?.user_id) && (
                                  <TouchableOpacity
                                    onPress={async () => {
                                      try {
                                        const commentDocRef = doc(
                                          db,
                                          "user_activities",
                                          selectedComment.activityId,
                                          "comments",
                                          selectedComment.comment.id
                                        );
                                        await deleteDoc(commentDocRef);
                                        setCommentOptionsVisible(false);
                                      } catch (err) {
                                        Alert.alert("Error", "Could not delete comment.");
                                      }
                                    }}
                                    style={{ paddingVertical: 16 }}
                                  >
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                      <Ionicons name="trash-outline" size={20} color="#d32f2f" style={{ marginRight: 12 }} />
                                      <Text style={{ color: "#d32f2f", fontWeight: "bold", fontSize: 16 }}>Delete Comment</Text>
                                    </View>
                                  </TouchableOpacity>
                                )}

                                {/* Cancel Option */}
                                <TouchableOpacity
                                  onPress={() => setCommentOptionsVisible(false)}
                                  style={{ paddingVertical: 16 }}
                                >
                                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="close-outline" size={20} color={theme.primary} style={{ marginRight: 12 }} />
                                    <Text style={{ color: theme.primary, fontSize: 16 }}>Cancel</Text>
                                  </View>
                                </TouchableOpacity>
                              </View>
                            </TouchableWithoutFeedback>
                          </View>
                        </TouchableWithoutFeedback>
                      </Modal>
                    </View>
                  )
                })
              )}
            </View>
          </ScrollView>
        {/* Floating "+" button */}
        <TouchableOpacity
          style={{
            position: 'absolute',
            bottom: 24,
            right: 24,
            backgroundColor: theme.primary,
            width: 60,
            height: 60,
            borderRadius: 30,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 5,
            zIndex: 10,
          }}
          onPress={() => navigation.navigate('Sessions')}
        >
          <Ionicons name="add" size={32} color="#fff" />
        </TouchableOpacity>
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
  paidUpgradeLogo: {
    width: 72,
    height: 72,
    marginRight: 20,
    borderRadius: 11,
  },
  upgradeText: {
    fontWeight: '400',
    fontSize: 16,
  },
  popupOption: {
  paddingVertical: 14,
  borderBottomWidth: 0.5,
  borderBottomColor: '#ccc',
}
})