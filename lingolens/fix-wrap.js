const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf8');

code = code.replace(/process\.env\.NEXT_P\nUBLIC_DEBUG/g, 'process.env.NEXT_PUBLIC_DEBUG');
code = code.replace(/Array<\{ id: string; imageSrc: string; l\nesson/g, 'Array<{ id: string; imageSrc: string; lesson');
code = code.replace(/targetLang \}\),\n *\}\);/g, 'targetLang }), });');
code = code.replace(/data !== null && 'error' in d\nata/g, "data !== null && 'error' in data");
code = code.replace(/improvement\n\)/g, 'improvement)');
code = code.replace(/Italian': '\nit'/g, "Italian': 'it'");
code = code.replace(/q=\$\n\{encodeURIComponent/g, 'q=${encodeURIComponent');
code = code.replace(/lou\nder/g, 'louder');
code = code.replace(/currentTime \n\+ 0\.35/g, 'currentTime + 0.35');
code = code.replace(/in t\nhe browser/g, 'in the browser');
code = code.replace(/LessonDa\nta/g, 'LessonData');
code = code.replace(/over\nflow-hidden/g, 'overflow-hidden');
code = code.replace(/py-6 \nmb-4/g, 'py-6 mb-4');
code = code.replace(/text-\nblack/g, 'text-black');
code = code.replace(/text-b\nlue-600/g, 'text-blue-600');
code = code.replace(/te\nxt-blue-700/g, 'text-blue-700');
code = code.replace(/bg-bl\nue-600/g, 'bg-blue-600');
code = code.replace(/text-blu\ne-700/g, 'text-blue-700');
code = code.replace(/items-cent\ner/g, 'items-center');
code = code.replace(/overflo\nw-hidden/g, 'overflow-hidden');
code = code.replace(/isAnalyzing \? null : lessonData \n *\}\}/g, 'isAnalyzing ? null : lessonData }}');

fs.writeFileSync('src/app/page.tsx', code);
