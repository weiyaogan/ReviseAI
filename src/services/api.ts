import { SourceDocument, RevisionLesson, LessonSection, StudyNotesData, QuizSet, ChatMessage } from '../types';

export interface GradeAnswerResponse {
  score: number;
  isCorrect: boolean;
  strengths: string;
  missingPoints: string;
  aiFeedback: string;
  improvedModelAnswer: string;
}

export interface TutorChatResponse {
  reply: string;
  suggestedQuestions?: string[];
}

export async function fetchUrlContent(url: string): Promise<{ title: string; content: string; url: string }> {
  const response = await fetch('/api/fetch-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to fetch URL (HTTP ${response.status})`);
  }

  return response.json();
}

export async function generateLesson(
  topicTitle: string,
  sources: SourceDocument[],
  customInstruction?: string,
  teachingStyle?: string,
  language?: string,
  allowWebSearch?: boolean
): Promise<RevisionLesson> {
  const response = await fetch('/api/generate-lesson', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topicTitle, sources, customInstruction, teachingStyle, language, allowWebSearch }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to generate lesson (HTTP ${response.status})`);
  }

  return response.json();
}

export async function generateNotes(
  topicTitle: string,
  sources: SourceDocument[],
  customInstruction?: string,
  teachingStyle?: string,
  language?: string,
  allowWebSearch?: boolean,
  lessonStructure?: RevisionLesson
): Promise<StudyNotesData> {
  const response = await fetch('/api/generate-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topicTitle, sources, customInstruction, teachingStyle, language, allowWebSearch, lessonStructure }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to generate study notes (HTTP ${response.status})`);
  }

  return response.json();
}

export async function generateQuiz(
  topicTitle: string,
  sources: SourceDocument[],
  questionCount: number = 8,
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed' = 'medium',
  customInstructionOrTypes?: string | string[],
  teachingStyle?: string,
  language?: string,
  questionTypes?: string[],
  allowWebSearch?: boolean
): Promise<QuizSet> {
  let resolvedCustomInstruction: string | undefined = undefined;
  let resolvedQuestionTypes: string[] = ['multiple_choice', 'true_false', 'fill_in_blank', 'short_answer'];

  if (Array.isArray(customInstructionOrTypes)) {
    resolvedQuestionTypes = customInstructionOrTypes;
  } else if (typeof customInstructionOrTypes === 'string') {
    resolvedCustomInstruction = customInstructionOrTypes;
  }

  if (questionTypes && Array.isArray(questionTypes)) {
    resolvedQuestionTypes = questionTypes;
  }

  const response = await fetch('/api/generate-quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topicTitle,
      sources,
      questionCount,
      difficulty,
      questionTypes: resolvedQuestionTypes,
      customInstruction: resolvedCustomInstruction,
      teachingStyle,
      language,
      allowWebSearch,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to generate quiz (HTTP ${response.status})`);
  }

  return response.json();
}

export async function adaptLessonSection(
  section: LessonSection,
  topicTitle: string,
  sources: SourceDocument[],
  instruction: string,
  language?: string,
  allowWebSearch?: boolean
): Promise<LessonSection> {
  const response = await fetch('/api/adapt-lesson-section', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ section, topicTitle, sources, instruction, language, allowWebSearch }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to adapt lesson section (HTTP ${response.status})`);
  }

  return response.json();
}

export async function gradeShortAnswer(
  question: string,
  studentAnswer: string,
  idealAnswer?: string,
  context?: string,
  allowWebSearch?: boolean
): Promise<GradeAnswerResponse> {
  const response = await fetch('/api/grade-short-answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, studentAnswer, idealAnswer, context, allowWebSearch }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to grade answer (HTTP ${response.status})`);
  }

  return response.json();
}

export async function sendTutorChatMessage(
  messages: ChatMessage[],
  topicTitle: string,
  sources: SourceDocument[],
  tutorMode: 'socratic' | 'simple' | 'exam_prep' | 'deep_dive' = 'socratic',
  customInstruction?: string,
  language?: string,
  allowWebSearch?: boolean
): Promise<TutorChatResponse> {
  const response = await fetch('/api/tutor-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, topicTitle, sources, tutorMode, customInstruction, language, allowWebSearch }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Failed to chat with tutor (HTTP ${response.status})`);
  }

  return response.json();
}

export async function generateProjectTitle(content: string): Promise<string> {
  try {
    const response = await fetch('/api/generate-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!response.ok) return 'New Revision Topic';
    const data = await response.json();
    return data.title || 'New Revision Topic';
  } catch (err) {
    return 'New Revision Topic';
  }
}
