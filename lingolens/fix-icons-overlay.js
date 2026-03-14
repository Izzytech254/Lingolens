const fs = require('fs');

let content = fs.readFileSync('src/components/AROverlay.tsx', 'utf8');

content = content.replace(/import \{.*?\} from "lucide-react";\n/g, '');

const speakerRegex = /<Speaker size=\{28\} \/>/g;
content = content.replace(speakerRegex, '<span className="text-xl font-bold">Speak</span>');

const refreshCcwRegex = /<RefreshCcw size=\{16\} \/>/g;
content = content.replace(refreshCcwRegex, '');

fs.writeFileSync('src/components/AROverlay.tsx', content);
console.log("Success AROverlay");
