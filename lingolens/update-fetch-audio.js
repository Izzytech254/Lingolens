const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, 'src/app/page.tsx');
let content = fs.readFileSync(p, 'utf8');

const regex = /const fetchAudio = async \(text: string\) => \{[\s\S]*?resetAudioState\(\);\n  \};\n\n  const playBeep/m;

const replacement = `const fetchAudio = (text: string) => {
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
    const langCode = getLangCode(targetLang);

    // Use highly-reliable Google API directly on the client to avoid 500 server errors
    const googleTtsUrl = \`https://translate.googleapis.com/translate_tts?ie=UTF-8&q=\${encodeURIComponent(text)}&tl=\${langCode}&client=tw-ob\`;
    const audio = new Audio(googleTtsUrl);
    
    // Safety timeout in case audio gets stuck
    const safetyTimer = setTimeout(resetAudioState, 6000);

    audio.onended = () => {
        clearTimeout(safetyTimer);
        resetAudioState();
    };

    audio.onerror = () => {
        clearTimeout(safetyTimer);
        console.warn('Network Audio failed, falling back to browser synthesis');
        
        // Native fallback
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
           window.speechSynthesis.cancel();
           const utterance = new SpeechSynthesisUtterance(text);
           utterance.lang = langCode === 'en' ? 'en-US' : langCode === 'es' ? 'es-ES' : langCode;
           utterance.rate = 0.8;
           utterance.onend = resetAudioState;
           utterance.onerror = () => { playBeep(); resetAudioState(); };
           window.speechSynthesis.speak(utterance);
        } else {
           playBeep();
           resetAudioState();
        }
    };

    // Play without "await" to satisfy strict browser user-gesture constraints
    const playPromise = audio.play();
    if (playPromise !== undefined) {
        playPromise.catch((error) => {
            console.warn('Audio autoplay prevented:', error);
            // Trigger onerror manually to activate fallback
            audio.onerror?.(new Event('error'));
        });
    }
  };

  const playBeep`;

if (regex.test(content)) {
    fs.writeFileSync(p, content.replace(regex, replacement));
    console.log("Success");
} else {
    console.error("Could not match the regex");
}
