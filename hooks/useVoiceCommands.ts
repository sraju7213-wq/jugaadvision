import { useCallback, useEffect, useRef, useState } from "react";

type CommandHandler = (transcript: string) => void;

export interface VoiceCommand {
  phrase: string | RegExp;
  action: string;
  handler: CommandHandler;
}

export function useVoiceCommands(commands: VoiceCommand[], enabled = true) {
  const [listening, setListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const recRef = useRef<any>(null);

  const start = useCallback(() => {
    if (!enabled) return;
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onresult = (e: any) => {
      const t: string = e.results?.[0]?.[0]?.transcript ?? "";
      setLastTranscript(t);
      const lower = t.toLowerCase();
      for (const c of commands) {
        const match = typeof c.phrase === "string" ? lower.includes(c.phrase.toLowerCase()) : c.phrase.test(lower);
        if (match) c.handler(t);
      }
    };
    recRef.current = rec;
    try { rec.start(); } catch { /* */ }
  }, [commands, enabled]);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* */ }
    setListening(false);
  }, []);

  useEffect(() => () => { try { recRef.current?.stop(); } catch { /* */ } }, []);

  return { listening, lastTranscript, start, stop, supported: typeof window !== "undefined" && !!((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition) };
}
