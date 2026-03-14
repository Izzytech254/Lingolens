const fs = require('fs');

let content = fs.readFileSync('src/components/CameraView.tsx', 'utf8');

content = content.replace(/import \{.*?\} from "lucide-react";\n/g, '');

const refreshCwRegex = /<RefreshCw className="w-8 h-8 text-blue-600 animate-spin" \/>/g;
content = content.replace(refreshCwRegex, '<div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>');

fs.writeFileSync('src/components/CameraView.tsx', content);
console.log("Success CameraView");
