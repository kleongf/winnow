// Push-to-talk: hold V (Space, 1, 2 and the arrows are the Workstation's and Your call's), or
// press and hold the mic button. The turn's moment is the playhead when it began: Voice
// Transcribe gives no word timestamps.
import { useCallback, useEffect, useRef, useState } from "react";

import { startCapture, type Capture, type StartCapture } from "./capture";
import { TARGET_RATE } from "./wav";

const MIN_TURN_S = 0.3; // shorter is a slip of the key, not a word
const MIN_BYTES = 44 + MIN_TURN_S * TARGET_RATE * 2;

function isTalkKey(event: KeyboardEvent): boolean {
  const target = event.target;
  const typing =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement;
  const modified = event.metaKey || event.ctrlKey || event.altKey;
  return event.code === "KeyV" && !typing && !modified;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function usePushToTalk(options: {
  t: number;
  onTurn: (wav: Blob, t: number) => void;
  start?: StartCapture;
}) {
  const { onTurn, start = startCapture } = options;
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useRef(options.t);
  const turn = useRef<{ capture: Promise<Capture>; t: number } | null>(null);

  useEffect(() => {
    t.current = options.t;
  }, [options.t]);

  const press = useCallback(() => {
    if (turn.current) return;
    setError(null);
    const capture = start();
    capture.catch(() => undefined); // reported on release
    turn.current = { capture, t: t.current };
    setListening(true);
  }, [start]);

  const release = useCallback(() => {
    const ending = turn.current;
    if (!ending) return;
    turn.current = null;
    setListening(false);
    void (async () => {
      let capture: Capture;
      try {
        capture = await ending.capture;
      } catch (e) {
        setError(`The microphone couldn't be opened: ${message(e)}`);
        return;
      }
      try {
        const wav = await capture.stop();
        if (wav.size >= MIN_BYTES) onTurn(wav, ending.t);
      } catch (e) {
        setError(`The turn couldn't be recorded: ${message(e)}`);
      }
    })();
  }, [onTurn]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (!isTalkKey(event)) return;
      event.preventDefault();
      if (!event.repeat) press();
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "KeyV") release();
    };
    globalThis.addEventListener("keydown", down);
    globalThis.addEventListener("keyup", up);
    globalThis.addEventListener("blur", release); // a key released in another window never says
    return () => {
      globalThis.removeEventListener("keydown", down);
      globalThis.removeEventListener("keyup", up);
      globalThis.removeEventListener("blur", release);
    };
  }, [press, release]);

  return { listening, error, press, release };
}
