import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  MessageSquare,
  Volume2,
  VolumeX,
  Send,
  Loader2,
  HelpCircle,
  RefreshCw,
  Zap,
  GraduationCap,
  Copy,
  Check,
  Clock,
  Layers,
  Wand2,
  Languages
} from 'lucide-react';
import { RevisionLesson, LessonSection, ChatMessage, SourceDocument } from '../types';
import { sendTutorChatMessage, adaptLessonSection } from '../services/api';
import { speakText, stopSpeaking, isSpeaking } from '../utils/speech';

interface LessonTutorViewProps {
  lesson?: RevisionLesson;
  sources: SourceDocument[];
  topicTitle: string;
  onGoToNotes: () => void;
  onGoToQuiz: () => void;
  chatHistory: ChatMessage[];
  setChatHistory: (history: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  onUpdateSection?: (sectionIndex: number, updatedSection: LessonSection) => void;
  completedSectionIds?: string[];
  passedCheckpointIds?: string[];
  onToggleSectionCompleted?: (sectionId: string) => void;
  onCheckpointPassed?: (sectionId: string) => void;
  onIncrementStudyTime?: (seconds: number) => void;
  language?: string;
  teachingStyle?: string;
  allowWebSearch?: boolean;
}

export const LessonTutorView: React.FC<LessonTutorViewProps> = ({
  lesson,
  sources,
  topicTitle,
  onGoToNotes,
  onGoToQuiz,
  chatHistory,
  setChatHistory,
  onUpdateSection,
  completedSectionIds = [],
  passedCheckpointIds = [],
  onToggleSectionCompleted,
  onCheckpointPassed,
  onIncrementStudyTime,
  language = 'auto',
  teachingStyle = 'standard',
  allowWebSearch,
}) => {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number | null>>({});
  const [showCheckFeedback, setShowCheckFeedback] = useState<Record<string, boolean>>({});

  // Study timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      if (onIncrementStudyTime && document.visibilityState === 'visible') {
        onIncrementStudyTime(5);
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [onIncrementStudyTime]);

  // Audio State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Section Adaptation State
  const [isAdaptingSection, setIsAdaptingSection] = useState(false);
  const [adaptationSuccess, setAdaptationSuccess] = useState<string | null>(null);

