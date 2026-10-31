// The microphone, open for one push-to-talk turn: raw PCM through the Web Audio API (an
// AudioWorklet copies each render quantum out), then a 16 kHz mono WAV when the turn ends.
import { downsample, encodeWav } from "./wav";

export interface Capture {
  /** Close the microphone; the turn as WAV. */
  stop: () => Promise<Blob>;
}

export type StartCapture = () => Promise<Capture>;

const PROCESSOR = "winnow-capture";
const WORKLET = `
class Capture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage(channel.slice());
    return true;
  }
}
registerProcessor("${PROCESSOR}", Capture);
`;

let workletUrl: string | undefined;

function worklet(): string {
  workletUrl ??= URL.createObjectURL(new Blob([WORKLET], { type: "text/javascript" }));
  return workletUrl;
}

function joined(chunks: Float32Array[]): Float32Array {
  const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

export const startCapture: StartCapture = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });
  const context = new AudioContext();
  try {
    await context.audioWorklet.addModule(worklet());
  } catch (error) {
    stream.getTracks().forEach((track) => {
      track.stop();
    });
    await context.close();
    throw error;
  }
  const source = context.createMediaStreamSource(stream);
  // No outputs: a sink, which the graph still renders.
  const node = new AudioWorkletNode(context, PROCESSOR, { numberOfOutputs: 0 });
  const chunks: Float32Array[] = [];
  node.port.onmessage = (event: MessageEvent<Float32Array>) => {
    chunks.push(event.data);
  };
  source.connect(node);
  return {
    stop: async () => {
      source.disconnect();
      node.port.close();
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      const rate = context.sampleRate;
      await context.close();
      return encodeWav(downsample(joined(chunks), rate));
    },
  };
};
