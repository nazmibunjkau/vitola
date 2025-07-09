import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import axios from 'axios';

export default function Scanner({ navigation }) {
  const [hasPermission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const cameraRef = useRef(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, []);

  const handleBarCodeScanned = async ({ data }) => {
    setScanned(true);

    try {
      // Replace with your actual fetch/DB lookup logic
      const response = await fetch(`https://your-backend.com/cigars/${data}`);
      const cigar = await response.json();

      if (response.ok && cigar) {
        // Navigate to details or do something with cigar
        navigation.navigate('CigarDetail', { cigar });
      } else {
        throw new Error('Cigar not found');
      }
    } catch (error) {
      setErrorMsg('Scan failed or cigar not found.');
    } finally {
      setTimeout(() => setScanned(false), 3000); // Allow rescan after delay
    }
  };

  const processImage = async (uri) => {
  const manipResult = await ImageManipulator.manipulateAsync(uri, [], {
      base64: true,
    });
    return manipResult.base64;
  };

  const sendToGoogleVision = async (base64Image) => {
    console.log("Sending image to Google Vision API...");
    try {
      const result = await axios.post(
        'https://vision.googleapis.com/v1/images:annotate?key=AIzaSyCJKdW9w8ZPnhJBTpdnGFvS3ZODthJhf3c',
        {
          requests: [
            {
              image: { content: base64Image },
              features: [
                { type: 'LOGO_DETECTION', maxResults: 5 },
                { type: 'LABEL_DETECTION', maxResults: 5 },
                { type: 'TEXT_DETECTION', maxResults: 5 },
              ],
            },
          ],
        }
      );
      console.log("BASE64 length:", base64Image.length);
      console.log("Google Vision API response:", result.data);
      console.log("Full Vision response:", JSON.stringify(result.data, null, 2));
      return result.data.responses[0];
    } catch (error) {
      console.error("Google Vision API error:", error.response?.data || error.message);
      throw error;
    }
  };

  const findCigarByBrand = async (brandName) => {
    const q = query(collection(db, 'cigars'), where('brand', '==', brandName));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
  };

  const captureAndDetectLogo = async (cameraRef) => {
    if (!cameraRef || !isCameraReady) {
      setErrorMsg("Camera not ready yet. Please wait a moment.");
      return;
    }

    try {
      const photo = await cameraRef.takePictureAsync();
      const compressed = await ImageManipulator.manipulateAsync(
        photo.uri,
        [],
        { compress: 0.4, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      const visionResponse = await sendToGoogleVision(compressed.base64);
      const logos = visionResponse.logoAnnotations;
      const labels = visionResponse.labelAnnotations;
      const texts = visionResponse.textAnnotations;
      if (logos?.length > 0) {
        const possibleBrands = [
          ...(logos || []).map(l => l.description),
          ...(labels || []).map(l => l.description),
          ...(texts || []).map(t => t.description),
        ];

        for (const brand of possibleBrands) {
          const cigars = await findCigarByBrand(brand);
          if (cigars.length > 0) {
            navigation.navigate('CigarDetail', { cigar: cigars[0] });
            return;
          }
        }

        setErrorMsg('No matching cigar found in database.');
      } else {
        setErrorMsg('No logo detected.');
      }
    } catch (error) {
      console.error(error);
      setErrorMsg('Logo detection failed.');
    }
  };

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text>Requesting camera permission...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          onCameraReady={() => setIsCameraReady(true)}  // ✅ new handler
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          barCodeScannerSettings={{ barCodeTypes: ['ean13', 'code128', 'qr'] }}
          autofocus='on'
        />
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={BROWN} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.searchIconButton}
            onPress={() => navigation.navigate('CigarSearch')}
          >
            <Ionicons name="search" size={24} color={BROWN} />
          </TouchableOpacity>
          <View style={styles.scanBox}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            <Text style={styles.scanText}>Align cigar in the box</Text>
          </View>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.circularButton}
              onPress={() => captureAndDetectLogo(cameraRef.current)}
            >
              <Ionicons name="camera" size={32} color={BROWN} />
            </TouchableOpacity>
            {/* <TouchableOpacity
              style={styles.searchInsteadButton}
              onPress={() => navigation.navigate('Search')}
            >
              <Text style={styles.searchInsteadText}>Search Instead</Text>
            </TouchableOpacity> */}
          </View>
        </View>
      </View>

      {errorMsg && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

    </SafeAreaView>
  );
}

const BROWN = '#7b5e57';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanBox: {
    width: 250,
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 120,
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: BROWN,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderLeftWidth: 3,
    borderTopWidth: 3,
  },
  topRight: {
    top: 0,
    right: 0,
    borderRightWidth: 3,
    borderTopWidth: 3,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderLeftWidth: 3,
    borderBottomWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderRightWidth: 3,
    borderBottomWidth: 3,
  },
  scanText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
  },
  circularButton: {
    marginTop: 20,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: BROWN,
    borderWidth: 3,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BROWN,
    padding: 12,
  },
  searchText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
  },
  errorContainer: {
    padding: 10,
    backgroundColor: '#330000',
    alignItems: 'center',
  },
  errorText: {
    color: '#ffaaaa',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInsteadButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BROWN,
  },
  searchInsteadText: {
    color: BROWN,
    fontSize: 16,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  searchIconButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BROWN,
    zIndex: 10,
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BROWN,
    zIndex: 10,
  },
});