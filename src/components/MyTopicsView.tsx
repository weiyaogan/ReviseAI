import React, { useState } from 'react';
import {
  BookOpen,
  Layers,
  HelpCircle,
  FileText,
  Search,
  Plus,
  Trash2,
  Copy,
  Download,
  Calendar,
  Sparkles,
  ArrowRight,
  Clock,
  Languages,
  CheckCircle2,
  FolderOpen
} from 'lucide-react';
import { RevisionProject } from '../types';
import { calculateTopicMastery } from '../utils/progress';

interface MyTopicsViewProps {
  savedProjects: RevisionProject[];
  currentProjectId?: string;
  onOpenProject: (project: RevisionProject) => void;
  onDeleteProject: (id: string) => void;
  onDuplicateProject: (project: RevisionProject) => void;
  onCreateNewTopic: () => void;
}

export const MyTopicsView: React.FC<MyTopicsViewProps> = ({
  savedProjects,
  currentProjectId,
  onOpenProject,
  onDeleteProject,
  onDuplicateProject,
  onCreateNewTopic,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filter projects by search query
  const filteredProjects = savedProjects.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      (p.language && p.language.toLowerCase().includes(q)) ||
      (p.customInstruction && p.customInstruction.toLowerCase().includes(q)) ||
      p.sources.some((s) => s.title.toLowerCase().includes(q) || (s.content && s.content.toLowerCase().includes(q)))
    );
  });

  // Calculate high-level stats
  const totalCards = savedProjects.reduce((acc, p) => acc + (p.notes?.flashcards?.length || 0), 0);
  const totalQuestions = savedProjects.reduce((acc, p) => acc + (p.quiz?.questions?.length || 0), 0);
  const totalSources = savedProjects.reduce((acc, p) => acc + (p.sources?.length || 0), 0);

  // Export topic data as JSON or Markdown
  const handleExportTopic = (project: RevisionProject) => {
    let exportContent = '';
    let filename = `${project.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Revision.md`;

    if (project.notes?.summaryMarkdown) {
      exportContent = project.notes.summaryMarkdown;
    } else if (project.lesson) {
      exportContent = `# ${project.title}\n\n${project.lesson.overview}\n\n` +
        project.lesson.sections.map(s => `## ${s.title}\n${s.summary}\n\n${s.detailedContent}\n`).join('\n');
    } else {
      exportContent = JSON.stringify(project, null, 2);
      filename = `${project.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_data.json`;
    }

    const blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'Recently';
    const d = new Date(timestamp);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Banner & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-xs">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                My Revision Library
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Browse and resume all your saved revision topics, interactive lessons, notes, and quiz sets.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="create-new-topic-btn"
            onClick={onCreateNewTopic}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Topic</span>
          </button>
        </div>
      </div>

      {/* Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Saved Topics</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{savedProjects.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Sources Studied</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{totalSources}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Flashcards</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{totalCards}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Practice Questions</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{totalQuestions}</p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs mb-6 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search past topics by title, keyword, or language..."
            className="w-full pl-9.5 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-2 py-1 cursor-pointer"
          >
            Clear Search
          </button>
        )}
      </div>

      {/* Topics Grid */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center my-8">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
            {searchQuery ? 'No matching topics found' : 'No saved topics in your library yet'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-6">
            {searchQuery
              ? `No topics match "${searchQuery}". Try a different keyword or clear the search filter.`
              : 'Add your first web link, document, PDF, or study notes to generate your first complete revision workspace.'}
          </p>
          <button
            onClick={onCreateNewTopic}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Start a New Revision Topic</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => {
            const isCurrent = project.id === currentProjectId;
            const sectionCount = project.lesson?.sections?.length || 0;
            const cardCount = project.notes?.flashcards?.length || 0;
            const qCount = project.quiz?.questions?.length || 0;
            const sourceCount = project.sources?.length || 0;
            const mastery = calculateTopicMastery(project);

            return (
              <div
                key={project.id}
                className={`flex flex-col bg-white rounded-2xl border transition-all hover:shadow-md ${
                  isCurrent
                    ? 'border-indigo-500 ring-2 ring-indigo-500/10 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                {/* Card Header */}
                <div className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Active Topic</span>
                        </span>
                      )}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${mastery.tierBg}`}>
                        {mastery.overallMasteryScore}% • {mastery.masteryTier}
                      </span>
                      {project.language && project.language !== 'auto' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          <Languages className="w-3 h-3 text-slate-500" />
                          <span>{project.language}</span>
                        </span>
                      )}
                      {project.teachingStyle && project.teachingStyle !== 'standard' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          {project.teachingStyle}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center gap-1 flex-shrink-0">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(project.lastStudiedAt || project.createdAt)}</span>
                    </div>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base line-clamp-2 hover:text-indigo-600 transition-colors">
                    {project.title}
                  </h3>

                  {/* Mastery Progress Bar */}
                  <div className="mt-3">
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          mastery.overallMasteryScore >= 80
                            ? 'bg-emerald-500'
                            : mastery.overallMasteryScore >= 40
                            ? 'bg-indigo-600'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${mastery.overallMasteryScore}%` }}
                      />
                    </div>
                  </div>

                  {project.customInstruction && (
                    <p className="text-[11px] text-slate-500 line-clamp-1 italic mt-2 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                      "{project.customInstruction}"
                    </p>
                  )}
                </div>

                {/* Module Stats Badges */}
                <div className="px-5 py-2.5 bg-slate-50/70 border-y border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-1" title={`${sourceCount} Source materials`}>
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>{sourceCount} {sourceCount === 1 ? 'src' : 'srcs'}</span>
                  </div>
                  <div className="flex items-center gap-1" title={`${sectionCount} Lesson chapters`}>
                    <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{sectionCount} {sectionCount === 1 ? 'ch' : 'chs'}</span>
                  </div>
                  <div className="flex items-center gap-1" title={`${cardCount} Active Recall Flashcards`}>
                    <Layers className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{cardCount} cards</span>
                  </div>
                  <div className="flex items-center gap-1" title={`${qCount} Exam Practice Questions`}>
                    <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                    <span>{qCount} qs</span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="p-4 pt-3 flex items-center justify-between gap-2 mt-auto">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleExportTopic(project)}
                      title="Export Revision Markdown"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDuplicateProject(project)}
                      title="Duplicate Topic"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    {deleteConfirmId === project.id ? (
                      <div className="flex items-center gap-1 bg-rose-50 p-1 rounded-lg border border-rose-200">
                        <button
                          onClick={() => {
                            onDeleteProject(project.id);
                            setDeleteConfirmId(null);
                          }}
                          className="px-2 py-0.5 text-[10px] font-bold text-white bg-rose-600 rounded-md hover:bg-rose-700 cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-1 text-[10px] text-slate-500 hover:text-slate-700 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(project.id)}
                        title="Delete Topic"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => onOpenProject(project)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs'
                        : 'bg-slate-100 text-slate-800 hover:bg-indigo-600 hover:text-white'
                    }`}
                  >
                    <span>{isCurrent ? 'Continue' : 'Study Now'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
