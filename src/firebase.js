import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAxMbaKju5hw_HTx10F2Xo5aTpxib5ijww",
  authDomain: "gen-lang-client-0164240497.firebaseapp.com",
  projectId: "gen-lang-client-0164240497",
  storageBucket: "gen-lang-client-0164240497.firebasestorage.app",
  messagingSenderId: "919927408531",
  appId: "1:919927408531:web:d9b50f65fcf1cd6335ca66",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
