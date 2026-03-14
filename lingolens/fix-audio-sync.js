const fs = require('fs');

let content = fs.readFileSync('src/app/page.tsx', 'utf8');

const newAudioFunc = `  const fetchAudio = (text: string) => {
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
            'Spanish': 'es-ES', 'French': 'fr-FR', 'German': 'de-DE', 
            'Japanese': 'ja-JP', 'Mandarin': 'zh-CN', 'English': 'en-US', 'Italian': 'it-IT'
        };
        return map[lang] || 'en-US';
    };
    
    // Safety timeout in case audio gets stuck
    const safetyTimer = setTimeout(resetAudioState, 5000);

    // Completely synchronous native TTS call (unblocks Brave/iOS restrictions)
    try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel(); // Clear any hanging utterances
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = getLangCode(targetLang);
            utterance.rate = 0.8;
            
            utterance.onend = () => {
                clearTimeout(safetyTimer);
                resetAudioState();
            };
            
            utterance.onerror = (e) => {
                console.warn('Speech synthesis error:', e);
                clearTimeout(safetyTimer);
                playBeep(); 
                resetAudioState();
            };

            // Force speak immediately in the sync click handler
            window.speechSynthesis.speak(utterance);
        } else {
            clearTimeout(safetyTimer);
            playBeep();
            resetAudioState();
        }
    } catch (e) {
        clearTimeout(safetyTimer);
        playBeep();
        resetAudioState();
    }
  };

  const playBeep = async () => {`;

const pattern = /const fetchAudio = \(text: string\) => \{[\s\S]*?const playBeep = async \(\) => \{/;

if (pattern.test(content)) {
    content = content.replace(pattern, newAudioFunc);
    fs.writeFileSync('src/app/page.tsx', content);
    console.log("Success");
} else {
    console.error("Pattern not found");
}
