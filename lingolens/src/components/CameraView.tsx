import React, { useCallback, useRef, useState } from "react";
import Webcam from "react-webcam";

interface CameraViewProps {
  onCapture: (imageSrc: string) => void;
  isProcessing: boolean;
}

const videoConstraints = {
  width: 1280,
  height: 720,
  facingMode: "environment" // Use back camera on mobile
};

export function CameraView({ onCapture, isProcessing }: CameraViewProps) {
  const webcamRef = useRef<Webcam>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      onCapture(imageSrc);
    }
  }, [webcamRef, onCapture]);

  return (
    <div className="relative w-full h-[60vh] bg-white rounded-3xl overflow-hidden shadow-2xl border-4 border-blue-600">
      {/* Loading State */}
      {!cameraReady && (
        <div className="absolute inset-0 flex items-center justify-center text-blue-600 font-bold animate-pulse">
          Loading Camera...
        </div>
      )}

      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        videoConstraints={videoConstraints}
        className={`w-full h-full object-cover transition-opacity duration-500 ${cameraReady ? 'opacity-100' : 'opacity-0'}`}
        onUserMedia={() => setCameraReady(true)}
        mirrored={false} 
      />

      {/* Capture Button */}
      <div className="absolute bottom-6 inset-x-0 flex justify-center z-20">
        <button
          onClick={capture}
          disabled={!cameraReady || isProcessing}
          className={`
            w-20 h-20 rounded-full border-4 border-blue-600 
            bg-white backdrop-blur-sm flex items-center justify-center
            transition-all duration-200 active:scale-95 hover:bg-gray-100 shadow-xl
            ${isProcessing ? 'opacity-50 cursor-not-allowed animate-pulse' : 'opacity-100'}
          `}
        >
          {isProcessing ? (
             <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          ) : (
             <div className="w-16 h-16 rounded-full bg-blue-600" />
          )}
        </button>
      </div>

      {/* Overlay Guidelines */}
      <div className="absolute inset-0 pointer-events-none border-[12px] border-blue-600/30 z-10 rounded-3xl" />
    </div>
  );
}
