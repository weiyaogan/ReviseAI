const fs = require('fs');
let code = fs.readFileSync('src/components/QuizPracticeView.tsx', 'utf8');

code = code.replace(/topicTitle, allowWebSearch/g, "topicTitle");
fs.writeFileSync('src/components/QuizPracticeView.tsx', code);

code = fs.readFileSync('src/components/QuizPracticeView.tsx', 'utf8');

if (!code.includes('allowWebSearch?: boolean')) {
  code = code.replace(/onQuizAttemptCompleted\?: \(score: number, total: number, timeSpentSecs: number\) => void;/g, "onQuizAttemptCompleted?: (score: number, total: number, timeSpentSecs: number) => void;\n  teachingStyle?: string;\n  language?: string;\n  allowWebSearch?: boolean;");
}
if (!code.includes('allowWebSearch,')) {
  code = code.replace(/onQuizAttemptCompleted,/g, "onQuizAttemptCompleted,\n  teachingStyle,\n  language,\n  allowWebSearch,");
}
code = code.replace(/generateQuiz\(topicTitle, sources, questionCount, difficulty, selectedTypes\)/g, "generateQuiz(topicTitle, sources, questionCount, difficulty, undefined, teachingStyle, language, selectedTypes, allowWebSearch)");
code = code.replace(/gradeShortAnswer\(\s*currentQ\.question,\s*shortAnswerInput\.trim\(\),\s*String\(currentQ\.correctAnswer\),\s*topicTitle\s*\)/g, "gradeShortAnswer(currentQ.question, shortAnswerInput.trim(), String(currentQ.correctAnswer), topicTitle, allowWebSearch)");

fs.writeFileSync('src/components/QuizPracticeView.tsx', code);
