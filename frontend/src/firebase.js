import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';

// Read config from Vite environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.apiKey.length > 10 && firebaseConfig.projectId
);

let app = null;
let auth = null;
let googleProvider = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
  } catch (err) {
    console.warn("Firebase Auth setup note:", err);
  }
}

/**
 * Signs in using Google via Firebase Popup (or local Google Session simulation if keys not in .env)
 */
export async function signInWithGoogle() {
  if (isFirebaseConfigured && auth && googleProvider) {
    const result = await signInWithPopup(auth, googleProvider);
    return {
      uid: result.user.uid,
      displayName: result.user.displayName || "Google User",
      email: result.user.email,
      photoURL: result.user.photoURL
    };
  }

  // Developer / Quick Local Google Session fallback
  const mockUser = {
    uid: "google_user_" + (localStorage.getItem("lumen_local_uid") || Math.random().toString(36).substring(2, 10)),
    displayName: localStorage.getItem("lumen_local_name") || "Google Account",
    email: localStorage.getItem("lumen_local_email") || "user@gmail.com",
    photoURL: "https://lh3.googleusercontent.com/a/default-user=s96-c"
  };
  localStorage.setItem("lumen_local_uid", mockUser.uid);
  localStorage.setItem("lumen_auth_user", JSON.stringify(mockUser));
  return mockUser;
}

/**
 * Signs out the current user
 */
export async function logOut() {
  if (isFirebaseConfigured && auth) {
    await signOut(auth);
  }
  localStorage.removeItem("lumen_auth_user");
}

/**
 * Listens to auth state changes
 */
export function subscribeToAuth(callback) {
  if (isFirebaseConfigured && auth) {
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        callback({
          uid: user.uid,
          displayName: user.displayName || "Google User",
          email: user.email,
          photoURL: user.photoURL
        });
      } else {
        callback(null);
      }
    });
  }

  // Check stored session
  const stored = localStorage.getItem("lumen_auth_user");
  if (stored) {
    try {
      callback(JSON.parse(stored));
    } catch {
      callback(null);
    }
  } else {
    callback(null);
  }
  return () => {};
}
