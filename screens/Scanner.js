import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform, ActivityIndicator, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

import * as ImageManipulator from 'expo-image-manipulator';
import { db } from '../config/firebase';
import { collection, query, where, getDocs, limit, orderBy, startAt, endAt } from 'firebase/firestore';

// NOTE: This screen calls Google Cloud Vision directly from the client.
// Be sure to restrict the API key in Google Cloud Console to:
// - APIs: Vision API only
// - Application restrictions: iOS bundle ID and Android package + SHA-1/256 fingerprints.
// Without restrictions, anyone who extracts your APK/IPA could abuse the key.

const BROWN = '#4b382a';
const OVERLAY_BG = 'rgba(0,0,0,0.55)';
const TIMEOUT_MS = 12000; // fail fast so user can retry/open search



// Debug toggle for logging what we send/receive with Vision
const DEBUG_VISION = true;
const dlog = (...args) => { if (DEBUG_VISION) console.log('[Scanner][Vision]', ...args); };
const VISION_URL_LOG = 'https://vision.googleapis.com/v1/images:annotate?key=***redacted***';

// ⚠️ Direct-to-Google Vision (no backend). Restrict this key in GCP (API restrictions: Vision, and app restrictions for iOS bundle ID / Android SHA + package).

const VISION_API_KEY = 'AIzaSyCJKdW9w8ZPnhJBTpdnGFvS3ZODthJhf3c';
const VISION_URL = `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`;

// --- cancellation + concurrency guard ---
// We keep a mutable ref with an AbortController and an operation sequence id.
// Any async step checks the current opSeq; if it changed (or cancelled), bail early.
const opState = { controller: null, opSeq: 0, cancelled: false };

const withTimeout = (promiseFactory, ms = TIMEOUT_MS, label = 'operation', signal) => {
  let id;
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener('abort', onAbort, { once: true });
    }
    id = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(new Error(`${label} timed out`));
    }, ms);
    Promise.resolve()
      .then(promiseFactory)
      .then(val => {
        if (signal) signal.removeEventListener('abort', onAbort);
        clearTimeout(id);
        resolve(val);
      })
      .catch(err => {
        if (signal) signal.removeEventListener('abort', onAbort);
        clearTimeout(id);
        reject(err);
      });
  });
};

// Helpers to normalize OCR text to a brand-like string
const normalizeBrand = (s) => {
  if (!s) return '';
  // collapse newlines/spaces, remove extra punctuation, title-case words
  const compact = s
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^A-Za-z0-9 &'-]/g, '')
    .trim();
  return compact
    .split(' ')
    .filter(Boolean)
    .map(w => w.length > 2 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toUpperCase())
    .join(' ');
};


// Convert a /cigars doc into the shape CigarDetails expects
const cigarDocToCigar = (id, data) => ({
  id: data.id || id,
  name: data.name || '',
  manufacturer: data.manufacturer || '',
  origin: data.origin || '',
  wrapper: data.wrapper || '',
  strength: data.strength || '',
  binder: data.binder || '',
  filler: data.filler || '',
  vitola: data.vitola || '',
  pressed: data.pressed || '',
  sweet: data.sweet || '',
  flavored: data.flavored || '',
  rolled_by: data.rolled_by || '',
  description: data.description || '',
  image_url: data.image_url || '',
  rating: (typeof data.rating === 'string') ? data.rating : (data.rating || 0),
  review_count: (typeof data.review_count === 'string') ? data.review_count : (data.review_count || 0),
  brand: data.brand || '',
  source: data.source || ''
});

