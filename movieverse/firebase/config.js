import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyB6_jbjIoS1Vu4Er3FadpMmEnFXEcD9yuo",
  authDomain: "1mmun3-b75b1.firebaseapp.com",
  projectId: "1mmun3-b75b1",
  storageBucket: "1mmun3-b75b1.firebasestorage.app",
  messagingSenderId: "12175261060",
  appId: "1:12175261060:web:1ff4e080311327382971d1",
  measurementId: "G-6JZC2CJP4Y"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const db = getFirestore(app);
