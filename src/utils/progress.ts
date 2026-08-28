import { RevisionProject, TopicProgress, QuizAttemptRecord } from '../types';

export interface TopicMasteryStats {
  lessonCompletedCount: number;
  lessonTotalCount: number;
  lessonPercentage: number;
  
  flashcardsMastered: number;
  flashcardsLearning: number;
  flashcardsUnreviewed: number;
  flashcardsTotal: number;
  flashcardsPercentage: number;

  bestQuizScore: number | null;
  latestQuizScore: number | null;
  quizAttemptsCount: number;
  quizTotalQuestions: number;

  overallMasteryScore: number; // 0 to 100
  masteryTier: 'Unstarted' | 'Getting Started' | 'Developing' | 'Proficient' | 'Mastered';
  tierColor: string; // Tailwind color class
  tierBg: string;

  studyTimeMinutes: number;
  nextRecommendedAction: {
    title: string;
    description: string;
    targetTab: 'sources' | 'teach' | 'notes' | 'quiz';
    actionText: string;
  };
}

export function getDefaultTopicProgress(): TopicProgress {
  return {
    completedSectionIds: [],
    passedCheckpointIds: [],
    flashcardStatuses: {},
    quizAttempts: [],
    totalStudyTimeSeconds: 0,
    lastStudiedAt: Date.now(),
  };
}

