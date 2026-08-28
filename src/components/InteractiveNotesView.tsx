import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Sparkles,
  BookOpen,
  Layers,
  FileText,
  CheckCircle2,
  RotateCw,
  Volume2,
  Shuffle,
  Download,
  Copy,
  Plus,
  Trash2,
  Network,
  Calculator,
  Check,
  Zap,
  ArrowRight,
  ArrowLeft,
  Filter
} from 'lucide-react';
import { StudyNotesData, Flashcard, ConceptNode } from '../types';
import { speakText } from '../utils/speech';
import { exportNotesHTML, exportNotesDoc, exportNotesMarkdown } from '../utils/export';

interface InteractiveNotesViewProps {
  notes?: StudyNotesData;
  topicTitle: string;
  language?: string;
  onGoToQuiz: () => void;
  onUpdateFlashcards?: (updatedCards: Flashcard[]) => void;
}

export const InteractiveNotesView: React.FC<InteractiveNotesViewProps> = ({
  notes,
  topicTitle,
  language = 'auto',
  onGoToQuiz,
  onUpdateFlashcards,
}) => {
  const [activeNotesSubTab, setActiveNotesSubTab] = useState<'notes' | 'flashcards' | 'mindmap' | 'formulas'>('notes');

  // Flashcards state
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cards, setCards] = useState<Flashcard[]>(notes?.flashcards || []);
  const [flashcardFilter, setFlashcardFilter] = useState<'all' | 'unreviewed' | 'mastered' | 'learning'>('all');
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [newCategory, setNewCategory] = useState('Custom Notes');

  // Personal sticky notes state
  const [userCustomNotes, setUserCustomNotes] = useState<string[]>([]);
  const [newStickyInput, setNewStickyInput] = useState('');
  const [copiedNote, setCopiedNote] = useState(false);

  // Selected Concept Node
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    notes?.conceptMap && notes.conceptMap.length > 0 ? notes.conceptMap[0].id : null
  );

  // Sync cards if notes prop changes
  useEffect(() => {
    if (notes?.flashcards) {
      setCards(notes.flashcards);
      setFlashcardIndex(0);
      setIsFlipped(false);
    }
  }, [notes]);

  // Keyboard navigation for flashcards
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeNotesSubTab !== 'flashcards' || isAddingCard) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.key === 'ArrowRight') {
        if (flashcardIndex < filteredCards.length - 1) {
          setIsFlipped(false);
          setFlashcardIndex((prev) => prev + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        if (flashcardIndex > 0) {
          setIsFlipped(false);
          setFlashcardIndex((prev) => prev - 1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  if (!notes) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">No Study Notes Generated Yet</h2>
        <p className="text-slate-600 text-sm max-w-md mx-auto mb-6">
          Import links or files on the Sources tab, then click "Start Learning & Revision" to generate interactive study notes, high-yield flashcards, and concept maps.
        </p>
      </div>
    );
  }

  // Filter flashcards
  const filteredCards = cards.filter((c) => {
    if (flashcardFilter === 'all') return true;
    return (c.userStatus || 'unreviewed') === flashcardFilter;
  });

  const currentCard: Flashcard | undefined = filteredCards[flashcardIndex] || filteredCards[0];

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleCardStatus = (status: 'mastered' | 'learning' | 'unreviewed') => {
    if (!currentCard) return;
    const updated = cards.map((c) => (c.id === currentCard.id ? { ...c, userStatus: status } : c));
    setCards(updated);
    if (onUpdateFlashcards) {
      onUpdateFlashcards(updated);
    }

    // Move to next card
    if (flashcardIndex < filteredCards.length - 1) {
      setIsFlipped(false);
      setFlashcardIndex((prev) => prev + 1);
    } else {
      setIsFlipped(false);
    }
  };

  const handleShuffle = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setFlashcardIndex(0);
    setIsFlipped(false);
  };

  const handleResetCards = () => {
    const reset = cards.map((c) => ({ ...c, userStatus: 'unreviewed' as const }));
    setCards(reset);
    setFlashcardIndex(0);
    setIsFlipped(false);
    if (onUpdateFlashcards) onUpdateFlashcards(reset);
  };

  const handleCardAudio = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    speakText(text, undefined, undefined, undefined, language);
  };

  const handleCreateCustomCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFront.trim() || !newBack.trim()) return;

    const newCard: Flashcard = {
      id: `custom-card-${Date.now()}`,
      front: newFront.trim(),
      back: newBack.trim(),
      category: newCategory.trim() || 'User Note',
      difficulty: 'medium',
      userStatus: 'unreviewed',
    };

    const updated = [newCard, ...cards];
    setCards(updated);
    if (onUpdateFlashcards) onUpdateFlashcards(updated);
    setNewFront('');
    setNewBack('');
    setIsAddingCard(false);
    setFlashcardIndex(0);
  };

  const handleDeleteCard = (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = cards.filter((c) => c.id !== cardId);
    setCards(updated);
    if (onUpdateFlashcards) onUpdateFlashcards(updated);
    if (flashcardIndex >= updated.length) {
      setFlashcardIndex(Math.max(0, updated.length - 1));
    }
  };

  const handleCopySummary = () => {
    navigator.clipboard.writeText(notes.summaryMarkdown);
    setCopiedNote(true);
    setTimeout(() => setCopiedNote(false), 2000);
  };

  const masteredCount = cards.filter((c) => c.userStatus === 'mastered').length;
  const learningCount = cards.filter((c) => c.userStatus === 'learning').length;
  const unreviewedCount = cards.filter((c) => !c.userStatus || c.userStatus === 'unreviewed').length;
  const masteryPercentage = cards.length > 0 ? Math.round((masteredCount / cards.length) * 100) : 0;

  const selectedConceptNode = notes.conceptMap?.find((n) => n.id === selectedNodeId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Sub-Tabs Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs mb-8">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveNotesSubTab('notes')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeNotesSubTab === 'notes'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Master Notes</span>
          </button>

          <button
            onClick={() => setActiveNotesSubTab('flashcards')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeNotesSubTab === 'flashcards'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>3D Flashcards ({cards.length})</span>
            {masteredCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                {masteryPercentage}%
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveNotesSubTab('mindmap')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeNotesSubTab === 'mindmap'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Network className="w-4 h-4" />
            <span>Concept Map</span>
          </button>

          <button
            onClick={() => setActiveNotesSubTab('formulas')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeNotesSubTab === 'formulas'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Formulas & Cheat Sheet</span>
          </button>
        </div>

        <button
          onClick={onGoToQuiz}
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <span>Take Practice Quiz</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. MASTER REVISION NOTES TAB */}
      {/* ========================================================================= */}
      {activeNotesSubTab === 'notes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Markdown Notes Document */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
                <div>
                  <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                    Comprehensive Study Guide
                  </span>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
                    {topicTitle || 'Master Revision Guide'}
                  </h1>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopySummary}
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Copy full notes markdown"
                  >
                    {copiedNote ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span className="hidden sm:inline">{copiedNote ? 'Copied!' : 'Copy'}</span>
                  </button>

                  <div className="relative group">
                    <button
                      className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 focus:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Download options"
                    >
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">Export As</span>
                    </button>
                    {/* Dropdown Menu */}
                    <div className="absolute right-0 mt-2 w-36 bg-white border border-slate-200 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all z-20 overflow-hidden">
                      <button
                        onClick={() => exportNotesMarkdown(notes, (topicTitle || 'revision_notes').toLowerCase().replace(/\s+/g, '_'))}
                        className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors border-b border-slate-100 font-medium"
                      >
                        Markdown (.md)
                      </button>
                      <button
                        onClick={() => exportNotesDoc(notes, (topicTitle || 'revision_notes').toLowerCase().replace(/\s+/g, '_'))}
                        className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors border-b border-slate-100 font-medium"
                      >
                        Word (.doc)
                      </button>
                      <button
                        onClick={() => exportNotesHTML(notes, (topicTitle || 'revision_notes').toLowerCase().replace(/\s+/g, '_'))}
                        className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors border-b border-slate-100 font-medium"
                      >
                        HTML (.html)
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors font-medium"
                      >
                        PDF (Print)
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rendered Markdown Notes */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 sm:p-12 mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50 -mr-20 -mt-20 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-50 -ml-20 -mb-20 pointer-events-none"></div>
                <div className="relative prose prose-slate max-w-none prose-headings:text-indigo-900 prose-h1:text-3xl prose-h1:font-extrabold prose-h2:text-2xl prose-h2:font-bold prose-h2:border-b prose-h2:border-slate-100 prose-h2:pb-2 prose-a:text-indigo-600 hover:prose-a:text-indigo-500 prose-strong:text-slate-900 prose-blockquote:border-l-4 prose-blockquote:border-indigo-500 prose-blockquote:bg-indigo-50/50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:text-slate-700">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {notes.summaryMarkdown}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Key Terms & Quick Takeaways */}
          <div className="lg:col-span-4 space-y-6">
            {/* Rapid-Fire Exam Cheat Sheet */}
            {notes.quickCheatSheet && notes.quickCheatSheet.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-500" />
                  High-Yield Revision Takeaways
                </h3>
                <div className="space-y-2">
                  {notes.quickCheatSheet.map((tip, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/80 text-xs text-amber-950 flex items-start gap-2"
                    >
                      <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-900 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Core Definitions Preview */}
            {notes.formulasAndDefinitions && notes.formulasAndDefinitions.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-indigo-600" />
                  Key Definitions
                </h3>
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {notes.formulasAndDefinitions.slice(0, 5).map((f, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                      <p className="font-bold text-slate-900 mb-1">{f.term}</p>
                      <div className="text-slate-700 bg-white p-2 rounded-lg border border-slate-200 mb-1 prose prose-slate prose-sm max-w-none prose-p:leading-snug prose-p:my-1 text-[11px]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{f.formulaOrMeaning}</ReactMarkdown>
                      </div>
                      {f.notes && <p className="text-[10px] text-slate-500 italic mt-1.5">{f.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. 3D FLASHCARDS TAB */}
      {/* ========================================================================= */}
      {activeNotesSubTab === 'flashcards' && (
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Flashcard Header Controls & Stats */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Active Recall Flashcards</h2>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span className="font-semibold text-emerald-600">{masteredCount} Mastered</span>
                  <span>•</span>
                  <span className="font-semibold text-amber-600">{learningCount} Learning</span>
                  <span>•</span>
                  <span>{unreviewedCount} Unreviewed</span>
                </div>
              </div>
            </div>

            {/* Filter Chips & Action Tools */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  onClick={() => {
                    setFlashcardFilter('all');
                    setFlashcardIndex(0);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                    flashcardFilter === 'all' ? 'bg-white shadow-xs text-indigo-700' : 'text-slate-600'
                  }`}
                >
                  All ({cards.length})
                </button>
                <button
                  onClick={() => {
                    setFlashcardFilter('unreviewed');
                    setFlashcardIndex(0);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                    flashcardFilter === 'unreviewed' ? 'bg-white shadow-xs text-indigo-700' : 'text-slate-600'
                  }`}
                >
                  Unreviewed ({unreviewedCount})
                </button>
                <button
                  onClick={() => {
                    setFlashcardFilter('learning');
                    setFlashcardIndex(0);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                    flashcardFilter === 'learning' ? 'bg-white shadow-xs text-indigo-700' : 'text-slate-600'
                  }`}
                >
                  Learning ({learningCount})
                </button>
                <button
                  onClick={() => {
                    setFlashcardFilter('mastered');
                    setFlashcardIndex(0);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                    flashcardFilter === 'mastered' ? 'bg-white shadow-xs text-indigo-700' : 'text-slate-600'
                  }`}
                >
                  Mastered ({masteredCount})
                </button>
              </div>

              <button
                onClick={handleShuffle}
                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                title="Shuffle Flashcard Deck"
              >
                <Shuffle className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsAddingCard(!isAddingCard)}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs border border-indigo-200 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Card</span>
              </button>
            </div>
          </div>

          {/* Add Custom Flashcard Modal/Card */}
          {isAddingCard && (
            <form
              onSubmit={handleCreateCustomCard}
              className="bg-white rounded-2xl border-2 border-indigo-500 p-6 shadow-sm space-y-4"
            >
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                Create Custom Study Flashcard
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Front / Prompt Question
                  </label>
                  <textarea
                    value={newFront}
                    onChange={(e) => setNewFront(e.target.value)}
                    placeholder="e.g. What is the definition of..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Back / Answer & Explanation
                  </label>
                  <textarea
                    value={newBack}
                    onChange={(e) => setNewBack(e.target.value)}
                    placeholder="e.g. It refers to the process where..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Category (optional)"
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs w-48"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingCard(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 cursor-pointer"
                  >
                    Save Flashcard
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Flashcard Viewer Canvas */}
          {filteredCards.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900 mb-1">No cards in this filter!</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                You have reviewed all cards in this category. Switch back to "All" or reset your deck status.
              </p>
              <button
                onClick={handleResetCards}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 cursor-pointer"
              >
                Reset All Cards to Unreviewed
              </button>
            </div>
          ) : currentCard ? (
            <div className="space-y-4">
              {/* Progress & Card Index */}
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-2">
                <span>
                  Card {flashcardIndex + 1} of {filteredCards.length}
                </span>
                <span className="text-[11px] text-slate-400">
                  Tip: Press <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-700">Space</kbd> to flip,{' '}
                  <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-700">←</kbd>{' '}
                  <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-700">→</kbd> to navigate
                </span>
              </div>

              {/* 3D Flip Card */}
              <div
                onClick={handleFlip}
                className="relative h-80 sm:h-96 w-full rounded-2xl cursor-pointer select-none transition-all duration-300 transform perspective-1000 group"
              >
                <div
                  className={`w-full h-full rounded-2xl border p-8 flex flex-col justify-between transition-all duration-500 shadow-md ${
                    isFlipped
                      ? 'bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 text-white border-indigo-800'
                      : 'bg-white hover:border-indigo-400 text-slate-900 border-slate-200'
                  }`}
                >
                  {/* Top Bar of the Card */}
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                        isFlipped
                          ? 'bg-indigo-800 text-indigo-200 border border-indigo-700'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                      }`}
                    >
                      {currentCard.category || 'Core Concept'}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleCardAudio(isFlipped ? currentCard.back : currentCard.front, e)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isFlipped ? 'hover:bg-indigo-800 text-indigo-300' : 'hover:bg-slate-100 text-slate-500'
                        }`}
                        title="Read aloud"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          currentCard.userStatus === 'mastered'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : currentCard.userStatus === 'learning'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-500/20 text-slate-400'
                        }`}
                      >
                        {currentCard.userStatus || 'unreviewed'}
                      </span>
                    </div>
                  </div>

                  {/* Card Center Content */}
                  <div className="py-4 text-center my-auto overflow-y-auto max-h-56">
                    <span className="text-[11px] font-bold uppercase tracking-wider block mb-2 opacity-60">
                      {isFlipped ? 'Answer & Explanation' : 'Prompt / Question'}
                    </span>
                    <p
                      className={`text-base sm:text-xl font-bold leading-relaxed ${
                        isFlipped ? 'text-indigo-100' : 'text-slate-900'
                      }`}
                    >
                      {isFlipped ? currentCard.back : currentCard.front}
                    </p>
                  </div>

                  {/* Card Bottom Flip Indicator */}
                  <div className="flex items-center justify-between text-[11px] pt-3 border-t border-white/10 opacity-70">
                    <span>Click card or press Space to flip</span>
                    <RotateCw className="w-3.5 h-3.5 animate-spin-slow" />
                  </div>
                </div>
              </div>

              {/* Card Mastery Rating Controls */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleCardStatus('learning')}
                  className="py-3 px-4 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Still Learning</span>
                </button>

                <button
                  onClick={() => handleCardStatus('unreviewed')}
                  className="py-3 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Skip</span>
                </button>

                <button
                  onClick={() => handleCardStatus('mastered')}
                  className="py-3 px-4 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Mastered (Know It)</span>
                </button>
              </div>

              {/* Bottom Carousel Navigation */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => {
                    if (flashcardIndex > 0) {
                      setIsFlipped(false);
                      setFlashcardIndex((prev) => prev - 1);
                    }
                  }}
                  disabled={flashcardIndex === 0}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous Card</span>
                </button>

                <button
                  onClick={() => {
                    if (flashcardIndex < filteredCards.length - 1) {
                      setIsFlipped(false);
                      setFlashcardIndex((prev) => prev + 1);
                    }
                  }}
                  disabled={flashcardIndex === filteredCards.length - 1}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Next Card</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. VISUAL CONCEPT MAP TAB */}
      {/* ========================================================================= */}
      {activeNotesSubTab === 'mindmap' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div>
              <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                Hierarchical Knowledge Graph
              </span>
              <h2 className="text-xl font-bold text-slate-900 mt-0.5">Concept Relationship Map</h2>
              <p className="text-xs text-slate-500 mt-1">
                Explore how core mechanisms, definitions, and applications connect with each other. Click any node to inspect details.
              </p>
            </div>

            {/* Concept Nodes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {notes.conceptMap?.map((node) => {
                const isSelected = node.id === selectedNodeId;
                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNodeId(node.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 uppercase">
                        {node.category}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {node.relatedIds?.length || 0} links
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm mb-1">{node.label}</h3>
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{node.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Inspector Sidebar for Selected Concept */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Concept Inspector
              </h3>

              {selectedConceptNode ? (
                <div className="space-y-4">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                      {selectedConceptNode.category}
                    </span>
                    <h4 className="text-lg font-bold text-slate-900 mt-2">{selectedConceptNode.label}</h4>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                    <p className="font-semibold text-slate-900 mb-1">Description:</p>
                    <p>{selectedConceptNode.description}</p>
                  </div>

                  {selectedConceptNode.relatedIds && selectedConceptNode.relatedIds.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-700 mb-2">Connected Concepts:</p>
                      <div className="space-y-1.5">
                        {selectedConceptNode.relatedIds.map((relId) => {
                          const linked = notes.conceptMap?.find((n) => n.id === relId);
                          if (!linked) return null;
                          return (
                            <button
                              key={relId}
                              onClick={() => setSelectedNodeId(relId)}
                              className="w-full text-left p-2 rounded-lg bg-indigo-50/60 hover:bg-indigo-100 text-xs text-indigo-900 border border-indigo-200 transition-colors flex items-center justify-between cursor-pointer"
                            >
                              <span className="font-semibold">{linked.label}</span>
                              <ArrowRight className="w-3 h-3 text-indigo-600" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400">Click a concept node on the left to view details.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. FORMULAS & CHEAT SHEET TAB */}
      {/* ========================================================================= */}
      {activeNotesSubTab === 'formulas' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
            <div className="pb-4 mb-6 border-b border-slate-100">
              <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                Exam Formula & Vocabulary Sheet
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
                Key Formulas, Laws & Precise Definitions
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                The exact formulas, theorems, and definitions required for full method marks in examinations.
              </p>
            </div>

            {notes.formulasAndDefinitions && notes.formulasAndDefinitions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                      <th className="py-3 px-4 font-bold">Term / Concept</th>
                      <th className="py-3 px-4 font-bold">Formula / Precise Meaning</th>
                      <th className="py-3 px-4 font-bold">Exam Application Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {notes.formulasAndDefinitions.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap align-top">
                          {item.term}
                        </td>
                        <td className="py-3.5 px-4 align-top max-w-xs">
                          <div className="text-indigo-900 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100/50 prose prose-indigo prose-sm max-w-none prose-p:leading-snug prose-p:my-1 text-xs">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.formulaOrMeaning}</ReactMarkdown>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 leading-relaxed align-top max-w-xs">
                          {item.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500">No formula list generated.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
