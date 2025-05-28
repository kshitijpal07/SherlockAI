import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
const firebaseConfig = {
  apiKey: "AIzaSyAVId_kOXBqlUNjrM1PVHQvEcX6uSVS1XY",
  authDomain: "crime-ffe7e.firebaseapp.com",
  projectId: "crime-ffe7e",
  storageBucket: "crime-ffe7e.firebasestorage.app",
  messagingSenderId: "228928614751",
  appId: "1:228928614751:web:f46e837936dd05be5f46ea"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);