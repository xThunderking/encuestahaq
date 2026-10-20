"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AttendanceGuest } from "@/modules/attendance/get-attendance-guests";

export type AttendanceSyncStatus =
  "connecting" | "live" | "reconnecting" | "offline";

const REFRESH_TIMEOUT_MS = 10_000;
const RECONNECT_DELAY_MS = 2_000;
const STREAM_STALE_AFTER_MS = 35_000;

export function useLiveAttendance(initialGuests: AttendanceGuest[]) {
  const [guests, setGuests] = useState(initialGuests);
  const [refreshing, setRefreshing] = useState(false);
  const [syncStatus, setSyncStatus] =
    useState<AttendanceSyncStatus>("connecting");
  const snapshotVersion = useRef(0);
  const refreshRequest = useRef(0);
  const pendingRefresh = useRef<Promise<void> | null>(null);
  const refreshController = useRef<AbortController | null>(null);

  const refresh = useCallback((): Promise<void> => {
    // A slow request must not fill the browser's connections and block the live stream.
    if (pendingRefresh.current) return pendingRefresh.current;
    const version = snapshotVersion.current;
    const requestId = ++refreshRequest.current;
    const controller = new AbortController();
    refreshController.current = controller;
    setRefreshing(true);
    const timeout = window.setTimeout(
      () => controller.abort(),
      REFRESH_TIMEOUT_MS,
    );
    const request = (async () => {
      try {
        const response = await fetch("/api/admin/attendance", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error(
            "No pudimos actualizar la lista. Inténtalo nuevamente.",
          );
        const data = (await response.json()) as AttendanceGuest[];
        // A late HTTP response must not replace a newer realtime snapshot.
        if (
          version === snapshotVersion.current &&
          requestId === refreshRequest.current
        ) {
          setGuests(data);
        }
      } catch (error) {
        if (controller.signal.aborted)
          throw new Error(
            "La actualización se interrumpió. Revisa la conexión e inténtalo nuevamente.",
          );
        throw error;
      } finally {
        window.clearTimeout(timeout);
        pendingRefresh.current = null;
        refreshController.current = null;
        if (requestId === refreshRequest.current) setRefreshing(false);
      }
    })();
    pendingRefresh.current = request;
    return request;
  }, []);

  const rememberGuest = useCallback((guest: AttendanceGuest) => {
    snapshotVersion.current += 1;
    // Firestore may deliver the creation before the POST response arrives.
    setGuests((current) =>
      current.some((item) => item.id === guest.id)
        ? current
        : [...current, guest],
    );
  }, []);

  useEffect(() => {
    let source: EventSource | null = null;
    let status: AttendanceSyncStatus = "connecting";
    let lastEvent = Date.now();
    let disposed = false;
    let reconnectTimer: number | undefined;
    const markStatus = (next: AttendanceSyncStatus) => {
      if (disposed) return;
      status = next;
      setSyncStatus(next);
    };
    const connect = () => {
      window.clearTimeout(reconnectTimer);
      source?.close();
      source = null;
      if (disposed) return;
      if (!navigator.onLine) {
        markStatus("offline");
        return;
      }
      markStatus(status === "connecting" ? "connecting" : "reconnecting");
      lastEvent = Date.now();
      if (typeof EventSource === "undefined") return;
      const connection = new EventSource("/api/admin/attendance/stream");
      source = connection;
      const retry = () => {
        if (disposed || source !== connection) return;
        connection.close();
        source = null;
        markStatus(navigator.onLine ? "reconnecting" : "offline");
        if (navigator.onLine)
          reconnectTimer = window.setTimeout(connect, RECONNECT_DELAY_MS);
      };
      connection.addEventListener("guests", (event) => {
        if (disposed || source !== connection) return;
        try {
          const data = JSON.parse(
            (event as MessageEvent<string>).data,
          ) as AttendanceGuest[];
          if (!Array.isArray(data))
            throw new Error("Invalid attendance snapshot");
          lastEvent = Date.now();
          snapshotVersion.current += 1;
          setGuests(data);
          markStatus("live");
        } catch {
          retry();
        }
      });
      connection.addEventListener("heartbeat", () => {
        if (disposed || source !== connection) return;
        lastEvent = Date.now();
      });
      connection.onerror = retry;
    };
    const offline = () => {
      window.clearTimeout(reconnectTimer);
      source?.close();
      source = null;
      refreshController.current?.abort();
      markStatus("offline");
    };
    const visible = () => {
      if (
        document.visibilityState === "visible" &&
        (status !== "live" || Date.now() - lastEvent > 30_000)
      )
        connect();
    };
    connect();
    const watchdog = window.setInterval(() => {
      if (!navigator.onLine) return;
      if (Date.now() - lastEvent > STREAM_STALE_AFTER_MS) connect();
      // Backup while a stream recovers; never silently present a failed stream as live.
      if (status !== "live") void refresh().catch(() => {});
    }, 5_000);
    window.addEventListener("online", connect);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    return () => {
      disposed = true;
      source?.close();
      window.clearTimeout(reconnectTimer);
      refreshRequest.current += 1;
      refreshController.current?.abort();
      window.clearInterval(watchdog);
      window.removeEventListener("online", connect);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);

  return { guests, refreshing, syncStatus, refresh, rememberGuest };
}
