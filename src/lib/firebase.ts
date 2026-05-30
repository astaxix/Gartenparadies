import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, enableIndexedDbPersistence } from 'firebase/firestore';
import localFirebaseConfig from '../../firebase-applet-config.json';

const metaEnv = (import.meta as any).env || {};

const isCustomProject = !!metaEnv.VITE_FIREBASE_PROJECT_ID && metaEnv.VITE_FIREBASE_PROJECT_ID !== localFirebaseConfig.projectId;

const resolvedDatabaseId = isCustomProject 
  ? (metaEnv.VITE_FIREBASE_DATABASE_ID || 'gartt')
  : localFirebaseConfig.firestoreDatabaseId;

const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || localFirebaseConfig.apiKey,
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || localFirebaseConfig.authDomain,
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || localFirebaseConfig.projectId,
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || localFirebaseConfig.storageBucket,
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || localFirebaseConfig.messagingSenderId,
  appId: metaEnv.VITE_FIREBASE_APP_ID || localFirebaseConfig.appId,
};

const app = initializeApp(firebaseConfig);
export const db = resolvedDatabaseId && resolvedDatabaseId !== 'default' && resolvedDatabaseId !== '(default)'
  ? getFirestore(app, resolvedDatabaseId)
  : getFirestore(app);

// Enable offline persistence for Firestore
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db)
    .then(() => {
      console.log('Firestore offline persistence enabled successfully.');
    })
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence failed: Multiple tabs open.');
      } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence not supported by this browser.');
      } else {
        console.warn('Firestore persistence error:', err);
      }
    });
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 8000,
  errorMsg = 'Datenbank-Timeout: Die Verbindung konnte nicht hergestellt werden. Bitte prüfe deine Internetverbindung, dein Firebase-Projekt und ob deine Firestore-Datenbank aktiv ist.'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(errorMsg)), timeoutMs)
    )
  ]);
}

// Validate connection to Firestore on initial boot and manage offline system state
export let isOffline = false;
const offlineCallbacks = new Set<(status: boolean) => void>();

export function subscribeOfflineStatus(callback: (status: boolean) => void) {
  offlineCallbacks.add(callback);
  callback(isOffline);
  return () => {
    offlineCallbacks.delete(callback);
  };
}

function setOfflineStatus(status: boolean) {
  if (isOffline !== status) {
    isOffline = status;
    offlineCallbacks.forEach(cb => cb(isOffline));
  }
}

async function testConnection() {
  try {
    await withTimeout(getDocFromServer(doc(db, 'test', 'connection')), 3500);
    setOfflineStatus(false);
  } catch (error) {
    setOfflineStatus(true);
    console.warn("Firestore connection check: Client ofline/unavailable. Standard local cache database fallbacks enabled.");
  }
}
testConnection();

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    testConnection();
  });
  window.addEventListener('offline', () => {
    setOfflineStatus(true);
  });
  if (!navigator.onLine) {
    setOfflineStatus(true);
  }
}