// Tokenize OCR text into meaningful words (>=2 chars), upper-case for uniformity
const tokensFromText = (s) => (s || '')
  .replace(/\n+/g, ' ')
  .split(/\s+/)
  .map(t => t.replace(/[^A-Za-z0-9'-]/g, ''))
  .filter(t => t.length >= 2) // allow 2+ to keep brand particles like "La", "De"
  .map(t => t.toUpperCase());

// Simple score: number of tokens present in the candidate brand/name
const scoreCandidate = (candStr, ocrTokens) => {
  const hay = (candStr || '').toUpperCase();
  let score = 0;
  for (const tk of ocrTokens) {
    if (hay.includes(tk)) score += 1;
  }
  return score;
};

// Boost when OCR phrase appears contiguously in string
const contiguousBoost = (hay, needle) => {
  const i = hay.toUpperCase().indexOf(needle.toUpperCase());
  if (i === -1) return 0;
  // longer contiguous matches get exponentially more weight
  return Math.pow(needle.length, 2);
};

// Try splitting first N tokens as brand, rest as variant/model (e.g., HENRY|CLAY + WAR|HAWK)
const brandVariantSplits = (ocrTokens) => {
  const out = [];
  const maxBrandTokens = Math.min(3, ocrTokens.length - 1); // at least 1 token left for variant
  for (let n = 1; n <= maxBrandTokens; n++) {
    const brand = ocrTokens.slice(0, n).join(' ');
    const variant = ocrTokens.slice(n);
    out.push({ brand, variant });
  }
  return out;
};


// --- Resolve against root /cigars collection as well ---
const resolveInCigars = async (brandOrText) => {
  const qStr = normalizeBrand(brandOrText);
  if (!qStr) return null;
  const ocrTokens = tokensFromText(brandOrText);
  const titleCase = qStr;              // e.g., "Henry Clay War Hawk"
  const lower = qStr.toLowerCase();    // e.g., "henry clay war hawk"

  // 0) Strong contiguous full-phrase exacts first
  let snap = await getDocs(query(collection(db, 'cigars'), where('name', '==', titleCase), limit(1)));
  if (!snap.empty) { const d = snap.docs[0]; return cigarDocToCigar(d.id, d.data()); }

  snap = await getDocs(query(collection(db, 'cigars'), where('name_insensitive', '==', lower), limit(1)));
  if (!snap.empty) { const d = snap.docs[0]; return cigarDocToCigar(d.id, d.data()); }

  // 1) Brand + variant: try treating the first 1–3 tokens as brand and the rest as variant
  const splits = brandVariantSplits(ocrTokens);
  for (const split of splits) {
    try {
      const brandTitle = split.brand.split(' ').map(w => w[0] + w.slice(1).toLowerCase()).join(' ');
      const brandSnap = await getDocs(query(collection(db, 'cigars'), where('brand', '==', brandTitle), limit(25)));
      if (!brandSnap.empty) {
        const cs = [];
        brandSnap.forEach(doc => cs.push({ id: doc.id, data: doc.data() }));
        const best = cs.map(c => {
          const n = c.data.name || '';
          const ni = c.data.name_insensitive || '';
          // score is: contiguous match on the variant phrase + token overlap
          const variantPhrase = split.variant.join(' ');
          const base = Math.max(
            contiguousBoost(n, variantPhrase),
            contiguousBoost(ni, variantPhrase)
          );
          const overlap = Math.max(
            scoreCandidate(n, split.variant),
            scoreCandidate(ni.toUpperCase(), split.variant)
          );
          return { ...c, score: base + overlap };
        }).sort((a,b) => b.score - a.score);
        if (best[0] && best[0].score > 0) {
          dlog('Brand+variant picked from /cigars', { brand: brandTitle, id: best[0].id, name: best[0].data.name, score: best[0].score });
          return cigarDocToCigar(best[0].id, best[0].data);
        }
      }
    } catch {}
  }

  // 2) Prefix fuzzy on name, brand, and name_insensitive (keep small, then score)
  const prefixesTitle = ocrTokens.slice(0, 3).map(t => t[0] + t.slice(1).toLowerCase());
  const prefixesLower = ocrTokens.slice(0, 3).map(t => t.toLowerCase());
  const candidates = [];

  const qPref = async (field, pref, lim = 10) => {
    const s = query(collection(db, 'cigars'), orderBy(field), startAt(pref), endAt(pref + '\uf8ff'), limit(lim));
    return getDocs(s);
  };

  for (const pref of prefixesTitle) {
    try { (await qPref('name', pref)).forEach(doc => candidates.push({ id: doc.id, data: doc.data() })); } catch {}
    try { (await qPref('brand', pref)).forEach(doc => candidates.push({ id: doc.id, data: doc.data() })); } catch {}
  }
  for (const pref of prefixesLower) {
    try { (await qPref('name_insensitive', pref)).forEach(doc => candidates.push({ id: doc.id, data: doc.data() })); } catch {}
  }

  if (candidates.length) {
    const byId = new Map();
    for (const c of candidates) byId.set(c.id, c);
    const uniq = Array.from(byId.values());
    const ocrPhrase = ocrTokens.join(' ');
    const scored = uniq.map(c => {
      const n = c.data.name || '';
      const b = c.data.brand || '';
      const ni = c.data.name_insensitive || '';
      const overlap = Math.max(
        scoreCandidate(n, ocrTokens),
        scoreCandidate(b, ocrTokens),
        scoreCandidate((ni || '').toUpperCase(), ocrTokens)
      );
      const contig = Math.max(
        contiguousBoost(n, ocrPhrase),
        contiguousBoost(ni, ocrPhrase)
      );
      return { ...c, score: contig + overlap };
    }).sort((a,b) => b.score - a.score);
    if (scored[0] && scored[0].score > 0) {
      dlog('Fuzzy picked from /cigars', { id: scored[0].id, name: scored[0].data.name, brand: scored[0].data.brand, score: scored[0].score });
      return cigarDocToCigar(scored[0].id, scored[0].data);
    }
  }

  return null;
};

const resolveToCigar = async (brandOrText) => {
  const qStr = normalizeBrand(brandOrText);
  if (!qStr) return null;
  dlog('Resolving brand/text to cigar (cigars-only)', qStr);

  try {
    // 1) exact + insensitive + fuzzy inside /cigars
    const exact = await resolveInCigars(qStr);
    if (exact) return exact;

    // 2) Fallback: try the raw OCR string (may include multiple tokens)
    const fuzzy = await resolveInCigars(brandOrText);
    if (fuzzy) return fuzzy;

    dlog('No exact/fuzzy match in /cigars for', qStr);
    return null;
  } catch (err) {
    if (err?.code === 'permission-denied') {
      throw err;
    }
    console.error('[Scanner][Vision] resolveToCigar failed', err);
    return null;
  }
};

const buildTextCandidates = (rawText) => {
  if (!rawText) return [];
  const lines = rawText
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  const joinedAll = normalizeBrand(lines.join(' '));
  const joinedTop2 = normalizeBrand(lines.slice(0, 2).join(' '));
  const longest = normalizeBrand(lines.slice().sort((a,b) => b.length - a.length)[0] || '');

  // Keep order of preference: full phrase, top2, longest, then individual lines
  const ordered = [joinedAll, joinedTop2, longest, ...lines.map(normalizeBrand)];
  const seen = new Set();
  return ordered.filter(x => x && !seen.has(x) && seen.add(x));
};

export default function Scanner({ navigation }) {
  const [hasPermission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stageText, setStageText] = useState('');
  const cameraRef = useRef(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [barcodeCooldown, setBarcodeCooldown] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const cancelRef = useRef({ controller: null, opSeq: 0, cancelled: false });
  const stageTimeoutRef = useRef(null);

  const beginOp = () => {
    // bump operation sequence; create a fresh controller; clear cancelled
    const next = (cancelRef.current.opSeq || 0) + 1;
    const controller = new AbortController();
    cancelRef.current = { controller, opSeq: next, cancelled: false };
    return next;
  };

  // Guarded navigation helper: only allows navigation if this scan op is still the latest and not cancelled
  const safeNavigate = React.useCallback((seq, screen, params = {}) => {
    if (cancelRef.current.cancelled || seq !== cancelRef.current.opSeq) {
      dlog('safeNavigate blocked (cancelled or stale op)', { seqTried: seq, currentSeq: cancelRef.current.opSeq });
      return;
    }
    navigation.navigate(screen, params);
  }, [navigation]);

  const cancelScan = () => {
    try {
      // mark current op as cancelled and *advance* the sequence to invalidate any pending work
      const nextSeq = (cancelRef.current.opSeq || 0) + 1;
      cancelRef.current.cancelled = true;
      cancelRef.current.opSeq = nextSeq;
      if (cancelRef.current.controller) {
        cancelRef.current.controller.abort();
        cancelRef.current.controller = null;
      }
    } catch {}
    if (stageTimeoutRef.current) {
      clearTimeout(stageTimeoutRef.current);
      stageTimeoutRef.current = null;
    }
    setIsProcessing(false);
    setStageText('');
    setErrorMsg(null);
    // Suppress barcode handler briefly so cancel cannot accidentally trigger a search via barcode
    try {
      setBarcodeCooldown(true);
      setTimeout(() => setBarcodeCooldown(false), 2000);
    } catch {}
    // Stay on the camera view; do not navigate.
  };

  useEffect(() => {
    if (!hasPermission) { requestPermission(); }
  }, []);

  const handleBarCodeScanned = async ({ data }) => {
    if (isProcessing) return; // don't allow barcode nav during a scan op
    setScanned(true);
    try {
      navigation.navigate('CigarSearch', { prefFill: data });
    } finally {
      setTimeout(() => setScanned(false), 1500);
    }
  };

  const openSearch = (seq, prefFill = '', ocrClues = '') => {
    // If this call belongs to a cancelled or stale operation, do nothing
    if (cancelRef.current.cancelled || (typeof seq !== 'undefined' && seq !== cancelRef.current.opSeq)) {
      dlog('openSearch blocked (cancelled or stale op)', { seqTried: seq, currentSeq: cancelRef.current.opSeq });
      return;
    }
    try { setErrorMsg(null); } catch {}
    safeNavigate(seq, 'CigarSearch', { prefFill, ocrClues, fromScan: true });
  };

  const sendToVision = async (base64Image, signal) => {
    const features = [
      { type: 'LOGO_DETECTION', maxResults: 10 },
      { type: 'TEXT_DETECTION', maxResults: 10 }
    ];
    const payload = {
      requests: [
        {
          image: { content: base64Image },
          features
        }
      ]
    };

    // Debug: log what we are about to send (without exposing API key)
    dlog('Prepared Vision payload', {
      features,
      imageBytes: base64Image ? base64Image.length : 0,
      approxKB: base64Image ? Math.round((base64Image.length * 3) / 4 / 1024) : 0
    });

    dlog('POST', VISION_URL_LOG);

    try {
      const res = await withTimeout(
        () => fetch(VISION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal
        }),
        TIMEOUT_MS,
        'Vision API request',
        signal
      );

      const text = await res.text();
      dlog('Vision raw status', res.status);
      if (!res.ok) {
        dlog('Vision non-200 body (truncated)', text?.slice(0, 500));
        throw new Error(`Vision API ${res.status}`);
      }

      let json;
      try { json = JSON.parse(text); } catch (_) {
        dlog('Vision parse error body (truncated)', text?.slice(0, 500));
        throw new Error('Vision parse error');
      }

      const resp = (json.responses && json.responses[0]) || {};
      const logos = resp.logoAnnotations || [];
      const textAnn = resp.textAnnotations || [];
      dlog('Vision parsed', {
        logoCount: logos.length,
        topLogos: logos.slice(0, 3).map(l => ({ description: l.description, score: l.score, mid: l.mid })),
        textChars: textAnn.length ? (textAnn[0].description || '').length : 0,
        textSample: textAnn.length ? (textAnn[0].description || '').slice(0, 120) : ''
      });

      const candidates = logos.map(l => ({ brand: l.description, score: l.score, mid: l.mid }));
      const clues = textAnn.length ? textAnn[0].description : '';

      return { candidates, clues, raw: resp };
    } catch (err) {
      console.error('[Scanner][Vision] call failed:', err);
      throw err;
    }
  };

  const captureAndDetectLogo = async (cam) => {
    if (!cam || !isCameraReady) { setErrorMsg('Camera not ready yet.'); return; }
    const mySeq = beginOp();
    const isStale = () => cancelRef.current.cancelled || mySeq !== cancelRef.current.opSeq;
    setErrorMsg(null);
    dlog('captureAndDetectLogo invoked. Camera ready?', isCameraReady);
    setIsProcessing(true);
    setStageText('Capturing…');
    try {
      const photo = await cam.takePictureAsync();
      if (isStale()) { dlog('Scan cancelled/stale — exiting early'); return; }
      dlog('Captured photo', { width: photo?.width, height: photo?.height, uri: photo?.uri });
      setStageText('Optimizing image…');
      const compressed = await ImageManipulator.manipulateAsync(photo.uri, [], { compress: 0.45, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      if (isStale()) { dlog('Scan cancelled/stale — exiting early'); return; }
      dlog('Compressed image', { approxKB: compressed?.base64 ? Math.round((compressed.base64.length * 3) / 4 / 1024) : 0 });
      setStageText('Analyzing band…');
      const out = await sendToVision(compressed.base64, cancelRef.current.controller?.signal);
      if (isStale()) { dlog('Scan cancelled/stale — exiting early'); return; }
      setStageText('Matching in database…');
      const best = (out.candidates || [])[0];
      if (best) {
        dlog('Logo match found', best);
        const cigarObj = await resolveToCigar(best.brand || best.description || '');
        if (isStale()) { dlog('Scan cancelled/stale — exiting early'); return; }
        if (cigarObj) {
          setIsProcessing(false);
          setStageText('');
          setErrorMsg(null);
          safeNavigate(mySeq, 'CigarDetails', { cigar: cigarObj });
        } else {
          setIsProcessing(false);
          setStageText('');
          openSearch(mySeq, best.brand || '', out.clues);
          setErrorMsg('Matched a logo, but couldn\'t map it to a cigar record. Opened search instead.');
        }
      } else if (out.clues && out.clues.trim().length) {
        const candidates = buildTextCandidates(out.clues);
        dlog('No logo match; OCR candidates (brand+variant aware)', candidates);
        let resolved = null; let tried = [];
        try {
          for (const cand of candidates) {
            tried.push(cand);
            // eslint-disable-next-line no-await-in-loop
            const cig = await resolveToCigar(cand);
            if (isStale()) { dlog('Scan cancelled/stale — exiting early'); return; }
            if (cig) { resolved = cig; break; }
          }
        } catch (err) {
          if (err?.code === 'permission-denied') {
            setIsProcessing(false);
            setStageText('');
            setErrorMsg('Scanner cannot read band database (permission-denied). Check Firestore rules for /cigars.');
            // still fall back to search UI with best guess
            const bestGuess = candidates[0] || '';
            openSearch(mySeq, bestGuess, out.clues);
            return;
          }
          // Unknown error—show a generic message and fall back
          console.error('[Scanner][Vision] resolveToCigar unexpected fail', err);
        }

        if (resolved) {
          setIsProcessing(false);
          setStageText('');
          setErrorMsg(null);
          safeNavigate(mySeq, 'CigarDetails', { cigar: resolved });
        } else {
          setIsProcessing(false);
          setStageText('');
          const bestGuess = candidates[0] || '';
          openSearch(mySeq, bestGuess, out.clues);
          setErrorMsg('No matching brand from logo — tried OCR text and opened search for you.');
        }
      } else {
        dlog('No logo or meaningful text found');
        setIsProcessing(false);
        setStageText('');
        setErrorMsg('No matching brand found yet. Try again with a clearer band image or open search.');
      }
    } catch (e) {
      setIsProcessing(false);
      setStageText('');
      const msg = e?.message || 'Scan failed';
      if (e?.name === 'AbortError' || /aborted/i.test(msg)) {
        dlog('Scan aborted by user.');
        return;
      }
      if (/timed out/i.test(msg)) {
        setErrorMsg('Scanning took too long. Please try again, move closer, or open search.');
      } else if (/Network request failed/i.test(msg)) {
        setErrorMsg('Network error while contacting Vision. Check your connection and try again.');
      } else {
        setErrorMsg(msg.includes('permission') ?
          'Permission error. Check camera access and Firestore rules.' :
          `${msg}. Check network & permissions.`);
      }
    }
  };

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.centered}><Text>Requesting camera permission...</Text></SafeAreaView>
    );
  }

  dlog('Scanner mounted. Vision direct-call mode enabled. (Logs visible in Metro console)');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          onCameraReady={() => setIsCameraReady(true)}
          onBarCodeScanned={
            !isProcessing && !barcodeCooldown && !cancelRef.current.cancelled && !scanned ? handleBarCodeScanned : undefined
          }
          barCodeScannerSettings={{ barCodeTypes: ['ean13', 'code128', 'qr'] }}
          autofocus='on'
          enableTorch={torchOn}
        />
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={BROWN} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.flashButton} onPress={() => setTorchOn(t => !t)}>
            <Ionicons name={torchOn ? 'flash' : 'flash-outline'} size={22} color={BROWN} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.searchIconButton} onPress={() => navigation.navigate('CigarSearch')}>
            <Ionicons name="search" size={24} color={BROWN} />
          </TouchableOpacity>
          <View style={styles.scanBox}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <View style={styles.scanNote}>
            <Text style={styles.scanNoteText}>Align cigar band in the box</Text>
          </View>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={[styles.circularButton, isProcessing && { opacity: 0.5 }]} disabled={isProcessing} onPress={() => captureAndDetectLogo(cameraRef.current)}>
              <Ionicons name="camera" size={32} color={BROWN} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {isProcessing && (
        <View style={styles.processingOverlay} pointerEvents="auto">
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" />
            <Text style={styles.processingText}>{stageText || 'Working…'}</Text>
            <View style={styles.processingButtons}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={cancelScan}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  cancelScan();
                  // Intentionally bypass safeNavigate: user explicitly wants to open Search now.
                  navigation.navigate('CigarSearch', { fromScan: true });
                }}
              >
                <Text style={styles.primaryBtnText}>Open Search</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {errorMsg && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <View style={{ marginTop: 8, flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity style={styles.secondaryBtnSmall} onPress={() => setErrorMsg(null)}>
              <Text style={styles.secondaryBtnText}>Dismiss</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryBtnSmall}
              onPress={() => navigation.navigate('CigarSearch', { fromScan: true })}
            >
              <Text style={styles.primaryBtnText}>Go to Search</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  scanBox: { width: 250, height: 250, justifyContent: 'center', alignItems: 'center', marginBottom: 28 },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#fff' },
  topLeft: { top: 0, left: 0, borderLeftWidth: 3, borderTopWidth: 3 },
  topRight: { top: 0, right: 0, borderRightWidth: 3, borderTopWidth: 3 },
  bottomLeft: { bottom: 0, left: 0, borderLeftWidth: 3, borderBottomWidth: 3 },
  bottomRight: { bottom: 0, right: 0, borderRightWidth: 3, borderBottomWidth: 3 },
  scanText: { color: '#fff', fontSize: 16, marginTop: 10 },
  scanNote: { marginTop: 6, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  scanNoteText: { color: '#fff', fontSize: 16, textAlign: 'center' },
  circularButton: { marginTop: 20, width: 70, height: 70, borderRadius: 35, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderColor: BROWN, borderWidth: 3 },
  errorContainer: { padding: 10, backgroundColor: '#330000', alignItems: 'center' }, // keep existing bg
  errorText: { color: '#ffaaaa', textAlign: 'center' }, // ensure centered
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  buttonContainer: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
  searchIconButton: { position: 'absolute', top: 40, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: BROWN, zIndex: 10 },
  backButton: { position: 'absolute', top: 40, left: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: BROWN, zIndex: 10 },
  processingOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: OVERLAY_BG, justifyContent: 'center', alignItems: 'center' },
  processingCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, width: 260, alignItems: 'center' },
  processingText: { marginTop: 12, fontSize: 16, color: '#333', textAlign: 'center' },
  processingButtons: { marginTop: 16, flexDirection: 'row' },
  primaryBtn: { backgroundColor: BROWN, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginLeft: 8 },
  primaryBtnSmall: { backgroundColor: BROWN, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  primaryBtnText: { color: '#fff', fontWeight: '600' },
  secondaryBtn: { backgroundColor: '#eee', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginRight: 8 },
  secondaryBtnSmall: { backgroundColor: '#eee', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  secondaryBtnText: { color: '#333', fontWeight: '600' },
  flashButton: { position: 'absolute', top: 40, right: 74, width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: BROWN, zIndex: 10 },
});