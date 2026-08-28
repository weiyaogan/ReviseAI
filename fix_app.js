const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(/allowWebSearch={currentProject.allowWebSearch}\n\s*allowWebSearch={currentProject.allowWebSearch}/g, "allowWebSearch={currentProject.allowWebSearch}");
fs.writeFileSync('src/App.tsx', code);
