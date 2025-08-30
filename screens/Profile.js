import * as ImagePicker from 'expo-image-picker';
import { doc, updateDoc, getDoc, arrayUnion, arrayRemove, collection, getDocs, query, orderBy, where, onSnapshot, deleteDoc, setDoc, collectionGroup, serverTimestamp, addDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../config/firebase';
import { Image } from 'react-native';
import { StyleSheet, View, Text, TouchableOpacity, TextInput, ScrollView, Alert, Modal } from 'react-native'
import { KeyboardAvoidingView, Keyboard, TouchableWithoutFeedback, Platform } from 'react-native';
import React, { useEffect, useState } from "react"
import { SafeAreaView } from 'react-native-safe-area-context'
import { auth } from '../config/firebase';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { MaterialIcons } from '@expo/vector-icons';

export default function Profile({ navigation, route }) {
  const { theme } = useTheme();
  const isDark = theme?.isDark === true || theme?.mode === 'dark';
  const inputBg = isDark
    ? (theme.inputBackground || '#1d1d1f')
    : (theme.inputBackground || theme.inputBackground || '#f2f2f7');
  const inputText = isDark
    ? (theme.inputTextDark || '#0b0b0c')
    : (theme.inputTextLight || '#111');
  const inputBorder = isDark
    ? (theme.borderDark || '#3a3a3c')
    : (theme.borderLight || theme.border || '#d1d1d6');
  const viewedUserId = route?.params?.userId || auth.currentUser?.uid;
  const isOwnProfile = viewedUserId === auth.currentUser?.uid;
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
  const [joinedClubIds, setJoinedClubIds] = useState([]);
  const [memberClubIds, setMemberClubIds] = useState([]);
  const [ownerClubIds, setOwnerClubIds] = useState([]);
  const [commentsMap, setCommentsMap] = useState({});
  const [likesMap, setLikesMap] = useState({});
  const [isLikedMap, setIsLikedMap] = useState({});
  const [isVerified, setIsVerified] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [editDraft, setEditDraft] = useState({
    title: '',
    description: '',
    gearUsed: '',
    drinkPairing: '',
    sessionFeeling: '',
    media: '',
  });
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const SESSION_FEEL_OPTIONS = [
    'Relaxing',
    'Social',
    'Celebratory',
    'Reflective',
    'Routine'
  ];
  const [sessionFeelMenuOpen, setSessionFeelMenuOpen] = useState(false);

  const startEditPost = (post) => {
    if (!post) return;
    setSelectedPost(post);
    setEditDraft({
      title: post.title || '',
      description: post.description || '',
      gearUsed: post.gearUsed || '',
      drinkPairing: post.drinkPairing || '',
      sessionFeeling: post.sessionFeeling || '',
      media: '',
      __localMedia: false,
    });
    setEditModalVisible(true);
  };

  const pickNewMediaForEdit = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to change the image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (uri) setEditDraft((d) => ({ ...d, media: uri, __localMedia: true }));
    } catch (e) {
      console.warn('pick image failed', e);
    }
  };

  const saveEditedPost = async () => {
    if (!selectedPost?.id) return;
    const postId = selectedPost.id;

    const payload = {
      title: editDraft.title?.trim() || '',
      description: editDraft.description?.trim() || '',
      gearUsed: editDraft.gearUsed?.trim() || '',
      drinkPairing: editDraft.drinkPairing?.trim() || '',
      sessionFeeling: editDraft.sessionFeeling?.trim() || '',
    };

    try {
      // If a local image was chosen, upload it now and use its download URL
      if (editDraft.media && editDraft.__localMedia) {
        const response = await fetch(editDraft.media);
        const blob = await response.blob();
        const storage = getStorage();
        const filename = `${postId}_${Date.now()}.jpg`;
        const storageRef = ref(storage, `user_activities/${postId}/${filename}`);
        await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);
        payload.media = downloadURL;
      } else if (editDraft.media) {
        // A remote URL already set, keep it
        payload.media = editDraft.media;
      } else {
        // No media present – explicitly clear if you want to remove previous media
        // payload.media = firebase.firestore.FieldValue.delete();
      }

      await updateDoc(doc(db, 'user_activities', postId), payload);

      // Optimistically update local list
      setActivities((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, ...payload } : p))
      );
      setEditModalVisible(false);
      setSelectedPost(null);
    } catch (e) {
      console.error('saveEditedPost failed', e);
      Alert.alert('Update failed', 'Could not save changes to this post.');
    }
  };
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      try { showSub?.remove(); } catch {}
      try { hideSub?.remove(); } catch {}
    };
  }, []);
  
  useEffect(() => {
    // Subscribe to comments subcollections for each visible post
    if (!activities || activities.length === 0) {
      setCommentsMap({});
      return;
    }

    const unsubs = activities.map((act) => {
      const commentsRef = collection(db, 'user_activities', act.id, 'comments');
      return onSnapshot(
        commentsRef,
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => {
              const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
              const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
              return ta - tb; // older first
            });
          setCommentsMap((prev) => ({ ...prev, [act.id]: list }));
        },
        (err) => console.warn('comments listener error', act.id, err)
      );
    });

    return () => {
      unsubs.forEach((u) => { try { u && u(); } catch {} });
    };
  }, [activities.map((a) => a.id).join(',')]);

  useEffect(() => {
    // Subscribe to likes subcollections for each visible post
    if (!activities || activities.length === 0) {
      setLikesMap({});
      setIsLikedMap({});
      return;
    }

    const unsubs = activities.map((act) => {
      const likesRef = collection(db, 'user_activities', act.id, 'likes');
      return onSnapshot(
        likesRef,
        (snap) => {
          const uids = snap.docs.map((d) => d.id);
          setLikesMap((prev) => ({ ...prev, [act.id]: uids }));
          const me = auth.currentUser?.uid;
          setIsLikedMap((prev) => ({ ...prev, [act.id]: !!(me && uids.includes(me)) }));
        },
        (err) => console.warn('likes listener error', act.id, err)
      );
    });

    return () => {
      unsubs.forEach((u) => { try { u && u(); } catch {} });
    };
  }, [activities.map((a) => a.id).join(',')]);

  useEffect(() => {
    if (!auth.currentUser?.uid || !viewedUserId) return;

    const unsubscribers = [];

    if (isOwnProfile) {
      // Listen to joined_clubs (source A)
      const joinedClubsRef = collection(db, 'users', viewedUserId, 'joined_clubs');
      unsubscribers.push(
        onSnapshot(
          joinedClubsRef,
          (snapshot) => {
            const ids = snapshot.docs.map((d) => d.id);
            setJoinedClubIds(ids);
          },
          (err) => console.error('Error listening to joined clubs:', err)
        )
      );
      setMemberClubIds([]);
      setOwnerClubIds([]);
    } else {
      // Viewing someone else: rely on collectionGroup members (requires uid field)
      const membersQ = query(collectionGroup(db, 'members'), where('uid', '==', viewedUserId));
      unsubscribers.push(
        onSnapshot(
          membersQ,
          (snapshot) => {
            const ids = snapshot.docs.map((d) => d.ref.parent.parent.id);
            setMemberClubIds(ids);
            setJoinedClubIds([]); // clear other source when not own profile
          },
          (err) => console.error('Error subscribing to members collectionGroup:', err)
        )
      );
      // Also include clubs this user OWNS
      const ownedQ = query(collection(db, 'clubs'), where('createdBy', '==', viewedUserId));
      unsubscribers.push(
        onSnapshot(
          ownedQ,
          (snapshot) => {
            const ids = snapshot.docs.map((d) => d.id);
            setOwnerClubIds(ids);
          },
          (err) => console.error('Error subscribing to owned clubs:', err)
        )
      );
    }

    return () => unsubscribers.forEach((u) => {
      try { u && u(); } catch {}
    });
  }, [viewedUserId, isOwnProfile]);

  useEffect(() => {
    const allIds = Array.from(new Set([...(joinedClubIds || []), ...(memberClubIds || []), ...(ownerClubIds || [])]));
    // Clear when no clubs
    if (allIds.length === 0) {
      setClubs([]);
      return;
    }

    // Subscribe to each club doc; update when any doc changes or is deleted
    const cache = {}; // id -> club object
    const unsubs = allIds.map((clubId) => {
      const clubRef = doc(db, 'clubs', clubId);
      return onSnapshot(
        clubRef,
        (snap) => {
          if (snap.exists()) {
            const d = snap.data();
            cache[clubId] = { id: clubId, name: d.name, image: d.image };
          } else {
            delete cache[clubId]; // removed club
          }
          // Push a new array copy so React re-renders
          setClubs(Object.values(cache));
        },
        (err) => {
          console.warn('club doc listener error', clubId, err);
          delete cache[clubId];
          setClubs(Object.values(cache));
        }
      );
    });

    return () => {
      unsubs.forEach((u) => {
        try { u && u(); } catch {}
      });
    };
  }, [joinedClubIds, memberClubIds, ownerClubIds]);

  useEffect(() => {
    if (!viewedUserId) return;

    // 1) Basic profile fields from users/{uid}
    const unsubscribeViewed = onSnapshot(doc(db, 'users', viewedUserId), async (userDoc) => {
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setFullName(userData.fullName || userData.name || '');
        setProfilePic(userData.photoURL || null);
        setBio(userData.bio || '');
        setIsVerified((userData.subscriptionPlan || '').toLowerCase() === 'paid');

        // Count posts for the viewed user
        try {
          const postsQuery = query(collection(db, 'user_activities'), where('user_id', '==', viewedUserId));
          const postsSnapshot = await getDocs(postsQuery);
          setPostsCount(postsSnapshot.size);
        } catch (e) {
          console.warn('posts count fetch failed', e);
        }
      }
    });

    // 2) Live follower/following counts from subcollections
    const follRefs = [];
    try {
      const followersRef = collection(db, 'users', viewedUserId, 'followers');
      const unf1 = onSnapshot(
        followersRef,
        (snap) => setFollowersCount(snap.size),
        (err) => console.warn('followers count listener error', err)
      );
      follRefs.push(unf1);
    } catch (e) {
      console.warn('followers listener attach failed', e);
    }

    try {
      const followingRef = collection(db, 'users', viewedUserId, 'following');
      const unf2 = onSnapshot(
        followingRef,
        (snap) => setFollowingCount(snap.size),
        (err) => console.warn('following count listener error', err)
      );
      follRefs.push(unf2);
    } catch (e) {
      console.warn('following listener attach failed', e);
    }

    // 3) Is the CURRENT user following the viewed user? (doc existence)
    let unfIsFollowing;
    if (auth.currentUser?.uid) {
      const me = auth.currentUser.uid;
      const fDocRef = doc(db, 'users', me, 'following', viewedUserId);
      unfIsFollowing = onSnapshot(
        fDocRef,
        (d) => setIsFollowing(!!d.exists()),
        (err) => console.warn('isFollowing listener error', err)
      );
    }

    return () => {
      try { unsubscribeViewed && unsubscribeViewed(); } catch {}
      follRefs.forEach((u) => { try { u && u(); } catch {} });
      try { unfIsFollowing && unfIsFollowing(); } catch {}
    };
  }, [viewedUserId]);

  useEffect(() => {
    if (!viewedUserId) return;

    // Live stream this user's posts so likes/comments update instantly
    const q = query(
      collection(db, 'user_activities'),
      where('user_id', '==', viewedUserId),
      orderBy('date', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            comments: Array.isArray(data.comments) ? data.comments : [],
            likes: [],
          };
        });
        setActivities(next);
      },
      (err) => {
        console.error('Realtime activities listener error:', err);
      }
    );

    return () => {
      try { unsub && unsub(); } catch {}
    };
  }, [viewedUserId]);

  const handleLike = async (postId, currentUserId) => {
    if (!currentUserId) return;
    const likeDocRef = doc(db, 'user_activities', postId, 'likes', currentUserId);
    const isLiked = !!isLikedMap[postId];

    try {
      if (isLiked) {
        await deleteDoc(likeDocRef);
      } else {
        await setDoc(likeDocRef, {
          userId: currentUserId,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error('Error toggling like (subcollection):', err);
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

  const handleDeletePost = async (postId) => {
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
              await deleteDoc(doc(db, "user_activities", postId));
              setActivities(prev => prev.filter(p => p.id !== postId));
              setModalVisible(false);
              setSelectedPost(null);
            } catch (e) {
              Alert.alert("Error", "Could not delete post.");
            }
          }
        }
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <SafeAreaView style={[styles.container, {backgroundColor: theme.background}]}>
            {route.params?.fromOutside && (
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={{ marginBottom: -20 }}
              >
                <Ionicons name="arrow-back-circle" size={38} color={theme.primary} />
              </TouchableOpacity>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <TouchableOpacity onPress={isOwnProfile ? handleProfilePicPress : undefined} disabled={!isOwnProfile} style={{ marginTop: 20 }}>
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
                          backgroundColor: theme?.avatarBg || (isDark ? '#2c2c2e' : '#ccc'),
                          borderWidth: 1,
                          borderColor: theme?.avatarBorder || (isDark ? '#3a3a3c' : '#888'),
                          marginRight: 16,
                          justifyContent: 'center',
                          alignItems: 'center'
                        }}
                      >
                        {isOwnProfile ? (
                          <Text style={{ fontSize: 12, color: theme?.placeholder || (isDark ? '#98989f' : '#555'), textAlign: 'center' }}>
                            Upload{'\n'}Photo
                          </Text>
                        ) : null}
                      </View>
                    )}
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
                        <Text
                          style={[styles.greeting, { color: theme.primary }]}
                          numberOfLines={1}
                        >
                          {fullName}
                        </Text>
                        {isVerified && (
                          <MaterialIcons
                            name="verified"
                            size={20}
                            color={theme.primary}
                            style={{ marginLeft: 6, marginTop: 14 }}
                          />
                        )}
                      </View>
                      {isOwnProfile && (
                        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
                          <Ionicons name="settings-outline" size={28} color={theme.primary} />
                        </TouchableOpacity>
                      )}
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
                                  backgroundColor: inputBg,
                                  color: inputText,
                                  borderRadius: 8,
                                  padding: 8,
                                  fontSize: 15,
                                  borderWidth: 1,
                                  borderColor: inputBorder,
                                }}
                                value={bio}
                                onChangeText={setBio}
                                placeholder="Write something about yourself..."
                                placeholderTextColor={theme.searchPlaceholder}
                                keyboardAppearance={isDark ? 'dark' : 'light'}
                                selectionColor={theme.primary}
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
                              onPress={isOwnProfile ? () => setEditingBio(true) : undefined}
                              disabled={!isOwnProfile}
                              style={{ marginLeft: 8, padding: 6 }}
                            >
                              <Ionicons name="pencil" size={18} color={theme.primary} />
                            </TouchableOpacity>
                            </View>
                        )}
                    </View>
                    {/* Profile action buttons */}
                    {isOwnProfile ? (
                      // Own profile: single centered button labeled "Edit Full Profile" (UI-only for now)
                      <View style={{ alignItems: 'flex-start', marginTop: 18 }}>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          style={{
                            backgroundColor: theme.primary,
                            borderRadius: 8,
                            paddingVertical: 8,
                            paddingHorizontal: 75,
                            alignItems: 'center',
                            alignSelf: 'flex-start',
                            maxWidth: 260,
                            borderWidth: 1,
                            borderColor: theme.primary,
                          }}
                          onPress={() => navigation.navigate('FullProfile', { userId: viewedUserId, isOwnProfile: true })}
                        >
                          <Text style={{ color: theme.iconOnPrimary || '#fff', fontWeight: 'bold', fontSize: 16 }}>Full Profile</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      // Viewing someone else: show "View Full Profile" to the left of Follow/Unfollow
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginTop: 18, paddingHorizontal: 0, columnGap: 12, width: '100%' }}>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          style={{
                            backgroundColor: theme.background,
                            borderRadius: 8,
                            paddingVertical: 10,
                            paddingHorizontal: 16,
                            alignItems: 'center',
                            alignSelf: 'flex-start',
                            flexShrink: 0,
                            flexGrow: 0,
                            borderWidth: 1,
                            borderColor: theme.primary,
                          }}
                          onPress={() => navigation.navigate('FullProfile', { userId: viewedUserId })}
                        >
                          <Text
                            numberOfLines={1}
                            style={{ color: theme.primary, fontWeight: 'bold', fontSize: 16, textAlign: 'center' }}
                          >
                            View Full Profile
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={{
                            backgroundColor: isFollowing ? theme.background : theme.primary,
                            borderRadius: 8,
                            paddingVertical: 10,
                            paddingHorizontal: 16,
                            alignItems: 'center',
                            alignSelf: 'flex-start',
                            flexShrink: 0,
                            flexGrow: 0,
                            borderWidth: 1,
                            borderColor: theme.primary,
                          }}
                          onPress={async () => {
                            const me = auth.currentUser?.uid;
                            const them = viewedUserId;
                            if (!me || !them || me === them) return;

                            const myFollowingRef     = doc(db, 'users', me,   'following', them);
                            const theirFollowersRef  = doc(db, 'users', them, 'followers', me);

                            try {
                              if (isFollowing) {
                                // UNFOLLOW
                                await deleteDoc(myFollowingRef).catch(e => { console.warn('delete following failed:', myFollowingRef.path, e); throw e; });
                                await deleteDoc(theirFollowersRef).catch(async e => {
                                  console.warn('delete followers failed:', theirFollowersRef.path, e);
                                  // rollback: re-create following to keep state consistent
                                  await setDoc(myFollowingRef, { createdAt: new Date() }, { merge: true }).catch(() => {});
                                  throw e;
                                });
                              } else {
                                // FOLLOW
                                await setDoc(myFollowingRef, { createdAt: new Date() }, { merge: true }).catch(e => { console.warn('create following failed:', myFollowingRef.path, e); throw e; });
                                await setDoc(theirFollowersRef, { createdAt: new Date() }, { merge: true }).catch(async e => {
                                  console.warn('create followers failed:', theirFollowersRef.path, e);
                                  // rollback: remove following if followers failed
                                  await deleteDoc(myFollowingRef).catch(() => {});
                                  throw e;
                                });
                                // Fire-and-forget: notify the followed user
                                try {
                                  const notifRef = doc(collection(db, 'users', them, 'notifications'));
                                  await setDoc(notifRef, {
                                    type: 'follow',
                                    fromUserId: me,
                                    timestamp: serverTimestamp(),
                                    read: false,
                                  });
                                } catch (notifErr) {
                                  console.warn('follow notification create failed:', notifErr);
                                }
                              }
                            } catch (err) {
                              const msg = err?.code === 'permission-denied'
                                ? 'Permission denied writing followers/following.\nCheck rules & doc IDs match auth.uid.'
                                : err?.message || String(err);
                              alert(`Failed to update follow status.\n${msg}`);
                            }
                          }}
                        >
                          <Text style={{ color: isFollowing ? theme.primary : (theme.iconOnPrimary || '#fff'), fontWeight: 'bold', fontSize: 16 }}>
                            {isFollowing ? 'Unfollow' : 'Follow'}
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
                    <Text style={{ color: theme.primary, fontWeight: 'bold', fontSize: 20, marginBottom: 12 }}>
                      {isOwnProfile ? 'Your Posts' : 'Posts'}
                    </Text>
                    {activities.length === 0 ? (
                    <Text style={{ color: theme.text, textAlign: "center" }}>No posts yet</Text>
                    ) : (
                    activities.map((activity, idx) => (
                        <React.Fragment key={activity.id}>
                            <View
                              key={activity.id}
                              style={{
                                padding: 12,
                                marginBottom: 8,
                                backgroundColor: (theme.card || theme.inputBackground || '#eee'),
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: theme.border || 'transparent'
                              }}
                            >
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <Text style={{ fontWeight: "bold", color: theme.text, fontSize: 20 }} numberOfLines={2}>
                                  {activity.title}
                                </Text>
                                <TouchableOpacity
                                  onPress={() => { setSelectedPost(activity); setModalVisible(true); }}
                                  accessibilityRole="button"
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  style={{ paddingHorizontal: 6, paddingVertical: 4 }}
                                >
                                  <Ionicons name="ellipsis-vertical" size={20} color={theme.text} />
                                </TouchableOpacity>
                              </View>
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
                                        name={isLikedMap[activity.id] ? 'heart' : 'heart-outline'}
                                        size={20}
                                        color={isLikedMap[activity.id] ? theme.primary : theme.text}
                                      />
                                      <Text style={{ marginLeft: 6, color: isLikedMap[activity.id] ? theme.primary : theme.text }}>
                                        {(likesMap[activity.id]?.length || 0) > 0 ? (likesMap[activity.id]?.length || 0) : 'Like'}
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
                                        backgroundColor: inputBg,
                                        borderRadius: 8,
                                        borderWidth: 1,
                                        borderColor: inputBorder,
                                        paddingHorizontal: 12,
                                        paddingRight: 38,
                                        paddingVertical: 8,
                                        color: inputText,
                                        minHeight: 36,
                                      }}
                                      placeholder="Write a comment..."
                                      placeholderTextColor={theme.searchPlaceholder}
                                      keyboardAppearance={isDark ? 'dark' : 'light'}
                                      selectionColor={theme.primary}
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
                                        const text = (commentInput[activity.id] || '').trim();
                                        if (!text) return;
                                        try {
                                          await addDoc(collection(db, 'user_activities', activity.id, 'comments'), {
                                            userId: auth.currentUser.uid,
                                            userName: fullName || 'Anonymous',
                                            text,
                                            createdAt: serverTimestamp(),
                                          });
                                          setCommentInput((prev) => ({ ...prev, [activity.id]: '' }));
                                        } catch (err) {
                                          console.error('Error adding comment:', err);
                                          alert('Could not add comment. Please try again.');
                                        }
                                      }}
                                      style={{
                                        position: 'absolute',
                                        right: 6,
                                        top: 4,
                                        bottom: 0,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        zIndex: 2,
                                        width: 28,
                                        height: 28,
                                        borderRadius: 14,
                                        backgroundColor: '#4b382a',
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
                                {Array.isArray(commentsMap[activity.id]) && commentsMap[activity.id].length > 0 && (
                                  <View style={{ marginTop: 12 }}>
                                    {commentsMap[activity.id].map((comment) => (
                                      <View key={comment.id} style={{ marginBottom: 8 }}>
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
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPressOut={() => setModalVisible(false)}
            style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}
          >
            <View style={{
              backgroundColor: theme.background,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 28,
            }}>
              {!!selectedPost && (
                <View style={{ marginBottom: 4 }}>
                  {isOwnProfile ? (
                    <>
                      <TouchableOpacity
                        style={{ paddingVertical: 14 }}
                        onPress={() => {
                          setModalVisible(false);
                          startEditPost(selectedPost);
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="create-outline" size={20} color={theme.primary} style={{ marginRight: 12 }} />
                          <Text style={{ color: theme.primary, fontWeight: 'bold' }}>Edit Post</Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{ paddingVertical: 14 }}
                        onPress={() => {
                          setModalVisible(false);
                          handleDeletePost(selectedPost.id);
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="trash-outline" size={20} color="#d32f2f" style={{ marginRight: 12 }} />
                          <Text style={{ color: "#d32f2f", fontWeight: "bold" }}>Delete Post</Text>
                        </View>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={{ paddingVertical: 14 }}
                      onPress={() => {
                        setModalVisible(false);
                        Alert.alert("Reported", "Thank you for reporting this post.");
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="flag-outline" size={20} color={theme.primary} style={{ marginRight: 12 }} />
                        <Text style={{ color: theme.primary }}>Report</Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={{ paddingVertical: 14 }}
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
          </TouchableOpacity>
        </Modal>
        <Modal
          animationType="slide"
          transparent={true}
          visible={editModalVisible}
          onRequestClose={() => setEditModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPressOut={() => {
              if (keyboardVisible) {
                Keyboard.dismiss();
                setSessionFeelMenuOpen(false);
                return; // don't close the modal when dismissing keyboard
              }
              setSessionFeelMenuOpen(false);
              setEditModalVisible(false);
            }}
            style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
              style={{ width: '100%' }}
            >
              {/* Tapping anywhere on the sheet (not inputs) will dismiss keyboard only */}
              <TouchableWithoutFeedback onPress={() => { setSessionFeelMenuOpen(false); Keyboard.dismiss(); }}>
                <View
                  style={{
                    maxHeight: '100%',
                    backgroundColor: theme.background,
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    paddingTop: 16,
                    paddingBottom: 48,
                  }}
                >
                  <ScrollView
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    automaticallyAdjustKeyboardInsets
                  >
                    <Text style={{ color: theme.text, fontWeight: '700', fontSize: 18, marginBottom: 8 }}>
                      Edit Post
                    </Text>

                    <Text style={{ color: theme.text, fontSize: 12, marginBottom: 6 }}>Title</Text>
                    <TextInput
                      value={editDraft.title}
                      onChangeText={(t) => setEditDraft((d) => ({ ...d, title: t }))}
                      placeholder="Title"
                      placeholderTextColor={theme.searchPlaceholder}
                      style={{
                        backgroundColor: inputBg,
                        color: inputText,
                        borderWidth: 1,
                        borderColor: inputBorder,
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        marginBottom: 10,
                      }}
                      keyboardAppearance={isDark ? 'dark' : 'light'}
                      selectionColor={theme.searchPlaceholder}
                      returnKeyType="done"
                    />

                    <Text style={{ color: theme.text, fontSize: 12, marginBottom: 6 }}>Description</Text>
                    <TextInput
                      value={editDraft.description}
                      onChangeText={(t) => setEditDraft((d) => ({ ...d, description: t }))}
                      placeholder="Describe your session"
                      placeholderTextColor={theme.searchPlaceholder}
                      style={{
                        backgroundColor: inputBg,
                        color: inputText,
                        borderWidth: 1,
                        borderColor: inputBorder,
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        minHeight: 80,
                        textAlignVertical: 'top',
                        marginBottom: 10,
                      }}
                      multiline
                      keyboardAppearance={isDark ? 'dark' : 'light'}
                      selectionColor={theme.searchPlaceholder}
                    />

                    <View style={{ flexDirection: 'row', columnGap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.text, fontSize: 12, marginBottom: 6 }}>Accessories</Text>
                        <TextInput
                          value={editDraft.gearUsed}
                          onChangeText={(t) => setEditDraft((d) => ({ ...d, gearUsed: t }))}
                          placeholder="Cutters, lighters..."
                          placeholderTextColor={theme.searchPlaceholder}
                          style={{
                            backgroundColor: inputBg,
                            color: inputText,
                            borderWidth: 1,
                            borderColor: inputBorder,
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            marginBottom: 10,
                          }}
                          keyboardAppearance={isDark ? 'dark' : 'light'}
                          selectionColor={theme.searchPlaceholder}
                          returnKeyType="done"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.text, fontSize: 12, marginBottom: 6 }}>Drink Pairing</Text>
                        <TextInput
                          value={editDraft.drinkPairing}
                          onChangeText={(t) => setEditDraft((d) => ({ ...d, drinkPairing: t }))}
                          placeholder="Coffee, bourbon..."
                          placeholderTextColor={theme.searchPlaceholder}
                          style={{
                            backgroundColor: inputBg,
                            color: inputText,
                            borderWidth: 1,
                            borderColor: inputBorder,
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            marginBottom: 10,
                          }}
                          keyboardAppearance={isDark ? 'dark' : 'light'}
                          selectionColor={theme.searchPlaceholder}
                          returnKeyType="done"
                        />
                      </View>
                    </View>

                    <Text style={{ color: theme.text, fontSize: 12, marginBottom: 6 }}>Session Feel</Text>
                    <View style={{ position: 'relative', marginBottom: 20 }}>
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => setSessionFeelMenuOpen((v) => !v)}
                        style={{
                          backgroundColor: inputBg,
                          borderWidth: 1,
                          borderColor: inputBorder,
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                     >
                        <Text style={{ color: editDraft.sessionFeeling ? inputText : theme.searchPlaceholder }}>
                          {editDraft.sessionFeeling || 'Select a feeling'}
                        </Text>
                        <Ionicons name={sessionFeelMenuOpen ? 'chevron-up' : 'chevron-down'} size={18} color={'#4b382a'} />
                      </TouchableOpacity>

                      {sessionFeelMenuOpen && (
                        <View
                          style={{
                            position: 'absolute',
                            top: 46,
                            left: 0,
                            right: 0,
                            backgroundColor: inputBg,
                            borderWidth: 1,
                            borderColor: inputBorder,
                            borderRadius: 8,
                            overflow: 'hidden',
                            zIndex: 10,
                          }}
                        >
                          {SESSION_FEEL_OPTIONS.map((opt, idx) => (
                            <TouchableOpacity
                              key={opt}
                              onPress={() => {
                                setEditDraft((d) => ({ ...d, sessionFeeling: opt }));
                                setSessionFeelMenuOpen(false);
                              }}
                              style={{ paddingVertical: 10, paddingHorizontal: 12, backgroundColor: inputBg }}
                            >
                              <Text style={{ color: inputText }}>{opt}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, justifyContent: 'center' }}>
                      <TouchableOpacity
                        onPress={pickNewMediaForEdit}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          alignSelf: 'center',
                          paddingVertical: 14,
                          paddingHorizontal: 12,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: theme.primary,
                        }}
                      >
                        <Ionicons name="image-outline" size={18} color={theme.primary} />
                        <Text style={{ color: theme.primary, marginLeft: 8, fontWeight: '600', textAlign: 'center' }}>
                          {editDraft.__localMedia ? 'Change Selected Image' : (editDraft.media ? 'Replace Image' : 'Add Image')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {/* Preview newly picked image in edit modal */}
                    {editDraft.__localMedia && !!editDraft.media ? (
                      <View style={{ marginBottom: 20 }}>
                        <View style={{ position: 'relative', marginTop: 12 }}>
                          <Image
                            source={{ uri: editDraft.media }}
                            style={{
                              width: '100%',
                              height: 200,
                              borderRadius: 8,
                            }}
                            resizeMode="contain"
                          />
                          <TouchableOpacity
                            onPress={() => setEditDraft(d => ({ ...d, media: '', __localMedia: false }))}
                            style={{
                              position: 'absolute',
                              right: 28,
                              backgroundColor: isDark ? theme.primary : theme.primary,
                              borderRadius: 12,
                              padding: 4,
                            }}
                          >
                            <Ionicons name="close" size={18} color={isDark ? '#000' : '#fff'} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : null}

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 8 }}>
                      <TouchableOpacity
                        onPress={() => { setEditModalVisible(false); setSelectedPost(null); }}
                        style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: theme.primary }}
                      >
                        <Text style={{ color: theme.text }}>Cancel</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={saveEditedPost}
                        style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: theme.primary, borderWidth: 1, borderColor: theme.primary }}
                      >
                        <Text style={{ color: theme.iconOnPrimary || '#fff', fontWeight: '700' }}>Save Changes</Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Modal>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
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
// --- Club join/leave logic for ClubDetails.js ---
// Usage: Call joinClub(clubId) to join, leaveClub(clubId) to leave.
export async function joinClub(clubId, userId) {
  // Add user to /clubs/{clubId}/members and add club to /users/{uid}/joined_clubs
  try {
    // Add to club's members subcollection (if needed)
    await setDoc(doc(db, 'clubs', clubId, 'members', userId), { uid: userId, joinedAt: new Date() });
    // Add to user's joined_clubs subcollection
    await setDoc(doc(db, 'users', userId, 'joined_clubs', clubId), { joinedAt: new Date() });
  } catch (err) {
    console.error('Error joining club:', err);
    throw err;
  }
}

export async function leaveClub(clubId, userId) {
  // Remove user from /clubs/{clubId}/members and remove club from /users/{uid}/joined_clubs
  try {
    // Remove from club's members subcollection
    await deleteDoc(doc(db, 'clubs', clubId, 'members', userId));
    // Remove from user's joined_clubs subcollection
    await deleteDoc(doc(db, 'users', userId, 'joined_clubs', clubId));
  } catch (err) {
    console.error('Error leaving club:', err);
    throw err;
  }
}