
import { useState, useRef, useCallback, useEffect } from 'react';

const useSpeechToText = (onTranscript: (text: string) => void) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  
  // Use a ref to store the instance so it persists between renders but doesn't trigger re-renders
  const recognitionRef = useRef<any>(null);
  const onTranscriptRef = useRef(onTranscript);

  // Keep the callback ref fresh
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  // Check support on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setIsSupported(!!SpeechRecognition);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
      recognitionRef.current = null;
      setIsListening(false);
    }
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    // 1. Clean up any existing instance to prevent double-binding
    if (recognitionRef.current) {
        recognitionRef.current.abort();
    }

    // 2. Lazy Initialization: Create the instance immediately before use
    const recognition = new SpeechRecognition();
    recognition.continuous = false; // Mobile often fails with true
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (onTranscriptRef.current && transcript) {
        onTranscriptRef.current(transcript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      // Specifically handle 'not-allowed' which means permission denied
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
         alert("Microphone access denied. Please check your browser permissions.");
      }
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (e) {
      console.error("Failed to start recognition:", e);
      setIsListening(false);
    }
  }, []);

  return { isListening, isSupported, startListening, stopListening };
};

export default useSpeechToText;
