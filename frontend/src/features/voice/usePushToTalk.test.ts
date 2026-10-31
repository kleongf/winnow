import { act, fireEvent, renderHook } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import type { Capture } from "./capture";
import { usePushToTalk } from "./usePushToTalk";

const SECOND = new Blob([new Uint8Array(44 + 32_000)], { type: "audio/wav" });

function fakeMic(turn: Blob = SECOND) {
  const stop = vi.fn(() => Promise.resolve(turn));
  const start = vi.fn(() => Promise.resolve<Capture>({ stop }));
  return { start, stop };
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

test("holding V records a turn whose moment is the playhead when V went down", async () => {
  const mic = fakeMic();
  const onTurn = vi.fn();
  const { result, rerender } = renderHook(
    (props: { t: number }) => usePushToTalk({ t: props.t, onTurn, start: mic.start }),
    { initialProps: { t: 2.5 } },
  );

  fireEvent.keyDown(globalThis.window, { key: "v", code: "KeyV" });
  expect(result.current.listening).toBe(true);
  rerender({ t: 4.0 }); // the video plays on while the reviewer talks
  fireEvent.keyUp(globalThis.window, { key: "v", code: "KeyV" });
  await settle();

  expect(result.current.listening).toBe(false);
  expect(onTurn).toHaveBeenCalledExactlyOnceWith(SECOND, 2.5);
});

test("a held key's repeats start no second turn", async () => {
  const mic = fakeMic();
  renderHook(() => usePushToTalk({ t: 0, onTurn: vi.fn(), start: mic.start }));

  fireEvent.keyDown(globalThis.window, { key: "v", code: "KeyV" });
  fireEvent.keyDown(globalThis.window, { key: "v", code: "KeyV", repeat: true });
  fireEvent.keyDown(globalThis.window, { key: "v", code: "KeyV" });
  await settle();

  expect(mic.start).toHaveBeenCalledTimes(1);
});

test("V while typing, or with a modifier, is left alone", () => {
  const mic = fakeMic();
  renderHook(() => usePushToTalk({ t: 0, onTurn: vi.fn(), start: mic.start }));
  const input = document.createElement("input");
  document.body.append(input);

  fireEvent.keyDown(input, { key: "v", code: "KeyV" });
  fireEvent.keyDown(globalThis.window, { key: "v", code: "KeyV", metaKey: true });

  expect(mic.start).not.toHaveBeenCalled();
  input.remove();
});

test("pressing and releasing the button records a turn too", async () => {
  const mic = fakeMic();
  const onTurn = vi.fn();
  const { result } = renderHook(() => usePushToTalk({ t: 1, onTurn, start: mic.start }));

  act(() => {
    result.current.press();
  });
  act(() => {
    result.current.release();
  });
  await settle();

  expect(onTurn).toHaveBeenCalledExactlyOnceWith(SECOND, 1);
});

test("a turn too short to hold a word isn't sent", async () => {
  const blip = new Blob([new Uint8Array(44 + 1600)], { type: "audio/wav" }); // 50 ms
  const mic = fakeMic(blip);
  const onTurn = vi.fn();
  renderHook(() => usePushToTalk({ t: 0, onTurn, start: mic.start }));

  fireEvent.keyDown(globalThis.window, { key: "v", code: "KeyV" });
  fireEvent.keyUp(globalThis.window, { key: "v", code: "KeyV" });
  await settle();

  expect(mic.stop).toHaveBeenCalled();
  expect(onTurn).not.toHaveBeenCalled();
});

test("a microphone that can't be opened is reported", async () => {
  const start = vi.fn(() => Promise.reject(new Error("Permission denied")));
  const { result } = renderHook(() => usePushToTalk({ t: 0, onTurn: vi.fn(), start }));

  fireEvent.keyDown(globalThis.window, { key: "v", code: "KeyV" });
  fireEvent.keyUp(globalThis.window, { key: "v", code: "KeyV" });
  await settle();

  expect(result.current.error).toBe("The microphone couldn't be opened: Permission denied");
});
