import React, { useState, useRef, useEffect } from 'react'
import { View, SafeAreaView, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert, Keyboard } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useTheme } from '../context/ThemeContext'
import { Swipeable } from 'react-native-gesture-handler'
import { format } from 'date-fns'
import { auth, db } from '../config/firebase'
import {
  collection,
  query,
  where,
  addDoc,
  doc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  orderBy,
  serverTimestamp,
  getDocs,
  getDoc,
} from 'firebase/firestore'

export default function Sessions() {
  const navigation = useNavigation()
  const { theme } = useTheme()
  const [humidor, setHumidor] = useState([])
  const [modalVisible, setModalVisible] = useState(false)
  const [humidorName, setHumidorName] = useState('')
  const [renameModalVisible, setRenameModalVisible] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const swipeableRefs = useRef(new Map())
  const [searchQuery, setSearchQuery] = useState('')
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectedHumidor, setSelectedHumidor] = useState(null)

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'users', auth.currentUser.uid, 'humidors'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const humidorsData = [];
      querySnapshot.forEach((doc) => {
        humidorsData.push({ id: doc.id, ...doc.data() });
      });
      setHumidor(humidorsData);
    });

    return () => unsubscribe();
  }, []);

  const closeSwipeable = (key) => {
    const swipeable = swipeableRefs.current.get(key)
    if (swipeable) {
      swipeable.close()
    }
  }

  const confirmDelete = async (item) => {
    Alert.alert(
      'Delete Humidor',
      `Are you sure you want to delete "${item.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const humidorRef = doc(db, 'users', auth.currentUser.uid, 'humidors', item.id);
              // Step 1: Delete cigars from the correct subcollection: humidor_cigars
              const cigarsRef = collection(db, 'users', auth.currentUser.uid, 'humidors', item.id, 'humidor_cigars');
              const snapshot = await getDocs(cigarsRef);
              const cigarDeletions = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
              await Promise.all(cigarDeletions);

              // Step 2: Delete the humidor document
              const docSnap = await getDoc(humidorRef);
              if (docSnap.exists()) {
                console.log('✅ Deleting humidor:', humidorRef.path);
                await deleteDoc(humidorRef);

                setSelectedItems((prev) => prev.filter(i => i !== item));
                if (selectedHumidor === item) setSelectedHumidor(null);
              } else {
                console.warn('❌ Humidor document not found at:', humidorRef.path);
                Alert.alert('Error', 'Humidor not found in database.');
              }
            } catch (error) {
              console.error('❌ Failed to delete humidor and cigars:', error);
              Alert.alert('Error', 'Failed to delete humidor. Please try again.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleDelete = (item) => {
    closeSwipeable(item.title)
    confirmDelete(item)
  }

  const handleRename = async () => {
    if (!renameValue.trim()) {
      Alert.alert('Name Required', 'Please enter a humidor name.')
      return
    }
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid, 'humidors', selectedHumidor.id), {
        title: renameValue.trim(),
      });
      setRenameValue('')
      setSelectedHumidor(null)
      setRenameModalVisible(false)
      setSelectedItems([]);
      setSelectionMode(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to rename humidor. Please try again.')
    }
  }

  const renderRightActions = (item) => (
    <TouchableOpacity
      style={[styles.deleteButton, { backgroundColor: '#ff3b30' }]}
      onPress={() => handleDelete(item)}
    >
      <Ionicons name="trash" size={24} color="#fff" />
      <Text style={styles.deleteButtonText}>Delete</Text>
    </TouchableOpacity>
  )

  const renderHumidor = ({ item, index }) => (
    <Swipeable
      ref={(ref) => {
        if (ref && item.title) {
          swipeableRefs.current.set(item.title, ref)
        }
      }}
      renderRightActions={() => renderRightActions(item)}
      onSwipeableWillOpen={() => setSelectedHumidor(item)}
      enabled={!selectionMode}
    >
      <TouchableOpacity
        onPress={() => navigation.navigate('HumidorAdditions', {
          humidorId: item.id,
          humidorTitle: item.title,
          createdAt: item.createdAt?.toDate?.() || null,
          userId: auth.currentUser.uid
        })}
        activeOpacity={0.7}
      >
        <View style={[styles.humidorCard, { backgroundColor: theme.primary, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {selectionMode && (
              <TouchableOpacity onPress={() => {
                const alreadySelected = selectedItems.includes(item);
                setSelectedItems(alreadySelected
                  ? selectedItems.filter(i => i !== item)
                  : [...selectedItems, item]);
              }}>
                <Ionicons
                  name={selectedItems.includes(item) ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={theme.accent}
                  style={{ marginRight: 10 }}
                />
              </TouchableOpacity>
            )}
            <View>
              <Text style={[styles.humidorTitle, { color: theme.accent }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.humidorDate, { color: theme.accent }]}>
                {item.createdAt && item.createdAt.toDate ? format(item.createdAt.toDate(), 'PPP p') : ''}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color={theme.accent} />
        </View>
      </TouchableOpacity>
    </Swipeable>
  )

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginTop: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: theme.text }}>
          My Humidors
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => {}}
            style={{
              backgroundColor: theme.accent,
              borderRadius: 20,
              padding: 6,
              marginRight: 10,
              borderWidth: 1,
              borderColor: theme.primary,
            }}
          >
            <Ionicons name="filter" size={18} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setSelectionMode(!selectionMode);
              setSelectedItems([]);
            }}
            style={{
              backgroundColor: theme.accent,
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: theme.primary,
            }}
          >
            <Text style={{ color: theme.primary, fontWeight: 'bold' }}>
              {selectionMode ? 'Cancel' : 'Select'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 8,
        margin: 16,
        paddingHorizontal: 10,
        backgroundColor: theme.accent,
      }}>
        <Ionicons name="search-outline" size={20} color={theme.primary} />
        <TextInput
          style={{ flex: 1, height: 40, marginLeft: 8, color: theme.text }}
          placeholder="Search Humidors..."
          placeholderTextColor={theme.placeholder}
          onChangeText={setSearchQuery}
          value={searchQuery}
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#B71C1C" />
          </TouchableOpacity>
        )}
      </View>
      {humidor.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.placeholder }]}>
            No humidors created yet. Tap + to add one!
          </Text>
        </View>
      ) : (
        <FlatList
          data={humidor.filter(h => h.title.toLowerCase().includes(searchQuery.toLowerCase()))}
          keyExtractor={(item) => item.id}
          renderItem={renderHumidor}
          contentContainerStyle={{ paddingTop: 20, paddingBottom: selectionMode && selectedItems.length > 0 ? 220 : 100 }}
        />
      )}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="add" size={32} color={theme.iconOnPrimary} />
      </TouchableOpacity>

      {selectionMode && selectedItems.length > 0 && (
        <View style={{
          position: 'absolute',
          bottom: 100,
          left: 16,
          right: 16,
          flexDirection: 'row',
          justifyContent: 'space-between',
          backgroundColor: theme.accent,
          paddingVertical: 16,
          paddingHorizontal: 20,
          borderRadius: 12,
          elevation: 3,
        }}>
          <TouchableOpacity onPress={() => {
            setSelectedHumidor(selectedItems[0]);
            setRenameValue(selectedItems[0].title);
            setRenameModalVisible(true);
          }}>
            <Text style={{ color: theme.primary, fontWeight: 'bold', fontSize: 16 }}>Rename</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => {
            selectedItems.forEach(item => confirmDelete(item));
            setSelectionMode(false);
            setSelectedItems([]);
          }}>
            <Text style={{ color: '#ff3b30', fontWeight: 'bold', fontSize: 16 }}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Add Humidor Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.accent }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Enter Humidor Name</Text>
            <TextInput
              style={[styles.modalInput, { borderColor: theme.border, color: theme.text }]}
              placeholder="Humidor Name"
              placeholderTextColor={theme.placeholder}
              value={humidorName}
              onChangeText={setHumidorName}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={[styles.modalButton, { backgroundColor: '#ccc' }]}>
                <Text style={{ fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (!humidorName.trim()) {
                    Alert.alert('Name Required', 'Please enter a humidor name.')
                    return
                  }
                  try {
                    // Create the new humidor document
                    const docRef = await addDoc(collection(db, 'users', auth.currentUser.uid, 'humidors'), {
                      title: humidorName.trim(),
                      createdAt: serverTimestamp(),
                      humidor_status: 'active',
                    });
                    // Create the humidor_cigars subcollection with a placeholder doc
                    await addDoc(collection(docRef, 'humidor_cigars'), {
                      placeholder: true,
                    });
                    setHumidorName('')
                    setModalVisible(false)
                  } catch (error) {
                    Alert.alert('Error', 'Failed to create humidor. Please try again.')
                  }
                }}
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
              >
                <Text style={{ color: theme.iconOnPrimary, fontSize: 16 }}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rename Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={renameModalVisible}
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.accent }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Rename Humidor</Text>
            <TextInput
              style={[styles.modalInput, { borderColor: theme.border, color: theme.text }]}
              placeholder="New Humidor Name"
              placeholderTextColor={theme.placeholder}
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setRenameModalVisible(false)} style={[styles.modalButton, { backgroundColor: '#ccc' }]}>
                <Text style={{ fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRename}
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
              >
                <Text style={{ color: theme.iconOnPrimary, fontSize: 16 }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontStyle: 'italic',
  },
  humidorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 16,
    elevation: 3,
    minHeight: 120,
  },
  humidorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  humidorDate: {
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    padding: 20,
    borderRadius: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 24,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginVertical: 12,
    borderRadius: 16,
  },
  deleteButtonText: {
    color: '#fff',
    marginTop: 4,
    fontWeight: 'bold',
  },
})