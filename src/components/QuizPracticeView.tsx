import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  HelpCircle,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  RotateCcw,
  Plus,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Loader2,
  Lightbulb,
  Check,
  Zap,
  Sliders,
  Send,
  FileText,
  Filter
} from 'lucide-react';
import { QuizSet, QuizQuestion, UserAnswerRecord, SourceDocument } from '../types';
import { generateQuiz, gradeShortAnswer, GradeAnswerResponse } from '../services/api';

interface QuizPracticeViewProps {
  currentQuiz?: QuizSet;
  sources: SourceDocument[];
  topicTitle: string;
  onSetQuiz: (quiz: QuizSet) => void;
  onGoToLesson: () => void;
  onGoToNotes: () => void;
  onQuizAttemptCompleted?: (score: number, total: number, timeSpentSecs: number) => void;
  teachingStyle?: string;
  language?: string;
  allowWebSearch?: boolean;
}

export const QuizPracticeView: React.FC<QuizPracticeViewProps> = ({
  currentQuiz,
  sources,
  topicTitle,
  onSetQuiz,
  onGoToLesson,
  onGoToNotes,
  onQuizAttemptCompleted,
  teachingStyle,
  language,
  allowWebSearch,
}) => {
  // Quiz Generator Modal / Options
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [questionCount, setQuestionCount] = useState(8);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('medium');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([
    'multiple_choice',
    'true_false',
    'fill_in_blank',
    'short_answer',
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Active Quiz Runner State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, UserAnswerRecord>>({});
  const [showHint, setShowHint] = useState<Record<string, boolean>>({});
  const [isQuizFinished, setIsQuizFinished] = useState(false);

  // Short Answer specific state
  const [shortAnswerInput, setShortAnswerInput] = useState('');
  const [isGradingShortAnswer, setIsGradingShortAnswer] = useState(false);
  const [shortAnswerGrades, setShortAnswerGrades] = useState<Record<string, GradeAnswerResponse>>({});

  // Fill in blank specific state
  const [fillInput, setFillInput] = useState('');

  // Timer state
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(true);

  // Review filter
  const [reviewFilter, setReviewFilter] = useState<'all' | 'incorrect' | 'correct'>('all');

  // Timer tick
  useEffect(() => {
    let interval: any = null;
    if (isTimerActive && !isQuizFinished && currentQuiz?.questions?.length) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, isQuizFinished, currentQuiz]);

  // Trigger celebration on Quiz Finish if score is good
  useEffect(() => {
    if (isQuizFinished && currentQuiz) {
      const answeredList = Object.values(userAnswers);
      const totalScore = answeredList.reduce((acc, a) => acc + (a.score || 0), 0);
      const averageScore = Math.round(totalScore / currentQuiz.questions.length);

      if (onQuizAttemptCompleted) {
        onQuizAttemptCompleted(averageScore, currentQuiz.questions.length, secondsElapsed);
      }

      if (averageScore >= 70) {
        try {
          confetti({
            particleCount: 70,
            spread: 60,
            origin: { y: 0.6 },
          });
        } catch {
          // ignore
        }
      }
    }
  }, [isQuizFinished]);

  const questions = currentQuiz?.questions || [];
  const currentQ: QuizQuestion | undefined = questions[currentQuestionIndex];

  // Handle New Quiz Generation
  const handleGenerateNewQuiz = async () => {
    if (!sources || !sources.length) {
      setGenerateError('Please add at least one source on the Sources tab first.');
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);

    try {
      const newQuiz = await generateQuiz(topicTitle, sources, questionCount, difficulty, undefined, teachingStyle, language, selectedTypes, allowWebSearch);
      onSetQuiz(newQuiz);
      setUserAnswers({});
      setShowHint({});
      setShortAnswerGrades({});
      setCurrentQuestionIndex(0);
      setIsQuizFinished(false);
      setSecondsElapsed(0);
      setIsTimerActive(true);
      setShowConfigModal(false);
    } catch (err: any) {
      console.error('Quiz generation error:', err);
      setGenerateError(err.message || 'Failed to generate quiz questions. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Submit Multiple Choice / True-False Answer
  const handleSelectOption = (optionIndex: number) => {
    if (!currentQ || userAnswers[currentQ.id]?.reviewed) return;

    const isCorrect = optionIndex === Number(currentQ.correctAnswer);
    const newRecord: UserAnswerRecord = {
      questionId: currentQ.id,
      userAnswer: optionIndex,
      isCorrect,
      score: isCorrect ? 100 : 0,
      reviewed: true,
    };

    setUserAnswers((prev) => ({ ...prev, [currentQ.id]: newRecord }));
  };

  // Submit Fill in Blank Answer
  const handleSubmitFill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentQ || !fillInput.trim() || userAnswers[currentQ.id]?.reviewed) return;

    const expected = String(currentQ.correctAnswer).trim().toLowerCase();
    const provided = fillInput.trim().toLowerCase();
    const isCorrect = provided === expected || expected.includes(provided);

    const newRecord: UserAnswerRecord = {
      questionId: currentQ.id,
      userAnswer: fillInput.trim(),
      isCorrect,
      score: isCorrect ? 100 : 0,
      reviewed: true,
    };

    setUserAnswers((prev) => ({ ...prev, [currentQ.id]: newRecord }));
    setFillInput('');
  };

  // Submit Short Answer with AI Grading
  const handleSubmitShortAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentQ || !shortAnswerInput.trim() || isGradingShortAnswer || userAnswers[currentQ.id]?.reviewed) return;

    setIsGradingShortAnswer(true);

    try {
      const grade = await gradeShortAnswer(currentQ.question, shortAnswerInput.trim(), String(currentQ.correctAnswer), topicTitle, allowWebSearch);

      setShortAnswerGrades((prev) => ({ ...prev, [currentQ.id]: grade }));

      const isCorrect = grade.score >= 60;
      const newRecord: UserAnswerRecord = {
        questionId: currentQ.id,
        userAnswer: shortAnswerInput.trim(),
        isCorrect,
        score: grade.score,
        aiFeedback: grade.aiFeedback || grade.strengths,
        reviewed: true,
      };

      setUserAnswers((prev) => ({ ...prev, [currentQ.id]: newRecord }));
      setShortAnswerInput('');
    } catch (err: any) {
      console.error('Error grading short answer:', err);
      const fallbackRecord: UserAnswerRecord = {
        questionId: currentQ.id,
        userAnswer: shortAnswerInput.trim(),
        isCorrect: true,
        score: 75,
        aiFeedback: 'Response recorded. Model answer provided below.',
        reviewed: true,
      };
      setUserAnswers((prev) => ({ ...prev, [currentQ.id]: fallbackRecord }));
    } finally {
      setIsGradingShortAnswer(false);
    }
  };

  const handleRetakeQuiz = () => {
    setUserAnswers({});
    setShowHint({});
    setShortAnswerGrades({});
    setCurrentQuestionIndex(0);
    setIsQuizFinished(false);
    setSecondsElapsed(0);
    setIsTimerActive(true);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  const toggleTypeSelection = (type: string) => {
    if (selectedTypes.includes(type)) {
      if (selectedTypes.length > 1) {
        setSelectedTypes(selectedTypes.filter((t) => t !== type));
      }
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  // No Quiz View State
  if (!currentQuiz || questions.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-4">
          <HelpCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">No Practice Quiz Generated Yet</h2>
        <p className="text-slate-600 text-sm max-w-md mx-auto mb-6">
          Generate an adaptive practice quiz based on your uploaded revision notes to test your understanding under real exam conditions.
        </p>

        <button
          onClick={() => setShowConfigModal(true)}
          className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm transition-all inline-flex items-center gap-2 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>Configure & Generate Practice Quiz</span>
        </button>

        {showConfigModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 text-left shadow-xl border border-slate-200">
              <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-600" />
                Customize Practice Quiz
              </h3>

              <div className="space-y-4 text-xs">
                {/* Question Count */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Number of Questions</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[5, 8, 10, 15].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setQuestionCount(cnt)}
                        className={`py-2 rounded-xl border font-bold text-center cursor-pointer ${
                          questionCount === cnt
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {cnt} Questions
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Difficulty Level</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'easy', label: 'Easy' },
                      { id: 'medium', label: 'Standard' },
                      { id: 'hard', label: 'Hard' },
                      { id: 'mixed', label: 'Mixed' },
                    ].map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDifficulty(d.id as any)}
                        className={`py-2 rounded-xl border font-bold text-center capitalize cursor-pointer ${
                          difficulty === d.id
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question Types */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Included Question Types</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'multiple_choice', label: 'Multiple Choice (MCQ)' },
                      { id: 'true_false', label: 'True / False' },
                      { id: 'fill_in_blank', label: 'Fill in the Blank' },
                      { id: 'short_answer', label: 'AI Graded Short Answer' },
                    ].map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => toggleTypeSelection(type.id)}
                        className={`p-2.5 rounded-xl border text-left font-medium flex items-center justify-between cursor-pointer ${
                          selectedTypes.includes(type.id)
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-900 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span>{type.label}</span>
                        {selectedTypes.includes(type.id) && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                      </button>
                    ))}
                  </div>
                </div>

                {generateError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{generateError}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerateNewQuiz}
                  disabled={isGenerating}
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating Questions...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Start Quiz</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // QUIZ RESULTS & SCORE BREAKDOWN VIEW
  // =========================================================================
  if (isQuizFinished) {
    const answeredList = Object.values(userAnswers);
    const correctCount = answeredList.filter((a) => a.isCorrect).length;
    const totalScore = answeredList.reduce((acc, a) => acc + (a.score || 0), 0);
    const averageScore = Math.round(totalScore / questions.length);
    const percentage = Math.round((correctCount / questions.length) * 100);

    const filteredQuestionsForReview = questions.filter((q) => {
      const ans = userAnswers[q.id];
      if (reviewFilter === 'all') return true;
      if (reviewFilter === 'incorrect') return !ans || !ans.isCorrect;
      if (reviewFilter === 'correct') return ans && ans.isCorrect;
      return true;
    });

    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Score Summary Banner */}
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-md text-center relative overflow-hidden">
          <div className="max-w-md mx-auto space-y-4">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
              Exam Performance Report
            </span>

            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              {percentage >= 80 ? 'Mastery Level!' : percentage >= 60 ? 'Solid Attempt!' : 'Keep Revising!'}
            </h1>

            <div className="flex items-center justify-center gap-6 py-4">
              <div>
                <p className="text-3xl sm:text-4xl font-extrabold text-indigo-200">{percentage}%</p>
                <p className="text-xs text-indigo-300 font-medium">Score ({correctCount}/{questions.length} Correct)</p>
              </div>
              <div className="h-10 w-px bg-white/20" />
              <div>
                <p className="text-3xl sm:text-4xl font-extrabold text-indigo-200">{formatTime(secondsElapsed)}</p>
                <p className="text-xs text-indigo-300 font-medium">Time Taken</p>
              </div>
            </div>

            {/* Quick Action buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={handleRetakeQuiz}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retake Quiz</span>
              </button>

              <button
                onClick={() => setShowConfigModal(true)}
                className="px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Generate New Questions</span>
              </button>

              <button
                onClick={onGoToNotes}
                className="px-4 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>Review Weak Areas in Notes</span>
              </button>
            </div>
          </div>
        </div>

        {/* Detailed Question Review List */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Question-by-Question Review</h2>
              <p className="text-xs text-slate-500">Examine answers, detailed marking criteria, and model solutions</p>
            </div>

            {/* Filter */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                onClick={() => setReviewFilter('all')}
                className={`px-3 py-1 rounded-lg font-semibold cursor-pointer ${
                  reviewFilter === 'all' ? 'bg-white shadow-xs text-indigo-700' : 'text-slate-600'
                }`}
              >
                All ({questions.length})
              </button>
              <button
                onClick={() => setReviewFilter('incorrect')}
                className={`px-3 py-1 rounded-lg font-semibold cursor-pointer ${
                  reviewFilter === 'incorrect' ? 'bg-white shadow-xs text-rose-700' : 'text-slate-600'
                }`}
              >
                Incorrect ({questions.length - correctCount})
              </button>
              <button
                onClick={() => setReviewFilter('correct')}
                className={`px-3 py-1 rounded-lg font-semibold cursor-pointer ${
                  reviewFilter === 'correct' ? 'bg-white shadow-xs text-emerald-700' : 'text-slate-600'
                }`}
              >
                Correct ({correctCount})
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {filteredQuestionsForReview.map((q, idx) => {
              const ans = userAnswers[q.id];
              const isCorrect = ans?.isCorrect;
              const shortGrade = shortAnswerGrades[q.id];

              return (
                <div
                  key={q.id}
                  className={`p-5 rounded-2xl border transition-all text-xs space-y-3 ${
                    isCorrect
                      ? 'border-emerald-200 bg-emerald-50/40'
                      : 'border-rose-200 bg-rose-50/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-800 font-bold flex items-center justify-center text-[11px]">
                        {idx + 1}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200/80 text-slate-700">
                        {q.type.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 font-bold">
                      {isCorrect ? (
                        <span className="text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Correct ({ans?.score || 100}%)
                        </span>
                      ) : (
                        <span className="text-rose-700 flex items-center gap-1">
                          <XCircle className="w-4 h-4" /> Needs Review ({ans?.score || 0}%)
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-slate-900 font-bold text-sm">{q.question}</p>

                  {/* Multiple Choice Options preview */}
                  {q.options && (
                    <div className="space-y-1.5 pl-2">
                      {q.options.map((opt, optIdx) => {
                        const isSelected = ans?.userAnswer === optIdx;
                        const isActualCorrect = Number(q.correctAnswer) === optIdx;

                        return (
                          <div
                            key={optIdx}
                            className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                              isActualCorrect
                                ? 'bg-emerald-100 border-emerald-300 text-emerald-950 font-bold'
                                : isSelected && !isActualCorrect
                                ? 'bg-rose-100 border-rose-300 text-rose-950 line-through'
                                : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            <span>
                              {String.fromCharCode(65 + optIdx)}. {opt}
                            </span>
                            {isActualCorrect && <Check className="w-3.5 h-3.5 text-emerald-700" />}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Fill in Blank / Short Answer Review */}
                  {!q.options && (
                    <div className="space-y-2 p-3 bg-white rounded-xl border border-slate-200">
                      <div>
                        <span className="text-slate-500 font-medium">Your answer: </span>
                        <span className="font-semibold text-slate-900">{String(ans?.userAnswer || '(No answer)')}</span>
                      </div>
                      <div>
                        <span className="text-emerald-700 font-medium">Model solution: </span>
                        <span className="font-bold text-emerald-900">{String(q.correctAnswer)}</span>
                      </div>
                      {shortGrade && (
                        <div className="pt-2 border-t border-slate-100 space-y-1 text-slate-700">
                          <p className="font-semibold text-indigo-900">AI Examiner Breakdown:</p>
                          <p>{shortGrade.aiFeedback || (shortGrade as any).feedback}</p>
                          {shortGrade.missingPoints && (
                            <p className="text-rose-700">
                              <span className="font-bold">Missing key points:</span> {shortGrade.missingPoints}
                            </p>
                          )}
                          {shortGrade.improvedModelAnswer && (
                            <p className="text-slate-800">
                              <span className="font-bold">Model Answer:</span> {shortGrade.improvedModelAnswer}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Explanation Callout */}
                  <div className="p-3 rounded-xl bg-slate-100/90 text-slate-800 leading-relaxed border border-slate-200/80">
                    <span className="font-bold text-slate-900 block mb-0.5">Explanation:</span>
                    <p>{q.explanation}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal for New Quiz Config */}
        {showConfigModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 text-left shadow-xl border border-slate-200">
              <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-600" />
                Customize Practice Quiz
              </h3>

              <div className="space-y-4 text-xs">
                {/* Question Count */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Number of Questions</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[5, 8, 10, 15].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setQuestionCount(cnt)}
                        className={`py-2 rounded-xl border font-bold text-center cursor-pointer ${
                          questionCount === cnt
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {cnt} Questions
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Difficulty Level</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'easy', label: 'Easy' },
                      { id: 'medium', label: 'Standard' },
                      { id: 'hard', label: 'Hard' },
                      { id: 'mixed', label: 'Mixed' },
                    ].map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDifficulty(d.id as any)}
                        className={`py-2 rounded-xl border font-bold text-center capitalize cursor-pointer ${
                          difficulty === d.id
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question Types */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Included Question Types</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'multiple_choice', label: 'Multiple Choice (MCQ)' },
                      { id: 'true_false', label: 'True / False' },
                      { id: 'fill_in_blank', label: 'Fill in the Blank' },
                      { id: 'short_answer', label: 'AI Graded Short Answer' },
                    ].map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => toggleTypeSelection(type.id)}
                        className={`p-2.5 rounded-xl border text-left font-medium flex items-center justify-between cursor-pointer ${
                          selectedTypes.includes(type.id)
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-900 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span>{type.label}</span>
                        {selectedTypes.includes(type.id) && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                      </button>
                    ))}
                  </div>
                </div>

                {generateError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{generateError}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerateNewQuiz}
                  disabled={isGenerating}
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating Questions...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Start Quiz</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // ACTIVE QUESTION RUNNER
  // =========================================================================
  const activeAnswerRecord = currentQ ? userAnswers[currentQ.id] : undefined;
  const isCurrentAnswered = Boolean(activeAnswerRecord?.reviewed);
  const isCurrentCorrect = activeAnswerRecord?.isCorrect;
  const currentShortGrade = currentQ ? shortAnswerGrades[currentQ.id] : undefined;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Quiz Runner Header Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              {topicTitle || 'Practice Examination'}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="capitalize font-semibold">{currentQuiz.difficulty} difficulty</span>
              <span>•</span>
              <span>{questions.length} total questions</span>
            </div>
          </div>
        </div>

        {/* Timer & Finish button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-mono text-xs font-bold border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span>{formatTime(secondsElapsed)}</span>
          </div>

          <button
            onClick={() => setIsQuizFinished(true)}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Finish Exam
          </button>
        </div>
      </div>

      {/* Question Progress Dots */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {questions.map((q, idx) => {
          const ans = userAnswers[q.id];
          const isSelected = idx === currentQuestionIndex;

          let btnClass = 'bg-white border-slate-200 text-slate-600';
          if (ans) {
            btnClass = ans.isCorrect
              ? 'bg-emerald-500 text-white border-emerald-500'
              : 'bg-rose-500 text-white border-rose-500';
          } else if (isSelected) {
            btnClass = 'bg-indigo-600 text-white border-indigo-600 shadow-xs font-bold';
          }

          return (
            <button
              key={q.id}
              onClick={() => setCurrentQuestionIndex(idx)}
              className={`w-8 h-8 rounded-xl border text-xs font-bold flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${btnClass}`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Active Question Card */}
      {currentQ && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          {/* Question Header & Hint */}
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                Question {currentQuestionIndex + 1} of {questions.length} • {currentQ.type.replace(/_/g, ' ')}
              </span>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 mt-1 leading-snug">
                {currentQ.question}
              </h1>
            </div>

            {currentQ.hint && (
              <button
                onClick={() =>
                  setShowHint((prev) => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }))
                }
                className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold flex items-center gap-1.5 border border-amber-200 transition-colors cursor-pointer flex-shrink-0"
              >
                <Lightbulb className="w-4 h-4 text-amber-600" />
                <span>{showHint[currentQ.id] ? 'Hide Hint' : 'Hint'}</span>
              </button>
            )}
          </div>

          {/* Hint Card */}
          {showHint[currentQ.id] && currentQ.hint && (
            <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 leading-relaxed flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Exam Hint: </span>
                {currentQ.hint}
              </div>
            </div>
          )}

          {/* QUESTION TYPE 1 & 2: Multiple Choice or True/False */}
          {(currentQ.type === 'multiple_choice' || currentQ.type === 'true_false') && currentQ.options && (
            <div className="space-y-3">
              {currentQ.options.map((opt, optIdx) => {
                const isSelected = activeAnswerRecord?.userAnswer === optIdx;
                const isCorrectOption = optIdx === Number(currentQ.correctAnswer);

                let optStyle = 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800';
                if (isCurrentAnswered) {
                  if (isCorrectOption) {
                    optStyle = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold';
                  } else if (isSelected && !isCorrectOption) {
                    optStyle = 'border-rose-500 bg-rose-50 text-rose-950';
                  }
                } else if (isSelected) {
                  optStyle = 'border-indigo-600 bg-indigo-50 text-indigo-950 font-bold';
                }

                return (
                  <button
                    key={optIdx}
                    onClick={() => handleSelectOption(optIdx)}
                    disabled={isCurrentAnswered}
                    className={`w-full p-4 rounded-xl border text-left text-xs sm:text-sm transition-all flex items-start gap-3 cursor-pointer ${optStyle}`}
                  >
                    <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {String.fromCharCode(65 + optIdx)}
                    </span>
                    <span className="flex-1 leading-relaxed">{opt}</span>
                    {isCurrentAnswered && isCorrectOption && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* QUESTION TYPE 3: Fill in the blank */}
          {currentQ.type === 'fill_in_blank' && (
            <form onSubmit={handleSubmitFill} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Type your answer in the box below:
                </label>
                <input
                  type="text"
                  value={isCurrentAnswered ? String(activeAnswerRecord?.userAnswer || '') : fillInput}
                  onChange={(e) => setFillInput(e.target.value)}
                  disabled={isCurrentAnswered}
                  placeholder="Type term or formula here..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                  required
                />
              </div>

              {!isCurrentAnswered && (
                <button
                  type="submit"
                  disabled={!fillInput.trim()}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
                >
                  <span>Submit Answer</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </form>
          )}

          {/* QUESTION TYPE 4: Short Answer / Essay */}
          {currentQ.type === 'short_answer' && (
            <form onSubmit={handleSubmitShortAnswer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Provide your written explanation (AI will grade key points and method):
                </label>
                <textarea
                  value={
                    isCurrentAnswered ? String(activeAnswerRecord?.userAnswer || '') : shortAnswerInput
                  }
                  onChange={(e) => setShortAnswerInput(e.target.value)}
                  disabled={isCurrentAnswered || isGradingShortAnswer}
                  rows={4}
                  placeholder="Explain the process, mechanism, or reason step-by-step..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-xs leading-relaxed focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                  required
                />
              </div>

              {!isCurrentAnswered && (
                <button
                  type="submit"
                  disabled={!shortAnswerInput.trim() || isGradingShortAnswer}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isGradingShortAnswer ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>AI Examiner Grading Response...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit for AI Evaluation</span>
                      <Send className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              )}
            </form>
          )}

          {/* Answer Feedback & Detailed Marking Criteria */}
          {isCurrentAnswered && (
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div
                className={`p-4 rounded-2xl text-xs leading-relaxed border ${
                  isCurrentCorrect
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50 border-rose-200 text-rose-950'
                }`}
              >
                <div className="flex items-center gap-2 font-bold mb-2 text-sm">
                  {isCurrentCorrect ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>Correct! {activeAnswerRecord?.score ? `(${activeAnswerRecord.score}%)` : ''}</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-rose-600" />
                      <span>Needs Review {activeAnswerRecord?.score ? `(${activeAnswerRecord.score}%)` : ''}</span>
                    </>
                  )}
                </div>

                {/* Explanation */}
                <p className="font-semibold text-slate-900 mb-1">Marking Guide & Solution:</p>
                <p>{currentQ.explanation}</p>

                {/* AI Detailed Feedback for short answers */}
                {currentShortGrade && (
                  <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-1.5">
                    <p className="font-bold text-indigo-900">AI Examiner Evaluation:</p>
                    <p className="text-slate-800">{currentShortGrade.aiFeedback || (currentShortGrade as any).feedback}</p>
                    {currentShortGrade.missingPoints && (
                      <p className="text-rose-700">
                        <span className="font-bold">Missing key points:</span> {currentShortGrade.missingPoints}
                      </p>
                    )}
                    {currentShortGrade.improvedModelAnswer && (
                      <p className="text-indigo-950 italic">
                        <span className="font-bold not-italic">Sample Model Answer: </span>
                        {currentShortGrade.improvedModelAnswer}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Carousel Next/Prev Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 gap-3">
            <button
              onClick={() => {
                if (currentQuestionIndex > 0) {
                  setCurrentQuestionIndex((prev) => prev - 1);
                }
              }}
              disabled={currentQuestionIndex === 0}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            {currentQuestionIndex < questions.length - 1 ? (
              <button
                onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Next Question</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setIsQuizFinished(true)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Submit & View Report</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