  // Tutor Chat State
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [tutorMode, setTutorMode] = useState<'socratic' | 'simple' | 'exam_prep' | 'deep_dive'>('socratic');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const sections = lesson?.sections || [];
  const currentSection: LessonSection | undefined = sections[currentSectionIndex];

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isSendingChat]);

  // Handle section audio read
  const handleToggleAudio = () => {
    if (isPlayingAudio) {
      stopSpeaking();
      setIsPlayingAudio(false);
    } else if (currentSection) {
      const textToRead = `${currentSection.title}. ${currentSection.summary}. ${currentSection.detailedContent.replace(/[#*`_]/g, '')} ${currentSection.analogy ? `Analogy: ${currentSection.analogy}` : ''}`;
      setIsPlayingAudio(true);
      speakText(
        textToRead,
        () => setIsPlayingAudio(true),
        () => setIsPlayingAudio(false),
        () => setIsPlayingAudio(false),
        language
      );
    }
  };

  useEffect(() => {
    stopSpeaking();
    setIsPlayingAudio(false);
  }, [currentSectionIndex]);

  // Adapt current section with custom instruction
  const handleAdaptCurrentSection = async (instruction: string) => {
    if (!currentSection || isAdaptingSection) return;

    setIsAdaptingSection(true);
    setAdaptationSuccess(null);

    try {
      const updated = await adaptLessonSection(currentSection, topicTitle, sources, instruction, language, allowWebSearch);
      if (onUpdateSection) {
        onUpdateSection(currentSectionIndex, updated);
      }
      setAdaptationSuccess(`Section updated: "${instruction}"`);
      setTimeout(() => setAdaptationSuccess(null), 4000);
    } catch (err: any) {
      console.error('Error adapting section:', err);
    } finally {
      setIsAdaptingSection(false);
    }
  };

  // Handle Checkpoint Quiz Answer
  const handleOptionSelect = (sectionId: string, optionIndex: number) => {
    if (showCheckFeedback[sectionId]) return;

    setSelectedAnswers((prev) => ({ ...prev, [sectionId]: optionIndex }));
    setShowCheckFeedback((prev) => ({ ...prev, [sectionId]: true }));

    const isCorrect = currentSection?.checkQuestion && optionIndex === currentSection.checkQuestion.correctIndex;
    if (isCorrect) {
      if (onCheckpointPassed) {
        onCheckpointPassed(sectionId);
      }
      if (onToggleSectionCompleted && !completedSectionIds.includes(sectionId)) {
        onToggleSectionCompleted(sectionId);
      }
    }
  };

  // Handle Advance chapter
  const handleAdvanceChapter = () => {
    if (currentSection && onToggleSectionCompleted && !completedSectionIds.includes(currentSection.id)) {
      onToggleSectionCompleted(currentSection.id);
    }
    if (currentSectionIndex < sections.length - 1) {
      setCurrentSectionIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleToggleCurrentCompleted = () => {
    if (currentSection && onToggleSectionCompleted) {
      onToggleSectionCompleted(currentSection.id);
    }
  };

  // Handle Tutor Chat submit
  const handleSendChat = async (promptToSend?: string) => {
    const messageContent = promptToSend || chatInput.trim();
    if (!messageContent || isSendingChat) return;

    const userMsg: ChatMessage = {
      id: `chat-${Date.now()}`,
      role: 'user',
      content: messageContent,
      timestamp: Date.now(),
    };

    const updatedHistory = [...chatHistory, userMsg];
    setChatHistory(updatedHistory);
    setChatInput('');
    setIsSendingChat(true);

    try {
      const res = await sendTutorChatMessage(updatedHistory, topicTitle, sources, tutorMode, undefined, language, allowWebSearch);
      const assistantMsg: ChatMessage = {
        id: `chat-res-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        timestamp: Date.now(),
        suggestedQuestions: res.suggestedQuestions,
      };
      setChatHistory((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Error sending chat message:', err);
      const errorMsg: ChatMessage = {
        id: `chat-err-${Date.now()}`,
        role: 'assistant',
        content: `I encountered an issue generating a response: ${err.message || 'Please try asking again or rephrase your question.'}`,
        timestamp: Date.now(),
      };
      setChatHistory((prev) => [...prev, errorMsg]);
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleCopyChat = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(msgId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  if (!lesson || sections.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">No Revision Lesson Generated Yet</h2>
        <p className="text-slate-600 text-sm max-w-md mx-auto mb-6">
          Import links or files on the Sources tab, then click "Start Learning & Revision" to generate your custom step-by-step interactive lesson.
        </p>
      </div>
    );
  }

  const completedCount = completedSectionIds.filter((id) => sections.some((s) => s.id === id)).length;
  const progressPercent = sections.length > 0 ? Math.round((completedCount / sections.length) * 100) : 0;
  const isCurrentSectionDone = currentSection ? completedSectionIds.includes(currentSection.id) : false;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Lesson Header Overview Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                Interactive Revision Lesson
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                <Clock className="w-3.5 h-3.5" />
                ~{lesson.estimatedStudyTimeMinutes || 20} min study
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              {lesson.topicTitle || topicTitle}
            </h1>
          </div>

          {/* Progress tracker */}
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <div className="w-28 bg-slate-200 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
              {completedCount} / {sections.length} Chapters ({progressPercent}%)
            </span>
          </div>
        </div>

        {/* Overview & Objectives */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="md:col-span-2">
            <p className="text-slate-600 leading-relaxed">{lesson.overview}</p>
          </div>
          <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100">
            <p className="font-bold text-indigo-900 mb-1.5 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-indigo-700" />
              Core Objectives
            </p>
            <ul className="space-y-1 text-indigo-800">
              {lesson.learningObjectives?.slice(0, 3).map((obj, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-indigo-500 font-bold">•</span>
                  <span>{obj}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Lesson Reader + Right Socratic AI Tutor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left 7 Columns: Lesson Chapter Viewer */}
        <div className="lg:col-span-7 space-y-6">
          {/* Chapter Navigation Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {sections.map((sec, idx) => {
              const isSelected = idx === currentSectionIndex;
              const isDone = completedSectionIds.includes(sec.id);
              return (
                <button
                  key={sec.id}
                  onClick={() => setCurrentSectionIndex(idx)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : isDone
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/70'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[10px] flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                  )}
                  <span className="max-w-[130px] truncate">{sec.title}</span>
                </button>
              );
            })}
          </div>

          {/* Active Chapter Card */}
          {currentSection && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
              {/* Chapter Header */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                      Chapter {currentSectionIndex + 1} of {sections.length}
                    </span>
                    {isCurrentSectionDone && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        Completed
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mt-1">{currentSection.title}</h2>
                  <p className="text-xs text-slate-600 mt-1 font-medium italic">
                    "{currentSection.summary}"
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Mark Completed Toggle */}
                  <button
                    onClick={handleToggleCurrentCompleted}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isCurrentSectionDone
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                    title={isCurrentSectionDone ? 'Click to unmark chapter' : 'Click to mark chapter as completed'}
                  >
                    <CheckCircle2 className={`w-4 h-4 ${isCurrentSectionDone ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className="hidden sm:inline">{isCurrentSectionDone ? 'Mastered' : 'Mark Done'}</span>
                  </button>

                  {/* Audio Listen Button */}
                  <button
                    onClick={handleToggleAudio}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isPlayingAudio
                        ? 'bg-indigo-600 text-white border-indigo-600 animate-pulse'
                        : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                    }`}
                    title="Listen to chapter explanation (Text-to-Speech)"
                  >
                    {isPlayingAudio ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    <span className="hidden sm:inline">{isPlayingAudio ? 'Stop' : 'Listen'}</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Teaching Adaptation Toolbar */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5 text-[11px]">
                    <Wand2 className="w-3.5 h-3.5 text-indigo-600" />
                    Re-explain this section with custom style:
                  </span>
                  {isAdaptingSection && (
                    <span className="text-indigo-600 flex items-center gap-1 text-[11px] font-medium">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Adapting section...
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => handleAdaptCurrentSection('Teach like I am a beginner, simplify all jargon, and provide intuitive step-by-step breakdowns')}
                    disabled={isAdaptingSection}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 text-slate-700 hover:text-indigo-700 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                  >
                    🍼 Beginner Mode
                  </button>
                  <button
                    onClick={() => handleAdaptCurrentSection('Make it look much more interesting with dramatic real-world applications and vivid storytelling analogies')}
                    disabled={isAdaptingSection}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 text-slate-700 hover:text-indigo-700 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                  >
                    ✨ Make It More Interesting
                  </button>
                  <button
                    onClick={() => handleAdaptCurrentSection(`Explain in ${language === 'auto' ? 'simple, easy to understand English' : language} with clear analogies`)}
                    disabled={isAdaptingSection}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 text-slate-700 hover:text-indigo-700 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                  >
                    <Languages className="w-3 h-3 text-slate-500" />
                    <span>{language === 'auto' ? 'English' : language}</span>
                  </button>
                  <button
                    onClick={() => handleAdaptCurrentSection('Provide high-yield exam marking scheme points, key examiner phrases, and common pitfalls')}
                    disabled={isAdaptingSection}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 text-slate-700 hover:text-indigo-700 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                  >
                    🎯 Exam Marking Scheme
                  </button>
                </div>

                {adaptationSuccess && (
                  <p className="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                    ✓ {adaptationSuccess}
                  </p>
                )}
              </div>

              {/* Intuitive Real-World Analogy */}
              {currentSection.analogy && (
                <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs sm:text-sm">
                  <div className="flex items-center gap-2 font-bold text-amber-800 mb-1.5">
                    <Lightbulb className="w-4 h-4 text-amber-600" />
                    <span>Intuitive Real-World Analogy</span>
                  </div>
                  <p className="leading-relaxed text-amber-950 font-normal">
                    {currentSection.analogy}
                  </p>
                </div>
              )}

              {/* Detailed Markdown Content */}
              <div className="prose prose-sm prose-slate max-w-none text-slate-800 leading-relaxed space-y-4">
                <div className="markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {currentSection.detailedContent}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Key Concept Vocabulary Chips */}
              {currentSection.keyConcepts && currentSection.keyConcepts.length > 0 && (
                <div className="pt-4 border-t border-slate-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    Key Concepts & Terminology
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {currentSection.keyConcepts.map((kc, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-900">{kc.term}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                              kc.importance === 'critical'
                                ? 'bg-rose-100 text-rose-800'
                                : kc.importance === 'important'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {kc.importance}
                          </span>
                        </div>
                        <p className="text-slate-600 text-[11px] leading-relaxed">{kc.definition}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Common Student Pitfalls & Exam Traps */}
              {currentSection.pitfallsToAvoid && currentSection.pitfallsToAvoid.length > 0 && (
                <div className="p-4 rounded-xl bg-rose-50/80 border border-rose-200 text-rose-900 text-xs">
                  <div className="flex items-center gap-2 font-bold text-rose-800 mb-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>Common Exam Traps & Misconceptions</span>
                  </div>
                  <ul className="space-y-1.5 list-disc list-inside text-rose-950">
                    {currentSection.pitfallsToAvoid.map((pitfall, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {pitfall}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Active Recall Checkpoint Question */}
              {currentSection.checkQuestion && (
                <div className="pt-4 border-t border-slate-200">
                  <div className="p-5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-4">
                    <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs sm:text-sm">
                      <HelpCircle className="w-4 h-4 text-indigo-600" />
                      <span>Active Recall Checkpoint</span>
                    </div>

                    <p className="font-semibold text-slate-900 text-xs sm:text-sm">
                      {currentSection.checkQuestion.question}
                    </p>

                    <div className="space-y-2">
                      {currentSection.checkQuestion.options.map((option, optIdx) => {
                        const isSelected = selectedAnswers[currentSection.id] === optIdx;
                        const isFeedbackShown = showCheckFeedback[currentSection.id];
                        const isCorrect = optIdx === currentSection.checkQuestion?.correctIndex;

                        let btnStyle = 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800';
                        if (isFeedbackShown) {
                          if (isCorrect) {
                            btnStyle = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold';
                          } else if (isSelected && !isCorrect) {
                            btnStyle = 'border-rose-500 bg-rose-50 text-rose-900';
                          }
                        } else if (isSelected) {
                          btnStyle = 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold';
                        }

                        return (
                          <button
                            key={optIdx}
                            onClick={() => handleOptionSelect(currentSection.id, optIdx)}
                            disabled={isFeedbackShown}
                            className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-start gap-2.5 cursor-pointer ${btnStyle}`}
                          >
                            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span className="flex-1">{option}</span>
                            {isFeedbackShown && isCorrect && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {showCheckFeedback[currentSection.id] && (
                      <div
                        className={`p-3 rounded-xl text-xs leading-relaxed ${
                          selectedAnswers[currentSection.id] === currentSection.checkQuestion.correctIndex
                            ? 'bg-emerald-100/70 border border-emerald-200 text-emerald-950'
                            : 'bg-rose-100/70 border border-rose-200 text-rose-950'
                        }`}
                      >
                        <p className="font-bold mb-1">
                          {selectedAnswers[currentSection.id] === currentSection.checkQuestion.correctIndex
                            ? 'Spot on! Correct answer.'
                            : 'Not quite. Here is why:'}
                        </p>
                        <p>{currentSection.checkQuestion.explanation}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Bottom Pagination & Navigation */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 gap-3">
                <button
                  onClick={() => {
                    if (currentSectionIndex > 0) {
                      setCurrentSectionIndex((prev) => prev - 1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  disabled={currentSectionIndex === 0}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                {currentSectionIndex < sections.length - 1 ? (
                  <button
                    onClick={handleAdvanceChapter}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Next Chapter</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={onGoToNotes}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Lesson Complete! View Notes</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right 5 Columns: Socratic AI Revision Tutor */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col h-[650px]">
            {/* Tutor Header */}
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Socratic AI Tutor</h3>
                  <p className="text-[10px] text-slate-500">Ask questions, request analogies, or test yourself</p>
                </div>
              </div>

              {chatHistory.length > 0 && (
                <button
                  onClick={() => setChatHistory([])}
                  className="text-[11px] text-slate-400 hover:text-slate-600 p-1 flex items-center gap-1"
                  title="Clear chat history"
                >
                  <RefreshCw className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>

            {/* Tutor Teaching Mode Selector */}
            <div className="py-2.5 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto">
              <button
                onClick={() => setTutorMode('socratic')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  tutorMode === 'socratic'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Socratic Guide
              </button>
              <button
                onClick={() => setTutorMode('simple')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  tutorMode === 'simple'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ELI5 Metaphors
              </button>
              <button
                onClick={() => setTutorMode('exam_prep')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  tutorMode === 'exam_prep'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Exam Marking Tips
              </button>
              <button
                onClick={() => setTutorMode('deep_dive')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  tutorMode === 'deep_dive'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Deep Dive
              </button>
            </div>

            {/* Chat Messages List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3.5 pr-1 text-xs">
              {chatHistory.length === 0 ? (
                <div className="text-center py-8 text-slate-400 space-y-3">
                  <Sparkles className="w-7 h-7 mx-auto text-indigo-400 opacity-80" />
                  <p className="font-semibold text-slate-700">Need help understanding something?</p>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    Try asking for an analogy, requesting an exam sample question, or asking about a confusing concept in Chapter {currentSectionIndex + 1}.
                  </p>
                  <div className="pt-2 space-y-1.5 max-w-xs mx-auto text-left">
                    <button
                      onClick={() =>
                        handleSendChat(`Teach this topic like I am a beginner. Use very simple everyday words and clear analogies for "${currentSection?.title || topicTitle}".`)
                      }
                      className="w-full text-left p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-[11px] transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      🍼 Teach like I am a beginner
                    </button>
                    <button
                      onClick={() =>
                        handleSendChat(`Make this look much more interesting! Share surprising real-life applications and intriguing insights on "${currentSection?.title || topicTitle}".`)
                      }
                      className="w-full text-left p-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      ✨ Make it look more interesting
                    </button>
                    <button
                      onClick={() =>
                        handleSendChat(`Can you give me a simple real-world analogy for "${currentSection?.title || topicTitle}"?`)
                      }
                      className="w-full text-left p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-[11px] transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      💡 Give me an intuitive analogy
                    </button>
                    <button
                      onClick={() =>
                        handleSendChat(`Tolong terangkan topik "${currentSection?.title || topicTitle}" dalam Bahasa Melayu dengan mudah dan jelas.`)
                      }
                      className="w-full text-left p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-[11px] transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      🇲🇾 Terangkan dalam Bahasa Melayu
                    </button>
                    <button
                      onClick={() =>
                        handleSendChat(`What is the most common exam trick question on "${currentSection?.title || topicTitle}"?`)
                      }
                      className="w-full text-left p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-[11px] transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      🎯 What is the trickiest exam question?
                    </button>
                  </div>
                </div>
              ) : (
                chatHistory.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[90%] p-3 rounded-2xl leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-none'
                          : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200/80'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="markdown-body prose-xs">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p>{msg.content}</p>
                      )}
                    </div>

                    {/* Suggested follow-up questions from AI */}
                    {msg.role === 'assistant' && msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                      <div className="mt-2 space-y-1 max-w-[90%]">
                        {msg.suggestedQuestions.map((q, qIdx) => (
                          <button
                            key={qIdx}
                            onClick={() => handleSendChat(q)}
                            className="text-left text-[10px] px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 transition-colors block w-full truncate cursor-pointer"
                          >
                            ↳ {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}

              {isSendingChat && (
                <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-100 text-slate-500 text-xs w-fit">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  <span>Tutor is writing explanation...</span>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Chat Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat();
              }}
              className="pt-3 border-t border-slate-100 flex items-center gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={`Ask tutor about ${currentSection?.title || 'this topic'}...`}
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={isSendingChat}
              />
              <button
                type="submit"
                disabled={isSendingChat || !chatInput.trim()}
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition-colors cursor-pointer flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
