import React, { useRef, useEffect } from "react";
import Image from "next/image";

interface LessonData {
  object_name: string;
  detected_language_translation: string;
  pronunciation_guide: string;
  example_sentence: string;
  bounding_box: number[];
}

interface ImageSnapshot {
  src: string;
  lesson: LessonData | null;
}

interface AROverlayProps {
  snapshot: ImageSnapshot;
  onRetake: () => void;
  onPlayAudio: (text: string) => void;
  isAudioPlaying: boolean;
}

export function AROverlay({ snapshot, onRetake, onPlayAudio, isAudioPlaying }: AROverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!snapshot.lesson || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const container = canvasRef.current.parentElement;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    canvasRef.current.width = width;
    canvasRef.current.height = height;

    // Draw Box
    const [ymin, xmin, ymax, xmax] = snapshot.lesson.bounding_box;
    
    // Convert normalized (0-1000) to pixel coords
    const x = (xmin / 1000) * width;
    const y = (ymin / 1000) * height;
    const w = ((xmax - xmin) / 1000) * width;
    const h = ((ymax - ymin) / 1000) * height;

    ctx.clearRect(0, 0, width, height);
    
    // Stroke Box
    ctx.strokeStyle = "#FFFF00"; // AWS Orange
    ctx.lineWidth = 8;
    ctx.lineJoin = "round";
    ctx.strokeRect(x, y, w, h);
    
  }, [snapshot]);

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="relative w-full h-[60vh] bg-white rounded-3xl overflow-hidden shadow-2xl border-4 border-blue-600">
        {/* Background Image */}
        <div className="relative w-full h-full">
          <Image
            src={snapshot.src}
            alt="Captured Scene"
            fill
            unoptimized
            sizes="100vw"
            className="object-cover"
          />
          {/* Canvas for Drawing Box */}
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        </div>

        {/* Retake Button */}
        <div className="absolute top-4 left-4 z-20">
          <button 
              onClick={onRetake}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white font-bold rounded-full backdrop-blur-sm hover:bg-gray-800 transition-colors"
          >
               Retake
          </button>
        </div>
      </div>

      {/* Lesson Details Below Image */}
      {snapshot.lesson && (
        <div className="w-full bg-white border-4 border-black p-6 rounded-2xl shadow-xl transform transition-all animate-in slide-in-from-bottom duration-500">
          <div className="flex justify-between items-start">
              <div>
                  <span className="text-xs font-mono uppercase text-blue-600 font-bold mb-2 block">
                      Object Detected: {snapshot.lesson.object_name}
                  </span>
                  <h2 className="text-3xl font-bold text-black mb-1">{snapshot.lesson.detected_language_translation}</h2>
                  <p className="text-lg text-black font-semibold italic mb-2">"{snapshot.lesson.pronunciation_guide}"</p>
                  <p className="text-black">{snapshot.lesson.example_sentence}</p>
              </div>
              
              <button 
                onClick={() => onPlayAudio(`${snapshot.lesson!.object_name}. ${snapshot.lesson!.detected_language_translation}. ${snapshot.lesson!.example_sentence}`)}
                disabled={isAudioPlaying}
                className={`px-6 py-3 rounded-xl bg-blue-600 text-white shadow-lg active:scale-95 transition-transform ${isAudioPlaying ? 'animate-pulse bg-blue-400' : 'hover:bg-blue-700'}`}
              >
                  <span className="text-xl font-bold">Speak</span>
              </button>
          </div>
        </div>
      )}
    </div>
  );
}