export function calculateTopicMastery(project?: RevisionProject): TopicMasteryStats {
  if (!project) {
    return {
      lessonCompletedCount: 0,
      lessonTotalCount: 0,
      lessonPercentage: 0,
      flashcardsMastered: 0,
      flashcardsLearning: 0,
      flashcardsUnreviewed: 0,
      flashcardsTotal: 0,
      flashcardsPercentage: 0,
      bestQuizScore: null,
      latestQuizScore: null,
      quizAttemptsCount: 0,
      quizTotalQuestions: 0,
      overallMasteryScore: 0,
      masteryTier: 'Unstarted',
      tierColor: 'text-slate-500',
      tierBg: 'bg-slate-100 text-slate-700',
      studyTimeMinutes: 0,
      nextRecommendedAction: {
        title: 'Add Study Sources',
        description: 'Import study materials or notes to generate your revision workspace.',
        targetTab: 'sources',
        actionText: 'Add Sources',
      },
    };
  }

  const progress = project.progress || getDefaultTopicProgress();

  // 1. Lesson Progress
  const totalSections = project.lesson?.sections?.length || 0;
  const validCompletedSections = (progress.completedSectionIds || []).filter(
    (id) => !project.lesson?.sections || project.lesson.sections.some((s) => s.id === id)
  );
  const lessonCompletedCount = Math.min(validCompletedSections.length, totalSections);
  const lessonPercentage = totalSections > 0 ? Math.round((lessonCompletedCount / totalSections) * 100) : 0;

  // 2. Flashcard Progress
  const allCards = project.notes?.flashcards || [];
  const flashcardsTotal = allCards.length;
  let flashcardsMastered = 0;
  let flashcardsLearning = 0;

  allCards.forEach((c) => {
    const status = progress.flashcardStatuses?.[c.id] || c.userStatus || 'unreviewed';
    if (status === 'mastered') flashcardsMastered++;
    else if (status === 'learning') flashcardsLearning++;
  });

  const flashcardsUnreviewed = Math.max(0, flashcardsTotal - flashcardsMastered - flashcardsLearning);
  const flashcardsPercentage = flashcardsTotal > 0 ? Math.round((flashcardsMastered / flashcardsTotal) * 100) : 0;

  // 3. Quiz Performance
  const quizAttempts = progress.quizAttempts || [];
  const quizAttemptsCount = quizAttempts.length;
  const bestQuizScore = progress.bestQuizScore ?? (quizAttempts.length > 0 ? Math.max(...quizAttempts.map((q) => q.score)) : null);
  const latestQuizScore = progress.latestQuizScore ?? (quizAttempts.length > 0 ? quizAttempts[quizAttempts.length - 1].score : null);
  const quizTotalQuestions = project.quiz?.questions?.length || 0;

  // 4. Overall Weighted Mastery Calculation
  let overallMasteryScore = 0;
  const hasLesson = totalSections > 0;
  const hasCards = flashcardsTotal > 0;
  const hasQuiz = quizTotalQuestions > 0;

  if (hasLesson && hasCards && hasQuiz) {
    const quizComponent = bestQuizScore !== null ? bestQuizScore : 0;
    overallMasteryScore = Math.round(lessonPercentage * 0.3 + flashcardsPercentage * 0.35 + quizComponent * 0.35);
  } else if (hasLesson && hasCards) {
    overallMasteryScore = Math.round(lessonPercentage * 0.45 + flashcardsPercentage * 0.55);
  } else if (hasCards && hasQuiz) {
    const quizComponent = bestQuizScore !== null ? bestQuizScore : 0;
    overallMasteryScore = Math.round(flashcardsPercentage * 0.5 + quizComponent * 0.5);
  } else if (hasLesson) {
    overallMasteryScore = lessonPercentage;
  } else if (hasCards) {
    overallMasteryScore = flashcardsPercentage;
  } else if (hasQuiz) {
    overallMasteryScore = bestQuizScore ?? 0;
  }

  overallMasteryScore = Math.min(100, Math.max(0, overallMasteryScore));

  // Mastery Tier
  let masteryTier: TopicMasteryStats['masteryTier'] = 'Unstarted';
  let tierColor = 'text-slate-500';
  let tierBg = 'bg-slate-100 text-slate-700 border-slate-200';

  if (overallMasteryScore >= 90) {
    masteryTier = 'Mastered';
    tierColor = 'text-emerald-700';
    tierBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  } else if (overallMasteryScore >= 70) {
    masteryTier = 'Proficient';
    tierColor = 'text-indigo-700';
    tierBg = 'bg-indigo-50 text-indigo-800 border-indigo-200';
  } else if (overallMasteryScore >= 40) {
    masteryTier = 'Developing';
    tierColor = 'text-amber-700';
    tierBg = 'bg-amber-50 text-amber-800 border-amber-200';
  } else if (overallMasteryScore > 0 || (project.sources && project.sources.length > 0)) {
    masteryTier = 'Getting Started';
    tierColor = 'text-blue-700';
    tierBg = 'bg-blue-50 text-blue-800 border-blue-200';
  }

  // Next Recommended Action
  let nextRecommendedAction: TopicMasteryStats['nextRecommendedAction'] = {
    title: 'Start Learning & Revision',
    description: 'Begin exploring the step-by-step lesson chapters.',
    targetTab: 'teach',
    actionText: 'Open Lesson',
  };

  if (!project.lesson && (!project.sources || project.sources.length === 0)) {
    nextRecommendedAction = {
      title: 'Import Study Materials',
      description: 'Add your study link, PDF notes, or lecture slides to generate the revision pack.',
      targetTab: 'sources',
      actionText: 'Add Sources',
    };
  } else if (lessonPercentage < 100 && totalSections > 0) {
    const nextChapterIndex = project.lesson?.sections.findIndex(
      (s) => !validCompletedSections.includes(s.id)
    );
    const chapterNum = nextChapterIndex !== undefined && nextChapterIndex >= 0 ? nextChapterIndex + 1 : 1;
    nextRecommendedAction = {
      title: `Complete Chapter ${chapterNum}`,
      description: `Read through chapter ${chapterNum} and pass the checkpoint knowledge check.`,
      targetTab: 'teach',
      actionText: `Study Chapter ${chapterNum}`,
    };
  } else if (flashcardsPercentage < 80 && flashcardsTotal > 0) {
    const unmastered = flashcardsTotal - flashcardsMastered;
    nextRecommendedAction = {
      title: `Master Remaining Flashcards`,
      description: `You have ${unmastered} flashcards left to master using spaced active recall.`,
      targetTab: 'notes',
      actionText: 'Practice Flashcards',
    };
  } else if (bestQuizScore === null || bestQuizScore < 80) {
    nextRecommendedAction = {
      title: bestQuizScore === null ? 'Take Practice Quiz' : 'Improve Exam Score',
      description:
        bestQuizScore === null
          ? 'Test your active recall with adaptive exam questions and AI marking rubrics.'
          : `Current high score: ${bestQuizScore}%. Aim for 85%+ to achieve full mastery!`,
      targetTab: 'quiz',
      actionText: 'Take Practice Quiz',
    };
  } else {
    nextRecommendedAction = {
      title: 'Topic Mastered! 🎉',
      description: 'You have achieved over 90% topic mastery. Retake practice questions periodically to maintain retention.',
      targetTab: 'quiz',
      actionText: 'Retake Quiz for Retention',
    };
  }

  const studyTimeMinutes = Math.max(1, Math.round((progress.totalStudyTimeSeconds || 0) / 60));

  return {
    lessonCompletedCount,
    lessonTotalCount: totalSections,
    lessonPercentage,
    flashcardsMastered,
    flashcardsLearning,
    flashcardsUnreviewed,
    flashcardsTotal,
    flashcardsPercentage,
    bestQuizScore,
    latestQuizScore,
    quizAttemptsCount,
    quizTotalQuestions,
    overallMasteryScore,
    masteryTier,
    tierColor,
    tierBg,
    studyTimeMinutes,
    nextRecommendedAction,
  };
}
