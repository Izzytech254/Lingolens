const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf8');

// Find the start of fetchAudio
const startIdx = code.indexOf('const fetchAudio = ');

// Find the start of handleRetake
const endIdx = code.indexOf('const handleRetake = () => {');

if (startIdx !== -1 && endIdx !== -1) {
    const before = code.substring(0, startIdx);
    const after = code.substring(endIdx);
    
    // Build the new fetchAudio and playBeep
    const middle = `const fetchAudio = async (text: string) => {
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
            'Japanese': 'ja', 'Mandarin': 'zh-CN', 'English': 'en', 'Italian': 'it'
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

  `;
  
    fs.writeFileSync('src/app/page.tsx', before + middle + after);
    console.log("Success");
} else {
    console.log("Could not find boundaries");
}
