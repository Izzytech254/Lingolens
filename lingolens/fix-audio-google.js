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
            'Spanish': 'es', 'French': 'fr', 'German': 'de', 
            'Japanese': 'ja', 'Mandarin': 'zh-CN', 'English': 'en', 'Italian': 'it'
        };
        return map[lang] || 'en';
    };
    
    // Safety timeout in case audio gets stuck
    const safetyTimer = setTimeout(resetAudioState, 6000);

    try {
        const tl = getLangCode(targetLang);
        const url = \`https://translate.googleapis.com/translate_tts?ie=UTF-8&q=\${encodeURIComponent(text)}&tl=\${tl}&client=tw-ob\`;
        
        const audio = new Audio(url);
        
        audio.onended = () => {
            clearTimeout(safetyTimer);
            resetAudioState();
        };

        audio.onerror = () => {
            clearTimeout(safetyTimer);
            playBeep().then(resetAudioState);
        };

        // Play synchronously
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch((e) => {
                console.warn('Audio play failed', e);
                clearTimeout(safetyTimer);
                playBeep().then(resetAudioState);
            });
        }
    } catch (e) {
        clearTimeout(safetyTimer);
        playBeep().then(resetAudioState);
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
