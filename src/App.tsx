/**
 * ReviseAI - Interactive Study & Revision Platform
 * Analyzes links and uploaded files to teach step-by-step, generate interactive notes & flashcards, and create adaptive practice questions.
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SourceManager } from './components/SourceManager';
import { LessonTutorView } from './components/LessonTutorView';
import { InteractiveNotesView } from './components/InteractiveNotesView';
import { QuizPracticeView } from './components/QuizPracticeView';
import { MyTopicsView } from './components/MyTopicsView';
import { ProgressModal } from './components/ProgressModal';
import {
  SourceDocument,
  RevisionLesson,
  StudyNotesData,
  QuizSet,
  ChatMessage,
  RevisionProject,
  LessonSection
} from './types';
import { generateLesson, generateNotes, generateQuiz, generateProjectTitle } from './services/api';
import { calculateTopicMastery } from './utils/progress';
import { Sparkles, AlertCircle } from 'lucide-react';
import { onAuthStateChanged, User, auth, db } from './lib/firebase';
import { LoginView } from './components/LoginView';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const STORAGE_KEY_LIBRARY = 'revise_ai_study_library_v3';
const STORAGE_KEY_LEGACY = 'revise_ai_study_workspace_v2';

function createNewProject(initialTitle = ''): RevisionProject {
  return {
    id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    title: initialTitle,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sources: [],
    language: 'auto',
    teachingStyle: 'standard',
    customInstruction: '',
    allowWebSearch: false,
    chatHistory: [],
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'topics' | 'sources' | 'teach' | 'notes' | 'quiz'>('sources');
  const [projects, setProjects] = useState<RevisionProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string>('');
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Generation loading state
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setIsAuthLoading(false);
        return;
      }

      // Load from Firestore when user signs in
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(userRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.projects && Array.isArray(data.projects) && data.projects.length > 0) {
            setProjects(data.projects);
            setCurrentProjectId(data.projects[0].id);
            if (data.projects[0].lesson) {
              setActiveTab('teach');
            } else {
              setActiveTab('sources');
            }
          } else {
             // Initialize with fresh project if empty in cloud
            const fresh = createNewProject();
            setProjects([fresh]);
            setCurrentProjectId(fresh.id);
          }
        } else {
          // If no cloud data, try to migrate from local storage or start fresh
          const savedLibrary = localStorage.getItem(STORAGE_KEY_LIBRARY);
          let initialProjects = [createNewProject()];
          if (savedLibrary) {
             const parsed = JSON.parse(savedLibrary);
             if (Array.isArray(parsed) && parsed.length > 0) {
                initialProjects = parsed;
             }
          }
          setProjects(initialProjects);
          setCurrentProjectId(initialProjects[0].id);
          // Save initial data to cloud
          await setDoc(userRef, { projects: initialProjects, updatedAt: Date.now() }, { merge: true });
        }
      } catch (err) {
        console.warn("Warning: Could not fetch user data from Firestore (client may be offline). Falling back to local storage.", err);
        // Fallback to local storage if Firestore fails
        const savedLibrary = localStorage.getItem(STORAGE_KEY_LIBRARY);
        if (savedLibrary) {
          const parsed = JSON.parse(savedLibrary);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setProjects(parsed);
            setCurrentProjectId(parsed[0].id);
          }
        } else {
          const fresh = createNewProject();
          setProjects([fresh]);
          setCurrentProjectId(fresh.id);
        }
      } finally {
        setIsAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Persist projects to localStorage and Firestore whenever changed
  useEffect(() => {
    if (projects.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY_LIBRARY, JSON.stringify(projects));
      } catch (e) {
        console.warn('Failed to save revision library to localStorage:', e);
      }
      
      // Also sync to Firestore if logged in
      if (user && !isAuthLoading) {
         try {
            const userRef = doc(db, 'users', user.uid);
            setDoc(userRef, { projects, updatedAt: Date.now() }, { merge: true }).catch(e => {
               console.warn("Failed to sync to Firestore in background", e);
            });
         } catch(e) {
            console.warn("Failed to initiate Firestore sync", e);
         }
      }
    }
  }, [projects, user, isAuthLoading]);

  // Auto-scroll to top when tab or project changes
  useEffect(() => {
    const scrollToTop = () => {
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
    };
    
    scrollToTop();
    // Use multiple timeouts to guarantee scroll after React renders
    setTimeout(scrollToTop, 10);
    setTimeout(scrollToTop, 50);
    setTimeout(scrollToTop, 100);
  }, [activeTab, currentProjectId]);

  // Current active project accessor
  const currentProject = projects.find((p) => p.id === currentProjectId) || projects[0] || createNewProject();
  const currentMastery = calculateTopicMastery(currentProject);

  // Helper to update current project immutably
  const updateCurrentProject = (updater: (prev: RevisionProject) => RevisionProject) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === currentProject.id) {
          const updated = updater(p);
          return { ...updated, updatedAt: Date.now() };
        }
        return p;
      })
    );
  };

  // State setters for active project
  const setTopicTitle = (title: string) => {
    updateCurrentProject((p) => ({ ...p, title }));
  };

  const setLanguage = (language: string) => {
    updateCurrentProject((p) => ({ ...p, language }));
  };

  const setTeachingStyle = (teachingStyle: string) => {
    updateCurrentProject((p) => ({ ...p, teachingStyle }));
  };

  const setCustomInstruction = (customInstruction: string) => {
    updateCurrentProject((p) => ({ ...p, customInstruction }));
  };

  const setAllowWebSearch = (allowWebSearch: boolean) => {
    updateCurrentProject((p) => ({ ...p, allowWebSearch }));
  };

  const handleAddSource = (newSource: SourceDocument) => {
    updateCurrentProject((p) => ({
      ...p,
      sources: [...p.sources, newSource],
      title: p.title || newSource.title || 'Revision Topic',
    }));
  };

  const handleRemoveSource = (id: string) => {
    updateCurrentProject((p) => ({
      ...p,
      sources: p.sources.filter((s) => s.id !== id),
    }));
  };

  const handleClearSources = () => {
    updateCurrentProject((p) => ({
      ...p,
      sources: [],
    }));
  };

  const handleUpdateSection = (sectionIndex: number, updatedSection: LessonSection) => {
    updateCurrentProject((p) => {
      if (!p.lesson) return p;
      const updatedSections = [...p.lesson.sections];
      updatedSections[sectionIndex] = updatedSection;
      return {
        ...p,
        lesson: {
          ...p.lesson,
          sections: updatedSections,
        },
      };
    });
  };

  // Project Library actions
  const handleCreateNewTopic = () => {
    const newProj = createNewProject();
    setProjects((prev) => [newProj, ...prev]);
    setCurrentProjectId(newProj.id);
    setActiveTab('sources');
  };

  const handleOpenProject = (project: RevisionProject) => {
    setCurrentProjectId(project.id);
    if (project.lesson) {
      setActiveTab('teach');
    } else {
      setActiveTab('sources');
    }
  };

  const handleDeleteProject = (id: string) => {
    setProjects((prev) => {
      const remaining = prev.filter((p) => p.id !== id);
      if (remaining.length === 0) {
        const fresh = createNewProject();
        setCurrentProjectId(fresh.id);
        return [fresh];
      }
      if (currentProjectId === id) {
        setCurrentProjectId(remaining[0].id);
      }
      return remaining;
    });
  };

  const handleDuplicateProject = (project: RevisionProject) => {
    const duplicated: RevisionProject = {
      ...project,
      id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      title: `${project.title} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setProjects((prev) => [duplicated, ...prev]);
    setCurrentProjectId(duplicated.id);
  };

  // Generate All Revision Modules (Lesson, Notes, Quiz) from sources
  const handleGenerateAll = async () => {
    const activeSources = currentProject.sources || [];
    
    let title = currentProject.title.trim();
    if (!title && activeSources.length === 0) {
      setGlobalError('Please provide a topic title or at least one source.');
      return;
    }

    setIsLoading(true);
    setGlobalError(null);

    if (!title || title === 'Untitled Project') {
      setLoadingStep('Crafting a suitable title for your topic...');
      const combinedText = activeSources.map(s => s.content).join('\n').substring(0, 4000);
      title = await generateProjectTitle(combinedText) || 'Revision Topic';
      setTopicTitle(title);
    }

    try {
      // Step 1: Generate Interactive Lesson
      setLoadingStep('Analyzing sources & crafting step-by-step lesson...');
      const generatedLesson = await generateLesson(
        title,
        activeSources,
        currentProject.customInstruction,
        currentProject.teachingStyle,
        currentProject.language,
        currentProject.allowWebSearch
      );

      // Step 2: Generate Interactive Notes & Flashcards
      setLoadingStep('Generating summary notes, 3D flashcards & concept map...');
      const generatedNotes = await generateNotes(
        title,
        activeSources,
        currentProject.customInstruction,
        currentProject.teachingStyle,
        currentProject.language,
        currentProject.allowWebSearch,
        generatedLesson
      );

      // Step 3: Generate Practice Questions
      setLoadingStep('Creating practice questions & exam marking rubrics...');
      const generatedQuiz = await generateQuiz(
        title,
        activeSources,
        8,
        'medium',
        currentProject.customInstruction,
        currentProject.teachingStyle,
        currentProject.language,
        undefined, // questionTypes
        currentProject.allowWebSearch
      );

      // Update active project with all generated revision assets
      updateCurrentProject((p) => ({
        ...p,
        title,
        lesson: generatedLesson,
        notes: generatedNotes,
        quiz: generatedQuiz,
        chatHistory: [],
      }));

      // Transition to Teaching view once completed
      setActiveTab('teach');
    } catch (err: any) {
      console.error('Error generating revision materials:', err);
      setGlobalError(
        err.message || 'Failed to generate study materials. Please check your source material and try again.'
      );
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        topicTitle={currentProject.title}
        setTopicTitle={setTopicTitle}
        sourceCount={currentProject.sources.length}
        savedTopicsCount={projects.length}
        hasLesson={!!currentProject.lesson}
        hasNotes={!!currentProject.notes}
        hasQuiz={!!currentProject.quiz}
        masteryScore={currentMastery.overallMasteryScore}
        masteryTier={currentMastery.masteryTier}
        onOpenProgressModal={() => setIsProgressModalOpen(true)}
        onNewTopic={handleCreateNewTopic}
        user={user}
      />

      <ProgressModal
        project={currentProject}
        isOpen={isProgressModalOpen}
        onClose={() => setIsProgressModalOpen(false)}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          setIsProgressModalOpen(false);
        }}
        onResetProgress={() => {
          updateCurrentProject((p) => ({
            ...p,
            progress: undefined,
          }));
          setIsProgressModalOpen(false);
        }}
      />

      {/* Global Error Banner */}
      {globalError && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{globalError}</span>
            </div>
            <button
              onClick={() => setGlobalError(null)}
              className="text-rose-600 hover:text-rose-800 font-bold text-xs cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main App Content View */}
      <main className="flex-1">
        {activeTab === 'topics' && (
          <MyTopicsView
            savedProjects={projects}
            currentProjectId={currentProjectId}
            onOpenProject={handleOpenProject}
            onDeleteProject={handleDeleteProject}
            onDuplicateProject={handleDuplicateProject}
            onCreateNewTopic={handleCreateNewTopic}
          />
        )}

        {activeTab === 'sources' && (
          <SourceManager
            sources={currentProject.sources}
            onAddSource={handleAddSource}
            onRemoveSource={handleRemoveSource}
            onClearSources={handleClearSources}
            topicTitle={currentProject.title}
            setTopicTitle={setTopicTitle}
            language={currentProject.language}
            setLanguage={setLanguage}
            teachingStyle={currentProject.teachingStyle}
            setTeachingStyle={setTeachingStyle}
            customInstruction={currentProject.customInstruction}
            setCustomInstruction={setCustomInstruction}
            allowWebSearch={currentProject.allowWebSearch}
            setAllowWebSearch={setAllowWebSearch}
            onGenerateAll={handleGenerateAll}
            isLoading={isLoading}
            loadingStep={loadingStep}
          />
        )}

        {activeTab === 'teach' && (
          <LessonTutorView
            lesson={currentProject.lesson}
            sources={currentProject.sources}
            topicTitle={currentProject.title}
            onGoToNotes={() => setActiveTab('notes')}
            onGoToQuiz={() => setActiveTab('quiz')}
            chatHistory={currentProject.chatHistory || []}
            setChatHistory={(newChat) => {
              updateCurrentProject((p) => ({
                ...p,
                chatHistory: typeof newChat === 'function' ? newChat(p.chatHistory || []) : newChat,
              }));
            }}
            onUpdateSection={handleUpdateSection}
            completedSectionIds={currentProject.progress?.completedSectionIds || []}
            passedCheckpointIds={currentProject.progress?.passedCheckpointIds || []}
            onToggleSectionCompleted={(sectionId) => {
              updateCurrentProject((p) => {
                const prog = p.progress || { ...import('./utils/progress').then(m => m.getDefaultTopicProgress()) as any, completedSectionIds: [], passedCheckpointIds: [], flashcardStatuses: {}, quizAttempts: [], totalStudyTimeSeconds: 0, lastStudiedAt: Date.now() }; // Inlined default fallback
                const isCompleted = prog.completedSectionIds.includes(sectionId);
                const updatedIds = isCompleted 
                  ? prog.completedSectionIds.filter(id => id !== sectionId)
                  : [...prog.completedSectionIds, sectionId];
                return { ...p, progress: { ...prog, completedSectionIds: updatedIds, lastStudiedAt: Date.now() } };
              });
            }}
            onCheckpointPassed={(sectionId) => {
              updateCurrentProject((p) => {
                const prog = p.progress || { completedSectionIds: [], passedCheckpointIds: [], flashcardStatuses: {}, quizAttempts: [], totalStudyTimeSeconds: 0, lastStudiedAt: Date.now() };
                if (!prog.passedCheckpointIds.includes(sectionId)) {
                  return { ...p, progress: { ...prog, passedCheckpointIds: [...prog.passedCheckpointIds, sectionId], lastStudiedAt: Date.now() } };
                }
                return p;
              });
            }}
            onIncrementStudyTime={(seconds) => {
              updateCurrentProject((p) => {
                const prog = p.progress || { completedSectionIds: [], passedCheckpointIds: [], flashcardStatuses: {}, quizAttempts: [], totalStudyTimeSeconds: 0, lastStudiedAt: Date.now() };
                return { ...p, progress: { ...prog, totalStudyTimeSeconds: (prog.totalStudyTimeSeconds || 0) + seconds } };
              });
            }}
            language={currentProject.language}
            teachingStyle={currentProject.teachingStyle}
            allowWebSearch={currentProject.allowWebSearch}
          />
        )}

        {activeTab === 'notes' && (
          <InteractiveNotesView
            notes={currentProject.notes}
            topicTitle={currentProject.title}
            language={currentProject.language}
            onGoToQuiz={() => setActiveTab('quiz')}
            onUpdateFlashcards={(updatedCards) => {
              if (currentProject.notes) {
                updateCurrentProject((p) => ({
                  ...p,
                  notes: p.notes ? { ...p.notes, flashcards: updatedCards } : undefined,
                }));
              }
            }}
          />
        )}

        {activeTab === 'quiz' && (
          <QuizPracticeView
            currentQuiz={currentProject.quiz}
            sources={currentProject.sources}
            topicTitle={currentProject.title}
            onSetQuiz={(newQuiz) => {
              updateCurrentProject((p) => ({
                ...p,
                quiz: newQuiz,
              }));
            }}
            onGoToLesson={() => setActiveTab('teach')}
            onGoToNotes={() => setActiveTab('notes')}
            onQuizAttemptCompleted={(score, total, timeSpentSecs) => {
              updateCurrentProject((p) => {
                const prog = p.progress || { ...import('./utils/progress').then(m => m.getDefaultTopicProgress()) as any, completedSectionIds: [], passedCheckpointIds: [], flashcardStatuses: {}, quizAttempts: [], totalStudyTimeSeconds: 0, lastStudiedAt: Date.now() };
                const newAttempt = { timestamp: Date.now(), score, totalQuestions: total, timeSpentSeconds: timeSpentSecs };
                return { 
                  ...p, 
                  progress: { 
                    ...prog, 
                    quizAttempts: [...prog.quizAttempts, newAttempt],
                    totalStudyTimeSeconds: (prog.totalStudyTimeSeconds || 0) + timeSpentSecs,
                    lastStudiedAt: Date.now()
                  } 
                };
              });
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/80 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>ReviseAI • Socratic Revision & Learning Companion</span>
          </p>
          <p className="text-slate-400">
            Source-Grounded • Active Recall • Multiple Languages • Step-by-Step Mastery
          </p>
        </div>
      </footer>
    </div>
  );
}

