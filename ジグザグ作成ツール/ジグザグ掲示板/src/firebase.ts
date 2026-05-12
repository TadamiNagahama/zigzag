import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDTuwTPmfrvI9vD_OCrsMsXIc482tMGTj0",
  authDomain: "kanji-zigzag.firebaseapp.com",
  projectId: "kanji-zigzag",
  storageBucket: "kanji-zigzag.firebasestorage.app",
  messagingSenderId: "578726864028",
  appId: "1:578726864028:web:153906f077d02cc1edf959",
  measurementId: "G-85YQCEXQ3K"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const dbFirestore = initializeFirestore(app, {
  ignoreUndefinedProperties: true
});
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
