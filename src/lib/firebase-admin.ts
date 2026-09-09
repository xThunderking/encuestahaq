import { applicationDefault, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const app =
  getApps().length > 0
    ? getApp()
    : initializeApp({
        // Local development can set this explicitly; App Hosting can omit it
        // and let ADC provide the project identity automatically.
        projectId: process.env.FIREBASE_PROJECT_ID || undefined,
        credential: applicationDefault(),
      });

export const adminDb = getFirestore(app);
