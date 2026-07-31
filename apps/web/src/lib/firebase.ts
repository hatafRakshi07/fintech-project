import { initializeApp } from "firebase/app";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAUxrJ7R1l3Ao0kZAGBMBp8Bbd6egVx_q4",
  authDomain: "fintech-89dcc.firebaseapp.com",
  projectId: "fintech-89dcc",
  storageBucket: "fintech-89dcc.firebasestorage.app",
  messagingSenderId: "1005063044609",
  appId: "1:1005063044609:web:8c5cbfc8624cfbd230ca00",
  measurementId: "G-E2BPTDH40R"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export { RecaptchaVerifier, signInWithPhoneNumber };
