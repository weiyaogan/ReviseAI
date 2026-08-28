import React, { useState, useRef } from 'react';
import {
  Link as LinkIcon,
  Upload,
  FileText,
  Trash2,
  Sparkles,
  ArrowRight,
  AlertCircle,
  FileUp,
  File,
  Image as ImageIcon,
  Globe,
  Loader2,
  ExternalLink,
  BookOpen,
  HelpCircle,
  Layers,
  FileCheck
} from 'lucide-react';
import { SourceDocument } from '../types';
import { fetchUrlContent } from '../services/api';

interface SourceManagerProps {
  sources: SourceDocument[];
  onAddSource: (source: SourceDocument) => void;
  onRemoveSource: (id: string) => void;
  onClearSources: () => void;
  topicTitle: string;
  setTopicTitle: (title: string) => void;
  language?: string;
  setLanguage?: (lang: string) => void;
  teachingStyle?: string;
  setTeachingStyle?: (style: string) => void;
  customInstruction?: string;
  setCustomInstruction?: (instruction: string) => void;
  allowWebSearch?: boolean;
  setAllowWebSearch?: (allow: boolean) => void;
  onGenerateAll: () => void;
  isLoading: boolean;
  loadingStep: string;
}

export const SourceManager: React.FC<SourceManagerProps> = ({
  sources,
  onAddSource,
  onRemoveSource,
  onClearSources,
  topicTitle,
  setTopicTitle,
  language = 'auto',
  setLanguage,
  teachingStyle = 'standard',
  setTeachingStyle,
  customInstruction = '',
  setCustomInstruction,
  allowWebSearch = false,
  setAllowWebSearch,
  onGenerateAll,
  isLoading,
  loadingStep,
}) => {
  const [sourceMode, setSourceMode] = useState<'link' | 'upload' | 'text'>('link');
  const [urlInput, setUrlInput] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const [textTitleInput, setTextTitleInput] = useState('');
  const [textContentInput, setTextContentInput] = useState('');

  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle URL fetch
  const handleFetchUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setIsFetchingUrl(true);
    setUrlError(null);

    try {
      const data = await fetchUrlContent(urlInput.trim());
      const newSource: SourceDocument = {
        id: `src-url-${Date.now()}`,
        type: 'link',
        title: data.title || urlInput,
        content: data.content,
        url: data.url,
        uploadedAt: Date.now(),
      };
      onAddSource(newSource);
      if (!topicTitle.trim() && data.title) {
        setTopicTitle(data.title);
      }
      setUrlInput('');
    } catch (err: any) {
      console.error('URL error:', err);
      setUrlError(err.message || 'Could not fetch URL. You can paste the text directly into the "Paste Notes" tab.');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  // Handle Direct Text Paste
  const handleAddTextSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textContentInput.trim()) return;

    const title = textTitleInput.trim() || `Notes (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
    const newSource: SourceDocument = {
      id: `src-txt-${Date.now()}`,
      type: 'text',
      title,
      content: textContentInput.trim(),
      uploadedAt: Date.now(),
    };
    onAddSource(newSource);
    if (!topicTitle.trim()) {
      setTopicTitle(title);
    }
    setTextTitleInput('');
    setTextContentInput('');
  };

  // Process uploaded files
  const processFile = async (file: File) => {
    setUploadError(null);
    const fileName = file.name;
    const fileSizeStr = `${(file.size / 1024).toFixed(1)} KB`;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;
        const newSource: SourceDocument = {
          id: `src-file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type: 'file',
          title: fileName,
          fileName,
          fileSize: fileSizeStr,
          fileMimeType: file.type,
          base64Data,
          content: `[Image / Textbook Screenshot: ${fileName}]`,
          uploadedAt: Date.now(),
        };
        onAddSource(newSource);
        if (!topicTitle.trim()) {
          setTopicTitle(fileName.replace(/\.[^/.]+$/, ''));
        }
      };
      reader.readAsDataURL(file);
    } else if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;
        const newSource: SourceDocument = {
          id: `src-file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type: 'file',
          title: fileName,
          fileName,
          fileSize: fileSizeStr,
          fileMimeType: 'application/pdf',
          base64Data,
          content: `[PDF Document: ${fileName}]`,
          uploadedAt: Date.now(),
        };
        onAddSource(newSource);
        if (!topicTitle.trim()) {
          setTopicTitle(fileName.replace(/\.[^/.]+$/, ''));
        }
      };
      reader.readAsDataURL(file);
    } else {
      // Text / Markdown / Code file
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        const newSource: SourceDocument = {
          id: `src-file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type: 'file',
          title: fileName,
          fileName,
          fileSize: fileSizeStr,
          fileMimeType: file.type || 'text/plain',
          content: text,
          uploadedAt: Date.now(),
        };
        onAddSource(newSource);
        if (!topicTitle.trim()) {
          setTopicTitle(fileName.replace(/\.[^/.]+$/, ''));
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      processFile(files[i]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        processFile(e.dataTransfer.files[i]);
      }
    }
  };

  const totalWords = sources.reduce((acc, src) => {
    return acc + (src.content ? src.content.split(/\s+/).filter(Boolean).length : 0);
  }, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Revision Hub Header Banner */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute right-0 top-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            AI Revision & Socratic Learning Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
            Import Study Materials & Notes
          </h1>
          <p className="text-indigo-100/90 text-sm sm:text-base leading-relaxed mb-6">
            Add any study link, PDF syllabus, lecture slide, or pasted notes. ReviseAI analyzes your material to teach step-by-step with analogies, build interactive notes & flashcards, and create adaptive practice questions.
          </p>

          {/* Topic Title & Quick Settings */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label htmlFor="topic-title-input" className="block text-xs font-medium text-indigo-200 mb-1">
                  Subject or Topic Title
                </label>
                <input
                  id="topic-title-input"
                  type="text"
                  value={topicTitle}
                  onChange={(e) => setTopicTitle(e.target.value)}
                  placeholder="e.g. Photosynthesis & Cellular Respiration, Macroeconomics 101, Organic Chemistry..."
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-indigo-200/60 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white/15 transition-all"
                />
              </div>

              {(sources.length > 0 || topicTitle.trim() !== '') && (
                <div className="flex items-end">
                  <button
                    id="generate-all-btn"
                    onClick={onGenerateAll}
                    disabled={isLoading}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{loadingStep || 'Analyzing Material...'}</span>
                      </>
                    ) : (
                      <>
                        <span>Start Learning & Revision</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Custom Instruction & Teaching Style Customizer */}
            <div className="bg-white/10 border border-white/15 rounded-xl p-3 sm:p-4 text-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-indigo-100 font-semibold">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Teaching Style & Language Mode</span>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="language-select" className="text-indigo-200 text-[11px]">
                    Output Language:
                  </label>
                  <select
                    id="language-select"
                    value={language}
                    onChange={(e) => setLanguage && setLanguage(e.target.value)}
                    className="bg-indigo-950/80 text-white border border-indigo-400/40 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
                  >
                    <option value="auto">Auto-detect from source</option>
                    <option value="English">English</option>
                    <option value="Bahasa Melayu">Bahasa Melayu (SPM / STPM)</option>
                    <option value="Chinese (Simplified)">Chinese (Simplified / 简体中文)</option>
                    <option value="Chinese (Traditional)">Chinese (Traditional / 繁體中文)</option>
                    <option value="Spanish">Spanish (Español)</option>
                    <option value="French">French (Français)</option>
                    <option value="German">German (Deutsch)</option>
                    <option value="Indonesian">Indonesian (Bahasa Indonesia)</option>
                    <option value="Arabic">Arabic (العربية)</option>
                    <option value="Tamil">Tamil (தமிழ்)</option>
                    <option value="Portuguese">Portuguese (Português)</option>
                    <option value="Italian">Italian (Italiano)</option>
                    <option value="Japanese">Japanese (日本語)</option>
                    <option value="Korean">Korean (한국어)</option>
                    <option value="Russian">Russian (Русский)</option>
                    <option value="Hindi">Hindi (हिन्दी)</option>
                    <option value="Tagalog">Tagalog (Filipino)</option>
                    <option value="Vietnamese">Vietnamese (Tiếng Việt)</option>
                    <option value="Thai">Thai (ภาษาไทย)</option>
                  </select>
                </div>
              </div>

              {/* Quick style presets */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (setTeachingStyle) setTeachingStyle('beginner');
                    if (setCustomInstruction) setCustomInstruction('Teach like I am a beginner, use clear everyday analogies, and avoid ungrounded jargon.');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                    teachingStyle === 'beginner'
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                      : 'bg-white/10 text-indigo-100 hover:bg-white/20 border border-white/15'
                  }`}
                >
                  🍼 Teach Like I'm a Beginner
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (setTeachingStyle) setTeachingStyle('interesting');
                    if (setCustomInstruction) setCustomInstruction('Make it look more interesting with captivating story hooks, real-life applications, and vibrant visual analogies.');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                    teachingStyle === 'interesting'
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                      : 'bg-white/10 text-indigo-100 hover:bg-white/20 border border-white/15'
                  }`}
                >
                  ✨ Make It Look More Interesting
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (setTeachingStyle) setTeachingStyle('exam_prep');
                    if (setCustomInstruction) setCustomInstruction('Focus on high-yield exam marking criteria, exam traps, and memory mnemonics.');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                    teachingStyle === 'exam_prep'
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                      : 'bg-white/10 text-indigo-100 hover:bg-white/20 border border-white/15'
                  }`}
                >
                  🎯 High-Yield Exam Prep
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (setTeachingStyle) setTeachingStyle('deep_dive');
                    if (setCustomInstruction) setCustomInstruction('Provide rigorous academic depth, first-principle mechanisms, and comprehensive coverage.');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                    teachingStyle === 'deep_dive'
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                      : 'bg-white/10 text-indigo-100 hover:bg-white/20 border border-white/15'
                  }`}
                >
                  🎓 Deep Dive & Mechanisms
                </button>
              </div>

              {/* Web Search Toggle */}
              {setAllowWebSearch && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="web-search-toggle"
                    checked={allowWebSearch}
                    onChange={(e) => setAllowWebSearch(e.target.checked)}
                    className="w-3.5 h-3.5 text-amber-400 rounded focus:ring-amber-400 bg-black/20 border-white/15"
                  />
                  <label htmlFor="web-search-toggle" className="text-[11px] text-indigo-100 font-medium cursor-pointer">
                    Enable Web Search (AI will search the web for supplementary context)
                  </label>
                </div>
              )}

              {/* Custom prompt input */}
              <div>
                <input
                  type="text"
                  value={customInstruction}
                  onChange={(e) => {
                    if (setCustomInstruction) setCustomInstruction(e.target.value);
                    if (setTeachingStyle) setTeachingStyle('custom');
                  }}
                  placeholder="Optional custom instruction (e.g. 'teach like I am 10 years old and use cooking analogies', 'focus on Malaysian SPM syllabus format')..."
                  className="w-full px-3 py-1.5 rounded-lg bg-black/20 border border-white/15 text-white placeholder:text-indigo-200/50 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Source Input Tabs */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FileUp className="w-5 h-5 text-indigo-600" />
              Add Study Source
            </h2>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 mb-6 gap-2">
              <button
                id="tab-link"
                onClick={() => setSourceMode('link')}
                className={`flex items-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                  sourceMode === 'link'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Globe className="w-4 h-4" />
                <span>Web Link</span>
              </button>

              <button
                id="tab-upload"
                onClick={() => setSourceMode('upload')}
                className={`flex items-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                  sourceMode === 'upload'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Upload Files</span>
              </button>

              <button
                id="tab-text"
                onClick={() => setSourceMode('text')}
                className={`flex items-center gap-2 py-2.5 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                  sourceMode === 'text'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Paste Notes</span>
              </button>
            </div>

            {/* TAB 1: Link URL */}
            {sourceMode === 'link' && (
              <form onSubmit={handleFetchUrl} className="space-y-4">
                <div>
                  <label htmlFor="url-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Enter Web Article / Study Resource URL
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <LinkIcon className="w-4 h-4" />
                      </div>
                      <input
                        id="url-input"
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://en.wikipedia.org/wiki/Photosynthesis or any study URL..."
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                        disabled={isFetchingUrl}
                      />
                    </div>
                    <button
                      id="fetch-url-btn"
                      type="submit"
                      disabled={isFetchingUrl || !urlInput.trim()}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      {isFetchingUrl ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Fetching...</span>
                        </>
                      ) : (
                        <>
                          <span>Import Link</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {urlError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{urlError}</span>
                  </div>
                )}

                <div className="text-xs text-slate-500 bg-slate-50 p-3.5 rounded-xl border border-slate-100 leading-relaxed">
                  <p className="font-semibold text-slate-700 mb-1">Supported web resources:</p>
                  <p>Paste Wikipedia articles, online course guides, encyclopedia summaries, or educational pages. The content will be extracted and indexed for full interactive teaching.</p>
                </div>
              </form>
            )}

            {/* TAB 2: File Upload */}
            {sourceMode === 'upload' && (
              <div className="space-y-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  multiple
                  accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.webp,.doc,.docx"
                  className="hidden"
                  id="file-upload-input"
                />

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-indigo-600 bg-indigo-50/70'
                      : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50/60 bg-white'
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mb-1">
                    Click to upload or drag & drop files
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mb-3">
                    Supports <strong>PDF documents</strong>, <strong>Photos of notes/textbooks</strong> (JPG, PNG), Markdown (.md), and plain text (.txt).
                  </p>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <Sparkles className="w-3.5 h-3.5" />
                    Multimodal AI analyzes handwritten notes & textbook diagrams
                  </span>
                </div>

                {uploadError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{uploadError}</span>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Text Paste */}
            {sourceMode === 'text' && (
              <form onSubmit={handleAddTextSource} className="space-y-3">
                <div>
                  <label htmlFor="text-title-input" className="block text-xs font-semibold text-slate-700 mb-1">
                    Document Title (optional)
                  </label>
                  <input
                    id="text-title-input"
                    type="text"
                    value={textTitleInput}
                    onChange={(e) => setTextTitleInput(e.target.value)}
                    placeholder="e.g. Chapter 4 Lecture Notes & Definitions"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label htmlFor="text-content-input" className="block text-xs font-semibold text-slate-700 mb-1">
                    Paste Study Text / Syllabus / Lecture Notes
                  </label>
                  <textarea
                    id="text-content-input"
                    value={textContentInput}
                    onChange={(e) => setTextContentInput(e.target.value)}
                    rows={7}
                    placeholder="Paste textbook excerpts, definitions, formulas, or lecture notes here..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                    required
                  />
                  <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1">
                    <span>{textContentInput.length} characters</span>
                    <span>{textContentInput.split(/\s+/).filter(Boolean).length} words</span>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    id="add-text-btn"
                    type="submit"
                    disabled={!textContentInput.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Add to Sources</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: Active Sources & Launch Workspace */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  Active Sources ({sources.length})
                </h3>
                <p className="text-xs text-slate-500">
                  {sources.length === 0
                    ? 'No study material added yet'
                    : `${totalWords.toLocaleString()} total words indexed`}
                </p>
              </div>

              {sources.length > 0 && (
                <button
                  onClick={onClearSources}
                  className="text-xs text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear All
                </button>
              )}
            </div>

            {sources.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-slate-200 rounded-xl p-6 bg-slate-50/70">
                <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700 mb-1">Ready for your material</p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Import a website URL on the left, upload lecture files/PDFs, or paste your notes to generate a full revision guide.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {sources.map((src) => (
                  <div
                    key={src.id}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100/80 transition-all flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 flex-shrink-0 mt-0.5">
                        {src.type === 'link' ? (
                          <Globe className="w-3.5 h-3.5" />
                        ) : src.fileMimeType?.startsWith('image/') ? (
                          <ImageIcon className="w-3.5 h-3.5" />
                        ) : (
                          <File className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-slate-900 truncate">
                          {src.title || src.fileName || 'Source Document'}
                        </h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                          <span className="capitalize font-medium">{src.type}</span>
                          <span>•</span>
                          <span>
                            {src.fileSize || `${Math.round((src.content?.length || 0) / 5)} words`}
                          </span>
                          {src.url && (
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-600 hover:underline flex items-center gap-0.5"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                              link
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onRemoveSource(src.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 transition-colors flex-shrink-0 cursor-pointer"
                      title="Remove source"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Launch Action */}
            {(sources.length > 0 || topicTitle.trim() !== '') && (
              <div className="mt-6 pt-4 border-t border-slate-200 space-y-3">
                <button
                  id="primary-generate-btn"
                  onClick={onGenerateAll}
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{loadingStep || 'Generating Revision Content...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Full Revision Workspace</span>
                    </>
                  )}
                </button>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-indigo-50/70 border border-indigo-100">
                    <p className="font-bold text-indigo-900 text-[11px]">Step-by-Step</p>
                    <p className="text-[10px] text-indigo-700">Analogies & Lessons</p>
                  </div>
                  <div className="p-2 rounded-lg bg-indigo-50/70 border border-indigo-100">
                    <p className="font-bold text-indigo-900 text-[11px]">Notes & Cards</p>
                    <p className="text-[10px] text-indigo-700">3D Flip Flashcards</p>
                  </div>
                  <div className="p-2 rounded-lg bg-indigo-50/70 border border-indigo-100">
                    <p className="font-bold text-indigo-900 text-[11px]">Practice Quiz</p>
                    <p className="text-[10px] text-indigo-700">AI Essay Grading</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
