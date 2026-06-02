import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

const config = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

// Realtime chat is optional infrastructure — if the Firebase env vars are not
// configured, the Network station degrades gracefully instead of crashing the
// whole platform. `isFirebaseConfigured` gates every consumer.
export const isFirebaseConfigured = Boolean(
  config.apiKey && config.databaseURL && config.projectId
);

let app: FirebaseApp | null = null;
let database: Database | null = null;

if (isFirebaseConfigured) {
  app = getApps().length ? getApp() : initializeApp(config);
  database = getDatabase(app);
}

// Non-null assertion for consumers that have already checked isFirebaseConfigured.
export const db = database as Database;
