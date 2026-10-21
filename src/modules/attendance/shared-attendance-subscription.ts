import type { AttendanceGuest } from "./get-attendance-guests";
import type { AttendanceSubscribe } from "./attendance-stream";

// One Firestore listener per server instance; each browser gets its own SSE.
export function shareAttendanceSubscription(
  subscribe: AttendanceSubscribe,
): AttendanceSubscribe {
  type Observer = {
    next: (guests: AttendanceGuest[]) => void;
    fail: (error: Error) => void;
  };
  const observers = new Set<Observer>();
  let latest: AttendanceGuest[] | undefined;
  let detach: (() => void) | undefined;
  let starting = false;
  let generation = 0;

  const reset = () => {
    generation++;
    const cleanup = detach;
    detach = undefined;
    latest = undefined;
    cleanup?.();
  };

  return (next, fail) => {
    const observer = { next, fail };
    observers.add(observer);
    if (latest) next(latest);
    if (!detach && !starting) {
      starting = true;
      const currentGeneration = generation;
      const onError = (error: Error) => {
        if (currentGeneration !== generation) return;
        const failed = [...observers];
        observers.clear();
        reset();
        failed.forEach((item) => item.fail(error));
      };
      try {
        const cleanup = subscribe((guests) => {
          if (currentGeneration !== generation) return;
          latest = guests;
          observers.forEach((item) => item.next(guests));
        }, onError);
        if (currentGeneration === generation && observers.size)
          detach = cleanup;
        else cleanup();
      } catch (error) {
        onError(error instanceof Error ? error : new Error(String(error)));
      } finally {
        starting = false;
      }
    }
    return () => {
      if (!observers.delete(observer)) return;
      if (!observers.size) reset();
    };
  };
}
