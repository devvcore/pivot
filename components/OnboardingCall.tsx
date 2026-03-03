"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { GoogleGenAI, Modality } from "@google/genai";
import { Phone, PhoneOff, SkipForward, Rocket } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { Questionnaire } from "@/lib/types";

type LiveSessionLike = {
  sendRealtimeInput: (params: Record<string, unknown>) => void;
  sendClientContent: (params: Record<string, unknown>) => void;
  close: () => void;
};

interface OnboardingCallProps {
  extractedFromDocs: Partial<Questionnaire>;
  onExtracted: (patch: Partial<Questionnaire>) => void;
  onComplete: () => void;
  onSkip: () => void;
  onError: (message: string | null) => void;
}

interface ExtractedPayload extends Partial<Questionnaire> {
  complete?: boolean;
}

function buildLivePrompt(extractedFromDocs: Partial<Questionnaire>): string {
  const known = Object.entries(extractedFromDocs)
    .filter(([, v]) => v !== "" && v !== null && v !== undefined)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(", ");

  const hasKnown = known.length > 0;
  const fillGaps = hasKnown
    ? `FILL-GAPS MODE. We already extracted: ${known}.
Ask ONLY for missing or unclear fields. Keep questions short and conversational.
When enough info is collected, say "I have everything I need. You can launch your analysis now." and set complete to true.`
    : `COLLECTION ORDER:
1) Business name + industry
2) Website
3) Offer/business model
4) Key competitors
5) Biggest concern
6) Critical decision
7) Revenue range + location
When done, say "I have everything I need. You can launch your analysis now." and set complete to true.`;

  const schema = `{"organizationName":"","industry":"","website":"","businessModel":"","keyCompetitors":"","keyConcerns":"","oneDecisionKeepingOwnerUpAtNight":"","revenueRange":"","location":"","complete":false}`;

  return `You are Pivvy, a friendly AI business advisor on a phone call.
You are calling the user to quickly gather business info before running an analysis.

Voice rules:
- Sound natural and warm, like a real advisor on a phone call.
- Ask one question at a time. Keep it brief.
- Do not use any markdown, formatting, or special characters.
- Do not mention JSON, extraction, or technical details to the user.

Internal rules (hidden from user):
- After EVERY response, silently append:
[EXTRACTED]
${schema}
[/EXTRACTED]
- Only populate confirmed fields. Set "complete": true when done.

${fillGaps}`;
}

function parseExtractedFromResponse(raw: string): { fields: Partial<Questionnaire>; complete: boolean } {
  const match = raw.match(/\[EXTRACTED\]([\s\S]*?)\[\/EXTRACTED\]/);
  if (!match) return { fields: {}, complete: false };

  try {
    const parsed = JSON.parse(match[1].trim()) as ExtractedPayload;
    const complete = parsed.complete === true;
    const out: Partial<Questionnaire> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (k === "complete") continue;
      if (v === "" || v === null || v === undefined) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      if (v === 0) continue;
      (out as Record<string, unknown>)[k] = v;
    }
    return { fields: out, complete };
  } catch {
    return { fields: {}, complete: false };
  }
}

