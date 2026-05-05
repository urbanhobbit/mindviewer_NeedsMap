import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, query, orderBy, getDocs, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Check if basic config exists to allow fallback to local mode if not configured yet
export const isFirebaseConfigured = !!firebaseConfig.projectId;

let app;
let db;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}

// ------------------------------------
// DB Helper Functions
// ------------------------------------

export const saveMapToDB = async (mapId, data) => {
  if (!isFirebaseConfigured) return;
  const mapRef = doc(db, 'maps', mapId);
  await setDoc(mapRef, { data, updatedAt: new Date().toISOString() });
};

export const loadMapFromDB = async (mapId) => {
  if (!isFirebaseConfigured) return null;
  const mapRef = doc(db, 'maps', mapId);
  const snap = await getDoc(mapRef);
  if (snap.exists()) {
    return snap.data().data;
  }
  return null;
};

export const saveRevisionToDB = async (mapId, revision) => {
  if (!isFirebaseConfigured) return;
  const revisionsRef = collection(db, 'maps', mapId, 'revisions');
  await addDoc(revisionsRef, revision);
};

export const loadRevisionsFromDB = async (mapId) => {
  if (!isFirebaseConfigured) return [];
  const revisionsRef = collection(db, 'maps', mapId, 'revisions');
  const q = query(revisionsRef, orderBy('timestamp', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Returns an unsubscribe function to stop listening
export const subscribeToMapChanges = (mapId, callback) => {
  if (!isFirebaseConfigured) return () => {};
  const mapRef = doc(db, 'maps', mapId);
  return onSnapshot(mapRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data().data);
    }
  });
};

export const subscribeToRevisions = (mapId, callback) => {
  if (!isFirebaseConfigured) return () => {};
  const revisionsRef = collection(db, 'maps', mapId, 'revisions');
  const q = query(revisionsRef, orderBy('timestamp', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const revisions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(revisions);
  });
};
