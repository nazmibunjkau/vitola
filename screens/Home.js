import React, { useEffect, useState, useRef, useCallback } from "react"
import { StyleSheet, TouchableWithoutFeedback, SafeAreaView, Text, View, TouchableOpacity, Image, Dimensions, ScrollView, TextInput, Alert, Share, RefreshControl, Modal, KeyboardAvoidingView, Platform, Keyboard } from "react-native"
import { useFocusEffect, TabActions } from '@react-navigation/native';
import { auth, db } from "../config/firebase"
import { onAuthStateChanged } from 'firebase/auth';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext';
import { doc, getDoc, collection, query, where, setDoc, orderBy, addDoc, onSnapshot, updateDoc, arrayUnion, arrayRemove, doc as firestoreDoc, deleteDoc, getDocs, serverTimestamp } from "firebase/firestore";
import logo from '../img/logo.png';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import Autocomplete from 'react-native-autocomplete-input';
import cities from '../assets/cities.json';

// Session Feelings constant
const sessionFeelings = ['Relaxing', 'Social', 'Celebratory', 'Reflective', 'Routine'];

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
    const [editingId, setEditingId] = useState(null);
    const [editDrafts, setEditDrafts] = useState({});
    const [savingEdit, setSavingEdit] = useState(false);
    // Dropdown state for session picker
    const [sessionPicker, setSessionPicker] = useState({ visible: false, postId: null });
    // Dropdown state for Humidor & Cigar pickers
    const [humidorPicker, setHumidorPicker] = useState({ visible: false, postId: null });
    const [cigarPicker, setCigarPicker] = useState({ visible: false, postId: null });
    const [humidorOptions, setHumidorOptions] = useState([]); // [{id, title}]
    const [cigarOptions, setCigarOptions] = useState([]);     // [{id, name}]
    const commentListeners = useRef({});
    const likesListeners = useRef({});
    const [likesByPost, setLikesByPost] = useState({}); // { [postId]: { count, ids, hasCurrentUser } }
    // Add state for paid user
    const [isPaidUser, setIsPaidUser] = useState(false);
    const [cityACOpen, setCityACOpen] = useState({}); // { [postId]: boolean }
    // Ref for ScrollView to enable scroll-to-top on tab press
    const scrollRef = useRef(null);

    // Track comment input vertical positions (within ScrollView) for precise snapping
    const inputPositions = useRef({}); // { [postId]: number }

    // Hide comment inputs when keyboard hides (global)
    useEffect(() => {
      const sub = Keyboard.addListener('keyboardDidHide', () => {
        setShowCommentInput({});
      });
      return () => sub.remove();
    }, []);

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
          let unsubFollowing = null;
          const docRef = doc(db, "users", user.uid);
          const unsubUser = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              const name = data.name || user.displayName || "User";
              setFirstName(name.split(' ')[0]);
            }
            // Live-following listener (subcollection-based)
            if (!unsubFollowing) {
              const followingRef = collection(db, 'users', user.uid, 'following');
              unsubFollowing = onSnapshot(followingRef, (snap) => {
                const ids = snap.docs.map(d => d.id);
                setFollowing(ids);
              }, (err) => {
                console.error('following listener error:', err);
                setFollowing([]);
              });
            }
          });

          const notificationsRef = collection(db, 'users', user.uid, 'notifications');
          const q = query(notificationsRef, where('read', '==', false));
          const unsubNotifications = onSnapshot(q, (snapshot) => {
            setHasUnreadNotifications(!snapshot.empty);

            // Real-time pop for newly added notifications (e.g., invite)
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                const n = change.doc.data();
                if (n?.type === 'invite') {
                  const clubName = n?.clubName || 'a club';
                  Alert.alert(
                    'Club Invite',
                    `You have been invited to join ${clubName}.`,
                    [
                      { text: 'Dismiss', style: 'cancel' },
                      {
                        text: 'View',
                        onPress: () => {
                          // Navigate to notifications (or an Invites screen if you add one later)
                          try { navigation.navigate('NotificationScreen'); } catch {}
                        },
                      },
                    ]
                  );
                }
              }
            });
          });

          isFirstLoad.current = false;
          return () => {
            unsubUser();
            unsubNotifications();
            if (unsubFollowing) unsubFollowing();
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
        const newLikesListeners = {};

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
            // Set up a real-time listener for likes (subcollection)
            if (!likesListeners.current[postData.id]) {
              const likesRef = collection(db, "user_activities", postData.id, "likes");
              newLikesListeners[postData.id] = onSnapshot(likesRef, (snap) => {
                const ids = snap.docs.map(d => d.id); // doc id is the liker uid
                const me = auth.currentUser?.uid;
                setLikesByPost(prev => ({
                  ...prev,
                  [postData.id]: {
                    count: snap.size,
                    ids,
                    hasCurrentUser: me ? ids.includes(me) : false,
                  }
                }));
              });
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
        Object.keys(likesListeners.current).forEach(postId => {
          if (!postsList.find(post => post.id === postId)) {
            likesListeners.current[postId] && likesListeners.current[postId]();
            delete likesListeners.current[postId];
          }
        });

        commentListeners.current = { ...commentListeners.current, ...newCommentListeners };
        likesListeners.current = { ...likesListeners.current, ...newLikesListeners };
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
        // Clean up all likes listeners
        Object.values(likesListeners.current).forEach(unsub => unsub && unsub());
        likesListeners.current = {};
      };
    }, [following]);

    // Load user's humidors
    const loadHumidors = async () => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) return [];
        const ref = collection(db, 'users', uid, 'humidors');
        const snap = await getDocs(ref);
        const list = snap.docs.map(d => ({ id: d.id, title: d.data()?.title || d.data()?.name || 'Untitled Humidor' }));
        setHumidorOptions(list);
        return list;
      } catch (e) {
        console.error('Failed to load humidors:', e);
        setHumidorOptions([]);
        return [];
      }
    };

    // Load cigars for a given humidor (supports both 'cigars' and 'humidor_cigars')
    const loadCigarsForHumidor = async (humidorId) => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid || !humidorId) return [];
        // Prefer 'cigars' subcollection
        let ref = collection(db, 'users', uid, 'humidors', humidorId, 'cigars');
        let snap = await getDocs(ref);
        // Fallback to 'humidor_cigars' if empty
        if (snap.empty) {
          ref = collection(db, 'users', uid, 'humidors', humidorId, 'humidor_cigars');
          snap = await getDocs(ref);
        }
        const list = snap.docs.map(d => ({
          id: d.id,
          name: d.data()?.name || d.data()?.cigar || 'Unnamed Cigar',
          cigarId: d.data()?.cigarId || d.data()?.catalogId || d.data()?.masterId || d.data()?.catalog_id || d.data()?.master_id || d.id,
        }));
        setCigarOptions(list);
        return list;
      } catch (e) {
        console.error('Failed to load cigars:', e);
        setCigarOptions([]);
        return [];
      }
    };

    const handleUnfollow = async (targetUserId) => {
      const functions = getFunctions();
      const unfollow = httpsCallable(functions, 'unfollowUser');
      await unfollow({ targetUserId });
    };

    const openEditPost = (post) => {
      setEditingId(post.id);
      setEditDrafts(prev => ({
        ...prev,
        [post.id]: {
          title: post.title || '',
          description: post.description || '',
          gearUsed: post.gearUsed || '',
          drinkPairing: post.drinkPairing || '',
          sessionFeeling: post.sessionFeeling || '',
          humidor: post.humidor || '',
          cigar: post.cigar || '',
          cigarId: post.cigarId || '',
          locationQuery: post.location || '',
          selectedCity: post.location || ''
        }
      }));
      setModalVisible(false);
    };

    const saveEditedPost = async () => {
      if (!editingId) return;
      try {
        setSavingEdit(true);
        const draft = editDrafts[editingId] || {};
        const updated = {
          title: (draft.title || '').trim(),
          description: (draft.description || '').trim(),
          gearUsed: (draft.gearUsed || '').trim(),
          drinkPairing: (draft.drinkPairing || '').trim(),
          sessionFeeling: (draft.sessionFeeling || '').trim(),
          humidor: (draft.humidor || '').trim(),
          cigar: (draft.cigar || '').trim(),
          cigarId: draft.cigarId || null,
          location: ((draft.selectedCity || draft.locationQuery || '')).trim(),
          updatedAt: new Date(),
        };
        await updateDoc(doc(db, 'user_activities', editingId), updated);
        setActivities(prev => prev.map(p => p.id === editingId ? { ...p, ...updated } : p));
        setEditingId(null);
        setEditDrafts(prev => { const n = { ...prev }; delete n[editingId]; return n; });
      } catch (e) {
        Alert.alert('Error', 'Could not save changes.');
      } finally {
        setSavingEdit(false);
      }
    };

    // Report handler
    const handleReport = () => {
      setModalVisible(false);
      Alert.alert("Reported", "Thank you for reporting this post.");
    };

    // Like/unlike post handler
    const handleLike = async (postId, currentUserId) => {
      try {
        const likeDocRef = firestoreDoc(db, "user_activities", postId, "likes", currentUserId);
        const activity = activities.find(act => act.id === postId);
        const alreadyLiked = !!likesByPost[postId]?.hasCurrentUser;

        if (alreadyLiked) {
          await deleteDoc(likeDocRef);
        } else {
          await setDoc(likeDocRef, {
            userId: currentUserId,
            createdAt: serverTimestamp(),
          });
          // Notify the post owner only on new like and not for own post
          if (activity && activity.user_id !== currentUserId) {
            const notifRef = doc(collection(db, 'users', activity.user_id, 'notifications'));
            await setDoc(notifRef, {
              type: 'like',
              fromUserId: currentUserId,
              postId: activity.id,
              timestamp: new Date(),
              read: false,
            });
          }
        }
      } catch (err) {
        console.error("Error toggling like (subcollection):", err);
      }
    };

    // Listen for tabPress to scroll to top and refresh
    useEffect(() => {
      const unsubscribe = navigation.addListener('tabPress', e => {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        onRefresh();
      });
      return unsubscribe;
    }, [navigation, onRefresh]);

    return (
      <KeyboardAvoidingView
        style={[{ flex: 1 }, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}  // adjust if you have a header
      >
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }] }>
          <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setShowCommentInput({}); }} accessible={false}>
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={{ paddingBottom: 40 }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={theme.primary}
                />
              }
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              automaticallyAdjustKeyboardInsets={false}
              contentInsetAdjustmentBehavior="never"
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
                            <TouchableOpacity
                              onPress={() => {
                                const me = auth.currentUser?.uid;
                                const isCurrentUserTap = activity.user_id === me;

                                if (isCurrentUserTap) {
                                  // Prefer: jump directly to the Profile tab on the bottom tabs navigator
                                  const tabNavById = navigation.getParent && navigation.getParent('rootTabs');
                                  if (tabNavById) {
                                    tabNavById.dispatch(TabActions.jumpTo('Profile'));
                                    return;
                                  }

                                  const parent = navigation.getParent ? navigation.getParent() : null;
                                  if (parent) {
                                    try {
                                      parent.dispatch(TabActions.jumpTo('Profile'));
                                      return;
                                    } catch {}
                                  }

                                  // Fallback: target the nested tabs via the stack by name
                                  try {
                                    navigation.navigate('MainApp', { screen: 'Profile' });
                                    return;
                                  } catch {}

                                  return;
                                }

                                // Someone else -> push their profile as a separate screen
                                navigation.push('Profile', { userId: activity.user_id, fromOutside: true });
                              }}
                              accessibilityRole="button"
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                <Text style={{ color: theme.primary, fontWeight: '600' }}>
                                  {activity.user_name || 'Unknown User'}
                                </Text>
                                {userProfiles[activity.user_id]?.subscriptionPlan === 'paid' && (
                                  <MaterialIcons
                                    name="verified"
                                    size={16}
                                    color={theme.primary}
                                    style={{ marginLeft: 6 }}
                                  />
                                )}
                              </View>
                            </TouchableOpacity>
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
                                            onPress={() => openEditPost(selectedPost)}
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
                                                  const me = auth.currentUser?.uid;
                                                  const them = selectedPost.user_id;
                                                  if (!me || !them) return;

                                                  // delete subcollection docs
                                                  await deleteDoc(doc(db, 'users', me, 'following', them));
                                                  await deleteDoc(doc(db, 'users', them, 'followers', me));

                                                  // local mirror
                                                  setFollowing(prev => prev.filter(uid => uid !== them));

                                                  Alert.alert("Unfollowed", "You have unfollowed this user.");
                                                } catch (err) {
                                                  console.error("Unfollow error:", err);
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
                                                  const me = auth.currentUser?.uid;
                                                  const them = selectedPost.user_id;
                                                  if (!me || !them) return;

                                                  // create subcollection docs (minimal payload)
                                                  await setDoc(doc(db, 'users', me, 'following', them), {
                                                    createdAt: serverTimestamp()
                                                  }, { merge: true });
                                                  await setDoc(doc(db, 'users', them, 'followers', me), {
                                                    createdAt: serverTimestamp()
                                                  }, { merge: true });

                                                  setFollowing(prev => [...new Set([...prev, them])]);
                                                  Alert.alert("Followed", "You are now following this user.");
                                                } catch (err) {
                                                  console.error("Follow error:", err);
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
                      <Text style={{ fontWeight: "bold", color: theme.text, fontSize: 22, marginBottom: 15 }}>
                        {activity.title}
                      </Text>
                      {/* Cigar details from session */}
                      {(activity.cigar || activity.brand || activity.wrapper || activity.country || activity.size || activity.length || activity.ringGauge) && (
                        <View style={{ marginBottom: 20 }}>
                          {activity.cigar && (
                            <TouchableOpacity
                              onPress={async () => {
                                try {
                                  if (activity.cigarId) {
                                    const ref = doc(db, 'cigars', activity.cigarId);
                                    const snap = await getDoc(ref);
                                    if (snap.exists()) {
                                      const data = snap.data();
                                      navigation.navigate('CigarDetails', { cigar: { id: snap.id, ...data } });
                                      return;
                                    }
                                  }
                                  // Fallback: pass minimal info from activity if no cigarId or doc not found
                                  navigation.navigate('CigarDetails', {
                                    cigar: {
                                      name: activity.cigar,
                                      brand: activity.brand || null,
                                      size: activity.size || null,
                                      length: activity.length || null,
                                      ringGauge: activity.ringGauge || null,
                                      wrapper: activity.wrapper || null,
                                      country: activity.country || null,
                                      fromActivityId: activity.id,
                                      userId: activity.user_id,
                                    }
                                  });
                                } catch (e) {
                                  console.error('Failed to fetch cigar by id:', e);
                                  navigation.navigate('CigarDetails', {
                                    cigar: {
                                      name: activity.cigar,
                                      brand: activity.brand || null,
                                      size: activity.size || null,
                                      length: activity.length || null,
                                      ringGauge: activity.ringGauge || null,
                                      wrapper: activity.wrapper || null,
                                      country: activity.country || null,
                                      fromActivityId: activity.id,
                                      userId: activity.user_id,
                                    }
                                  });
                                }
                              }}
                              accessibilityRole="button"
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <MaterialCommunityIcons
                                  name="cigar"
                                  size={18}
                                  color={theme.primary}
                                  style={{ marginRight: 6 }}
                                />
                                <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 16, textDecorationLine: 'underline' }}>
                                  {activity.cigar}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          )}
                          {([
                            activity.brand,
                            activity.size,
                            activity.length && activity.ringGauge ? `${activity.length}\" x ${activity.ringGauge}` : null,
                            activity.wrapper,
                            activity.country
                          ].filter(Boolean).length > 0) && (
                            <Text style={{ color: theme.placeholder, marginTop: 2 }}>
                              {[
                                activity.brand,
                                activity.size,
                                activity.length && activity.ringGauge ? `${activity.length}\" x ${activity.ringGauge}` : null,
                                activity.wrapper,
                                activity.country
                              ].filter(Boolean).join(' • ')}
                            </Text>
                          )}
                        </View>
                      )}
                      
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 }}>
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
                      {/* Description block moved below Accessories/Drink/Session row */}
                      {activity.description ? (
                        <Text style={{ color: theme.text, marginTop: 10, marginBottom: 7 }}>
                          {activity.description}
                        </Text>
                      ) : null}
                      {editingId === activity.id && (
      <View style={{ marginTop: 8, padding: 12, borderWidth: 1, borderColor: theme.placeholder, borderRadius: 12, backgroundColor: theme.inputBackground }}>
        <Text style={{ color: theme.text, marginBottom: 6 }}>Title</Text>
        <TextInput
          value={editDrafts[activity.id]?.title || ''}
          onChangeText={(t) => setEditDrafts(d => ({ ...d, [activity.id]: { ...(d[activity.id]||{}), title: t } }))}
          placeholder="Title"
          placeholderTextColor={theme.placeholder}
          style={{ borderWidth: 1, borderColor: theme.placeholder, borderRadius: 8, padding: 10, color: theme.text, marginBottom: 12, backgroundColor: theme.background }}
        />

        <Text style={{ color: theme.text, marginBottom: 6 }}>Description</Text>
        <TextInput
          value={editDrafts[activity.id]?.description || ''}
          onChangeText={(t) => setEditDrafts(d => ({ ...d, [activity.id]: { ...(d[activity.id]||{}), description: t } }))}
          placeholder="Description"
          placeholderTextColor={theme.placeholder}
          multiline
          style={{ borderWidth: 1, borderColor: theme.placeholder, borderRadius: 8, padding: 10, color: theme.text, marginBottom: 12, minHeight: 80, textAlignVertical: 'top', backgroundColor: theme.background }}
        />

        <Text style={{ color: theme.text, marginBottom: 6 }}>Humidor</Text>
        <TouchableOpacity
          onPress={async () => {
            await loadHumidors();
            setHumidorPicker({ visible: true, postId: activity.id });
          }}
          style={{ borderWidth: 1, borderColor: theme.placeholder, borderRadius: 8, padding: 12, backgroundColor: theme.background, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Text style={{ color: theme.text }}>
            {editDrafts[activity.id]?.humidor || 'Select a humidor'}
          </Text>
          <Ionicons name="chevron-down" size={18} color={theme.placeholder} />
        </TouchableOpacity>

        <Text style={{ color: theme.text, marginBottom: 6 }}>Cigar</Text>
        <TouchableOpacity
          onPress={async () => {
            // Try loading cigars based on current draft humidor (if we can resolve its id from options)
            const currentHumidorTitle = editDrafts[activity.id]?.humidor || '';
            let selected = humidorOptions.find(h => (h.title || '').toLowerCase() === currentHumidorTitle.toLowerCase());
            // If humidor options are not loaded yet, load and then resolve
            if (!selected) {
              const list = await loadHumidors();
              selected = list.find(h => (h.title || '').toLowerCase() === currentHumidorTitle.toLowerCase());
            }
            if (selected) {
              await loadCigarsForHumidor(selected.id);
            } else {
              setCigarOptions([]);
            }
            setCigarPicker({ visible: true, postId: activity.id });
          }}
          style={{ borderWidth: 1, borderColor: theme.placeholder, borderRadius: 8, padding: 12, backgroundColor: theme.background, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Text style={{ color: theme.text }}>
            {editDrafts[activity.id]?.cigar || 'Select a cigar'}
          </Text>
          <Ionicons name="chevron-down" size={18} color={theme.placeholder} />
        </TouchableOpacity>

        <Text style={{ color: theme.text, marginBottom: 6 }}>Accessories / Gear Used</Text>
        <TextInput
          value={editDrafts[activity.id]?.gearUsed || ''}
          onChangeText={(t) => setEditDrafts(d => ({ ...d, [activity.id]: { ...(d[activity.id]||{}), gearUsed: t } }))}
          placeholder="e.g. Lighter, Cutter, Ashtray"
          placeholderTextColor={theme.placeholder}
          style={{ borderWidth: 1, borderColor: theme.placeholder, borderRadius: 8, padding: 10, color: theme.text, marginBottom: 12, backgroundColor: theme.background }}
        />

        <Text style={{ color: theme.text, marginBottom: 6 }}>Drink Pairing</Text>
        <TextInput
          value={editDrafts[activity.id]?.drinkPairing || ''}
          onChangeText={(t) => setEditDrafts(d => ({ ...d, [activity.id]: { ...(d[activity.id]||{}), drinkPairing: t } }))}
          placeholder="e.g. Whiskey, Coffee, Water"
          placeholderTextColor={theme.placeholder}
          style={{ borderWidth: 1, borderColor: theme.placeholder, borderRadius: 8, padding: 10, color: theme.text, marginBottom: 12, backgroundColor: theme.background }}
        />

        <Text style={{ color: theme.text, marginBottom: 6 }}>Session Feel</Text>
        <TouchableOpacity
          onPress={() => setSessionPicker({ visible: true, postId: activity.id })}
          style={{ borderWidth: 1, borderColor: theme.placeholder, borderRadius: 8, padding: 12, backgroundColor: theme.background, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Text style={{ color: theme.text }}>
            {editDrafts[activity.id]?.sessionFeeling || 'Select a session feel'}
          </Text>
          <Ionicons name="chevron-down" size={18} color={theme.placeholder} />
        </TouchableOpacity>

        <Text style={{ color: theme.text, marginBottom: 6 }}>City</Text>
        <View style={{ borderWidth: 1, borderColor: theme.placeholder, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 16, backgroundColor: theme.background }}>
          <Autocomplete
            autoCapitalize="none"
            autoCorrect={false}
            inputContainerStyle={{ borderWidth: 0, backgroundColor: 'transparent', padding: 0 }}
            listContainerStyle={{ backgroundColor: theme.inputBackground, borderRadius: 8, marginTop: 6, maxHeight: 140, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 }}
            containerStyle={{}}
            style={{ color: theme.text, paddingVertical: 6, fontSize: 14, backgroundColor: 'transparent' }}
            data={(editDrafts[activity.id]?.locationQuery || '').length > 0 ? cities.filter(c => c.name.toLowerCase().startsWith((editDrafts[activity.id]?.locationQuery || '').toLowerCase())).slice(0, 10) : []}
            defaultValue={editDrafts[activity.id]?.locationQuery || ''}
            onChangeText={(text) => {
              setEditDrafts(d => ({ ...d, [activity.id]: { ...(d[activity.id]||{}), locationQuery: text, selectedCity: text } }));
              setCityACOpen(prev => ({ ...prev, [activity.id]: true }));
            }}
            onFocus={() => setCityACOpen(prev => ({ ...prev, [activity.id]: true }))}
            onBlur={() => setCityACOpen(prev => ({ ...prev, [activity.id]: false }))}
            hideResults={!cityACOpen[activity.id] || !((editDrafts[activity.id]?.locationQuery || '').length > 0)}
            placeholder="Type a city"
            placeholderTextColor={theme.placeholder}
            flatListProps={{
              keyboardShouldPersistTaps: 'handled',
              keyExtractor: (_, idx) => idx.toString(),
              renderItem: ({ item }) => (
                <TouchableOpacity onPress={() => {
                  setEditDrafts(d => ({ ...d, [activity.id]: { ...(d[activity.id]||{}), locationQuery: item.name, selectedCity: item.name } }));
                  setCityACOpen(prev => ({ ...prev, [activity.id]: false }));
                }} style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
                  <Text style={{ color: theme.text }}>{item.name}</Text>
                </TouchableOpacity>
              ),
            }}
          />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <TouchableOpacity
            onPress={() => { setEditingId(null); setEditDrafts(d => { const n={...d}; delete n[activity.id]; return n; }); }}
            style={{ paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8, borderWidth: 1, borderColor: theme.searchPlaceholder }}
          >
            <Text style={{ color: '#4b382a' }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={savingEdit}
            onPress={saveEditedPost}
            style={{ paddingVertical: 12, paddingHorizontal: 18, borderRadius: 8, borderWidth: 1, borderColor: theme.searchPlaceholder, backgroundColor: '#4b382a', opacity: savingEdit ? 0.6 : 1 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>{savingEdit ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    )}
                      {activity.media && editingId !== activity.id && (
                        <View style={{ marginTop: 10, width: '100%', aspectRatio: 1 }}>
                          <Image
                            source={{ uri: activity.media }}
                            style={{ width: '100%', height: '100%', borderRadius: 10 }}
                            resizeMode="contain"
                          />
                        </View>
                      )}
                      {activity.media && editingId !== activity.id && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 }}>
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center' }}
                            onPress={() => handleLike(activity.id, auth.currentUser?.uid)}
                          >
                            <Ionicons
                              name={
                                likesByPost[activity.id]?.hasCurrentUser ? "heart" : "heart-outline"
                              }
                              size={20}
                              color={
                                likesByPost[activity.id]?.hasCurrentUser ? theme.primary : theme.text
                              }
                            />
                            <Text
                              style={{
                                marginLeft: 6,
                                color: likesByPost[activity.id]?.hasCurrentUser ? theme.primary : theme.text
                              }}
                            >
                              {typeof likesByPost[activity.id]?.count === 'number' && likesByPost[activity.id]?.count >= 1 ? likesByPost[activity.id].count : 'Like'}
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
                        <View
                          onLayout={(e) => {
                            inputPositions.current[activity.id] = e.nativeEvent.layout.y;
                          }}
                          style={{ marginTop: 10, position: 'relative', justifyContent: 'center' }}
                        >
                          <TextInput
                            style={{
                              backgroundColor: theme.inputBackground || '#eee',
                              borderRadius: 6,
                              paddingHorizontal: 12,
                              paddingRight: 38, // enough space for the button
                              paddingVertical: 8,
                              color: theme.mode === 'dark' ? theme.searchPlaceholder : theme.text,
                              minHeight: 36, // ensure input is at least as tall as the button
                            }}
                            placeholder="Write a comment..."
                            placeholderTextColor={theme.searchPlaceholder}
                            value={commentInput[activity.id] || ''}
                            onChangeText={text =>
                              setCommentInput(prev => ({
                                ...prev,
                                [activity.id]: text
                              }))
                            }
                            onFocus={() => {
                              const y = inputPositions.current[activity.id] ?? 0;
                              // Aim to place input ~200px from top (tweak as needed)
                              const targetY = Math.max(0, y - 200);
                              setTimeout(() => {
                                scrollRef.current?.scrollTo({ y: targetY, animated: true });
                              }, 40);
                            }}
                            onContentSizeChange={() => {
                              const y = inputPositions.current[activity.id] ?? 0;
                              const targetY = Math.max(0, y - 200);
                              setTimeout(() => {
                                scrollRef.current?.scrollTo({ y: targetY, animated: true });
                              }, 0);
                            }}
                            onBlur={() => {
                              setShowCommentInput(prev => {
                                const next = { ...prev };
                                delete next[activity.id];
                                return next;
                              });
                            }}
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
                                Keyboard.dismiss();
                                setShowCommentInput(prev => { const n = { ...prev }; delete n[activity.id]; return n; });
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
                              backgroundColor: '#4b382a',
                              shadowColor: "#000",
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: 0.12,
                              shadowRadius: 1,
                              elevation: 1,
                              minHeight: 36
                            }}
                          >
                            <Ionicons name="arrow-up" size={20} color={'#fff'} />
                          </TouchableOpacity>
                        </View>
                      )}
                      {commentsByPost[activity.id] && commentsByPost[activity.id].length > 0 && (
                        <View style={{ marginTop: 12 }}>
                          {commentsByPost[activity.id].map((comment, index) => {
                            const me = auth.currentUser?.uid || '';
                            const commentOwnerId = String(comment.userId || comment.user_id || '');
                            const postOwnerId = String(activity.user_id || '');
                            const canModerate = !!me && (me === commentOwnerId || me === postOwnerId);
                            return (
                              <View key={index} style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontWeight: '600', color: theme.text }}>{comment.userName || 'User'}</Text>
                                  <Text style={{ color: theme.text }}>{comment.text}</Text>
                                </View>
                                {canModerate && (
                                  <TouchableOpacity onPress={() => {
                                    setSelectedComment({
                                      activityId: activity.id,
                                      comment,
                                      postOwnerId: String(activity.user_id || ''),
                                      commentOwnerId: String(comment.userId || comment.user_id || ''),
                                    });
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
                                backgroundColor: theme.background || "#fff",
                                borderTopLeftRadius: 16,
                                borderTopRightRadius: 16,
                                paddingHorizontal: 20,
                                paddingTop: 24,
                                paddingBottom: 40,
                              }}>
                                {/* Permission-aware options based on selected comment */}
                                {(() => {
                                  const me = auth.currentUser?.uid || '';
                                  const cOwner = String(selectedComment?.commentOwnerId || '');
                                  const pOwner = String(selectedComment?.postOwnerId || '');
                                  const canDelete = !!me && (me === cOwner || me === pOwner);

                                  return (
                                    <>
                                      {/* Show Delete if the current user wrote the comment OR owns the post */}
                                      {canDelete && (
                                        <TouchableOpacity
                                          onPress={async () => {
                                            try {
                                              const meNow = auth.currentUser?.uid || '';
                                              const cOwnerNow = String(selectedComment?.commentOwnerId || '');
                                              const pOwnerNow = String(selectedComment?.postOwnerId || '');
                                              if (!(meNow && (meNow === cOwnerNow || meNow === pOwnerNow))) {
                                                Alert.alert('Not allowed', 'You can only delete your own comment or comments on your own post.');
                                                return;
                                              }
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

                                      {/* Show Report only if user is neither the comment owner nor the post owner */}
                                      {!canDelete && (
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
                                    </>
                                  );
                                })()}
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
          {/* Session Feelings Picker Modal */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={sessionPicker.visible}
            onRequestClose={() => setSessionPicker({ visible: false, postId: null })}
          >
            <TouchableWithoutFeedback onPress={() => setSessionPicker({ visible: false, postId: null })}>
              <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                <TouchableWithoutFeedback>
                  <View style={{ backgroundColor: theme.inputBackground || '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}>
                    {sessionFeelings.map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={{ paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#ccc' }}
                        onPress={() => {
                          const pid = sessionPicker.postId;
                          if (pid) {
                            setEditDrafts(d => ({ ...d, [pid]: { ...(d[pid]||{}), sessionFeeling: opt } }));
                          }
                          setSessionPicker({ visible: false, postId: null });
                        }}
                      >
                        <Text style={{ color: theme.text }}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity onPress={() => setSessionPicker({ visible: false, postId: null })} style={{ paddingVertical: 14 }}>
                      <Text style={{ color: theme.primary, textAlign: 'center' }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>

          {/* Humidor Picker Modal */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={humidorPicker.visible}
            onRequestClose={() => setHumidorPicker({ visible: false, postId: null })}
          >
            <TouchableWithoutFeedback onPress={() => setHumidorPicker({ visible: false, postId: null })}>
              <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                <TouchableWithoutFeedback>
                  <View style={{ backgroundColor: theme.inputBackground || '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}>
                    {humidorOptions.length === 0 && (
                      <Text style={{ color: theme.text, paddingVertical: 14 }}>No humidors found.</Text>
                    )}
                    {humidorOptions.map((opt) => (
                      <TouchableOpacity
                        key={opt.id}
                        style={{ paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#ccc' }}
                        onPress={async () => {
                          const pid = humidorPicker.postId;
                          if (pid) {
                            setEditDrafts(d => ({ ...d, [pid]: { ...(d[pid]||{}), humidor: opt.title, cigar: '', cigarId: '' } }));
                            await loadCigarsForHumidor(opt.id); // preload cigars for next picker
                          }
                          setHumidorPicker({ visible: false, postId: null });
                        }}
                      >
                        <Text style={{ color: theme.text }}>{opt.title}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity onPress={() => setHumidorPicker({ visible: false, postId: null })} style={{ paddingVertical: 14 }}>
                      <Text style={{ color: theme.primary, textAlign: 'center' }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>

          {/* Cigar Picker Modal */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={cigarPicker.visible}
            onRequestClose={() => setCigarPicker({ visible: false, postId: null })}
          >
            <TouchableWithoutFeedback onPress={() => setCigarPicker({ visible: false, postId: null })}>
              <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                <TouchableWithoutFeedback>
                  <View style={{ backgroundColor: theme.inputBackground || '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}>
                    {cigarOptions.length === 0 && (
                      <Text style={{ color: theme.text, paddingVertical: 14 }}>Select a humidor first, or no cigars found.</Text>
                    )}
                    {cigarOptions.map((opt) => (
                      <TouchableOpacity
                        key={opt.id}
                        style={{ paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#ccc' }}
                        onPress={() => {
                          const pid = cigarPicker.postId;
                          if (pid) {
                            setEditDrafts(d => ({ ...d, [pid]: { ...(d[pid]||{}), cigar: opt.name, cigarId: opt.cigarId || opt.id } }));
                          }
                          setCigarPicker({ visible: false, postId: null });
                        }}
                      >
                        <Text style={{ color: theme.text }}>{opt.name}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity onPress={() => setCigarPicker({ visible: false, postId: null })} style={{ paddingVertical: 14 }}>
                      <Text style={{ color: theme.primary, textAlign: 'center' }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>
            </ScrollView>
          </TouchableWithoutFeedback>
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
          <Ionicons name="add" size={32} color={theme.background} />
        </TouchableOpacity>
      </SafeAreaView>
      </KeyboardAvoidingView>
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
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
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