function stripExtracted(raw: string): string {
  return raw.replace(/\[EXTRACTED\][\s\S]*?\[\/EXTRACTED\]/g, "").trim();
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function downsampleTo16k(float32: Float32Array, inputRate: number): Int16Array {
  const ratio = inputRate / 16000;
  const outLen = Math.max(1, Math.round(float32.length / ratio));
  const out = new Int16Array(outLen);
  let offset = 0;
  for (let i = 0; i < outLen; i++) {
    const next = Math.min(float32.length, Math.round((i + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let j = offset; j < next; j++) { sum += float32[j]; count++; }
    const avg = count > 0 ? sum / count : 0;
    const s = Math.max(-1, Math.min(1, avg));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    offset = next;
  }
  return out;
}

function int16ToFloat32(i16: Int16Array): Float32Array {
  const f32 = new Float32Array(i16.length);
  for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 0x8000;
  return f32;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type CallState = "idle" | "ringing" | "connected" | "ready" | "ended";

export function OnboardingCall({ extractedFromDocs, onExtracted, onComplete, onSkip, onError }: OnboardingCallProps) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [lastCaption, setLastCaption] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);

  const sessionRef = useRef<LiveSessionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioInCtxRef = useRef<AudioContext | null>(null);
  const audioOutCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptBuf = useRef("");

  useEffect(() => {
    if (callState === "connected") {
      timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callState]);

  const playPcm24k = useCallback(async (base64: string) => {
    try {
      if (!audioOutCtxRef.current) {
        audioOutCtxRef.current = new AudioContext({ sampleRate: 24000 });
      }
      const ctx = audioOutCtxRef.current;
      const bytes = fromBase64(base64);
      const i16 = new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      const f32 = int16ToFloat32(i16);
      const buffer = ctx.createBuffer(1, f32.length, 24000);
      buffer.getChannelData(0).set(f32);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      const now = ctx.currentTime;
      const startAt = Math.max(now, nextPlayTimeRef.current);
      src.start(startAt);
      nextPlayTimeRef.current = startAt + buffer.duration;

      setIsSpeaking(true);
      if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
      speakingTimeoutRef.current = setTimeout(() => setIsSpeaking(false), 600);
    } catch {
      // ignore
    }
  }, []);

  const stopCall = useCallback(() => {
    try { sessionRef.current?.sendRealtimeInput({ audioStreamEnd: true }); } catch { /* */ }
    try { sessionRef.current?.close(); } catch { /* */ }
    sessionRef.current = null;
    try { procRef.current?.disconnect(); sourceRef.current?.disconnect(); } catch { /* */ }
    procRef.current = null;
    sourceRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioInCtxRef.current?.close().catch(() => {});
    audioInCtxRef.current = null;
    setCallState("ended");
  }, []);

  const startMicStreaming = async (session: LiveSessionLike) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    streamRef.current = stream;
    const ctx = new AudioContext();
    audioInCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    sourceRef.current = source;
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    procRef.current = processor;
    source.connect(processor);
    processor.connect(ctx.destination);
    processor.onaudioprocess = (event) => {
      if (!sessionRef.current) return;
      const input = event.inputBuffer.getChannelData(0);
      const i16 = downsampleTo16k(input, ctx.sampleRate);
      const bytes = new Uint8Array(i16.buffer);
      session.sendRealtimeInput({ audio: { data: toBase64(bytes), mimeType: "audio/pcm;rate=16000" } });
    };
  };

  const startCall = async () => {
    setCallState("ringing");
    setElapsed(0);
    setLastCaption("");
    onError(null);
    try {
      const keyRes = await fetch("/api/onboarding/live-token", { method: "POST" });
      const keyJson = (await keyRes.json().catch(() => ({}))) as { apiKey?: string; error?: string };
      if (!keyRes.ok || !keyJson.apiKey) throw new Error(keyJson.error || "Could not get API key for live call");

      const ai = new GoogleGenAI({ apiKey: keyJson.apiKey });
      const session = (await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-latest",
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: buildLivePrompt(extractedFromDocs),
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        } as Record<string, unknown>,
        callbacks: {
          onopen: () => setCallState("connected"),
          onmessage: (e: { text?: string; data?: string; serverContent?: { turnComplete?: boolean; inputTranscription?: { text?: string }; outputTranscription?: { text?: string } } }) => {
            if (e.serverContent?.outputTranscription?.text) {
              transcriptBuf.current += e.serverContent.outputTranscription.text;
              const clean = stripExtracted(transcriptBuf.current);
              if (clean) setLastCaption(clean);
            }
            if (e.text) {
              const clean = stripExtracted(e.text);
              if (clean) setLastCaption(clean);
            }
            if (e.serverContent?.turnComplete) {
              const full = transcriptBuf.current;
              transcriptBuf.current = "";
              if (full) {
                const { fields, complete } = parseExtractedFromResponse(full);
                if (Object.keys(fields).length > 0) onExtracted(fields);
                if (complete) {
                  // Show "Start Analysis" button instead of immediately ending
                  setCallState("ready");
                }
              }
            }
            if (e.data) void playPcm24k(e.data);
          },
          onerror: () => onError("Call dropped. Please try again."),
          onclose: () => stopCall(),
        },
      })) as unknown as LiveSessionLike;

      sessionRef.current = session;
      await startMicStreaming(session);
      session.sendClientContent({
        turns: [{ role: "user", parts: [{ text: "Start onboarding now. Acknowledge what you already know from my documents, then ask the first missing question." }] }],
        turnComplete: true,
      });
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to connect");
      setCallState("idle");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col items-center justify-center text-white select-none">
      <AnimatePresence mode="wait">
        {/* ── Idle: incoming call screen ── */}
        {callState === "idle" && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-8">
            <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center">
              <div className="w-10 h-10 bg-white rounded-md rotate-45" />
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold tracking-tight">Pivvy</div>
              <div className="text-sm text-zinc-400 mt-1">Business Intelligence Advisor</div>
              <div className="text-xs text-zinc-500 mt-3">wants to verify a few details from your documents</div>
            </div>
            <div className="flex items-center gap-8 mt-4">
              <button onClick={onSkip} className="flex flex-col items-center gap-2 group">
                <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
                  <SkipForward className="w-6 h-6 text-zinc-400" />
                </div>
                <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Skip</span>
              </button>
              <button onClick={startCall} className="flex flex-col items-center gap-2 group">
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center group-hover:bg-green-500 transition-colors shadow-lg shadow-green-600/30"
                >
                  <Phone className="w-7 h-7" />
                </motion.div>
                <span className="text-[11px] text-green-400 uppercase tracking-wider">Answer</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Ringing: connecting ── */}
        {callState === "ringing" && (
          <motion.div key="ringing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-6">
            <motion.div
              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center"
            >
              <div className="w-10 h-10 bg-white rounded-md rotate-45" />
            </motion.div>
            <div className="text-lg font-medium text-zinc-300">Connecting...</div>
          </motion.div>
        )}

        {/* ── Connected: active call ── */}
        {callState === "connected" && (
          <motion.div key="connected" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-6 w-full max-w-md px-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center">
                <div className="w-10 h-10 bg-white rounded-md rotate-45" />
              </div>
              {isSpeaking && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-green-400"
                  animate={{ scale: [1, 1.3], opacity: [0.7, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
            </div>

            <div className="text-center">
              <div className="text-xl font-semibold">Pivvy</div>
              <div className="text-sm text-green-400 mt-1 font-mono">{formatTime(elapsed)}</div>
            </div>

            {lastCaption && (
              <motion.div
                key={lastCaption.slice(0, 30)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-3 text-sm text-zinc-300 text-center max-h-28 overflow-y-auto leading-relaxed"
              >
                {lastCaption}
              </motion.div>
            )}

            <div className="flex items-center gap-8 mt-6">
              <button onClick={onSkip} className="flex flex-col items-center gap-2 group">
                <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
                  <SkipForward className="w-5 h-5 text-zinc-400" />
                </div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Skip</span>
              </button>
              <button onClick={() => { stopCall(); onComplete(); }} className="flex flex-col items-center gap-2 group">
                <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center group-hover:bg-red-500 transition-colors shadow-lg shadow-red-600/20">
                  <PhoneOff className="w-5 h-5" />
                </div>
                <span className="text-[10px] text-red-400 uppercase tracking-wider">End Call</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Ready: AI done, show Start Analysis ── */}
        {callState === "ready" && (
          <motion.div key="ready" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-6 w-full max-w-md px-6">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="relative"
            >
              <div className="w-24 h-24 rounded-full bg-emerald-900/30 border-2 border-emerald-500/40 flex items-center justify-center">
                <Rocket className="w-10 h-10 text-emerald-400" />
              </div>
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-emerald-400/30"
                animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </motion.div>

            <div className="text-center">
              <div className="text-xl font-semibold text-white mb-1">Ready to Analyze</div>
              <div className="text-sm text-zinc-400">
                {lastCaption || "I have everything I need to build your intelligence report."}
              </div>
            </div>

            <div className="flex flex-col items-center gap-3 w-full mt-2">
              <button
                onClick={() => { stopCall(); onComplete(); }}
                className="w-full max-w-xs flex items-center justify-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-2xl transition-all shadow-lg shadow-emerald-600/30 active:scale-95"
              >
                <Rocket className="w-5 h-5" />
                Start Analysis
              </button>
              <button
                onClick={() => setCallState("connected")}
                className="text-[11px] font-mono text-zinc-500 hover:text-zinc-300 uppercase tracking-wider transition-colors py-2"
              >
                Continue Talking
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Ended ── */}
        {callState === "ended" && (
          <motion.div key="ended" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4">
            <div className="text-lg text-zinc-400">Call ended</div>
            <div className="text-sm text-zinc-500 font-mono">{formatTime(elapsed)}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
