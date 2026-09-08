"use client";

import { getAnalytics, isSupported } from "firebase/analytics";
import { useEffect } from "react";
import { firebaseApp } from "@/lib/firebase/client";

/** Starts Firebase Analytics only in browsers that support it. */
export default function FirebaseAnalytics() {
  useEffect(() => {
    let cancelled = false;

    void isSupported().then((supported) => {
      if (supported && !cancelled) {
        getAnalytics(firebaseApp);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
