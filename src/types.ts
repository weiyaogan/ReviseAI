export type SourceType = 'file' | 'link' | 'text';

export interface SourceDocument {
  id: string;
  type: SourceType;
  title: string;
  content: string; // text content or summary
  fileName?: string;
  fileSize?: string;
  fileMimeType?: string;
  base64Data?: string; // for image/doc analysis
  url?: string;
  uploadedAt: number;
}

export interface KeyConcept {
  term: string;
  definition: string;
  importance: 'critical' | 'important' | 'helpful';
  example?: string;
}

export interface LessonSection {
  id: string;
  title: string;
  summary: string;
  detailedContent: string; // Markdown formatted
  analogy?: string;
  keyConcepts: KeyConcept[];
  pitfallsToAvoid?: string[];
  checkQuestion?: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}

export interface RevisionLesson {
  topicTitle: string;
  overview: string;
  learningObjectives: string[];
  estimatedStudyTimeMinutes: number;
  sections: LessonSection[];
  examTips: string[];
  language?: string;
  teachingStyle?: string;
  customInstruction?: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  userStatus?: 'unreviewed' | 'mastered' | 'learning';
}

export interface ConceptNode {
  id: string;
  label: string;
  category: string;
  description: string;
  relatedIds: string[];
}

export interface StudyNotesData {
  summaryMarkdown: string;
  flashcards: Flashcard[];
  conceptMap: ConceptNode[];
  formulasAndDefinitions: Array<{
    term: string;
    formulaOrMeaning: string;
    notes: string;
  }>;
  quickCheatSheet: string[];
  language?: string;
}

export type QuestionType = 'multiple_choice' | 'true_false' | 'fill_in_blank' | 'short_answer';

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[]; // for multiple_choice and true_false
  correctAnswer: string | number; // index or string
  explanation: string;
  hint?: string;
  sourceReference?: string;
}

export interface QuizSet {
  id: string;
  topicTitle: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  questions: QuizQuestion[];
  generatedAt: number;
  language?: string;
}

export interface UserAnswerRecord {
  questionId: string;
  userAnswer: string | number;
  isCorrect?: boolean;
  score?: number; // 0 to 100 for short answer
  aiFeedback?: string;
  reviewed: boolean;
}

export interface QuizResult {
  totalQuestions: number;
  correctCount: number;
  percentage: number;
  timeSpentSeconds: number;
  answers: Record<string, UserAnswerRecord>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  suggestedQuestions?: string[];
}

export interface QuizAttemptRecord {
  id: string;
  timestamp: number;
  score: number; // 0-100 percentage
  correctCount: number;
  totalQuestions: number;
  timeSpentSeconds: number;
  difficulty?: string;
}

export interface TopicProgress {
  completedSectionIds: string[]; // lesson section IDs marked as read/completed
  passedCheckpointIds: string[]; // lesson section checkpoint question IDs answered correctly
  flashcardStatuses: Record<string, 'unreviewed' | 'learning' | 'mastered'>;
  quizAttempts: QuizAttemptRecord[];
  bestQuizScore?: number;
  latestQuizScore?: number;
  totalStudyTimeSeconds: number;
  lastStudiedAt: number;
}

export interface RevisionProject {
  id: string;
  title: string;
  sources: SourceDocument[];
  lesson?: RevisionLesson;
  notes?: StudyNotesData;
  quiz?: QuizSet;
  quizSets?: QuizSet[];
  chatHistory: ChatMessage[];
  progress?: TopicProgress;
  createdAt: number;
  lastStudiedAt?: number;
  updatedAt?: number;
  language?: string;
  teachingStyle?: string;
  customInstruction?: string;
  allowWebSearch?: boolean;
}

