import { useEffect, useState, useRef } from 'react';
import { doc, getDoc, collection, getDocs, updateDoc, deleteDoc, addDoc, setDoc, query, orderBy, onSnapshot, where, startAt, endAt, limit, writeBatch, documentId } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../config/firebase';
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Image, TouchableOpacity, Dimensions, Alert, ScrollView, Modal, TextInput, TouchableWithoutFeedback, Platform, Share, KeyboardAvoidingView, FlatList } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');
const BACKGROUND_HEIGHT = height * 0.2;

export default function ClubDetails() {
  const navigation = useNavigation();
  const route = useRoute();
  const { club } = route.params;
  const { theme, isDarkMode } = useTheme();
  const auth = getAuth();
  const [uid, setUid] = useState(getAuth().currentUser?.uid || null);
  const modalScrollRef = useRef(null);
  const likesUnsubsRef = useRef({});
  const commentsUnsubsRef = useRef({});
  const [clubData, setClubData] = useState(null);
  const [memberCount, setMemberCount] = useState(0);
  const [isMember, setIsMember] = useState(false);
  const [backgroundImageUri, setBackgroundImageUri] = useState(null);
  const [profileImageUri, setProfileImageUri] = useState(null);
  const [clubEditVisible, setClubEditVisible] = useState(false);
  const [editClubType, setEditClubType] = useState('');
  const [editClubLocation, setEditClubLocation] = useState('');
  const [editClubPrivacy, setEditClubPrivacy] = useState('public');
  const [editClubDescription, setEditClubDescription] = useState('');
  const [editClubTags, setEditClubTags] = useState('');
  const [savingClubEdits, setSavingClubEdits] = useState(false);
  const [typePickerVisible, setTypePickerVisible] = useState(false);
  const [tagPickerVisible, setTagPickerVisible] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]); 
  const [events, setEvents] = useState([]);
  const [isEventModalVisible, setEventModalVisible] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventMaxAttendees, setNewEventMaxAttendees] = useState('');
  const [newEventPhotos, setNewEventPhotos] = useState([]);
  const [eventAttendeesProfiles, setEventAttendeesProfiles] = useState([]); 
  const [savingEvent, setSavingEvent] = useState(false);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteTargetUserId, setInviteTargetUserId] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [userSuggestions, setUserSuggestions] = useState([]); 
  const [inviteSelectedUser, setInviteSelectedUser] = useState(null); 
  const [searchingUsers, setSearchingUsers] = useState(false);
  const inviteSearchTimer = useRef(null);
  const [isEventDetailVisible, setEventDetailVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [editEventTitle, setEditEventTitle] = useState('');
  const [editEventDescription, setEditEventDescription] = useState('');
  const [editEventLocation, setEditEventLocation] = useState('');
  const [editEventMaxAttendees, setEditEventMaxAttendees] = useState('');
  const [editSelectedDate, setEditSelectedDate] = useState(null);
  const [editSelectedTime, setEditSelectedTime] = useState(null);
  const [editDateText, setEditDateText] = useState('');
  const [editTimeText, setEditTimeText] = useState('');
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [showEditTimePicker, setShowEditTimePicker] = useState(false);
  const [tempEditDate, setTempEditDate] = useState(new Date());
  const [tempEditTime, setTempEditTime] = useState(new Date());
  const [editEventPhotos, setEditEventPhotos] = useState([]);
  const [attendees, setAttendees] = useState([]);        
  const [isAttending, setIsAttending] = useState(false); 
  const attendeesUnsubRef = useRef(null);
  const [posts, setPosts] = useState([]);
  const [isComposingPost, setIsComposingPost] = useState(false);
  const [postText, setPostText] = useState('');
  const [postPhotos, setPostPhotos] = useState([]);
  const [savingPost, setSavingPost] = useState(false);
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [editingPostId, setEditingPostId] = useState(null);
  const [likesMap, setLikesMap] = useState({}); 
  const [commentsCountMap, setCommentsCountMap] = useState({}); 
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [commentingPost, setCommentingPost] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [commentsList, setCommentsList] = useState([]); 
  const commentsUnsubRef = useRef(null);
  const clubMemberIdsRef = useRef(new Set());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null); 
  const [selectedTime, setSelectedTime] = useState(null); 
  const [tempDate, setTempDate] = useState(new Date());
  const [tempTime, setTempTime] = useState(new Date());
  const isPrivate = (clubData?.privacy || '').toLowerCase() === 'private';
  const isOwner = !!(auth.currentUser && (clubData?.createdBy === auth.currentUser.uid || clubData?.ownerId === auth.currentUser.uid));
  const canViewPrivate = !isPrivate || isOwner || isMember;
  const canEngage = isOwner || isMember;
  const [hasLeftClub, setHasLeftClub] = useState(false);

  const cleanupEngagementListeners = () => {
    try {
      const likesUnsubs = likesUnsubsRef.current || {};
      Object.values(likesUnsubs).forEach((unsub) => { try { unsub && unsub(); } catch {} });
      likesUnsubsRef.current = {};
      const commentsUnsubs = commentsUnsubsRef.current || {};
      Object.values(commentsUnsubs).forEach((unsub) => { try { unsub && unsub(); } catch {} });
      commentsUnsubsRef.current = {};
    } catch {}
  };
  const TAG_OPTIONS = [
    'Brand/Organization', 'Local Community', 'Fundraising', 'Business',
    'Fun', 'Networking', 'Casual', 'High Value',
    'Relaxation', 'Celebratory', 'Event', 'Team',
    'Travel', 'Lounge', 'Exclusive', 'Social Impact'
  ];
  const TYPE_OPTIONS = [
    'Business', 'Casual', 'Lounge', 'Premium', 'Social'
  ];

  const openEventDetail = async (ev) => {
    setSelectedEvent(ev);
    setEventDetailVisible(true);
    setIsEditingEvent(false);
    setEditEventTitle(ev?.title || '');
    setEditEventDescription(ev?.description || '');
    setEditEventLocation(ev?.location || '');
    setEditEventMaxAttendees(
      typeof ev?.maxAttendees === 'number' && !Number.isNaN(ev.maxAttendees)
        ? String(ev.maxAttendees)
        : ''
    );
    const d = ev?.dateISO ? new Date(ev.dateISO) : null;
    const t = ev?.timeISO ? new Date(ev.timeISO) : null;
    setEditSelectedDate(d);
    setEditSelectedTime(t);
    setEditDateText(ev?.dateText || (d ? formatDate(d) : ''));
    setEditTimeText(ev?.timeText || (t ? formatTime(t) : ''));
    setEditEventPhotos(Array.isArray(ev?.photos) ? ev.photos.slice(0) : []);
    try {
      if (Array.isArray(ev.attendees) && ev.attendees.length > 0) {
        const ids = ev.attendees.slice(0, 12);
        const profiles = await Promise.all(ids.map(async (uid) => {
          try {
            const uref = doc(db, 'users', uid);
            const usnap = await getDoc(uref);
            if (usnap.exists()) {
              const u = usnap.data();
              return { uid, name: u.displayName || u.fullName || 'User', photoURL: u.photoURL || u.image || null };
            }
          } catch { /* noop */ }
          return { uid, name: 'User', photoURL: null };
        }));
        setEventAttendeesProfiles(profiles.filter(Boolean));
      } else {
        setEventAttendeesProfiles([]);
      }
    } catch {
      setEventAttendeesProfiles([]);
    }
  };
  const attendSelectedEvent = async () => {
    try {
      const user = auth.currentUser;
      if (!user || !selectedEvent?.id) return;

      const ref = doc(db, 'clubs', club.id, 'events', selectedEvent.id, 'attendees', user.uid);
      const profileSnap = await getDoc(doc(db, 'users', user.uid));
      const u = profileSnap.exists() ? profileSnap.data() : {};

      await setDoc(ref, {
        uid: user.uid,
        name: u.displayName || u.fullName || user.displayName || 'User',
        photoURL: u.photoURL || u.image || user.photoURL || null,
        timestamp: new Date(),
      });
    } catch (e) {
      Alert.alert('Attend failed', e.message || String(e));
    }
  };
  const unattendSelectedEvent = async () => {
    try {
      const user = auth.currentUser;
      if (!user || !selectedEvent?.id) return;

      const ref = doc(
        db,
        'clubs',
        club.id,
        'events',
        selectedEvent.id,
        'attendees',
        user.uid
      );
      await deleteDoc(ref);
    } catch (e) {
      Alert.alert('Unattend failed', e.message || String(e));
    }
  };
  const openEditDatePicker = () => {
    setTempEditDate(editSelectedDate || new Date());
    setShowEditTimePicker(false);
    setShowEditDatePicker(true);
  };
  const openEditTimePicker = () => {
    setTempEditTime(editSelectedTime || new Date());
    setShowEditDatePicker(false);
    setShowEditTimePicker(true);
  };
  const confirmEditDate = () => {
    setEditSelectedDate(tempEditDate);
    setEditDateText(formatDate(tempEditDate));
    setShowEditDatePicker(false);
  };
  const confirmEditTime = () => {
    setEditSelectedTime(tempEditTime);
    setEditTimeText(formatTime(tempEditTime));
    setShowEditTimePicker(false);
  };
  const clearEditDate = () => {
    setEditSelectedDate(null);
    setEditDateText('');
    setShowEditDatePicker(false);
  };
  const clearEditTime = () => {
    setEditSelectedTime(null);
    setEditTimeText('');
    setShowEditTimePicker(false);
  };
  const onChangeEditDate = (event, date) => {
    if (Platform.OS === 'android') {
      if (event?.type === 'set' && date) {
        setEditSelectedDate(date);
        setEditDateText(formatDate(date));
      }
      setShowEditDatePicker(false);
      return;
    }
    if (date) setTempEditDate(date);
  };
  const onChangeEditTime = (event, date) => {
    if (Platform.OS === 'android') {
      if (event?.type === 'set' && date) {
        setEditSelectedTime(date);
        setEditTimeText(formatTime(date));
      }
      setShowEditTimePicker(false);
      return;
    }
    if (date) setTempEditTime(date);
  };

  // --- In-app Invite helpers ---
  const openInAppInvite = () => {
    if (!isOwner) {
      Alert.alert('Only owner', 'Only the club owner can invite members.');
      return;
    }
    setInviteTargetUserId('');
    setInviteQuery('');
    setUserSuggestions([]);
    setInviteSelectedUser(null);
    setInviteModalVisible(true);
  };
  const closeInAppInvite = () => {
    setInviteModalVisible(false);
    setInviteTargetUserId('');
    setInviteQuery('');
    setUserSuggestions([]);
    setInviteSelectedUser(null);
  };

  // --- Invite user search (by name, username, or email) ---
  const runInviteSearch = async (qRaw) => {
    const q = (qRaw || '').trim();
    if (!uid) return;
    if (!q) { setUserSuggestions([]); return; }
    const qLower = q.toLowerCase();
    setSearchingUsers(true);

    const usersCol = collection(db, 'users'); // ROOT users collection
    const resultsMap = new Map();

    const push = (d) => {
      const u = d.data() || {};
      const uidStr = d.id;

      // skip self and existing members
      if (uidStr === uid) return;
      if (clubMemberIdsRef.current && clubMemberIdsRef.current.has(uidStr)) return;

      const item = {
        uid: uidStr,
        name: u.displayName || u.fullName || u.name || 'User',
        email: u.email || u.mail || '',
        username: u.username || u.handle || '',
        photoURL: u.photoURL || u.image || u.avatar || null,
      };
      // de-dupe by uid
      resultsMap.set(item.uid, item);
    };

    try {
      // ---- Preferred: lowercase fields with prefix search ----
      const tries = [];
      tries.push(
        // usernameLower
        (async () => {
          try {
            const q1 = query(usersCol, orderBy('usernameLower'), startAt(qLower), endAt(qLower + '\\uf8ff'), limit(10));
            const s1 = await getDocs(q1); s1.forEach(push);
          } catch {}
        })(),
        // displayNameLower
        (async () => {
          try {
            const q2 = query(usersCol, orderBy('displayNameLower'), startAt(qLower), endAt(qLower + '\\uf8ff'), limit(10));
            const s2 = await getDocs(q2); s2.forEach(push);
          } catch {}
        })(),
        // fullNameLower
        (async () => {
          try {
            const q3 = query(usersCol, orderBy('fullNameLower'), startAt(qLower), endAt(qLower + '\\uf8ff'), limit(10));
            const s3 = await getDocs(q3); s3.forEach(push);
          } catch {}
        })(),
      );
      if (q.includes('@')) {
        // exact emailLower
        tries.push((async () => {
          try { const s4 = await getDocs(query(usersCol, where('emailLower', '==', qLower), limit(5))); s4.forEach(push); } catch {}
        })());
        // emailLower prefix
        tries.push((async () => {
          try {
            const q5 = query(usersCol, orderBy('emailLower'), startAt(qLower), endAt(qLower + '\\uf8ff'), limit(10));
            const s5 = await getDocs(q5); s5.forEach(push);
          } catch {}
        })());
      }
      await Promise.all(tries);

      // ---- Fallback: plain-cased fields (if lowercase fields don't exist/indexed) ----
      if (resultsMap.size < 10) {
        const plainTries = [];
        plainTries.push(
          (async () => { try { const s = await getDocs(query(usersCol, orderBy('username'), startAt(q), endAt(q + '\\uf8ff'), limit(10))); s.forEach(push); } catch {} })(),
          (async () => { try { const s = await getDocs(query(usersCol, orderBy('displayName'), startAt(q), endAt(q + '\\uf8ff'), limit(10))); s.forEach(push); } catch {} })(),
          (async () => { try { const s = await getDocs(query(usersCol, orderBy('fullName'), startAt(q), endAt(q + '\\uf8ff'), limit(10))); s.forEach(push); } catch {} })(),
        );
        if (q.includes('@')) {
          plainTries.push((async () => { try { const s = await getDocs(query(usersCol, orderBy('email'), startAt(q), endAt(q + '\\uf8ff'), limit(10))); s.forEach(push); } catch {} })());
        }
        await Promise.all(plainTries);
      }

      // ---- Last resort: small client-side filter on first page ----
      if (resultsMap.size === 0) {
        try {
          const page = await getDocs(query(usersCol, limit(50)));
          page.forEach((d) => {
            const u = d.data() || {};
            const name = (u.displayName || u.fullName || u.name || '').toLowerCase();
            const usern = (u.username || u.handle || '').toLowerCase();
            const email = (u.email || u.mail || '').toLowerCase();
            if (name.includes(qLower) || usern.includes(qLower) || email.includes(qLower)) push(d);
          });
        } catch {}
      }

      setUserSuggestions(Array.from(resultsMap.values()).slice(0, 10));
    } catch (e) {
      console.warn('Invite search error:', e);
      setUserSuggestions([]);
    } finally {
      setSearchingUsers(false);
    }
  };
  const onChangeInviteQuery = (text) => {
    setInviteSelectedUser(null);
    setInviteQuery(text);
    setInviteTargetUserId('');
    if (inviteSearchTimer.current) clearTimeout(inviteSearchTimer.current);
    inviteSearchTimer.current = setTimeout(() => runInviteSearch(text), 250);
  };
  const sendInAppInvite = async () => {
    const user = auth.currentUser;
    if (!user) return Alert.alert('Not signed in', 'You must be signed in to invite.');

    // Prefer a picked suggestion; else allow a raw userId fallback
    const targetUid = inviteSelectedUser?.uid || inviteTargetUserId.trim();
    if (!targetUid && !inviteQuery.trim()) return Alert.alert('Missing User', 'Search and select a user or enter a user ID.');
    const target = targetUid || inviteQuery.trim();
    if (target === user.uid) return Alert.alert('Oops', 'You cannot invite yourself.');
    try {
      setSendingInvite(true);
      const recipientSnap = await getDoc(doc(db, 'users', target));
      if (clubMemberIdsRef.current && clubMemberIdsRef.current.has(target)) {
        setSendingInvite(false);
        return Alert.alert('Already a member', 'This user is already in the club.');
      }
      if (!recipientSnap.exists()) {
        setSendingInvite(false);
        return Alert.alert('User not found', 'No user exists with that ID.');
      }
      // Write with deterministic id to avoid duplicates and avoid reading recipient's invites
      const inviteId = `${club.id}_${user.uid}`; // one pending invite per sender per club
      const inviteRef = doc(db, 'users', target, 'invites', inviteId);
      const payload = {
        clubId: club.id,
        clubName: clubData?.name || 'Vitola Club',
        fromUserId: user.uid,
        timestamp: new Date(),
        status: 'pending',
      };
      try {
        // This will CREATE if absent; if it exists, Firestore treats as UPDATE which our rules forbid for sender,
        // causing a permission error we map to a friendly "already invited" message.
        await setDoc(inviteRef, payload, { merge: false });
        await addDoc(collection(db, 'users', target, 'notifications'), {
          type: 'invite',
          fromUserId: user.uid,
          clubId: club.id,
          clubName: clubData?.name || 'Vitola Club',
          timestamp: new Date(),
          read: false,
        });
      } catch (err) {
        // If we hit permission denied here, it's likely because the doc already exists
        const msg = (err && (err.code === 'permission-denied' || String(err).includes('Missing or insufficient permissions'))) ?
          'There\'s already a pending invite for this user.' : (err.message || String(err));
        setSendingInvite(false);
        return Alert.alert('Invite', msg);
      }
      closeInAppInvite();
      Alert.alert('Invite sent', 'The user will see this in their invitations.');
    } catch (e) {
      Alert.alert('Invite Error', e.message || String(e));
    } finally {
      setSendingInvite(false);
    }
  };
  const startEditEvent = () => {
    if (!isOwner) {
      Alert.alert('Only owner', 'Only the club owner can edit events.');
      return;
    }
    setIsEditingEvent(true);
  };
  const cancelEditEvent = () => {
    if (!selectedEvent) return setIsEditingEvent(false);
    setEditEventTitle(selectedEvent.title || '');
    setEditEventDescription(selectedEvent.description || '');
    setEditEventLocation(selectedEvent.location || '');
    setEditEventMaxAttendees(
      typeof selectedEvent.maxAttendees === 'number' && !Number.isNaN(selectedEvent.maxAttendees)
        ? String(selectedEvent.maxAttendees)
        : ''
    );
    const d = selectedEvent.dateISO ? new Date(selectedEvent.dateISO) : null;
    const t = selectedEvent.timeISO ? new Date(selectedEvent.timeISO) : null;
    setEditSelectedDate(d);
    setEditSelectedTime(t);
    setEditDateText(selectedEvent.dateText || (d ? formatDate(d) : ''));
    setEditTimeText(selectedEvent.timeText || (t ? formatTime(t) : ''));
    setEditEventPhotos(Array.isArray(selectedEvent.photos) ? selectedEvent.photos.slice(0) : []);
    setShowEditDatePicker(false);
    setShowEditTimePicker(false);
    setIsEditingEvent(false);
  };
  const saveEditedEvent = async () => {
    if (!selectedEvent) return;
    const user = auth.currentUser;
    if (!user) return Alert.alert('Not signed in', 'You must be signed in to edit an event.');
    if (!isOwner) { 
      Alert.alert('Only owner', 'Only the club owner can edit events.'); 
      return; 
    }
    try {
      setSavingEvent(true);
      const updates = {
        title: editEventTitle.trim() || selectedEvent.title || '',
        description: editEventDescription.trim(),
        location: editEventLocation.trim() || null,
        maxAttendees: editEventMaxAttendees ? Number(editEventMaxAttendees) : null,
        dateText: editDateText.trim(),
        timeText: editTimeText.trim(),
        dateISO: editSelectedDate ? editSelectedDate.toISOString() : null,
        timeISO: editSelectedTime ? editSelectedTime.toISOString() : null,
        updatedAt: new Date(),
        updatedBy: user.uid,
        photos: Array.isArray(editEventPhotos) ? editEventPhotos : [],
      };
      const evRef = doc(db, 'clubs', club.id, 'events', selectedEvent.id);
      await updateDoc(evRef, updates);
      // update local selectedEvent for immediate UI feedback
      setSelectedEvent(prev => prev ? { ...prev, ...updates } : prev);
      setIsEditingEvent(false);
      setShowEditDatePicker(false);
      setShowEditTimePicker(false);
    } catch (e) {
      Alert.alert('Error', e.message || String(e));
    } finally {
      setSavingEvent(false);
    }
  };
  const closeEventDetail = () => {
    setEventDetailVisible(false);
    setSelectedEvent(null);
  };
  useEffect(() => {
    if (!isEventDetailVisible || !selectedEvent?.id || !uid) {
      // tear down any previous listener
      try { attendeesUnsubRef.current && attendeesUnsubRef.current(); } catch {}
      attendeesUnsubRef.current = null;
      setAttendees([]);
      setIsAttending(false);
      return;
    }

    const colRef = collection(db, 'clubs', club.id, 'events', selectedEvent.id, 'attendees');
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
        setAttendees(list.map(x => ({ uid: x.uid || x.id, name: x.name || 'User', photoURL: x.photoURL || null })));
        setIsAttending(!!list.find(d => d.id === uid));
      },
      (err) => console.warn('attendees listener error', err)
    );

    attendeesUnsubRef.current = unsub;
    return () => {
      try { unsub(); } catch {}
      attendeesUnsubRef.current = null;
    };
  }, [isEventDetailVisible, selectedEvent?.id, uid, club.id]);

  const openDatePicker = () => {
    setTempDate(selectedDate || new Date());
    setShowTimePicker(false);
    setShowDatePicker(true);
    // ensure picker is visible if it's rendered inline (iOS)
    setTimeout(() => {
      try { modalScrollRef.current?.scrollToEnd({ animated: true }); } catch {}
    }, 0);
  };
  const openTimePicker = () => {
    setTempTime(selectedTime || new Date());
    setShowDatePicker(false);
    setShowTimePicker(true);
    setTimeout(() => {
      try { modalScrollRef.current?.scrollToEnd({ animated: true }); } catch {}
    }, 0);
  };
  const confirmDate = () => {
    setSelectedDate(tempDate);
    setNewEventDate(formatDate(tempDate));
    setShowDatePicker(false);
  };
  const confirmTime = () => {
    setSelectedTime(tempTime);
    setNewEventTime(formatTime(tempTime));
    setShowTimePicker(false);
  };
  const resetEventForm = () => {
    setNewEventTitle('');
    setNewEventDate('');
    setNewEventTime('');
    setNewEventDescription('');
    setSelectedDate(null);
    setSelectedTime(null);
    setShowDatePicker(false);
    setShowTimePicker(false);
    setNewEventLocation('');
    setNewEventMaxAttendees('');
    setNewEventPhotos([]);
  };
  const openEventModal = () => {
    if (!isOwner) {
      Alert.alert('Only owner', 'Only the club owner can create events.');
      return;
    }
    resetEventForm();
    setEventModalVisible(true);
  };
  const closeEventModal = () => {
    setEventModalVisible(false);
    setShowDatePicker(false);
    setShowTimePicker(false);
  };
  const clearDate = () => {
    setSelectedDate(null);
    setNewEventDate('');
    setShowDatePicker(false);
  };
  const clearTime = () => {
    setSelectedTime(null);
    setNewEventTime('');
    setShowTimePicker(false);
  };

  useFocusEffect(
    React.useCallback(() => {
      // on focus – nothing special
      return () => {
        // on blur – ensure pickers are hidden so they don't persist across screens
        setShowDatePicker(false);
        setShowTimePicker(false);
      };
    }, [])
  );

  // Handler for leaving the club
  const handleLeaveClub = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Not signed in', 'You must be signed in to leave a club.');
      return;
    }
    Alert.alert(
      'Leave Club',
      'Are you sure you want to leave this club?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              const memberDocRef = doc(db, 'clubs', club.id, 'members', user.uid);
              const joinedClubDocRef = doc(db, 'users', user.uid, 'joined_clubs', club.id);

              // Delete membership from club
              await deleteDoc(memberDocRef);
              // Delete membership from user
              await deleteDoc(joinedClubDocRef);

              // Remove any existing invites for this club addressed to the leaving user + related notifications
              try {
                const batch = writeBatch(db);

                const invitesColRef = collection(db, 'users', user.uid, 'invites');

                // A) Field match (newer schema): clubId == this club
                const invByFieldSnap = await getDocs(query(invitesColRef, where('clubId', '==', club.id)));

                // B) DocID prefix match (legacy deterministic IDs): `${club.id}_<senderUid>`
                const prefix = `${club.id}_`;
                const invByIdSnap = await getDocs(query(invitesColRef, orderBy(documentId()), startAt(prefix), endAt(prefix + '\uf8ff')));

                // C) Broad scan fallback (very old or irregular docs): first 500 invites, check id/data heuristics
                const broadScanSnap = await getDocs(query(invitesColRef, limit(500)));

                const toDelete = new Set();
                invByFieldSnap.forEach((d) => toDelete.add(d.id));
                invByIdSnap.forEach((d) => toDelete.add(d.id));
                broadScanSnap.forEach((d) => {
                  try {
                    const data = d.data() || {};
                    // match by field name variations or id containing club.id anywhere
                    if (
                      data.clubId === club.id ||
                      data.clubID === club.id ||
                      data.club === club.id ||
                      String(d.id).includes(club.id)
                    ) {
                      toDelete.add(d.id);
                    }
                  } catch {}
                });

                toDelete.forEach((id) => {
                  batch.delete(doc(db, 'users', user.uid, 'invites', id));
                });

                // Also delete any invite notifications for this club
                const notifsColRef = collection(db, 'users', user.uid, 'notifications');
                const notifSnap = await getDocs(query(notifsColRef, where('type', '==', 'invite'), where('clubId', '==', club.id)));
                notifSnap.forEach((d) => {
                  batch.delete(doc(db, 'users', user.uid, 'notifications', d.id));
                });

                await batch.commit();
              } catch (e) {
                console.warn('invite/notification cleanup on leave failed:', e?.message || e);
              }

              setMemberCount(prev => Math.max(0, prev - 1));
              setHasLeftClub(true);
              Alert.alert('Left Club', 'You have left the club.');
              navigation.navigate('Clubs')
            } catch (error) {
              Alert.alert('Error', error.message || String(error));
            }
          }
        }
      ]
    );
  };
  // Handler for joining the club
  const handleJoinClub = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Not signed in', 'You must be signed in to join a club.');
      return;
    }
    if (isOwner || isMember) return; // nothing to do
    if ((clubData?.privacy || '').toLowerCase() === 'private') {
      Alert.alert('Private club', 'This club is private. You need an invite to join.');
      return;
    }
    try {
      const batch = writeBatch(db);

      // Try to enrich from user profile
      let profile = {};
      try {
        const us = await getDoc(doc(db, 'users', user.uid));
        if (us.exists()) profile = us.data() || {};
      } catch {}

      // Club-side membership doc
      const memberRef = doc(db, 'clubs', club.id, 'members', user.uid);
      batch.set(memberRef, {
        uid: user.uid,
        name: profile.displayName || profile.fullName || user.displayName || 'User',
        photoURL: profile.photoURL || profile.image || user.photoURL || null,
        joinedAt: new Date(),
      });

      // User-side joined_clubs doc
      const joinedRef = doc(db, 'users', user.uid, 'joined_clubs', club.id);
      batch.set(joinedRef, {
        clubId: club.id,
        clubName: clubData?.name || 'Vitola Club',
        ownerId: clubData?.createdBy || clubData?.ownerId || null,
        image: clubData?.image || null,
        backgroundImage: clubData?.backgroundImage || null,
        joinedAt: new Date(),
      });

      await batch.commit();

      setIsMember(true);
      setMemberCount((prev) => (typeof prev === 'number' ? prev + 1 : 1));
      setHasLeftClub(false);
      Alert.alert('Joined', 'You are now a member of this club.');
    } catch (e) {
      Alert.alert('Join failed', e?.message || String(e));
    }
  };

  const handleDeleteClub = async () => {
    if (!clubData) return;
    Alert.alert(
      'Delete Club',
      'This will permanently delete this club. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'clubs', club.id));
              Alert.alert('Deleted', 'Club has been deleted.');
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', error.message || String(error));
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid || null));
    return () => unsub();
  }, [auth]);

  useEffect(() => {
    if (!uid) return;
    const membersColRef = collection(db, 'clubs', club.id, 'members');
    const unsubMembers = onSnapshot(
      membersColRef,
      (snap) => {
        const set = new Set();
        snap.forEach((d) => set.add(d.id));
        clubMemberIdsRef.current = set;
        setMemberCount(snap.size); // keeps your count live too
        try { setIsMember(set.has(uid)); } catch {}
      },
      (err) => console.warn('members realtime error', err)
    );
    return () => { try { unsubMembers(); } catch {} };
  }, [club.id, uid]);

  useEffect(() => {
    if (!uid) return; // wait for auth so reads are allowed by rules
    const fetchClubData = async () => {
      try {
        const clubRef = doc(db, 'clubs', club.id);
        const clubSnap = await getDoc(clubRef);
        if (clubSnap.exists()) {
          const data = clubSnap.data();
          setClubData(data);
          setBackgroundImageUri(data.backgroundImage || null);
          setProfileImageUri(data.image || null);
          // seed edit fields
          setEditClubType(data.type || '');
          setEditClubLocation(data.location || '');
          setEditClubPrivacy((data.privacy || 'public').toLowerCase());
          setEditClubDescription(data.description || '');
          setEditClubTags(Array.isArray(data.tags) ? data.tags.join(', ') : (data.tags || ''));
          setSelectedTags(Array.isArray(data.tags) ? data.tags.filter(Boolean) : []);
        }

        const membersRef = collection(db, 'clubs', club.id, 'members');
        const membersSnap = await getDocs(membersRef);
        setMemberCount(membersSnap.size); 
      } catch (error) {
        console.error('Error fetching club data:', error);
      }
    };

    fetchClubData();
  }, [club.id, uid]);

  useEffect(() => {
    // Real-time events listener (newest first)
    if (!uid) return; // wait for auth
    if ((clubData?.privacy || '').toLowerCase() === 'private' && !(isOwner || isMember)) return;
    const eventsColRef = collection(db, 'clubs', club.id, 'events');
    const qEv = query(eventsColRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      qEv,
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setEvents(list);
      },
      (err) => {
        console.warn('Events listener error:', err);
      }
    );

    return () => unsubscribe();
  }, [club.id, uid, isOwner, isMember, clubData?.privacy]);

  useEffect(() => {
    // Real-time posts listener (newest first)
    if (!uid) return; // wait for auth
    if ((clubData?.privacy || '').toLowerCase() === 'private' && !(isOwner || isMember)) return;
    const activitiesColRef = collection(db, 'clubs', club.id, 'club_activities');
    const qPosts = query(activitiesColRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      qPosts,
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPosts(list);
      },
      (err) => {
        console.warn('Posts listener error:', err);
      }
    );

    return () => unsubscribe();
  }, [club.id, uid, isOwner, isMember, clubData?.privacy]);

  // Realtime likes/comments listeners for first 25 posts
  useEffect(() => {
    if (!uid) return; // wait for auth
    if ((clubData?.privacy || '').toLowerCase() === 'private' && !(isOwner || isMember)) return;
    // Clear any previous listeners before re-subscribing
    cleanupEngagementListeners();

    if (!posts || posts.length === 0) return;

    const max = Math.min(posts.length, 25);
    for (let i = 0; i < max; i++) {
      const p = posts[i];
      if (!p?.id) continue;

      // Likes listener
      try {
        const likesColRef = collection(db, 'clubs', club.id, 'club_activities', p.id, 'likes');
        const unLikes = onSnapshot(likesColRef, (snap) => {
          const count = snap.size;
          const likedByMe = !!snap.docs.find((d) => d.id === uid);
          setLikesMap((prev) => ({ ...prev, [p.id]: { count, likedByMe } }));
        });
        likesUnsubsRef.current[p.id] = unLikes;
      } catch (e) { /* noop */ }

      // Comments listener
      try {
        const commentsColRef = collection(db, 'clubs', club.id, 'club_activities', p.id, 'comments');
        const unComments = onSnapshot(commentsColRef, (snap) => {
          const count = snap.size;
          setCommentsCountMap((prev) => ({ ...prev, [p.id]: count }));
        });
        commentsUnsubsRef.current[p.id] = unComments;
      } catch (e) { /* noop */ }
    }

    return () => {
      // Cleanup when deps change / unmount
      cleanupEngagementListeners();
    };
  }, [uid, club.id, posts, isOwner, isMember, clubData?.privacy]);
  useEffect(() => {
    // Clean up old listeners
    Object.values(commentsUnsubsRef.current || {}).forEach((fn) => {
      try { fn && fn(); } catch {}
    });
    commentsUnsubsRef.current = {};

    if (!club?.id || !Array.isArray(posts) || posts.length === 0) return;

    posts.forEach((p) => {
      if (!p?.id) return;
      const q = collection(db, 'clubs', club.id, 'club_activities', p.id, 'comments');
      const unsub = onSnapshot(q, (snap) => {
        setCommentsCountMap((prev) => ({ ...prev, [p.id]: snap.size }));
      });
      commentsUnsubsRef.current[p.id] = unsub;
    });

    // Cleanup when posts change/unmount
    return () => {
      Object.values(commentsUnsubsRef.current || {}).forEach((fn) => {
        try { fn && fn(); } catch {}
      });
      commentsUnsubsRef.current = {};
    };
  }, [club?.id, JSON.stringify(posts.map((x) => x.id).sort())]);
  useEffect(() => {
    if (!commentModalVisible || !commentingPost?.id || !club?.id) return;

    const q = query(
      collection(db, 'clubs', club.id, 'club_activities', commentingPost.id, 'comments'),
      orderBy('createdAt', 'asc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCommentsList(arr);
      setCommentsCountMap((prev) => ({ ...prev, [commentingPost.id]: snap.size }));
    });

    return () => {
      try { unsub(); } catch {}
    };
  }, [commentModalVisible, commentingPost?.id, club?.id]);

  const formatDate = (d) => {
    try {
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };
  const formatTime = (d) => {
    try {
      return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Relative time (similar to Home.js display)
  const timeAgo = (date) => {
    try {
      const d = date instanceof Date ? date : new Date(date);
      const now = new Date();
      const diffMs = Math.max(0, now - d);
      const sec = Math.floor(diffMs / 1000);
      const min = Math.floor(sec / 60);
      const hr = Math.floor(min / 60);
      const day = Math.floor(hr / 24);
      const week = Math.floor(day / 7);
      const month = Math.floor(day / 30);
      const year = Math.floor(day / 365);

      if (sec < 30) return 'now';
      if (min < 1) return `${sec}s`;
      if (min < 60) return `${min}m`;
      if (hr < 24) return `${hr}h`;
      if (day === 1) return '1d';
      if (day < 7) return `${day}d`;
      if (week < 5) return `${week}w`;
      if (month < 12) return `${month}mo`;
      return `${year}y`;
    } catch {
      return '';
    }
  };
  const onChangeDate = (event, date) => {
  // Android picker auto-closes; commit immediately there for UX parity
  if (Platform.OS === 'android') {
    if (event?.type === 'set' && date) {
      setSelectedDate(date);
      setNewEventDate(formatDate(date));
    }
    setShowDatePicker(false);
    return;
  }
  if (date) setTempDate(date);
};
  const onChangeTime = (event, date) => {
    if (Platform.OS === 'android') {
      if (event?.type === 'set' && date) {
        setSelectedTime(date);
        setNewEventTime(formatTime(date));
      }
      setShowTimePicker(false);
      return;
    }
    if (date) setTempTime(date);
  };

  const handleCreateEvent = async () => {
    const user = auth.currentUser;
    if (!user) { 
      Alert.alert('Not signed in', 'You must be signed in to create an event.'); 
      return; 
    }
    if (!isOwner) { 
      Alert.alert('Only owner', 'Only the club owner can create events.'); 
      return; 
    }
    if (!newEventTitle.trim()) {
      Alert.alert('Missing title', 'Please enter an event title.');
      return;
    }
    try {
      setSavingEvent(true);
      const payload = {
        title: newEventTitle.trim(),
        dateText: newEventDate.trim(),
        timeText: newEventTime.trim(),
        dateISO: selectedDate ? selectedDate.toISOString() : null,
        timeISO: selectedTime ? selectedTime.toISOString() : null,
        description: newEventDescription.trim(),
        location: newEventLocation.trim() || null,
        maxAttendees: newEventMaxAttendees ? Number(newEventMaxAttendees) : null,
        photos: newEventPhotos,
        createdAt: new Date(),
        createdBy: user.uid,
      };
      const ref = collection(db, 'clubs', club.id, 'events');
      const added = await addDoc(ref, payload);
      // Reset and close
      setNewEventTitle('');
      setNewEventDate('');
      setNewEventTime('');
      setNewEventDescription('');
      setSelectedDate(null);
      setSelectedTime(null);
      setNewEventLocation('');
      setNewEventMaxAttendees('');
      setNewEventPhotos([]);
      setEventModalVisible(false);
    } catch (e) {
      Alert.alert('Error', e.message || String(e));
    } finally {
      setSavingEvent(false);
    }
  };

  // Handle image picking and store in Firestore
  const handleImagePick = async (type) => {
    try {
      if (!isOwner) {
        Alert.alert('Only owner', 'Only the club owner can change photos.');
        return;
      }
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

  // Add/remove event photos for event creation
  const handleAddEventPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setNewEventPhotos((prev) => [...prev, result.assets[0].uri]);
      }
    } catch (e) {
      Alert.alert('Photo Picker', e.message || String(e));
    }
  };
  const handleRemoveEventPhoto = (uri) => {
    setNewEventPhotos((prev) => prev.filter(u => u !== uri));
  };

  // --- Post composer helpers ---
  const startComposePost = () => {
    if (!canEngage) {
      Alert.alert('Members only', 'Join this club to post.');
      return;
    }
    setIsComposingPost(true);
  };
  const cancelComposePost = () => {
    setIsComposingPost(false);
    setPostText('');
    setPostPhotos([]);
  };

  const handleAddPostPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setPostPhotos((prev) => [...prev, result.assets[0].uri]);
      }
    } catch (e) {
      Alert.alert('Photo Picker', e.message || String(e));
    }
  };
  const handleRemovePostPhoto = (uri) => {
    setPostPhotos((prev) => prev.filter(u => u !== uri));
  };

  const submitPost = async () => {
    const user = auth.currentUser;
    if (!user) return Alert.alert('Not signed in', 'You must be signed in to post.');

    const text = postText.trim();
    if (!text && postPhotos.length === 0) {
      return Alert.alert('Empty post', 'Write something or add a photo.');
    }

    try {
      setSavingPost(true);
      const isEditing = !!editingPostId;

      // Pull author display details
      let authorName = user.displayName || 'User';
      let authorPhoto = user.photoURL || null;
      try {
        const usnap = await getDoc(doc(db, 'users', user.uid));
        if (usnap.exists()) {
          const u = usnap.data();
          authorName = u.displayName || u.fullName || authorName;
          authorPhoto = u.photoURL || u.image || authorPhoto;
        }
      } catch {}

      const payload = {
        text,
        photos: postPhotos.slice(0),
        createdAt: new Date(),
        createdBy: user.uid,
        authorName,
        authorPhoto,
      };

      const colRef = collection(db, 'clubs', club.id, 'club_activities');

      if (isEditing) {
        // Optimistic update
        setPosts(prev => prev.map(p => p.id === editingPostId ? { ...p, ...payload, updatedAt: new Date(), updatedBy: user.uid } : p));
        await updateDoc(doc(colRef, editingPostId), { ...payload, updatedAt: new Date(), updatedBy: user.uid });
      } else {
        // Optimistic insert
        const tempId = `temp-${Date.now()}`;
        setPosts(prev => [{ id: tempId, ...payload }, ...prev]);
        await addDoc(colRef, payload);
        setPosts(prev => prev.filter(p => p.id !== tempId));
      }

      // Clear composer
      setEditingPostId(null);
      setPostText('');
      setPostPhotos([]);
      setIsComposingPost(false);
    } catch (e) {
      Alert.alert('Post Error', e.message || String(e));
    } finally {
      setSavingPost(false);
    }
  };
  const openPostMenu = (p) => {
    setSelectedPost(p);
    setPostModalVisible(true);
  };
  const closePostMenu = () => {
    setPostModalVisible(false);
    setSelectedPost(null);
  };
  const startEditPost = (p) => {
    setEditingPostId(p.id);
    setIsComposingPost(true);
    setPostText(p.text || '');
    setPostPhotos(Array.isArray(p.photos) ? p.photos.slice(0) : []);
    setPostModalVisible(false);
  };
  const handleDeletePost = async (p) => {
    const user = auth.currentUser;
    if (!user) return Alert.alert('Not signed in', 'You must be signed in to delete.');
    try {
      await deleteDoc(doc(db, 'clubs', club.id, 'club_activities', p.id));
      setPosts((prev) => prev.filter((x) => x.id !== p.id));
      setPostModalVisible(false);
    } catch (e) {
      Alert.alert('Delete Error', e.message || String(e));
    }
  };
  const handleReportPost = async (p) => {
    setPostModalVisible(false);
    Alert.alert('Reported', 'Thank you for reporting this post.');
    // Optional: write to /reports here
  };

  const toggleLike = async (p) => {
    const user = auth.currentUser;
    if (!user) return Alert.alert('Not signed in', 'You must be signed in to like posts.');
    if (!canEngage) { Alert.alert('Members only', 'Join this club to like posts.'); return; }
    const key = p.id;
    const current = likesMap[key] || { count: 0, likedByMe: false };
    const likeDocRef = doc(db, 'clubs', club.id, 'club_activities', p.id, 'likes', user.uid);
    try {
      if (current.likedByMe) {
        // Optimistic update
        setLikesMap((prev) => ({ ...prev, [key]: { count: Math.max(0, current.count - 1), likedByMe: false } }));
        await deleteDoc(likeDocRef);
      } else {
        setLikesMap((prev) => ({ ...prev, [key]: { count: current.count + 1, likedByMe: true } }));
        await setDoc(likeDocRef, { uid: user.uid, createdAt: new Date() });
      }
    } catch (e) {
      Alert.alert('Like Error', e.message || String(e));
    }
  };
  const openCommentModal = (p) => {
    if (!canEngage) { Alert.alert('Members only', 'Join this club to comment on posts.'); return; }
    setCommentingPost(p);
    setCommentText('');
    setCommentsList([]);
    setCommentModalVisible(true);

    // Attach realtime listener for this post's comments
    try {
      if (commentsUnsubRef.current) { try { commentsUnsubRef.current(); } catch {} }
      const commentsColRef = collection(db, 'clubs', club.id, 'club_activities', p.id, 'comments');
      commentsUnsubRef.current = onSnapshot(
        query(commentsColRef, orderBy('createdAt', 'asc')),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setCommentsList(list);
        },
        (err) => console.warn('Comments listener error:', err)
      );
    } catch (e) { /* noop */ }
  };
  const closeCommentModal = () => {
    setCommentModalVisible(false);
    setCommentingPost(null);
    setCommentsList([]);
    if (commentsUnsubRef.current) { try { commentsUnsubRef.current(); } catch {} commentsUnsubRef.current = null; }
  };
  const submitComment = async () => {
    const user = auth.currentUser;
    if (!user) return Alert.alert('Not signed in', 'You must be signed in to comment.');
    const text = commentText.trim();
    if (!text) return;
    try {
      const commentsCol = collection(db, 'clubs', club.id, 'club_activities', commentingPost.id, 'comments');
      await addDoc(commentsCol, {
        text,
        createdAt: new Date(),
        userId: user.uid,
        userName: user.displayName || 'User',
        userPhoto: user.photoURL || null,
      });
      // Optimistic bump count
      setCommentsCountMap((prev) => ({ ...prev, [commentingPost.id]: (prev[commentingPost.id] || 0) + 1 }));
      setCommentText(''); // keep modal open; realtime list updates
    } catch (e) {
      Alert.alert('Comment Error', e.message || String(e));
    }
  };
  // --- Comment deletion helpers ---
  const canDeleteComment = (c) => {
    const user = auth.currentUser;
    if (!user) return false;
    const isCommentAuthor = c?.userId === user.uid;
    const isClubOwner = clubData?.createdBy === user.uid || clubData?.ownerId === user.uid;
    const isPostAuthor = commentingPost?.createdBy === user.uid; // author of the post being commented
    return !!(isCommentAuthor || isClubOwner || isPostAuthor);
  };
  const deleteComment = async (c) => {
    const user = auth.currentUser;
    if (!user) return;

    if (!canDeleteComment(c)) {
      Alert.alert('Not allowed', 'You cannot delete this comment.');
      return;
    }

    Alert.alert(
      'Delete comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Optimistic UI
              setCommentsList((prev) => prev.filter((x) => x.id !== c.id));
              setCommentsCountMap((prev) => ({
                ...prev,
                [commentingPost.id]: Math.max(0, (prev[commentingPost.id] || 1) - 1),
              }));

              await deleteDoc(
                doc(db, 'clubs', club.id, 'club_activities', commentingPost.id, 'comments', c.id)
              );
            } catch (e) {
              Alert.alert('Delete failed', e.message || String(e));
            }
          },
        },
      ]
    );
  };
  const sharePost = async (p) => {
    try {
      if (!canEngage) { Alert.alert('Members only', 'Join this club to share posts.'); return; }
      await Share.share({ message: `${p.authorName || 'User'}: ${p.text || ''}`.trim() });
    } catch (e) {
      Alert.alert('Share Error', e.message || String(e));
    }
  };

  // Helper to navigate to a user's profile
  const goToUserProfile = (targetUid) => {
    try {
      const me = auth.currentUser?.uid;
      if (!targetUid) return;
      if (me && targetUid === me) {
        // Jump to the bottom tab's Profile screen if available
        const parent = navigation.getParent && navigation.getParent();
        const parentState = parent?.getState?.();
        const names = parentState?.routeNames || [];
        // prefer an existing "Profile" or "ProfileTab" tab name
        if (names.includes('Profile')) {
          parent.navigate('Profile');
          return;
        }
        if (names.includes('ProfileTab')) {
          parent.navigate('ProfileTab');
          return;
        }
        // Fallback: push the Profile screen with my uid
        navigation.navigate('Profile', { userId: me });
        return;
      }
      // Visiting someone else — push their Profile screen
      navigation.navigate('Profile', { userId: targetUid, fromOutside: true });
    } catch (e) {
      // Fallback to direct navigate if anything goes wrong
      navigation.navigate('Profile', { userId: targetUid });
    }
  };

  // Cleanup comments realtime listener if modal is dismissed by navigation or unmount
  useEffect(() => {
    if (!commentModalVisible) return;
    return () => {
      if (commentsUnsubRef.current) { try { commentsUnsubRef.current(); } catch {} commentsUnsubRef.current = null; }
    };
  }, [commentModalVisible]);

  // Add/remove photos while editing an existing event
  const handleAddEditPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setEditEventPhotos((prev) => [...prev, result.assets[0].uri]);
      }
    } catch (e) {
      Alert.alert('Photo Picker', e.message || String(e));
    }
  };
  const handleRemoveEditPhoto = (uri) => {
    setEditEventPhotos((prev) => prev.filter((u) => u !== uri));
  };


  // Helper to extract month abbreviation and day safely from event
  const getMonthAndDayFromEvent = (ev) => {
    try {
      const d = ev?.dateISO ? new Date(ev.dateISO) : (ev?.dateText ? new Date(ev.dateText) : null);
      if (d && !isNaN(d)) {
        const month = d.toLocaleString(undefined, { month: 'short' }).toUpperCase();
        const day = String(d.getDate()).padStart(2, '0');
        return { month, day };
      }
    } catch (e) { /* noop */ }
    // Fallback to regex from dateText like "Wed, Jul 17, 2025"
    const m = (ev?.dateText || '').match(/([A-Za-z]{3,})\s+(\d{1,2})/);
    if (m) {
      return { month: m[1].slice(0,3).toUpperCase(), day: m[2].padStart(2, '0') };
    }
    return { month: '---', day: '--' };
  };

  // --- Club Edit Modal handlers ---
  const openClubEdit = () => {
    if (!isOwner) {
      Alert.alert('Only owner', 'Only the club owner can edit club details.');
      return;
    }
    // Ensure fields are in sync with latest data
    setEditClubType(clubData?.type || '');
    setEditClubLocation(clubData?.location || '');
    setEditClubPrivacy((clubData?.privacy || 'public').toLowerCase());
    setEditClubDescription(clubData?.description || '');
    setEditClubTags(Array.isArray(clubData?.tags) ? clubData.tags.join(', ') : (clubData?.tags || ''));
    setSelectedTags(Array.isArray(clubData?.tags) ? clubData.tags.filter(Boolean) : []);
    setClubEditVisible(true);
  };
  const closeClubEdit = () => setClubEditVisible(false);
  const saveClubEdits = async () => {
    if (!isOwner) {
      Alert.alert('Only owner', 'Only the club owner can edit club details.');
      return;
    }
    try {
      setSavingClubEdits(true);
      const updates = {
        type: (editClubType || '').trim() || null,
        location: (editClubLocation || '').trim() || null,
        privacy: (editClubPrivacy || 'public').trim().toLowerCase(),
        description: (editClubDescription || '').trim() || null,
      };
      // tags: turn comma-separated into array of trimmed non-empty strings
      const rawFromText = (editClubTags || '').split(',').map(s => s.trim()).filter(Boolean);
      const finalTags = (selectedTags && selectedTags.length) ? selectedTags : rawFromText;
      updates.tags = finalTags.length ? finalTags : [];

      await updateDoc(doc(db, 'clubs', club.id), updates);

      // Update local UI immediately
      setClubData((prev) => prev ? { ...prev, ...updates } : { ...updates });

      setClubEditVisible(false);
    } catch (e) {
      Alert.alert('Update Error', e.message || String(e));
    } finally {
      setSavingClubEdits(false);
    }
  };
  const openTypePicker = () => setTypePickerVisible(true);
  const pickType = (val) => { setEditClubType(val); setTypePickerVisible(false); };
  const openTagPicker = () => setTagPickerVisible(true);
  const toggleTag = (tag) => {
    const active = selectedTags.includes(tag);

    if (active) {
      // Remove if already selected
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      if (selectedTags.length < 5) {
        // Allow adding up to 5 tags
        setSelectedTags([...selectedTags, tag]);
      } else {
        // Optional: show a warning or toast
        Alert.alert("Limit Reached", "You can select up to 5 tags only.");
      }
    }
  };
  const confirmTags = () => { setEditClubTags(selectedTags.join(', ')); setTagPickerVisible(false); };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Back Arrow */}
        <TouchableOpacity style={[styles.backButton, { backgroundColor: theme.primary }]} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.iconOnPrimary} />
        </TouchableOpacity>
        {/* Owner Edit Button */}
        {isOwner && (
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.primary, right: 16, left: undefined }]}
            onPress={openClubEdit}
          >
            <Ionicons name="create-outline" size={22} color={theme.iconOnPrimary} />
          </TouchableOpacity>
        )}

        {/* Background Image */}
        <TouchableOpacity
          onPress={() => (isOwner ? handleImagePick('background') : Alert.alert('Only owner', 'Only the club owner can change the cover photo.'))}
          activeOpacity={isOwner ? 0.7 : 1}
          disabled={!isOwner}
        >
          <View style={[styles.backgroundImage, { backgroundColor: isDarkMode ? theme.card : '#ddd' }]}>
            {backgroundImageUri ? (
              <Image source={{ uri: backgroundImageUri }} style={[styles.backgroundImage, !isOwner && { opacity: 0.7 }]} />
            ) : (
              isOwner ? (
                <Text style={[styles.uploadText, { color: theme.text }]}>Upload Background Photo</Text>
              ) : (
                // Non-owners see a plain placeholder with no call-to-action
                <View style={{ flex: 1 }} />
              )
            )}
          </View>
        </TouchableOpacity>

        {/* Profile Image */}
        <TouchableOpacity
          onPress={() => (isOwner ? handleImagePick('profile') : Alert.alert('Only owner', 'Only the club owner can change the profile photo.'))}
          activeOpacity={isOwner ? 0.7 : 1}
          disabled={!isOwner}
          style={[styles.profileImageWrapper, { backgroundColor: isDarkMode ? theme.card : '#eee' }]}
        >
          {profileImageUri ? (
            <Image source={{ uri: profileImageUri }} style={[styles.profileImage, !isOwner && { opacity: 0.7 }]} />
          ) : (
            isOwner ? (
              <Text style={[styles.uploadText, { color: theme.text }]}>Upload Profile Photo</Text>
            ) : (
              // Non-owners see a plain placeholder with no call-to-action
              <View style={{ width: '100%', height: '100%' }} />
            )
          )}
        </TouchableOpacity>

        {/* Club Title and Meta */}
        {clubData && (
          <>
            <View style={[styles.clubTitleRow, { marginTop: BACKGROUND_HEIGHT - 130, marginLeft: 20, alignItems: 'center', flexDirection: 'row' }]}>
              <Text style={[styles.clubTitle, { color: theme.text }]}>{clubData.name}</Text>
              {clubData.ownerName && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('Profile', { userId: clubData.ownerId, fromOutside: true })}
                  activeOpacity={0.7}
                  style={{
                    marginLeft: 26,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons name="person-outline" size={16} color={theme.text} style={{ marginRight: 5 }} />
                  <Text
                    style={{
                      fontSize: 15,
                      color: theme.text,
                      opacity: 0.6,
                      fontWeight: '400',
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    Owner: {clubData.ownerName}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <MaterialIcons name="category" size={16} color={theme.text} style={styles.metaIcon} />
                <Text style={[styles.metaText, { color: theme.text }]}>{clubData.type || 'N/A'}</Text>
              </View>
              <View style={styles.metaItem}>
                <MaterialIcons name="people" size={16} color={theme.text} style={styles.metaIcon} />
                <Text style={[styles.metaText, { color: theme.text }]}>
                  {memberCount.toLocaleString()} {memberCount === 1 ? 'member' : 'members'}
                </Text>
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
            {canViewPrivate ? (
              <>
                {clubData.description ? (
                  <Text style={[styles.descriptionText, { color: theme.text }]}>
                    {clubData.description}
                  </Text>
                ) : null}
                <View style={styles.buttonRow}>
                  {isOwner && (
                    <View style={styles.buttonWithLabel}>
                      <TouchableOpacity
                        style={[styles.circleButton, { backgroundColor: theme.primary }]}
                        onPress={openInAppInvite}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="person-add-outline" size={24} color={theme.iconOnPrimary} style={styles.buttonIcon} />
                      </TouchableOpacity>
                      <Text style={[styles.buttonLabel, { color: theme.text }]}>Invite</Text>
                    </View>
                  )}

                  {/* When public & not a member/owner, show Join to the LEFT of Share */}
                  {!isOwner && !isMember && (clubData?.privacy || 'public').toLowerCase() === 'public' ? (
                    <>
                      <View style={styles.buttonWithLabel}>
                        <TouchableOpacity
                          style={[styles.circleButton, { backgroundColor: theme.primary }]}
                          onPress={handleJoinClub}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="log-in-outline" size={24} color={theme.iconOnPrimary} style={styles.buttonIcon} />
                        </TouchableOpacity>
                        <Text style={[styles.buttonLabel, { color: theme.text }]}>Join</Text>
                      </View>

                      <View style={styles.buttonWithLabel}>
                        <TouchableOpacity
                          style={[styles.circleButton, { backgroundColor: theme.primary, opacity: canEngage ? 1 : 0.5 }]}
                          onPress={() => canEngage
                            ? Share.share({ message: clubData?.name || 'Vitola Club' })
                            : Alert.alert('Members only', 'Join this club to share.')
                          }
                          disabled={!canEngage}
                        >
                          <Ionicons name="share-social-outline" size={24} color={theme.iconOnPrimary} style={styles.buttonIcon} />
                        </TouchableOpacity>
                        <Text style={[styles.buttonLabel, { color: theme.text }]}>Share</Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.buttonWithLabel}>
                        <TouchableOpacity
                          style={[styles.circleButton, { backgroundColor: theme.primary, opacity: canEngage ? 1 : 0.5 }]}
                          onPress={() => canEngage
                            ? Share.share({ message: clubData?.name || 'Vitola Club' })
                            : Alert.alert('Members only', 'Join this club to share.')
                          }
                          disabled={!canEngage}
                        >
                          <Ionicons name="share-social-outline" size={24} color={theme.iconOnPrimary} style={styles.buttonIcon} />
                        </TouchableOpacity>
                        <Text style={[styles.buttonLabel, { color: theme.text }]}>Share</Text>
                      </View>

                      {isOwner ? (
                        <View style={styles.buttonWithLabel}>
                          <TouchableOpacity
                            style={[styles.circleButton, { backgroundColor: theme.primary }]}
                            onPress={handleDeleteClub}
                          >
                            <Ionicons name="trash-outline" size={24} color={theme.iconOnPrimary} style={styles.buttonIcon} />
                          </TouchableOpacity>
                          <Text style={[styles.buttonLabel, { color: theme.text }]}>Delete</Text>
                        </View>
                      ) : (
                        <View style={styles.buttonWithLabel}>
                          <TouchableOpacity
                            style={[styles.circleButton, { backgroundColor: theme.primary }]}
                            onPress={handleLeaveClub}
                          >
                            <Ionicons name="exit-outline" size={24} color={theme.iconOnPrimary} style={styles.buttonIcon} />
                          </TouchableOpacity>
                          <Text style={[styles.buttonLabel, { color: theme.text }]}>{isMember ? 'Leave' : 'Joined'}</Text>
                        </View>
                      )}
                    </>
                  )}
                </View>

                {/* Upcoming Events Section */}
                <View style={styles.upcomingEventsSection}>
                  <View style={styles.eventsHeaderRow}>
                    <Text style={[styles.upcomingEventsTitle, { color: theme.text }]}>Upcoming Events</Text>
                    {isOwner && (
                    <TouchableOpacity
                      onPress={openEventModal}
                      style={[styles.smallCircleButton, { backgroundColor: theme.primary, marginLeft: 10 }]}
                      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                      <Ionicons name="add" size={18} color={theme.iconOnPrimary} />
                    </TouchableOpacity>
                    )}
                  </View>
                  {events.length === 0 ? (
                    <View style={{ paddingVertical: 12 }}>
                      <Text style={{ color: theme.text, opacity: 0.7 }}>
                        {isOwner ? 'Click the “+” button to add your events.' : 'No events yet.'}
                      </Text>
                    </View>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: 'row' }}>
                        {events.map((ev) => (
                          <TouchableOpacity
                            key={ev.id}
                            activeOpacity={0.8}
                            onPress={() => openEventDetail(ev)}
                            style={[styles.eventCard, { backgroundColor: theme.card, borderColor: theme.border, marginRight: 16 }]}
                          >
                            <View style={styles.eventRow}>
                              <View style={[styles.eventDateBox, { backgroundColor: theme.primary }]}>
                                {(() => { const { month, day } = getMonthAndDayFromEvent(ev); return (
                                  <>
                                    <Text style={[styles.eventMonth, { color: theme.iconOnPrimary }]}>{month}</Text>
                                    <Text style={[styles.eventDate, { color: theme.iconOnPrimary }]}>{day}</Text>
                                  </>
                                ); })()}
                              </View>
                              <View style={styles.eventDetails}>
                                <Text style={[styles.eventTitle, { color: theme.text }]} numberOfLines={1}>{ev.title}</Text>
                                {!!ev.timeText && <Text style={[styles.eventTime, { color: theme.text }]}>{ev.timeText}</Text>}
                                {!!ev.description && <Text style={[styles.eventAttendees, { color: theme.text }]} numberOfLines={2}>{ev.description}</Text>}
                              </View>
                              <View style={{ justifyContent: 'center' }}>
                                <Ionicons name="chevron-forward-outline" size={20} color={theme.text} />
                              </View>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  )}
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
                <View style={{ paddingTop: 15, marginHorizontal: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <Image
                      source={profileImageUri ? { uri: profileImageUri } : require('../img/profile.png')}
                      style={styles.postProfileImage}
                    />

                    {(!isComposingPost || !canEngage) ? (
                      <TouchableOpacity
                        style={[
                          styles.postInputPlaceholder,
                          { backgroundColor: theme.background, borderColor: theme.text, opacity: canEngage ? 1 : 0.5 }
                        ]}
                        activeOpacity={0.85}
                        disabled={!canEngage}
                        onPress={() => canEngage
                          ? startComposePost()
                          : Alert.alert('Members only', 'Join this club to post.')
                        }
                      >
                        <Text style={[styles.postPlaceholderText, { color: theme.text }]}>
                          Create a new post...
                        </Text>
                        <Ionicons name="add-outline" size={24} color={theme.text} />
                      </TouchableOpacity>
                    ) : (
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={[styles.postComposerBox, { borderColor: theme.border, backgroundColor: theme.background }]}>
                          <TextInput
                            value={postText}
                            onChangeText={setPostText}
                            placeholder="Share an update..."
                            placeholderTextColor={theme.text + '99'}
                            multiline
                            style={{ minHeight: 80, color: theme.text, padding: 8 }}
                          />
                          {postPhotos.length > 0 && (
                            <View style={[styles.eventPhotosGrid, { marginTop: 8 }]}>
                              {postPhotos.map((uri, idx) => (
                                <View key={uri || String(idx)} style={[styles.eventPhotoTile, { borderColor: theme.border }]}>
                                  <Image source={{ uri }} style={styles.eventPhotoImage} />
                                  <TouchableOpacity
                                    onPress={() => handleRemovePostPhoto(uri)}
                                    style={[styles.eventPhotoRemoveBtn, { backgroundColor: theme.primary }]}
                                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                                  >
                                    <Ionicons name="close" size={14} color={theme.iconOnPrimary} />
                                  </TouchableOpacity>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>

                        {/* Composer actions */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                          <TouchableOpacity
                            onPress={handleAddPostPhoto}
                            style={[styles.addEventPhotoInline, { borderColor: theme.border }]}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="image-outline" size={18} color={theme.text} />
                            <Text style={{ marginLeft: 6, color: theme.text }}>Add photo</Text>
                          </TouchableOpacity>

                          <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                              onPress={cancelComposePost}
                              style={[styles.modalSecondaryBtn, { borderColor: theme.border, paddingVertical: 8, paddingHorizontal: 12 }]}
                              disabled={savingPost}
                            >
                              <Text style={[styles.modalSecondaryText, { color: theme.text }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={submitPost}
                              style={[styles.modalPrimaryBtn, { backgroundColor: theme.primary, paddingVertical: 8, paddingHorizontal: 12 }]}
                              disabled={savingPost}
                            >
                              <Text style={{ color: theme.iconOnPrimary, fontWeight: '600' }}>
                                {savingPost ? 'Posting...' : 'Post'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    )}
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
                {/* Posts feed */}
                {posts.length === 0 ? (
                  <Text style={{ color: theme.text, opacity: 0.7, marginHorizontal: 20, marginTop: 12 }}>No posts yet.</Text>
                ) : (
                  <View style={{ marginTop: 8 }}>
                    {posts.map((p) => (
                      <View key={p.id} style={[styles.feedPostContainer, { backgroundColor: theme.card, borderColor: theme.border }]}> 
                        {/* Header */}
                        <View style={styles.feedPostHeaderRow}>
                          <TouchableOpacity onPress={() => goToUserProfile(p.createdBy)} activeOpacity={0.8}>
                            <Image
                              source={p.authorPhoto ? { uri: p.authorPhoto } : require('../img/profile.png')}
                              style={styles.feedPostProfileImage}
                            />
                          </TouchableOpacity>
                          <View style={{ marginLeft: 10, flex: 1 }}>
                            <TouchableOpacity onPress={() => goToUserProfile(p.createdBy)} activeOpacity={0.7}>
                              <Text style={[styles.feedPostUserName, { color: theme.text }]} numberOfLines={1}>
                                {p.authorName || 'User'}
                              </Text>
                            </TouchableOpacity>
                            {p.createdAt && (
                              <Text style={[styles.feedPostDate, { color: theme.text, opacity: 0.6 }]}>
                                {(() => { try { const d = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt); return timeAgo(d); } catch { return ''; } })()}
                              </Text>
                            )}
                          </View>
                          <TouchableOpacity
                            onPress={() => canEngage ? openPostMenu(p) : Alert.alert('Members only', 'Join this club to view post options.')}
                            disabled={!canEngage}
                            style={{ padding: 4, opacity: canEngage ? 1 : 0.5 }}
                          >
                            <Ionicons name="ellipsis-vertical" size={20} color={theme.text} />
                          </TouchableOpacity>
                        </View>
                        {/* Body */}
                        {!!p.text && (
                          <Text style={[styles.feedPostText, { color: theme.text }]}>{p.text}</Text>
                        )}
                        {Array.isArray(p.photos) && p.photos.length > 0 && (
                          <Image
                            source={{ uri: p.photos[0] }}
                            style={[styles.feedPostImage, { backgroundColor: theme.background }]}
                            resizeMode="cover"
                          />
                        )}
                        {/* Action Row: Like, Comment, Share */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 8, paddingVertical: 6, borderTopWidth: 0.5, borderTopColor: '#ccc', borderBottomWidth: 0.5, borderBottomColor: '#ccc' }}>
                          {/* Like */}
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', opacity: canEngage ? 1 : 0.5 }}
                            disabled={!canEngage}
                            onPress={() => toggleLike(p)}
                          >
                            <Ionicons name={(likesMap[p.id]?.likedByMe ? 'heart' : 'heart-outline')} size={20} color={theme.text} style={{ marginRight: 4 }} />
                            <Text style={{ color: theme.text }}>{likesMap[p.id]?.count ? `Like (${likesMap[p.id].count})` : 'Like'}</Text>
                          </TouchableOpacity>

                          {/* Comment */}
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', opacity: canEngage ? 1 : 0.5 }}
                            disabled={!canEngage}
                            onPress={() => openCommentModal(p)}
                          >
                            <Ionicons name="chatbubble-outline" size={20} color={theme.text} style={{ marginRight: 4 }} />
                            <Text style={{ color: theme.text }}>{commentsCountMap[p.id] ? `Comment (${commentsCountMap[p.id]})` : 'Comment'}</Text>
                          </TouchableOpacity>

                          {/* Share */}
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', opacity: canEngage ? 1 : 0.5 }}
                            disabled={!canEngage}
                            onPress={() => sharePost(p)}
                          >
                            <Ionicons name="arrow-redo-outline" size={20} color={theme.text} style={{ marginRight: 4 }} />
                            <Text style={{ color: theme.text }}>Share</Text>
                          </TouchableOpacity>
                        </View>
                        {(likesMap[p.id]?.count || commentsCountMap[p.id]) ? (
                          <Text style={{ color: theme.text, opacity: 0.6, marginTop: 6 }}>
                            {likesMap[p.id]?.count ? `${likesMap[p.id].count} like${likesMap[p.id].count === 1 ? '' : 's'}` : ''}
                            {(likesMap[p.id]?.count && commentsCountMap[p.id]) ? ' · ' : ''}
                            {commentsCountMap[p.id] ? `${commentsCountMap[p.id]} comment${commentsCountMap[p.id] === 1 ? '' : 's'}` : ''}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}

                {/* Post options modal */}
                <Modal
                  animationType="slide"
                  transparent={true}
                  visible={postModalVisible}
                  onRequestClose={() => setPostModalVisible(false)}
                >
                  <TouchableWithoutFeedback onPress={() => setPostModalVisible(false)}>
                    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                      <TouchableWithoutFeedback>
                        <View style={{ backgroundColor: theme.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 }}>
                          {selectedPost && (
                            <View style={{ marginBottom: 10 }}>
                              {selectedPost.createdBy === auth.currentUser?.uid ? (
                                <>
                                  <TouchableOpacity style={styles.popupOption} onPress={() => startEditPost(selectedPost)}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                      <Ionicons name="create-outline" size={20} color={theme.primary} style={{ marginRight: 12 }} />
                                      <Text style={{ color: theme.primary, fontWeight: 'bold' }}>Edit Post</Text>
                                    </View>
                                  </TouchableOpacity>
                                  <TouchableOpacity style={styles.popupOption} onPress={() => handleDeletePost(selectedPost)}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                      <Ionicons name="trash-outline" size={20} color="#d32f2f" style={{ marginRight: 12 }} />
                                      <Text style={{ color: '#d32f2f', fontWeight: 'bold' }}>Delete Post</Text>
                                    </View>
                                  </TouchableOpacity>
                                </>
                              ) : (
                                <TouchableOpacity style={styles.popupOption} onPress={() => handleReportPost(selectedPost)}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="flag-outline" size={20} color={theme.primary} style={{ marginRight: 12 }} />
                                    <Text style={{ color: theme.primary }}>Report</Text>
                                  </View>
                                </TouchableOpacity>
                              )}
                              <TouchableOpacity style={styles.popupOption} onPress={closePostMenu}>
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
                {/* In-app Invite Modal */}
                <Modal
                  animationType="slide"
                  transparent={true}
                  visible={inviteModalVisible}
                  onRequestClose={closeInAppInvite}
                >
                  <TouchableWithoutFeedback onPress={closeInAppInvite}>
                    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                      <TouchableWithoutFeedback>
                        <View style={{ backgroundColor: theme.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 }}>
                          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, marginBottom: 10 }}>Invite a user</Text>
                          <Text style={{ color: theme.text, opacity: 0.7, marginBottom: 8 }}>Search by name, username, or email:</Text>
                          <TextInput
                            value={inviteQuery}
                            onChangeText={onChangeInviteQuery}
                            placeholder="Search by name, username, or email"
                            placeholderTextColor={theme.text + '99'}
                            autoCapitalize="none"
                            autoCorrect={false}
                            style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 10, color: theme.text }}
                          />
                          {inviteSelectedUser && (
                            <View style={{ marginTop: 8, padding: 8, borderWidth: 1, borderColor: theme.border, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}>
                              <Image source={inviteSelectedUser.photoURL ? { uri: inviteSelectedUser.photoURL } : require('../img/profile.png')} style={{ width: 28, height: 28, borderRadius: 14, marginRight: 8 }} />
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: theme.text, fontWeight: '600' }} numberOfLines={1}>{inviteSelectedUser.name}</Text>
                                <Text style={{ color: theme.text, opacity: 0.7 }} numberOfLines={1}>{inviteSelectedUser.email || inviteSelectedUser.username}</Text>
                              </View>
                              <TouchableOpacity onPress={() => { setInviteSelectedUser(null); setInviteTargetUserId(''); }}>
                                <Ionicons name="close" size={18} color={theme.text} />
                              </TouchableOpacity>
                            </View>
                          )}
                          {/* Suggestions */}
                          {!inviteSelectedUser && (
                            <FlatList
                              data={userSuggestions}
                              keyExtractor={(item) => item.uid}
                              keyboardShouldPersistTaps="handled"
                              style={{ maxHeight: 220, marginTop: 8 }}
                              ListEmptyComponent={inviteQuery && !searchingUsers ? (
                                <Text style={{ color: theme.text, opacity: 0.6 }}>No users found</Text>
                              ) : null}
                              renderItem={({ item }) => (
                                <TouchableOpacity
                                  onPress={() => { setInviteSelectedUser(item); setInviteTargetUserId(item.uid); }}
                                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
                                >
                                  <Image source={item.photoURL ? { uri: item.photoURL } : require('../img/profile.png')} style={{ width: 28, height: 28, borderRadius: 14, marginRight: 10 }} />
                                  <View style={{ flex: 1 }}>
                                    <Text style={{ color: theme.text, fontWeight: '600' }} numberOfLines={1}>{item.name}</Text>
                                    <Text style={{ color: theme.text, opacity: 0.7 }} numberOfLines={1}>
                                      {item.username ? `@${item.username}` : ''}{item.username && item.email ? ' · ' : ''}{item.email || ''}
                                    </Text>
                                  </View>
                                  <Ionicons name="chevron-forward" size={18} color={theme.text} />
                                </TouchableOpacity>
                              )}
                            />
                          )}
                          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 }}>
                            <TouchableOpacity onPress={closeInAppInvite} style={[styles.modalSecondaryBtn, { borderColor: theme.border, marginRight: 10 }]}>
                              <Text style={[styles.modalSecondaryText, { color: theme.text }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={sendInAppInvite}
                              disabled={( !inviteSelectedUser && !inviteTargetUserId.trim() && !inviteQuery.trim() ) || sendingInvite}
                              style={[styles.modalPrimaryBtn, { backgroundColor: theme.primary }]}
                            >
                              <Text style={{ color: theme.iconOnPrimary, fontWeight: '600' }}>{sendingInvite ? 'Sending…' : 'Send'}</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </TouchableWithoutFeedback>
                    </View>
                  </TouchableWithoutFeedback>
                </Modal>
                {/* Club Edit Modal (Owner Only) */}
                <Modal
                  animationType="slide"
                  transparent={true}
                  visible={clubEditVisible}
                  onRequestClose={closeClubEdit}
                >
                  <TouchableWithoutFeedback onPress={closeClubEdit}>
                    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                      <TouchableWithoutFeedback>
                        <View style={{ backgroundColor: theme.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 }}>
                          <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, marginBottom: 12 }}>Edit Club Details</Text>

                          {/* Type */}
                          <Text style={{ color: theme.text, opacity: 0.7, marginBottom: 6 }}>Type</Text>
                          <TouchableOpacity
                            onPress={openTypePicker}
                            style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                          >
                            <Text style={{ color: theme.text }}>{editClubType || 'Select a type'}</Text>
                            <Ionicons name="chevron-down" size={18} color={theme.text} />
                          </TouchableOpacity>

                          {/* Location */}
                          <Text style={{ color: theme.text, opacity: 0.7, marginBottom: 6 }}>Location</Text>
                          <TextInput
                            value={editClubLocation}
                            onChangeText={setEditClubLocation}
                            placeholder="City, Country or Anywhere"
                            placeholderTextColor={theme.text + '99'}
                            style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 10, color: theme.text, marginBottom: 12 }}
                          />

                          {/* Privacy */}
                          <Text style={{ color: theme.text, opacity: 0.7, marginBottom: 6 }}>Privacy</Text>
                          <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                            <TouchableOpacity
                              onPress={() => setEditClubPrivacy('public')}
                              style={{
                                flex: 1, paddingVertical: 10, borderWidth: 1, borderRadius: 8, alignItems: 'center', marginRight: 6,
                                borderColor: editClubPrivacy === 'public' ? theme.primary : theme.border,
                                backgroundColor: editClubPrivacy === 'public' ? theme.primary : 'transparent'
                              }}
                            >
                              <Text style={{ color: editClubPrivacy === 'public' ? theme.iconOnPrimary : theme.text }}>Public</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setEditClubPrivacy('private')}
                              style={{
                                flex: 1, paddingVertical: 10, borderWidth: 1, borderRadius: 8, alignItems: 'center', marginLeft: 6,
                                borderColor: editClubPrivacy === 'private' ? theme.primary : theme.border,
                                backgroundColor: editClubPrivacy === 'private' ? theme.primary : 'transparent'
                              }}
                            >
                              <Text style={{ color: editClubPrivacy === 'private' ? theme.iconOnPrimary : theme.text }}>Private</Text>
                            </TouchableOpacity>
                          </View>

                          {/* Description */}
                          <Text style={{ color: theme.text, opacity: 0.7, marginBottom: 6 }}>Description</Text>
                          <TextInput
                            value={editClubDescription}
                            onChangeText={setEditClubDescription}
                            placeholder="Describe your club"
                            placeholderTextColor={theme.text + '99'}
                            multiline
                            style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 10, color: theme.text, minHeight: 80, textAlignVertical: 'top', marginBottom: 12 }}
                          />

                          {/* Tags */}
                          <Text style={{ color: theme.text, opacity: 0.7, marginBottom: 6 }}>Tags</Text>
                          <TouchableOpacity
                            onPress={openTagPicker}
                            style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                          >
                            <Text style={{ color: theme.text }} numberOfLines={1} ellipsizeMode="tail">
                              {selectedTags.length ? selectedTags.join(', ') : 'Select tags'}
                            </Text>
                            <Ionicons name="chevron-down" size={18} color={theme.text} />
                          </TouchableOpacity>

                          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 }}>
                            <TouchableOpacity onPress={closeClubEdit} style={[styles.modalSecondaryBtn, { borderColor: theme.border, marginRight: 10 }]} disabled={savingClubEdits}>
                              <Text style={[styles.modalSecondaryText, { color: theme.text }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={saveClubEdits} style={[styles.modalPrimaryBtn, { backgroundColor: theme.primary }]} disabled={savingClubEdits}>
                              <Text style={{ color: theme.iconOnPrimary, fontWeight: '600' }}>{savingClubEdits ? 'Saving…' : 'Save'}</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </TouchableWithoutFeedback>
                    </View>
                  </TouchableWithoutFeedback>
                  {/* TYPE PICKER (bottom sheet) */}
                  <Modal
                    animationType="slide"
                    transparent
                    visible={typePickerVisible}
                    onRequestClose={() => setTypePickerVisible(false)}
                  >
                    <TouchableWithoutFeedback onPress={() => setTypePickerVisible(false)}>
                      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                        <TouchableWithoutFeedback>
                          <View style={{ backgroundColor: theme.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 8, maxHeight: height * 0.6 }}>
                            {/* Grabber */}
                            <View style={{ alignItems: 'center', paddingVertical: 6 }}>
                              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border }} />
                            </View>
                            <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
                              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>Select Type</Text>
                            </View>
                            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: height * 0.5 }}>
                              {TYPE_OPTIONS.map((opt) => (
                                <TouchableOpacity
                                  key={opt}
                                  onPress={() => { pickType(opt); }}
                                  style={{ paddingVertical: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }}
                                >
                                  <Ionicons
                                    name={editClubType === opt ? 'radio-button-on' : 'radio-button-off'}
                                    size={20}
                                    color={editClubType === opt ? theme.primary : theme.text}
                                    style={{ marginRight: 10 }}
                                  />
                                  <Text style={{ color: theme.text, fontSize: 15 }}>{opt}</Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
                              <TouchableOpacity onPress={() => setTypePickerVisible(false)} style={[styles.modalSecondaryBtn, { borderColor: theme.border, marginRight: 10 }]}>
                                <Text style={[styles.modalSecondaryText, { color: theme.text }]}>Cancel</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </TouchableWithoutFeedback>
                      </View>
                    </TouchableWithoutFeedback>
                  </Modal>

                  {/* TAG PICKER (bottom sheet) */}
                  <Modal
                    animationType="slide"
                    transparent
                    visible={tagPickerVisible}
                    onRequestClose={() => setTagPickerVisible(false)}
                  >
                    <TouchableWithoutFeedback onPress={() => setTagPickerVisible(false)}>
                      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                        <TouchableWithoutFeedback>
                          <View style={{ backgroundColor: theme.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 8, maxHeight: height * 0.7 }}>
                            {/* Grabber */}
                            <View style={{ alignItems: 'center', paddingVertical: 6 }}>
                              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border }} />
                            </View>
                            <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
                              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>Select Tags</Text>
                            </View>
                            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }} keyboardShouldPersistTaps="handled" style={{ maxHeight: height * 0.55 }}>
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                                {TAG_OPTIONS.map((tag) => {
                                  const active = selectedTags.includes(tag);
                                  return (
                                    <TouchableOpacity
                                      key={tag}
                                      onPress={() => toggleTag(tag)}
                                      style={{
                                        paddingVertical: 8,
                                        paddingHorizontal: 12,
                                        borderRadius: 16,
                                        borderWidth: 1,
                                        marginRight: 8,
                                        marginBottom: 10,
                                        borderColor: active ? theme.primary : theme.border,
                                        backgroundColor: active ? theme.primary : 'transparent',
                                      }}
                                    >
                                      <Text style={{ color: active ? theme.iconOnPrimary : theme.text }}>{tag}</Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            </ScrollView>
                            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
                              <TouchableOpacity onPress={() => setTagPickerVisible(false)} style={[styles.modalSecondaryBtn, { borderColor: theme.border, marginRight: 10 }]}>
                                <Text style={[styles.modalSecondaryText, { color: theme.text }]}>Cancel</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={confirmTags} style={[styles.modalPrimaryBtn, { backgroundColor: theme.primary }]}>
                                <Text style={{ color: theme.iconOnPrimary, fontWeight: '600' }}>Done</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </TouchableWithoutFeedback>
                      </View>
                    </TouchableWithoutFeedback>
                  </Modal>
                </Modal>
                {/* Comment modal */}
                <Modal
                  animationType="slide"
                  transparent={true}
                  visible={commentModalVisible}
                  onRequestClose={closeCommentModal}
                >
                  <TouchableWithoutFeedback onPress={closeCommentModal}>
                    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                      <TouchableWithoutFeedback>
                        <KeyboardAvoidingView
                          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                          keyboardVerticalOffset={Platform.OS === 'ios' ? 34 : 0}
                          style={{ width: '100%' }}
                        >
                          <View style={{
                            backgroundColor: theme.background,
                            borderTopLeftRadius: 16,
                            borderTopRightRadius: 16,
                            maxHeight: height * 0.8, // "snap" ceiling
                            paddingTop: 8,
                          }}>
                            {/* Grabber for snap feel */}
                            <View style={{ alignItems: 'center', paddingVertical: 6 }}>
                              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border }} />
                            </View>

                            <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
                              <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>Comments</Text>
                              {!!commentingPost?.text && (
                                <Text style={{ color: theme.text, opacity: 0.7, marginTop: 2 }} numberOfLines={2}>{commentingPost.text}</Text>
                              )}
                            </View>

                            {/* Comments list */}
                            <FlatList
                              data={commentsList}
                              keyExtractor={(item) => item.id}
                              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
                              style={{ maxHeight: height * 0.55 }}
                              keyboardShouldPersistTaps="handled"
                              renderItem={({ item }) => (
                                <TouchableOpacity
                                  activeOpacity={0.85}
                                  onLongPress={() => canDeleteComment(item) && deleteComment(item)}
                                  delayLongPress={300}
                                  style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 }}
                                >
                                  <Image
                                    source={item.userPhoto ? { uri: item.userPhoto } : require('../img/profile.png')}
                                    style={{ width: 28, height: 28, borderRadius: 14, marginRight: 10 }}
                                  />
                                  <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                      <Text style={{ color: theme.text, fontWeight: '600', marginRight: 6 }} numberOfLines={1}>
                                        {item.userName || 'User'}
                                      </Text>
                                      {item.createdAt && (
                                        <Text style={{ color: theme.text, opacity: 0.6, fontSize: 12 }}>
                                          {(() => { try { const d = item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt); return timeAgo(d); } catch { return ''; } })()}
                                        </Text>
                                      )}
                                    </View>
                                    {!!item.text && <Text style={{ color: theme.text, marginTop: 2 }}>{item.text}</Text>}
                                  </View>

                                  {canDeleteComment(item) && (
                                    <TouchableOpacity
                                      onPress={() => deleteComment(item)}
                                      style={{ paddingHorizontal: 6, paddingVertical: 4, marginLeft: 6 }}
                                      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                                    >
                                      <Ionicons name="trash-outline" size={18} color="#d32f2f" />
                                    </TouchableOpacity>
                                  )}
                                </TouchableOpacity>
                              )}
                              ListEmptyComponent={<Text style={{ color: theme.text, opacity: 0.6 }}>No comments yet.</Text>}
                            />

                            {/* Input row pinned above keyboard */}
                            <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: (Platform.OS === 'ios' ? 20 : 12), borderTopWidth: 0.5, borderTopColor: theme.border, backgroundColor: theme.background }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <TextInput
                                  value={commentText}
                                  onChangeText={setCommentText}
                                  placeholder="Write a comment..."
                                  placeholderTextColor={theme.text + '99'}
                                  style={{ flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12, color: theme.text }}
                                  multiline
                                  maxHeight={100}
                                />
                                <TouchableOpacity onPress={submitComment} style={{ marginLeft: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, backgroundColor: theme.primary }}>
                                  <Text style={{ color: theme.iconOnPrimary, fontWeight: '600' }}>Post</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          </View>
                        </KeyboardAvoidingView>
                      </TouchableWithoutFeedback>
                    </View>
                  </TouchableWithoutFeedback>
                </Modal>
              </>
            ) : (
              <View style={{ marginHorizontal: 20, marginTop: 16, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="lock-closed-outline" size={20} color={theme.text} />
                  <Text style={{ marginLeft: 8, color: theme.text, fontWeight: '700' }}>Private Club</Text>
                </View>
                <Text style={{ marginTop: 8, color: theme.text, opacity: 0.8 }}>
                  This club is private. You must be the owner or a member to view posts and events.
                </Text>
              </View>
            )}
          </>
        )}
      {/* Create Event Modal (full screen) */}
      {isOwner && (
        <Modal
          visible={isEventModalVisible}
          transparent={false}
          animationType="slide"
          onRequestClose={closeEventModal}
        >
          <ScrollView
            ref={modalScrollRef}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="on-drag"
            nestedScrollEnabled
            contentContainerStyle={[styles.eventScrollContent, { backgroundColor: theme.card }]}
          >
            <TouchableOpacity
              onPress={closeEventModal}
              style={[styles.modalCloseBtn, { backgroundColor: theme.primary }]}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Ionicons name="close" size={20} color={theme.iconOnPrimary} />
            </TouchableOpacity>
            <Text style={[styles.eventModalTitle, { color: theme.text }]}>Create Event</Text>

            <View style={styles.formRow}>
              <Text style={[styles.formLabel, { color: theme.text }]}>Title</Text>
              <TextInput
                value={newEventTitle}
                onChangeText={setNewEventTitle}
                placeholder="Event title"
                placeholderTextColor={theme.text}
                style={[styles.formInput, { color: theme.text, borderColor: theme.border }]}
              />
            </View>

            <View style={styles.formRow}>
              <Text style={[styles.formLabel, { color: theme.text }]}>Date</Text>
              <TouchableOpacity
                onPress={openDatePicker}
                onPressIn={openDatePicker}
                activeOpacity={0.7}
                style={[styles.formInput, { borderColor: theme.border, flexDirection: 'row', alignItems: 'center' }]}
              >
                <Text style={{ color: theme.text, flex: 1 }}>
                  {newEventDate || 'Select date'}
                </Text>
                {newEventDate ? (
                  <TouchableOpacity onPress={clearDate} hitSlop={{top:6,bottom:6,left:6,right:6}}>
                    <Ionicons name="close-circle" size={18} color={theme.text} />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="calendar-outline" size={18} color={theme.text} />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.formRow}>
              <Text style={[styles.formLabel, { color: theme.text }]}>Time</Text>
              <TouchableOpacity
                onPress={openTimePicker}
                onPressIn={openTimePicker}
                activeOpacity={0.7}
                style={[styles.formInput, { borderColor: theme.border, flexDirection: 'row', alignItems: 'center' }]}
              >
                <Text style={{ color: theme.text, flex: 1 }}>
                  {newEventTime || 'Select time'}
                </Text>
                {newEventTime ? (
                  <TouchableOpacity onPress={clearTime} hitSlop={{top:6,bottom:6,left:6,right:6}}>
                    <Ionicons name="close-circle" size={18} color={theme.text} />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="time-outline" size={18} color={theme.text} />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.formRow}>
              <Text style={[styles.formLabel, { color: theme.text }]}>Location</Text>
              <TextInput
                value={newEventLocation}
                onChangeText={setNewEventLocation}
                placeholder="123 Main St, or https://maps.google.com/..."
                placeholderTextColor={theme.text}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.formInput, { color: theme.text, borderColor: theme.border }]}
              />
            </View>

            <View style={styles.formRow}>
              <Text style={[styles.formLabel, { color: theme.text }]}>Description</Text>
              <TextInput
                value={newEventDescription}
                onChangeText={setNewEventDescription}
                placeholder="Optional description"
                placeholderTextColor={theme.text}
                multiline
                style={[styles.formInput, styles.formInputMultiline, { color: theme.text, borderColor: theme.border }]}
              />
            </View>

            <View style={styles.formRow}>
              <Text style={[styles.formLabel, { color: theme.text }]}>Max Attendees</Text>
              <TextInput
                value={newEventMaxAttendees}
                onChangeText={(t) => setNewEventMaxAttendees(t.replace(/[^0-9]/g, ''))}
                placeholder="e.g., 25"
                placeholderTextColor={theme.text}
                keyboardType="number-pad"
                style={[styles.formInput, { color: theme.text, borderColor: theme.border }]}
              />
            </View>

            <View style={styles.formRow}>
              <Text style={[styles.formLabel, { color: theme.text }]}>Photos</Text>
              <View style={[styles.eventPhotosBox, { borderColor: theme.border, backgroundColor: theme.background }]}>
                <View style={styles.eventPhotosGrid}>
                  {/* Add tile */}
                  <TouchableOpacity
                    onPress={handleAddEventPhoto}
                    activeOpacity={0.8}
                    style={[styles.eventPhotoTile, styles.eventPhotoAddTile, { borderColor: theme.border }]}
                  >
                    <Ionicons name="add" size={20} color={theme.text} />
                  </TouchableOpacity>

                  {/* Photo tiles */}
                  {newEventPhotos.map((uri, idx) => (
                    <View key={uri || String(idx)} style={[styles.eventPhotoTile, { borderColor: theme.border }]}>
                      <Image source={{ uri }} style={styles.eventPhotoImage} />
                      <TouchableOpacity
                        onPress={() => handleRemoveEventPhoto(uri)}
                        style={[styles.eventPhotoRemoveBtn, { backgroundColor: theme.primary }]}
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                      >
                        <Ionicons name="close" size={14} color={theme.iconOnPrimary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Auto-hide pickers if modal is closed */}
            {!isEventModalVisible && showDatePicker && setShowDatePicker(false)}
            {!isEventModalVisible && showTimePicker && setShowTimePicker(false)}

            {showDatePicker && (
              <>
                <DateTimePicker
                  value={tempDate || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                  onChange={onChangeDate}
                  themeVariant={theme.mode === 'dark' ? 'dark' : 'light'}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)} style={[styles.modalSecondaryBtn, { borderColor: theme.border }]}>
                    <Text style={[styles.modalSecondaryText, { color: theme.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={clearDate} style={[styles.modalSecondaryBtn, { borderColor: theme.border }]}>
                    <Text style={[styles.modalSecondaryText, { color: theme.text }]}>Clear</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={confirmDate} style={[styles.modalPrimaryBtn, { backgroundColor: theme.primary }]}>
                    <Text style={{ color: theme.iconOnPrimary, fontWeight: '600' }}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {showTimePicker && (
              <>
                <DateTimePicker
                  value={tempTime || new Date()}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'spinner'}
                  onChange={onChangeTime}
                  minuteInterval={1}
                  is24Hour={false}
                  themeVariant={theme.mode === 'dark' ? 'dark' : 'light'}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                  <TouchableOpacity onPress={() => setShowTimePicker(false)} style={[styles.modalSecondaryBtn, { borderColor: theme.border }]}>
                    <Text style={[styles.modalSecondaryText, { color: theme.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={clearTime} style={[styles.modalSecondaryBtn, { borderColor: theme.border }]}>
                    <Text style={[styles.modalSecondaryText, { color: theme.text }]}>Clear</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={confirmTime} style={[styles.modalPrimaryBtn, { backgroundColor: theme.primary }]}>
                    <Text style={{ color: theme.iconOnPrimary, fontWeight: '600' }}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {!showDatePicker && !showTimePicker && (
              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  onPress={closeEventModal}
                  style={[styles.modalSecondaryBtn, { borderColor: theme.border }]}
                  disabled={savingEvent}
                >
                  <Text style={[styles.modalSecondaryText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCreateEvent}
                  style={[styles.modalPrimaryBtn, { backgroundColor: theme.primary }]}
                  disabled={savingEvent}
                >
                  <Text style={{ color: theme.iconOnPrimary, fontWeight: '600' }}>
                    {savingEvent ? 'Saving...' : 'Save Event'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </Modal>
      )}
      {/* Event Details Modal */}
      <Modal
        visible={isEventDetailVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={closeEventDetail}
      >
        <View style={[styles.fullscreenEventModal, { backgroundColor: theme.card }]}>
          <TouchableOpacity
            onPress={closeEventDetail}
            style={[styles.modalCloseBtn, { backgroundColor: theme.primary }]}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Ionicons name="close" size={20} color={theme.iconOnPrimary} />
          </TouchableOpacity>
          {(() => {
            const canEdit = isOwner || (auth?.currentUser && selectedEvent && selectedEvent.createdBy === auth.currentUser.uid);
            if (!canEdit) return null;
            return !isEditingEvent ? (
              <TouchableOpacity
                onPress={startEditEvent}
                style={[styles.modalEditBtn, { backgroundColor: theme.primary }]}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              >
                <Ionicons name="create-outline" size={18} color={theme.iconOnPrimary} />
              </TouchableOpacity>
            ) : null;
          })()}

          {selectedEvent ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Title */}
              {!isEditingEvent ? (
                <Text style={[styles.eventDetailTitle, { color: theme.text }]}>
                  {selectedEvent.title || 'Event'}
                </Text>
              ) : (
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: theme.text }]}>Title</Text>
                  <TextInput
                    value={editEventTitle}
                    onChangeText={setEditEventTitle}
                    placeholder="Event title"
                    placeholderTextColor={theme.text + '99'}
                    style={[styles.formInput, { color: theme.text, borderColor: theme.border }]}
                  />
                </View>
              )}

              {/* Description */}
              {!isEditingEvent ? (
                !!selectedEvent.description && (
                  <Text style={[styles.eventDetailDesc, { color: theme.text }]}>
                    {selectedEvent.description}
                  </Text>
                )
              ) : (
                <View style={styles.formRow}>
                  <Text style={[styles.formLabel, { color: theme.text }]}>Description</Text>
                  <TextInput
                    value={editEventDescription}
                    onChangeText={setEditEventDescription}
                    placeholder="Optional description"
                    placeholderTextColor={theme.text + '99'}
                    multiline
                    style={[styles.formInput, styles.formInputMultiline, { color: theme.text, borderColor: theme.border }]}
                  />
                </View>
              )}

              {/* Meta chips / fields */}
              {!isEditingEvent ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingVertical: 2, paddingRight: 4 }}
                  style={{ marginTop: 4, marginBottom: 10 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {(() => {
                      const dateLabel = selectedEvent.dateText || (selectedEvent.dateISO ? formatDate(new Date(selectedEvent.dateISO)) : null);
                      return dateLabel ? (
                        <View style={[styles.metaChip, { backgroundColor: theme.background, borderColor: theme.border, marginRight: 8 }]}>
                          <Ionicons name="calendar-outline" size={14} color={theme.text} style={{ marginRight: 6 }} />
                          <Text style={[styles.metaChipText, { color: theme.text }]}>{dateLabel}</Text>
                        </View>
                      ) : null;
                    })()}
                    {(() => {
                      const timeLabel = selectedEvent.timeText || (selectedEvent.timeISO ? formatTime(new Date(selectedEvent.timeISO)) : null);
                      return timeLabel ? (
                        <View style={[styles.metaChip, { backgroundColor: theme.background, borderColor: theme.border, marginRight: 8 }]}>
                          <Ionicons name="time-outline" size={14} color={theme.text} style={{ marginRight: 6 }} />
                          <Text style={[styles.metaChipText, { color: theme.text }]}>{timeLabel}</Text>
                        </View>
                      ) : null;
                    })()}
                    {!!selectedEvent.location && (
                      <View style={[styles.metaChip, { backgroundColor: theme.background, borderColor: theme.border }]}>
                        <Ionicons name="location-outline" size={14} color={theme.text} style={{ marginRight: 6 }} />
                        <Text style={[styles.metaChipText, { color: theme.text }]} numberOfLines={1}>
                          {selectedEvent.location}
                        </Text>
                      </View>
                    )}
                  </View>
                </ScrollView>
              ) : (
                <>
                  {/* Date */}
                  <View style={styles.formRow}>
                    <Text style={[styles.formLabel, { color: theme.text }]}>Date</Text>
                    <TouchableOpacity
                      onPress={openEditDatePicker}
                      activeOpacity={0.7}
                      style={[styles.formInput, { borderColor: theme.border, flexDirection: 'row', alignItems: 'center' }]}
                    >
                      <Text style={{ color: theme.text, flex: 1 }}>
                        {editDateText || 'Select date'}
                      </Text>
                      {editDateText ? (
                        <TouchableOpacity onPress={clearEditDate} hitSlop={{top:6,bottom:6,left:6,right:6}}>
                          <Ionicons name="close-circle" size={18} color={theme.text} />
                        </TouchableOpacity>
                      ) : (
                        <Ionicons name="calendar-outline" size={18} color={theme.text} />
                      )}
                    </TouchableOpacity>
                  </View>
                  {/* Time */}
                  <View style={styles.formRow}>
                    <Text style={[styles.formLabel, { color: theme.text }]}>Time</Text>
                    <TouchableOpacity
                      onPress={openEditTimePicker}
                      activeOpacity={0.7}
                      style={[styles.formInput, { borderColor: theme.border, flexDirection: 'row', alignItems: 'center' }]}
                    >
                      <Text style={{ color: theme.text, flex: 1 }}>
                        {editTimeText || 'Select time'}
                      </Text>
                      {editTimeText ? (
                        <TouchableOpacity onPress={clearEditTime} hitSlop={{top:6,bottom:6,left:6,right:6}}>
                          <Ionicons name="close-circle" size={18} color={theme.text} />
                        </TouchableOpacity>
                      ) : (
                        <Ionicons name="time-outline" size={18} color={theme.text} />
                      )}
                    </TouchableOpacity>
                  </View>
                  {/* Location */}
                  <View style={styles.formRow}>
                    <Text style={[styles.formLabel, { color: theme.text }]}>Location</Text>
                    <TextInput
                      value={editEventLocation}
                      onChangeText={setEditEventLocation}
                      placeholder="123 Main St, or https://maps.google.com/..."
                      placeholderTextColor={theme.text + '99'}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={[styles.formInput, { color: theme.text, borderColor: theme.border }]}
                    />
                  </View>
                  {/* Max Attendees */}
                  <View style={styles.formRow}>
                    <Text style={[styles.formLabel, { color: theme.text }]}>Max Attendees</Text>
                    <TextInput
                      value={editEventMaxAttendees}
                      onChangeText={(t) => setEditEventMaxAttendees(t.replace(/[^0-9]/g, ''))}
                      placeholder="e.g., 25"
                      placeholderTextColor={theme.text + '99'}
                      keyboardType="number-pad"
                      style={[styles.formInput, { color: theme.text, borderColor: theme.border }]}
                    />
                  </View>
                  {/* Photos (edit) */}
                  <View style={styles.formRow}>
                    <Text style={[styles.formLabel, { color: theme.text }]}>Photos</Text>
                    <View style={[styles.eventPhotosBox, { borderColor: theme.border, backgroundColor: theme.background }]}>
                      <View style={styles.eventPhotosGrid}>
                        {/* Add tile */}
                        <TouchableOpacity
                          onPress={handleAddEditPhoto}
                          activeOpacity={0.8}
                          style={[styles.eventPhotoTile, styles.eventPhotoAddTile, { borderColor: theme.border }]}
                        >
                          <Ionicons name="add" size={20} color={theme.text} />
                        </TouchableOpacity>
                        {/* Photo tiles */}
                        {editEventPhotos.map((uri, idx) => (
                          <View key={uri || String(idx)} style={[styles.eventPhotoTile, { borderColor: theme.border }]}> 
                            <Image source={{ uri }} style={styles.eventPhotoImage} />
                            <TouchableOpacity
                              onPress={() => handleRemoveEditPhoto(uri)}
                              style={[styles.eventPhotoRemoveBtn, { backgroundColor: theme.primary }]}
                              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                            >
                              <Ionicons name="close" size={14} color={theme.iconOnPrimary} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                </>
              )}

              {showEditDatePicker && (
                <>
                  <DateTimePicker
                    value={tempEditDate || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                    onChange={onChangeEditDate}
                    themeVariant={theme.mode === 'dark' ? 'dark' : 'light'}
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                    <TouchableOpacity onPress={() => setShowEditDatePicker(false)} style={[styles.modalSecondaryBtn, { borderColor: theme.border }]}>
                      <Text style={[styles.modalSecondaryText, { color: theme.text }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={clearEditDate} style={[styles.modalSecondaryBtn, { borderColor: theme.border }]}>
                      <Text style={[styles.modalSecondaryText, { color: theme.text }]}>Clear</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={confirmEditDate} style={[styles.modalPrimaryBtn, { backgroundColor: theme.primary }]}>
                      <Text style={{ color: theme.iconOnPrimary, fontWeight: '600' }}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {showEditTimePicker && (
                <>
                  <DateTimePicker
                    value={tempEditTime || new Date()}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'spinner'}
                    onChange={onChangeEditTime}
                    minuteInterval={1}
                    is24Hour={false}
                    themeVariant={theme.mode === 'dark' ? 'dark' : 'light'}
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                    <TouchableOpacity onPress={() => setShowEditTimePicker(false)} style={[styles.modalSecondaryBtn, { borderColor: theme.border }]}>
                      <Text style={[styles.modalSecondaryText, { color: theme.text }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={clearEditTime} style={[styles.modalSecondaryBtn, { borderColor: theme.border }]}>
                      <Text style={[styles.modalSecondaryText, { color: theme.text }]}>Clear</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={confirmEditTime} style={[styles.modalPrimaryBtn, { backgroundColor: theme.primary }]}>
                      <Text style={{ color: theme.iconOnPrimary, fontWeight: '600' }}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {isEditingEvent && (
                <View style={styles.modalButtonsRow}>
                  <TouchableOpacity
                    onPress={cancelEditEvent}
                    style={[styles.modalSecondaryBtn, { borderColor: theme.border }]}
                    disabled={savingEvent}
                  >
                    <Text style={[styles.modalSecondaryText, { color: theme.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={saveEditedEvent}
                    style={[styles.modalPrimaryBtn, { backgroundColor: theme.primary }]}
                    disabled={savingEvent}
                  >
                    <Text style={{ color: theme.iconOnPrimary, fontWeight: '600' }}>
                      {savingEvent ? 'Saving...' : 'Save Changes'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Attendees section */}
              <View style={{ marginTop: 12 }}>
                {/* Attend / Unattend (non-owner) */}
                {!isOwner && selectedEvent?.id ? (
                  isAttending ? (
                    <TouchableOpacity
                      onPress={unattendSelectedEvent}
                      style={[
                        styles.modalPrimaryBtn,
                        { backgroundColor: theme.primary, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 }
                      ]}
                      activeOpacity={0.85}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="close-circle-outline" size={18} color={theme.iconOnPrimary} style={{ marginRight: 6 }} />
                        <Text style={{ color: theme.iconOnPrimary, fontWeight: '600' }}>Unattend</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={attendSelectedEvent}
                      style={[
                        styles.modalPrimaryBtn,
                        { backgroundColor: theme.primary, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 }
                      ]}
                      activeOpacity={0.85}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="checkmark-circle-outline" size={18} color={theme.iconOnPrimary} style={{ marginRight: 6 }} />
                        <Text style={{ color: theme.iconOnPrimary, fontWeight: '600' }}>Attend</Text>
                      </View>
                    </TouchableOpacity>
                  )
                ) : (
                  // Owner OR attendee – show list
                  <View>
                    <Text style={{ color: theme.text, fontWeight: '700', marginBottom: 6 }}>
                      Attendees ({attendees.length})
                    </Text>

                    {attendees.length === 0 ? (
                      <Text style={{ color: theme.text, opacity: 0.6 }}>No attendees yet.</Text>
                    ) : (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                        {attendees.map((a) => (
                          <View
                            key={a.uid}
                            style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 10 }}
                          >
                            <Image
                              source={a.photoURL ? { uri: a.photoURL } : require('../img/profile.png')}
                              style={{ width: 28, height: 28, borderRadius: 14, marginRight: 6 }}
                            />
                            <Text style={{ color: theme.text }} numberOfLines={1}>
                              {a.name}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Max Attendees – moved above Photos */}
              {!isEditingEvent && (
                (() => {
                  const maxCap = (typeof selectedEvent.maxAttendees === 'string')
                    ? parseInt(selectedEvent.maxAttendees, 10)
                    : selectedEvent.maxAttendees;
                  if (Number.isFinite(maxCap) && maxCap > 0) {
                    return (
                      <View style={{ marginTop: 16 }}>
                        <Text style={[styles.sectionHeader, { color: theme.text }]}>Max Attendees</Text>
                        <Text style={{ color: theme.text, opacity: 0.85 }}>{maxCap}</Text>
                      </View>
                    );
                  }
                  // If no limit is set, omit the section
                  return null;
                })()
              )}

              {/* Photos (if any) */}
              {Array.isArray(selectedEvent.photos) && selectedEvent.photos.length > 0 && (
                <>
                  <Text style={[styles.sectionHeader, { color: theme.text }]}>Photos</Text>
                  <View style={styles.photosGrid}>
                    {selectedEvent.photos.map((uri, idx) => (
                      <Image
                        key={idx}
                        source={{ uri }}
                        style={[styles.photoItem, { backgroundColor: theme.background }]}
                        resizeMode="cover"
                      />
                    ))}
                  </View>
                </>
              )}

              {/* Spacer at bottom */}
              <View style={{ height: 40 }} />
            </ScrollView>
          ) : (
            <Text style={{ color: theme.text }}>Loading...</Text>
          )}
        </View>
      </Modal>
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
  clubTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // marginTop and marginLeft handled inline for positioning
  },
  clubTitle: {
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
    marginBottom: 0,
    marginRight: 8,
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
  eventDetailTitle: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 10,
  },
  eventDetailDesc: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.95,
    marginBottom: 12,
  },
  metaChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 10,
    gap: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaChipText: {
    fontSize: 13,
    maxWidth: width * 0.5,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 10,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoItem: {
    width: (width - 20*2 - 8) / 2, // 2 columns within modal padding
    height: 120,
    borderRadius: 10,
    backgroundColor: '#eee',
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
  eventsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  smallCircleButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // modalBackdrop: removed
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  eventModalContainer: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    // height removed; use flex: 1 if needed elsewhere
    // height: height * 0.75,
  },
  fullscreenEventModal: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 120,
    paddingBottom: 24,
  },
  eventScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 120,
    paddingBottom: 24,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#999',
    marginBottom: 12,
  },
  eventModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  formRow: {
    marginTop: 12,
  },
  formLabel: {
    fontSize: 13,
    marginBottom: 6,
    opacity: 0.8,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    justifyContent: 'center',
  },
  formInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 18,
    gap: 12,
  },
  modalSecondaryBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  modalSecondaryText: {
    fontSize: 15,
  },
  modalPrimaryBtn: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 70,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    elevation: 4
  },
  modalEditBtn: {
    position: 'absolute',
    top: 70,
    right: 66,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    elevation: 4,
  },
  eventPhotoThumbWrap: {
    width: 70,
    height: 70,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 10,
    marginBottom: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  eventPhotoThumb: {
    width: '100%',
    height: '100%',
  },
  eventPhotoRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addEventPhotoBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  attendeeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventPhotosBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  eventPhotosContent: {
    padding: 12,
  },
  eventPhotosEmpty: {
    height: '100%',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventPhotosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  addEventPhotoInline: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  eventPhotoTile: {
    width: 72,
    height: 72,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  eventPhotoAddTile: {
    // optional: keep outline consistent; icon centered
  },
  eventPhotoImage: {
    width: '100%',
    height: '100%',
  },
  postComposerBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
  },
  popupOption: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
});
