const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(/allowWebSearch={currentProject.allowWebSearch}\n\s*setTeachingStyle={setTeachingStyle}/g, "setTeachingStyle={setTeachingStyle}");
fs.writeFileSync('src/App.tsx', code);
