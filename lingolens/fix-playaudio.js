const fs = require('fs');
let code = fs.readFileSync('src/components/AROverlay.tsx', 'utf8');

code = code.replace(
    /onPlayAudio\(`\$\{snapshot\.lesson!\.detected_language_translation\}\. \$\{snapshot\.lesson!\.example_sentence\}`\)/g,
    "onPlayAudio(`${snapshot.lesson!.object_name}. ${snapshot.lesson!.detected_language_translation}. ${snapshot.lesson!.example_sentence}`)"
);

fs.writeFileSync('src/components/AROverlay.tsx', code);
