'use client';

import React, { useState } from "react";
import Image from "next/image";
import clsx from "clsx";

import { CameraView } from "../components/CameraView";
import { AROverlay } from "../components/AROverlay";

interface LessonData {
  object_name: string;
  detected_language_translation: string;
  pronunciation_guide: string;
  example_sentence: string;
  bounding_box: number[];
}

export default function LingoLensApp() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lessonData, setLessonData] = useState<LessonData | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [serverError, setServerError] = useState<unknown>(null);
  const [debugMode, setDebugMode] = useState<boolean>(Boolean(process.env.NEXT_PUBLIC_DEBUG === 'true'));
  const [forceMock, setForceMock] = useState(false);

  const [history, setHistory] = useState<Array<{ id: string; imageSrc: string; lesson: LessonData; createdAt: number }>>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  
  const [sourceLang, setSourceLang] = useState('English');
  const [targetLang, setTargetLang] = useState('Spanish');

  const handleCapture = async (capturedImage: string) => {
    setImageSrc(capturedImage);
    setIsAnalyzing(true);
    setLessonData(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: capturedImage, forceMock, sourceLang, targetLang }),
      });
      const text = await response.text();
      let data: unknown = null;
      if (!response.ok) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: text || `HTTP ${response.status}` };
        }
        setServerError(data);
        const errMsg = typeof data === 'object' && data !== null && 'error' in data
          ? String((data as Record<string, unknown>)['error'])
          : `HTTP ${response.status}`;
        throw new Error(errMsg);
      }

      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.error('Failed to parse analyze response JSON:', parseErr, text);
        throw new Error('Invalid response from analyze API');
      }

      const lesson = data as LessonData;
      setLessonData(lesson);
      setServerError(null);

      const entry = {
        id: `${Date.now()}`,
        imageSrc: capturedImage,
        lesson,
        createdAt: Date.now(),
      };
      setHistory((prev) => [entry, ...prev].slice(0, 24));
      setSelectedHistoryId(entry.id);
    } catch (error: unknown) {
      console.error("Error analyzing image:", error, serverError);
      if (!debugMode) {
        alert("Failed to analyze image. Try again.");
      }
      setImageSrc(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fetchAudio = async (text: string) => {
    if (isAudioPlaying) return;
    setIsAudioPlaying(true);

    let completed = false;
    const resetAudioState = () => {
      if (completed) return;
      completed = true;
      setTimeout(() => setIsAudioPlaying(false), 250);
    };

    const getLangCode = (lang: string) => {
        const map: Record<string, string> = {
            'Spanish': 'es', 'French': 'fr', 'German': 'de', 
            'Japanese': 'ja', 'Mandarin': 'zh-CN', 'English': 'en', 'Italian': 'it',
            'Swahili': 'sw', 'Portuguese': 'pt', 'Korean': 'ko', 'Hindi': 'hi'
        };
        return map[lang] || 'en';
    };
    
    const safetyTimer = setTimeout(resetAudioState, 6000);

    try {
        const tl = getLangCode(targetLang);
        const response = await fetch('/api/speak', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, lang: tl })
        });
        
        if (!response.ok) throw new Error('TTS fetch failed');
        
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const audio = new Audio(objectUrl);
        
        audio.onended = () => {
            clearTimeout(safetyTimer);
            URL.revokeObjectURL(objectUrl);
            resetAudioState();
        };

        audio.onerror = () => {
            clearTimeout(safetyTimer);
            URL.revokeObjectURL(objectUrl);
            playBeep().then(resetAudioState);
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch((e) => {
                console.warn('Audio play failed', e);
                clearTimeout(safetyTimer);
                URL.revokeObjectURL(objectUrl);
                playBeep().then(resetAudioState);
            });
        }
    } catch (e) {
        clearTimeout(safetyTimer);
        playBeep().then(resetAudioState);
    }
  };

  const playBeep = async () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.45, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.35);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.35);

      await new Promise((resolve) => setTimeout(resolve, 360));
      await audioContext.close().catch(() => undefined);
      setTimeout(() => setIsAudioPlaying(false), 360);
    } catch (beepErr) {
      console.error('Beep failed:', beepErr);
      setIsAudioPlaying(false);
      alert('Audio playback is blocked or not supported.');
    }
  };

  const handleRetake = () => {
      setImageSrc(null);
      setLessonData(null);
      setIsAnalyzing(false);
      setSelectedHistoryId(null);
  };

  return (
    <>
      <main className="flex min-h-screen flex-col items-center p-4 relative overflow-hidden bg-white text-black bg-none">
      {/* Header */}
      <header className="w-full max-w-md flex justify-between items-center py-6 mb-4 z-10">
        <div className="flex items-center gap-3">
            <div>
                <h1 className="text-2xl font-bold tracking-tighter text-black">
                    LingoLens
                </h1>
                <p className="text-xs font-mono tracking-widest uppercase text-blue-600">Nova Powered</p>
            </div>
        </div>
        <div className="flex flex-col gap-2 relative z-50 items-end">
            <select 
               className="text-xs font-bold border border-blue-200 bg-blue-50 text-blue-700 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-400"
               value={sourceLang}
               onChange={(e) => setSourceLang(e.target.value)}
            >
                <option value="English">I speak: English</option>
                <option value="Spanish">I speak: Spanish</option>
                <option value="French">I speak: French</option>
                <option value="German">I speak: German</option>
                <option value="Italian">I speak: Italian</option>
                <option value="Portuguese">I speak: Portuguese</option>
                <option value="Japanese">I speak: Japanese</option>
                <option value="Korean">I speak: Korean</option>
                <option value="Mandarin">I speak: Mandarin</option>
                <option value="Hindi">I speak: Hindi</option>
                <option value="Swahili">I speak: Swahili</option>
            </select>
            <select 
               className="text-xs font-bold border border-blue-600 bg-blue-600 text-white rounded-lg px-2 py-1 outline-none shadow hover:bg-blue-700"
               value={targetLang}
               onChange={(e) => setTargetLang(e.target.value)}
            >
                <option value="Spanish">Learn: Spanish</option>
                <option value="English">Learn: English</option>
                <option value="French">Learn: French</option>
                <option value="German">Learn: German</option>
                <option value="Italian">Learn: Italian</option>
                <option value="Portuguese">Learn: Portuguese</option>
                <option value="Japanese">Learn: Japanese</option>
                <option value="Korean">Learn: Korean</option>
                <option value="Mandarin">Learn: Mandarin</option>
                <option value="Hindi">Learn: Hindi</option>
                <option value="Swahili">Learn: Swahili</option>
            </select>

            <button
              aria-label="Toggle mock mode"
              onClick={() => setForceMock((prev) => !prev)}
              className={clsx(
                'ml-2 p-2 rounded-md text-xs',
                forceMock ? 'bg-black text-white' : 'bg-blue-50 text-blue-700 border border-blue-200'
              )}
            >
              Mock
            </button>

            <button
              aria-label="Toggle debug"
              onClick={() => setDebugMode(d => !d)}
              className="ml-2 p-2 rounded-md text-xs bg-blue-50 text-blue-700 border border-blue-200"
            >
              {debugMode ? 'Debug ON' : 'Debug OFF'}
            </button>
        </div>
      </header>
      
      {/* Main Content Area */}
      <div className="w-full max-w-md flex-grow flex flex-col items-center justify-start z-10 relative">
        <div className="relative w-full aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl border-4 border-blue-600 bg-white">
             {/* Dynamic Render based on State */}
             {!imageSrc && (
                 <CameraView 
                    onCapture={handleCapture}
                    isProcessing={isAnalyzing}
                 />
             )}

             {imageSrc && (
                 <div className="relative w-full h-full">
                     <AROverlay 
                        snapshot={{ 
                            src: imageSrc, 
                            lesson: isAnalyzing ? null : lessonData 
                        }} 
                        onRetake={handleRetake}
                        onPlayAudio={fetchAudio}
                        isAudioPlaying={isAudioPlaying}
                     />
                 </div>
             )}
        </div>
      </div>
      </main>
    </>
  );
}
