import { describe, expect, it, vi } from "vitest";
import { shareAttendanceSubscription } from "@/modules/attendance/shared-attendance-subscription";
import type { AttendanceGuest } from "@/modules/attendance/get-attendance-guests";

describe("shared attendance listener lifecycle", () => {
  it("feeds seven clients through one listener and releases it after the last disconnect", () => {
    let notify: (guests: AttendanceGuest[]) => void = () => {};
    const detach = vi.fn();
    const upstream = vi.fn((next) => {
      notify = next;
      return detach;
    });
    const subscribe = shareAttendanceSubscription(upstream);
    const listeners = Array.from({ length: 7 }, () => vi.fn());
    const cleanup = listeners.map((next) => subscribe(next, vi.fn()));
    expect(upstream).toHaveBeenCalledOnce();
    notify([]);
    listeners.forEach((next) => expect(next).toHaveBeenCalledWith([]));
    cleanup.slice(0, 6).forEach((stop) => stop());
    expect(detach).not.toHaveBeenCalled();
    const newClient = vi.fn();
    const stopNew = subscribe(newClient, vi.fn());
    expect(newClient).toHaveBeenCalledWith([]);
    cleanup[6]();
    expect(detach).not.toHaveBeenCalled();
    stopNew();
    expect(detach).toHaveBeenCalledOnce();
    const fresh = vi.fn();
    const stopFresh = subscribe(fresh, vi.fn());
    expect(upstream).toHaveBeenCalledTimes(2);
    expect(fresh).not.toHaveBeenCalled();
    stopFresh();
  });

  it("releases a synchronously failed listener and allows a fresh connection", () => {
    const detach = vi.fn();
    const upstream = vi.fn((_next, fail) => {
      fail(new Error("Offline"));
      return detach;
    });
    const subscribe = shareAttendanceSubscription(upstream);
    const error = vi.fn();
    subscribe(vi.fn(), error)();
    expect(error).toHaveBeenCalledOnce();
    expect(detach).toHaveBeenCalledOnce();
    subscribe(vi.fn(), error)();
    expect(upstream).toHaveBeenCalledTimes(2);
  });
});
