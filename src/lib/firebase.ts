import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

let app: ReturnType<typeof initializeApp> | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let authRef: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dbRef: any;

if (IS_DEMO) {
  authRef = {
    currentUser: {
      uid: 'demo-user',
      email: 'demo@example.com',
      displayName: 'Demo User',
      getIdToken: async () => 'demo-token',
    },
  };
  dbRef = {};
} else {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  authRef = getAuth(app);
  dbRef = getFirestore(app);
}

export const auth = authRef;
export const db = dbRef;
export default (app || ({} as unknown as ReturnType<typeof initializeApp>));