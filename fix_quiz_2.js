const fs = require('fs');
let code = fs.readFileSync('src/components/QuizPracticeView.tsx', 'utf8');

code = code.replace(/topicTitle, allowWebSearch/g, "topicTitle");
fs.writeFileSync('src/components/QuizPracticeView.tsx', code);
