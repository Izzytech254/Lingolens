const fs = require('fs');

let content = fs.readFileSync('src/app/page.tsx', 'utf8');

// remove import
content = content.replace(/import \{.*?\} from "lucide-react";\n/g, '');

// replace Globe block
const globeRegex = /<div className="p-2 bg-blue-600 rounded-xl shadow-md">\s*<Globe[^>]*\/>\s*<\/div>/g;
content = content.replace(globeRegex, '');

// replace Sparkles
const sparklesRegex = /<Sparkles[^>]*\/>/g;
content = content.replace(sparklesRegex, 'Mock');

// replace RefreshCw (analyzing state)
const refreshCwRegex = /<RefreshCw className="w-12 h-12 text-blue-600 animate-spin relative z-10" \/>/g;
content = content.replace(refreshCwRegex, '<div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin relative z-10"></div>');

fs.writeFileSync('src/app/page.tsx', content);
console.log("Success page.tsx");
