const fs = require('fs');
let content = fs.readFileSync('src/app/page.tsx', 'utf8');

const ttsReplace = `            const fetchAudio = async (text: string) => {
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
  };`;

content = content.replace(/const fetchAudio = \(text: string\) => \{[\s\S]*? \};/, ttsReplace);

fs.writeFileSync('src/app/page.tsx', content);
console.log("Success page");
