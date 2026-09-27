// TW&D Firebase configuration
// Replace every placeholder below with the Firebase Web App configuration
// from Firebase Console > Project settings > Your apps > Web app.
//
// IMPORTANT: This file contains client configuration, not a Firebase Admin key.
// Never paste a service-account private key into this website.

export const firebaseConfig = {
  apiKey: "PASTE_FIREBASE_API_KEY_HERE",
  authDomain: "PASTE_FIREBASE_AUTH_DOMAIN_HERE",
  projectId: "PASTE_FIREBASE_PROJECT_ID_HERE",
  storageBucket: "PASTE_FIREBASE_STORAGE_BUCKET_HERE",
  messagingSenderId: "PASTE_FIREBASE_MESSAGING_SENDER_ID_HERE",
  appId: "PASTE_FIREBASE_APP_ID_HERE"
};

export const FIREBASE_CONFIG_READY =
  !Object.values(firebaseConfig).some(value => String(value).includes("PASTE_FIREBASE_"));
