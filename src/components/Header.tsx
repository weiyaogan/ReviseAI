import React, { useState, useEffect } from 'react';
import { BookOpen, Sparkles, FileText, HelpCircle, Plus, Layers, FolderOpen, Trophy, Edit2, LogIn, LogOut } from 'lucide-react';
import { signInWithGoogle, logOut, User } from '../lib/firebase';

interface HeaderProps {
  activeTab: 'topics' | 'sources' | 'teach' | 'notes' | 'quiz';
  setActiveTab: (tab: 'topics' | 'sources' | 'teach' | 'notes' | 'quiz') => void;
  topicTitle: string;
  setTopicTitle?: (t: string) => void;
  sourceCount: number;
  savedTopicsCount: number;
  hasLesson: boolean;
  hasNotes: boolean;
  hasQuiz: boolean;
  masteryScore?: number;
  masteryTier?: string;
  onOpenProgressModal?: () => void;
  onNewTopic: () => void;
  user: User | null;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  topicTitle,
  setTopicTitle,
  sourceCount,
  savedTopicsCount,
  hasLesson,
  hasNotes,
  hasQuiz,
  masteryScore = 0,
  masteryTier = 'Unstarted',
  onOpenProgressModal,
  onNewTopic,
  user,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(topicTitle);

  useEffect(() => {
    setTempTitle(topicTitle);
  }, [topicTitle]);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (setTopicTitle && tempTitle.trim() && tempTitle !== topicTitle) {
      setTopicTitle(tempTitle.trim());
    } else {
      setTempTitle(topicTitle); // Revert
    }
  };

  const handleAuth = async () => {
    if (user) {
      await logOut();
    } else {
      await signInWithGoogle();
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo and Topic Info */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setActiveTab('topics')}
              className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm flex-shrink-0 hover:bg-indigo-700 transition-colors cursor-pointer"
              title="View My Topics"
            >
              <Sparkles className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-lg tracking-tight">ReviseAI</span>
                
                {/* Mastery Progress Pill */}
                {onOpenProgressModal && (hasLesson || hasNotes || hasQuiz) && (
                  <button
                    onClick={onOpenProgressModal}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold transition-transform hover:scale-105 cursor-pointer ${
                      masteryScore >= 80
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : masteryScore >= 40
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    }`}
                    title="Click to view detailed Study Progress & Mastery breakdown"
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <span>{masteryScore}% Mastery</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5 max-w-[180px] sm:max-w-xs md:max-w-md">
                {isEditingTitle && setTopicTitle ? (
                  <input
                    type="text"
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    onBlur={handleTitleSubmit}
                    onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
                    className="text-xs text-slate-800 font-medium bg-slate-100 border border-slate-300 rounded px-1.5 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    autoFocus
                  />
                ) : (
                  <div 
                    className={`text-xs text-slate-500 truncate flex items-center gap-1 ${setTopicTitle ? 'cursor-pointer hover:text-slate-700 group' : ''}`}
                    onClick={() => setTopicTitle && setIsEditingTitle(true)}
                    title={setTopicTitle ? "Click to edit project name" : ""}
                  >
                    {topicTitle ? (
                      <span className="text-slate-800 font-medium truncate">{topicTitle}</span>
                    ) : (
                      'Add links, files, or notes to start'
                    )}
                    {setTopicTitle && topicTitle && (
                      <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Center Tabs Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
            <button
              id="nav-topics-btn"
              onClick={() => setActiveTab('topics')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'topics'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              <span>My Topics</span>
              {savedTopicsCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-bold">
                  {savedTopicsCount}
                </span>
              )}
            </button>

            {activeTab !== 'topics' && (
              <>
                <button
                  id="nav-sources-btn"
                  onClick={() => setActiveTab('sources')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeTab === 'sources'
                      ? 'bg-white text-indigo-700 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Sources</span>
                  {sourceCount > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-bold">
                      {sourceCount}
                    </span>
                  )}
                </button>

                <button
                  id="nav-teach-btn"
                  onClick={() => topicTitle && setActiveTab('teach')}
                  disabled={!topicTitle}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    !topicTitle ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    activeTab === 'teach'
                      ? 'bg-white text-indigo-700 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Teach Me</span>
                  {hasLesson && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                </button>

                <button
                  id="nav-notes-btn"
                  onClick={() => topicTitle && setActiveTab('notes')}
                  disabled={!topicTitle}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    !topicTitle ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    activeTab === 'notes'
                      ? 'bg-white text-indigo-700 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Notes & Flashcards</span>
                  {hasNotes && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                </button>

                <button
                  id="nav-quiz-btn"
                  onClick={() => topicTitle && setActiveTab('quiz')}
                  disabled={!topicTitle}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    !topicTitle ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    activeTab === 'quiz'
                      ? 'bg-white text-indigo-700 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>Practice & Quizzes</span>
                  {hasQuiz && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                </button>
              </>
            )}
          </nav>

          {/* Right Action Tools */}
          <div className="flex items-center gap-3">
            {/* New Topic Button */}
            <button
              id="new-topic-btn"
              onClick={onNewTopic}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
              title="Start a new revision topic"
            >
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>New Topic</span>
            </button>
            
            {/* User Profile / Login */}
            {user ? (
              <div className="flex items-center gap-2">
                <img 
                  src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || user.email}&background=random`} 
                  alt="User Profile" 
                  className="w-8 h-8 rounded-full border border-slate-200 shadow-sm"
                  title={user.displayName || user.email || 'User'}
                />
                <button
                  onClick={handleAuth}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleAuth}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign in</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Tabs */}
        <div className="flex md:hidden items-center justify-between py-2 border-t border-slate-100 overflow-x-auto gap-1">
          <button
            onClick={() => setActiveTab('topics')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold text-center whitespace-nowrap transition-colors ${
              activeTab === 'topics' ? 'bg-indigo-600 text-white' : 'text-slate-600 bg-slate-100'
            }`}
          >
            My Topics ({savedTopicsCount})
          </button>
          
          {activeTab !== 'topics' && (
            <>
              <button
                onClick={() => setActiveTab('sources')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold text-center whitespace-nowrap transition-colors ${
                  activeTab === 'sources' ? 'bg-indigo-600 text-white' : 'text-slate-600 bg-slate-100'
                }`}
              >
                Sources ({sourceCount})
              </button>
              <button
                onClick={() => topicTitle && setActiveTab('teach')}
                disabled={!topicTitle}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold text-center whitespace-nowrap transition-colors ${
                  !topicTitle ? 'opacity-50 cursor-not-allowed' : ''
                } ${
                  activeTab === 'teach' ? 'bg-indigo-600 text-white' : 'text-slate-600 bg-slate-100'
                }`}
              >
                Teach
              </button>
              <button
                onClick={() => topicTitle && setActiveTab('notes')}
                disabled={!topicTitle}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold text-center whitespace-nowrap transition-colors ${
                  !topicTitle ? 'opacity-50 cursor-not-allowed' : ''
                } ${
                  activeTab === 'notes' ? 'bg-indigo-600 text-white' : 'text-slate-600 bg-slate-100'
                }`}
              >
                Notes
              </button>
              <button
                onClick={() => topicTitle && setActiveTab('quiz')}
                disabled={!topicTitle}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold text-center whitespace-nowrap transition-colors ${
                  !topicTitle ? 'opacity-50 cursor-not-allowed' : ''
                } ${
                  activeTab === 'quiz' ? 'bg-indigo-600 text-white' : 'text-slate-600 bg-slate-100'
                }`}
              >
                Quiz
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

