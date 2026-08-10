import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCwk8G3rYBsZLaCSwaspL-o1uHOLtkxrKQ",
  authDomain: "gym-tracker-2fe70.firebaseapp.com",
  projectId: "gym-tracker-2fe70",
  storageBucket: "gym-tracker-2fe70.firebasestorage.app",
  messagingSenderId: "962627929878",
  appId: "1:962627929878:web:af34a71146aba9a940f237"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore (Database)
export const db = getFirestore(app);

// Initialize Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
