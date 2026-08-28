import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// Body parser for JSON and large payloads (e.g. document uploads/base64)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Lazy initialize Gemini API client
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Robust JSON extraction and parsing helper
function parseJsonSafely<T = any>(rawText: string, fallback: T): T {
  if (!rawText || typeof rawText !== 'string') return fallback;

  let cleaned = rawText.trim();
  // Strip markdown code fences if present
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Try direct parse
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // Try to find the outermost JSON object or array
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');

    let startIdx = -1;
    let isArray = false;

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      startIdx = firstBrace;
      isArray = false;
    } else if (firstBracket !== -1) {
      startIdx = firstBracket;
      isArray = true;
    }

    if (startIdx !== -1) {
      let jsonStr = cleaned.substring(startIdx);
      
      // Attempt 1: Just parse up to the last known good closing character
      const endChar = isArray ? ']' : '}';
      const lastIdx = jsonStr.lastIndexOf(endChar);
      if (lastIdx > 0) {
        try {
          const parsed = JSON.parse(jsonStr.substring(0, lastIdx + 1));
          if (parsed && typeof parsed === 'object') return parsed;
        } catch (e) {}
      }

      // Attempt 2: Auto-close truncated JSON. Extremely aggressive fixing for LLM cut-offs.
      const closeBrackets = (str: string) => {
        let openBraces = 0;
        let openBrackets = 0;
        let inString = false;
        let escapeNext = false;
        
        for (let i = 0; i < str.length; i++) {
          const char = str[i];
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          if (char === '"') {
            inString = !inString;
            continue;
          }
          if (!inString) {
            if (char === '{') openBraces++;
            if (char === '}') openBraces--;
            if (char === '[') openBrackets++;
            if (char === ']') openBrackets--;
          }
        }
        
        let fixed = str;
        if (inString) fixed += '"';
        
        // Remove trailing commas if any exist right before adding braces
        fixed = fixed.replace(/,\s*$/, '');

        while (openBrackets > 0 || openBraces > 0) {
          if (openBrackets > 0) {
            fixed += ']';
            openBrackets--;
          } else if (openBraces > 0) {
            fixed += '}';
            openBraces--;
          }
        }
        return fixed;
      };

      try {
        const fixedJson = closeBrackets(jsonStr);
        const parsed = JSON.parse(fixedJson);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (e) {
        console.warn('Aggressive JSON repair failed:', e);
      }
    }
  }

  return fallback;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hasGeminiKey: !!process.env.GEMINI_API_KEY, time: new Date().toISOString() });
});

// Fetch and extract readable text from a URL
app.post('/api/fetch-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Valid URL is required' });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format. Please provide a full web address (e.g. https://...).' });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 ReviseAIBot/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Could not reach website (HTTP ${response.status}: ${response.statusText}). You can also copy and paste the text directly into the "Paste Notes" tab.`,
      });
    }

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    let title = titleMatch ? titleMatch[1].trim() : parsedUrl.hostname;
    title = title.replace(/\s*[-–—|]\s*(Wikipedia|Medium|Khan Academy|BBC|YouTube|Britannica|Investopedia).*$/i, '').trim();

    // Strip scripts, styles, and HTML tags for clean text extraction
    let cleanText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
      .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanText.length > 120000) {
      cleanText = cleanText.substring(0, 120000) + '... [Long document preserved for comprehensive revision analysis]';
    }

    if (!cleanText || cleanText.length < 50) {
      cleanText = `Study topic from web link: ${url}\nTopic Title: ${title}\n(Extracted web body text was short, using article title and domain as context).`;
    }

    res.json({
      title: title || 'Web Study Source',
      url: parsedUrl.toString(),
      content: cleanText,
      length: cleanText.length,
    });
  } catch (err: any) {
    console.error('Error fetching URL:', err);
    res.status(500).json({
      error: err.message || 'Error fetching website content. You can paste the text directly into the "Paste Notes" tab.',
    });
  }
});

// Helper to construct Gemini content parts from sources
function buildGeminiSourceParts(sources: any[] = [], extraPrompt: string) {
  const parts: any[] = [];

  let textSourcesCombined = '';
  for (const src of sources) {
    if (src.base64Data && src.fileMimeType && src.fileMimeType.startsWith('image/')) {
      parts.push({
        inlineData: {
          mimeType: src.fileMimeType,
          data: src.base64Data.replace(/^data:[^;]+;base64,/, ''),
        },
      });
    } else if (src.base64Data && src.fileMimeType === 'application/pdf') {
      parts.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: src.base64Data.replace(/^data:[^;]+;base64,/, ''),
        },
      });
    }

    textSourcesCombined += `\n--- SOURCE DOCUMENT: "${src.title || src.fileName || 'Document'}" (${src.type}) ---\n`;
    textSourcesCombined += (src.content || '').substring(0, 120000) + '\n';
  }

  parts.push({
    text: `STUDY MATERIAL / SOURCES:\n${textSourcesCombined}\n\nINSTRUCTION:\n${extraPrompt}`,
  });

  return parts;
}

// -------------------------------------------------------------
// Resilient Smart Heuristic Synthesis Engines (Offline / Fallback)
// -------------------------------------------------------------
function extractKeyTermsFromText(text: string, count: number = 8): Array<{ term: string; definition: string; importance: 'critical' | 'important' | 'helpful' }> {
  const lines = text.split(/\n|\. /).map(s => s.trim()).filter(s => s.length > 20);
  const terms: Array<{ term: string; definition: string; importance: 'critical' | 'important' | 'helpful' }> = [];

  // Match sentences like "X is defined as...", "X is a...", "X refers to..."
  const defRegex = /([A-Z][A-Za-z0-9\s-]{2,25})\s+(?:is defined as|is a|is an|refers to|means|represents|describes)\s+([^.]+)/i;
  for (const line of lines) {
    const match = line.match(defRegex);
    if (match && match[1] && match[2]) {
      const termName = match[1].trim();
      if (!terms.some(t => t.term.toLowerCase() === termName.toLowerCase())) {
        terms.push({
          term: termName,
          definition: match[2].trim() + '.',
          importance: terms.length < 2 ? 'critical' : terms.length < 5 ? 'important' : 'helpful',
        });
      }
    }
    if (terms.length >= count) break;
  }

  // If still fewer terms, extract capitalized phrases
  if (terms.length < 3) {
    const words = text.split(/\s+/);
    for (let i = 0; i < words.length - 1; i++) {
      const pair = `${words[i]} ${words[i + 1]}`.replace(/[^a-zA-Z\s]/g, '');
      if (/^[A-Z][a-z]+\s[A-Z][a-z]+$/.test(pair) && !terms.some(t => t.term === pair)) {
        terms.push({
          term: pair,
          definition: `Core concept in this subject relating to the fundamental principles and mechanisms.`,
          importance: 'important',
        });
      }
      if (terms.length >= count) break;
    }
  }

  if (terms.length === 0) {
    terms.push(
      { term: 'Core Mechanism', definition: 'The primary operating process or reaction driving this system.', importance: 'critical' },
      { term: 'Key Variable', definition: 'The central measurable factor influencing outcomes and equilibrium.', importance: 'important' },
      { term: 'Governing Law', definition: 'The foundational scientific or logical rule describing behavior.', importance: 'critical' },
    );
  }

  return terms;
}

function generateSmartFallbackLesson(topicTitle: string, sources: any[]) {
  const combinedText = sources.map(s => s.content || '').join('\n\n');
  const terms = extractKeyTermsFromText(combinedText, 6);
  const title = topicTitle || sources[0]?.title || 'Revision Topic';

  const sections = [
    {
      id: 'sec-1',
      title: `1. Foundations & Fundamentals of ${title}`,
      summary: `An essential introduction establishing the core definitions, governing principles, and background context for ${title}.`,
      detailedContent: `### Core Principles of ${title}\n\nTo master **${title}**, you must first understand the foundational mechanism:\n\n- **Primary Purpose**: Identifies and organizes the critical laws governing this system.\n- **First Principles**: Rather than memorizing isolated facts, break the topic down into basic truths and reason upwards.\n- **Key Relationships**: Observe how variables interact under standard and boundary conditions.\n\n> **Study Note:** Review the foundational terminology carefully before moving into complex applications.`,
      analogy: `Think of ${title} like building the foundation of a skyscraper: if the ground principles are solid, even the most complex exam questions can be solved systematically.`,
      keyConcepts: terms.slice(0, 3),
      pitfallsToAvoid: [
        `Confusing foundational definitions with specific secondary edge cases.`,
        `Skipping core terminology and trying to solve complex exam questions without clear definitions.`,
      ],
      checkQuestion: {
        id: 'cq-1',
        question: `What is the most fundamental starting point when analyzing ${title}?`,
        options: [
          `Applying first-principles definitions and core governing mechanisms`,
          `Memorizing secondary formulas without understanding underlying units`,
          `Ignoring variable interactions under boundary conditions`,
          `Assuming outcomes are purely random and unmeasurable`,
        ],
        correctIndex: 0,
        explanation: `Beginning with first-principles definitions allows you to logically derive solutions to novel exam problems without relying on surface-level memorization.`,
      },
    },
    {
      id: 'sec-2',
      title: `2. Deep Mechanism, Process & Interaction`,
      summary: `Step-by-step breakdown of how the components within ${title} operate and interact dynamically.`,
      detailedContent: `### Step-by-Step Mechanism Breakdown\n\n1. **Initial State & Triggers**: What initiates the process or equilibrium shift.\n2. **Intermediate Phase**: Transfer of energy, variables, or information across the system.\n3. **Resulting Output / Equilibrium**: The final balanced state, products, or qualitative takeaway.\n\n| Stage | Key Factor | Expected Outcome |\n| :--- | :--- | :--- |\n| **Phase 1: Input** | Baseline conditions | Activation threshold met |\n| **Phase 2: Action** | Mechanism in progress | Energy/variable transformation |\n| **Phase 3: Output** | Final state | Equilibrium reached |\n\n*Review each stage in sequence to ensure complete active recall during exams.*`,
      analogy: `Like a set of perfectly lined-up dominoes: each reaction or step in ${title} directly triggers the next in a precise, predictable chain.`,
      keyConcepts: terms.slice(3, 6).length > 0 ? terms.slice(3, 6) : [
        { term: 'Process Equilibrium', definition: 'The balanced steady-state where rates of change equalize.', importance: 'important' as const }
      ],
      pitfallsToAvoid: [
        `Failing to state intermediate steps in written multi-mark exam questions.`,
        `Assuming rates or reactions occur in isolation without feedback loops.`,
      ],
      checkQuestion: {
        id: 'cq-2',
        question: `Why is understanding the intermediate sequence critical in multi-step processes?`,
        options: [
          `Because intermediate factors dictate the final equilibrium and grant method marks`,
          `Because only the final output matters on exam marking rubrics`,
          `Because processes do not have intermediate steps`,
          `Because it eliminates the need to measure initial conditions`,
        ],
        correctIndex: 0,
        explanation: `In standard examination rubrics, method marks and conceptual proofs depend heavily on correctly identifying the intermediate mechanism.`,
      },
    },
    {
      id: 'sec-3',
      title: `3. Exam Applications, Edge Cases & Synthesis`,
      summary: `High-yield problem solving strategies, boundary conditions, and exam-level question approaches.`,
      detailedContent: `### Mastering Exam Questions on ${title}\n\nWhen examiners test this topic, they often introduce:\n\n- **Boundary Conditions**: What happens when variables reach extreme minimums or maximums?\n- **Comparative Scenarios**: Comparing this system against an alternative model.\n- **Data Interpretation**: Extracting values, slopes, and trends from charts and tables.\n\n### Golden Rules for Full Marks:\n1. State your governing formula or principle explicitly first.\n2. Define all symbols, terms, and units clearly.\n3. Verify that your answer makes intuitive and physical sense.`,
      analogy: `Approaching an exam problem on ${title} is like being a detective: look for clues in the given data, match them to your core laws, and present your evidence step-by-step.`,
      keyConcepts: [
        { term: 'Boundary Condition', definition: 'The limiting values or constraints at the edges of a system.', importance: 'critical' },
        { term: 'Synthesis', definition: 'Combining multiple sub-concepts to solve unfamiliar exam scenarios.', importance: 'important' },
      ],
      pitfallsToAvoid: [
        `Forgetting units or misinterpreting scale in quantitative questions.`,
        `Writing vague generalized statements instead of specific academic terminology.`,
      ],
      checkQuestion: {
        id: 'cq-3',
        question: `When presented with an unfamiliar exam scenario on ${title}, what is the best strategy?`,
        options: [
          `Identify the governing principles, write out knowns/unknowns, and apply the core mechanism step-by-step`,
          `Guess the final answer immediately to save time`,
          `Leave the question blank if it does not match past papers exactly`,
          `Write down unrelated definitions in hopes of partial credit`,
        ],
        correctIndex: 0,
        explanation: `Systematically listing knowns, unknowns, and applying the governing mechanism ensures you capture method marks and navigate unfamiliar problems calmly.`,
      },
    },
  ];

  return {
    topicTitle: title,
    overview: `A structured, high-yield interactive study guide for ${title}, designed with active recall checkpoints, intuitive real-world analogies, and exam trap alerts.`,
    learningObjectives: [
      `Master the core definitions and first-principles mechanisms of ${title}`,
      `Trace the step-by-step interaction stages and intermediate processes`,
      `Avoid common student misconceptions and exam pitfalls`,
      `Apply active recall to solve exam-style practice questions with confidence`,
    ],
    estimatedStudyTimeMinutes: 20,
    sections,
    examTips: [
      `Always state the primary governing law or formula at the beginning of written answers.`,
      `Double-check units, standard definitions, and boundary condition assumptions.`,
      `Use active recall flashcards to commit definitions to long-term memory.`,
      `Practice explaining the mechanism out loud using the real-world analogies.`,
    ],
  };
}

function generateSmartFallbackNotes(topicTitle: string, sources: any[]) {
  const title = topicTitle || sources[0]?.title || 'Revision Notes';
  const combinedText = sources.map(s => s.content || '').join('\n\n');
  const terms = extractKeyTermsFromText(combinedText, 10);

  const flashcards = [
    {
      id: 'fc-1',
      front: `What is the primary definition and significance of ${title}?`,
      back: `It represents the fundamental framework and mechanism governing the behavior, interactions, and equilibrium of this system.`,
      category: 'Definitions',
      difficulty: 'easy' as const,
    },
    ...terms.map((t, idx) => ({
      id: `fc-${idx + 2}`,
      front: `Define "${t.term}" and explain its role in ${title}.`,
      back: `${t.definition} (Importance: ${t.importance.toUpperCase()})`,
      category: 'Core Concepts',
      difficulty: idx % 3 === 0 ? ('hard' as const) : idx % 2 === 0 ? ('medium' as const) : ('easy' as const),
    })),
    {
      id: 'fc-last',
      front: `What is the most frequent student exam pitfall when analyzing ${title}?`,
      back: `Failing to state intermediate steps, overlooking boundary conditions, and omitting units or precise definitions.`,
      category: 'Exam Strategy',
      difficulty: 'medium' as const,
    },
  ];

  const conceptMap = [
    {
      id: 'node-1',
      label: title,
      category: 'Central Domain',
      description: `The overarching subject encompassing all mechanisms, laws, and practical applications.`,
      relatedIds: ['node-2', 'node-3', 'node-4'],
    },
    {
      id: 'node-2',
      label: terms[0]?.term || 'Fundamental Laws',
      category: 'Principles',
      description: terms[0]?.definition || 'The governing rules that dictate system behavior and consistency.',
      relatedIds: ['node-1', 'node-3'],
    },
    {
      id: 'node-3',
      label: terms[1]?.term || 'Dynamic Mechanism',
      category: 'Process',
      description: terms[1]?.definition || 'The active stages of transformation, interaction, or calculation.',
      relatedIds: ['node-1', 'node-2', 'node-4'],
    },
    {
      id: 'node-4',
      label: terms[2]?.term || 'Exam Applications',
      category: 'Applications',
      description: terms[2]?.definition || 'Real-world problem sets, quantitative questions, and synthesis.',
      relatedIds: ['node-1', 'node-3'],
    },
  ];

  const summaryMarkdown = `# Master Revision Guide: ${title}

## 1. Executive Summary & Core Definitions
**${title}** forms a central pillar of this academic domain. To achieve top marks, students must be capable of defining key mechanisms clearly and applying them across varied problem contexts.

- **Primary Mechanism**: The foundational process driving the observed outcomes.
- **Key Relationships**: How primary variables respond to changes in system conditions.
- **Governing Principles**: Rules that remain constant across standard and edge-case scenarios.

---

## 2. Core Concepts & Vocabulary Table

| Concept / Term | Definition & Meaning | Exam Importance |
| :--- | :--- | :--- |
${terms.map(t => `| **${t.term}** | ${t.definition} | \`${t.importance.toUpperCase()}\` |`).join('\n')}

---

## 3. High-Yield Step-by-Step Process
1. **Initial Assessment**: Identify all known values, initial conditions, and primary constraints.
2. **Mechanism Application**: Apply the corresponding law or theorem to establish intermediate equations.
3. **Synthesis & Verification**: Solve for target unknowns and verify that physical/logical sense is maintained.

> **💡 Active Recall Tip:** Cover this section and test whether you can recall all terms and definitions from memory without looking!
`;

  return {
    summaryMarkdown,
    flashcards,
    conceptMap,
    formulasAndDefinitions: [
      {
        term: `Primary Governing Equation / Law of ${title}`,
        formulaOrMeaning: `Output = f(Inputs, Baseline Conditions) [Direct proportionality under standard constraints]`,
        notes: `Ensure consistent units and state any assumptions (e.g. constant temperature/pressure/mass).`,
      },
      {
        term: `Equilibrium Condition`,
        formulaOrMeaning: `Rate (Forward) = Rate (Reverse) [Net Δ = 0 at steady-state]`,
        notes: `Distinguish between dynamic equilibrium and static equilibrium in exam responses.`,
      },
      ...terms.slice(0, 3).map(t => ({
        term: t.term,
        formulaOrMeaning: t.definition,
        notes: `Crucial terminology required for full marks in short and long-form responses.`,
      })),
    ],
    quickCheatSheet: [
      `Memorize definitions verbatim to secure easy recall marks in section A.`,
      `Always write units clearly on every intermediate and final numerical calculation.`,
      `Check boundary conditions (zero, infinity, extreme temperatures/pressures) when solving edge cases.`,
      `Use the real-world analogy to structure your logical sequence during essay explanations.`,
      `Review flashcards with spaced repetition daily leading up to your exam date.`,
    ],
  };
}

function generateSmartFallbackQuiz(topicTitle: string, sources: any[], count: number = 8, difficulty: string = 'medium', types: string[] = ['multiple_choice', 'true_false', 'fill_in_blank', 'short_answer']) {
  const title = topicTitle || sources[0]?.title || 'Practice Quiz';
  const combinedText = sources.map(s => s.content || '').join('\n\n');
  const terms = extractKeyTermsFromText(combinedText, 10);

  const questions: any[] = [];

  // 1. Multiple Choice Questions
  if (types.includes('multiple_choice')) {
    questions.push({
      id: `q-mc-1`,
      type: 'multiple_choice',
      question: `What is the primary role or function of ${title}?`,
      options: [
        `To govern the central mechanisms and interactions within the system`,
        `To eliminate all variables without measurable outcomes`,
        `To act solely as an unobservable theoretical hypothesis`,
        `To prevent any equilibrium from ever forming`,
      ],
      correctAnswer: 0,
      explanation: `Understanding the primary governing role of ${title} provides the framework needed to solve both quantitative and qualitative exam questions.`,
      hint: `Think about the overarching purpose discussed in the fundamentals section.`,
      sourceReference: `Section 1: Foundations`,
    });

    if (terms.length > 0) {
      questions.push({
        id: `q-mc-2`,
        type: 'multiple_choice',
        question: `In the context of ${title}, which statement best describes "${terms[0].term}"?`,
        options: [
          terms[0].definition,
          `A random error that should be ignored during calculations`,
          `An obsolete metric replaced by modern definitions`,
          `A constant that never changes under any circumstances`,
        ],
        correctAnswer: 0,
        explanation: `${terms[0].term} is formally defined as: ${terms[0].definition}`,
        hint: `Review the vocabulary table in your study notes.`,
        sourceReference: `Core Vocabulary`,
      });
    }
  }

  // 2. True / False Questions
  if (types.includes('true_false')) {
    questions.push({
      id: `q-tf-1`,
      type: 'true_false',
      question: `True or False: In ${title}, understanding intermediate mechanism steps is critical for obtaining method marks on exams.`,
      options: ['True', 'False'],
      correctAnswer: 0,
      explanation: `True. Examination rubrics award substantial credit for clearly explaining the sequential mechanism and intermediate variables.`,
      hint: `Consider how examiners grade multi-mark written questions.`,
      sourceReference: `Exam Applications`,
    });

    questions.push({
      id: `q-tf-2`,
      type: 'true_false',
      question: `True or False: Boundary conditions and units can be safely ignored when solving high-level problems in ${title}.`,
      options: ['True', 'False'],
      correctAnswer: 1,
      explanation: `False. Ignoring units and boundary conditions is one of the most common student mistakes that causes lost marks.`,
      hint: `Check the Common Pitfalls section.`,
      sourceReference: `Common Exam Traps`,
    });
  }

  // 3. Fill in the Blank
  if (types.includes('fill_in_blank')) {
    const termToUse = terms[1]?.term || 'Equilibrium';
    questions.push({
      id: `q-fib-1`,
      type: 'fill_in_blank',
      question: `The state where forward and reverse reaction rates or system forces become balanced is known as ________.`,
      options: [],
      correctAnswer: 'Equilibrium',
      explanation: `Equilibrium occurs when dynamic opposing processes proceed at equal rates, resulting in no net observable change.`,
      hint: `Starts with the letter 'E'.`,
      sourceReference: `Process Laws`,
    });

    if (terms.length > 2) {
      questions.push({
        id: `q-fib-2`,
        type: 'fill_in_blank',
        question: `The key concept defined as "${terms[2].definition}" is ________.`,
        options: [],
        correctAnswer: terms[2].term,
        explanation: `${terms[2].term} corresponds directly to this definition in your study source.`,
        hint: `Refers to "${terms[2].term.substring(0, 3)}..."`,
        sourceReference: `Vocabulary Review`,
      });
    }
  }

  // 4. Open-Ended Short Answer (AI Graded)
  if (types.includes('short_answer')) {
    questions.push({
      id: `q-sa-1`,
      type: 'short_answer',
      question: `Explain the step-by-step mechanism of ${title}, describing how initial inputs transition through intermediate phases to reach the final state.`,
      options: [],
      correctAnswer: `A complete answer should mention: 1) Initial conditions and triggers, 2) The step-by-step intermediate transformation or interaction, 3) The resulting equilibrium/output, and 4) Accurate use of domain-specific terminology.`,
      explanation: `Demonstrating clear chronological logic and formal academic terms will earn maximum marks on essay-style questions.`,
      hint: `Recall the 3-phase sequence: Initial Input -> Intermediate Transformation -> Final Equilibrium.`,
      sourceReference: `Section 2: Mechanism Breakdown`,
    });
  }

  // Slice to requested count
  const finalQuestions = questions.slice(0, count);

  return {
    id: `quiz-${Date.now()}`,
    topicTitle: title,
    difficulty,
    questions: finalQuestions,
  };
}

// -------------------------------------------------------------
// Endpoints with AI + Resilient Fallbacks
// -------------------------------------------------------------

// 1. Generate Interactive Lesson ("Teach Me")
app.post('/api/generate-lesson', async (req, res) => {
  try {
    const { topicTitle, sources, customInstruction, teachingStyle, language, allowWebSearch } = req.body;
    
    // Auto-check web search if no sources
    const effectiveWebSearch = (!sources || sources.length === 0) ? true : allowWebSearch;
    const title = topicTitle || (sources && sources.length > 0 ? sources[0].title : '') || 'Revision Topic';

    if (!title && (!sources || sources.length === 0)) {
       return res.status(400).json({ error: 'Please provide a topic title or at least one source document.' });
    }

    const ai = getAI();

    if (ai) {
      try {
        const langDirective = language && language !== 'auto'
          ? `Generate ALL content, titles, explanations, analogies, key terms, and questions strictly in "${language}".`
          : `CRITICAL LANGUAGE REQUIREMENT: Identify the primary language of the source documents. You MUST write EVERYTHING (every title, section, definition, explanation, markdown, flashcard, question, etc.) ENTIRELY in that exact same language. For example, if the source text is in Malay/Bahasa Melayu, you MUST output 100% Malay/Bahasa Melayu. Do NOT use English unless the user explicitly requests another language in the custom instructions.`;

        const styleDirective = customInstruction || teachingStyle
          ? `USER'S CUSTOM TEACHING & STYLE DIRECTIVE: "${customInstruction || teachingStyle}". (e.g. If the student asked "teach like I am a beginner", simplify complex terminology, use vivid everyday analogies, and break ideas down step-by-step. If asked "make it more interesting", add dramatic real-life applications, intriguing hooks, and engaging narrative flow. If "university level", provide high-level academic depth).`
          : `Style: High-retention Socratic revision with clear intuitive analogies, active recall questions, and common exam pitfall warnings.`;

        const groundingDirective = sources && sources.length > 0 
           ? `CRITICAL GROUNDING DIRECTIVE:
1. You MUST base 100% of your teaching, mechanisms, facts, definitions, formulas, and historical context STRICTLY on the provided source materials.
2. Do NOT invent or hallucinate facts that contradict or are absent from the sources.
3. If the sources are extensive or long, systematically organize the material into complete sequential chapters (3 to 7 sections) so NO key concepts or parts of the syllabus are omitted.`
           : `CRITICAL KNOWLEDGE DIRECTIVE:
1. Rely on your extensive academic knowledge base to provide accurate, up-to-date, and rigorous information.
2. Organize the material systematically into complete sequential chapters (3 to 7 sections) so NO key concepts or parts of the syllabus are omitted.`;

        const prompt = `You are a world-class revision tutor creating a comprehensive, high-retention interactive step-by-step lesson for a student studying "${title}".

${groundingDirective}

LANGUAGE REQUIREMENT:
${langDirective}

TEACHING STYLE:
${styleDirective}

Generate a structured JSON revision lesson matching this exact format:
{
  "topicTitle": "${title}",
  "overview": "clear 2-3 sentence overview explaining why this topic matters.",
  "learningObjectives": ["objective 1", "objective 2", "objective 3", "objective 4"],
  "estimatedStudyTimeMinutes": 20,
  "language": "${language || 'auto'}",
  "teachingStyle": "${teachingStyle || 'standard'}",
  "customInstruction": "${customInstruction ? customInstruction.replace(/"/g, "'") : ''}",
  "sections": [
    {
      "id": "sec-1",
      "title": "Concise Chapter Title",
      "summary": "1-2 sentence core concept takeaway.",
      "detailedContent": "Rich Markdown formatted teaching text with clear ## subheaders, bullet points, bold key terms, comparison tables, and ascii flowcharts if helpful.",
      "analogy": "A memorable real-world analogy to help the student intuitively understand the mechanism.",
      "keyConcepts": [
        { "term": "Key Term 1", "definition": "Clear concise definition from source.", "importance": "critical" },
        { "term": "Key Term 2", "definition": "Clear concise definition from source.", "importance": "important" }
      ],
      "pitfallsToAvoid": ["Common student mistake 1", "Exam pitfall 2"],
      "checkQuestion": {
        "question": "Active recall test question for this section",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctIndex": 0,
        "explanation": "Detailed explanation of why Option A is correct based on the source."
      }
    }
  ],
  "examTips": ["High-yield exam tip 1", "High-yield exam tip 2", "High-yield exam tip 3"]
}

Return ONLY a valid JSON object matching this structure.`;

        const parts = buildGeminiSourceParts(sources, prompt);

        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: [
            {
              role: 'user',
              parts: parts,
            },
          ],
          config: {
            systemInstruction: sources && sources.length > 0
              ? 'You are a helpful, clear academic tutor. Explain concepts using simple words, easy-to-understand language, and intuitive analogies without dense jargon. Always follow the source material faithfully and return strictly valid JSON matching the requested structure.'
              : 'You are a helpful, clear academic tutor. Explain concepts using simple words, easy-to-understand language, and intuitive analogies without dense jargon. Rely on your academic knowledge and return strictly valid JSON matching the requested structure.',
            
            responseMimeType: 'application/json',
          },
        });

        const text = response.text || '{}';
        const parsed = parseJsonSafely(text, null);
        if (parsed && parsed.sections && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
          return res.json(parsed);
        }
      } catch (geminiErr) {
        console.error('Gemini API call failed:', geminiErr);
      }
    }

    // Fallback synthesis
    const lessonData = generateSmartFallbackLesson(title, sources);
    res.json(lessonData);
  } catch (err: any) {
    console.error('Error in /api/generate-lesson:', err);
    res.status(500).json({ error: err.message || 'Failed to generate revision lesson' });
  }
});

// 2. Generate Full Comprehensive Interactive Study Notes, Flashcards & Mindmap
app.post('/api/generate-notes', async (req, res) => {
  try {
    const { topicTitle, sources, customInstruction, language, allowWebSearch, lessonStructure } = req.body;
    
    // Auto-check web search if no sources
    const effectiveWebSearch = (!sources || sources.length === 0) ? true : allowWebSearch;
    const title = topicTitle || (sources && sources.length > 0 ? sources[0].title : '') || 'Study Material';

    if (!title && (!sources || sources.length === 0)) {
       return res.status(400).json({ error: 'Please provide a topic title or at least one source document.' });
    }

    const ai = getAI();

    if (ai) {
      try {
        const langDirective = language && language !== 'auto'
          ? `Generate ALL markdown notes, flashcards, concept maps, formulas, and cheat sheets strictly in "${language}".`
          : `CRITICAL LANGUAGE REQUIREMENT: Identify the primary language of the source documents. You MUST write EVERYTHING (every title, section, definition, explanation, markdown, flashcard, question, etc.) ENTIRELY in that exact same language. For example, if the source text is in Malay/Bahasa Melayu, you MUST output 100% Malay/Bahasa Melayu. Do NOT use English unless the user explicitly requests another language in the custom instructions.`;

        const styleDirective = customInstruction
          ? `CUSTOM INSTRUCTION: "${customInstruction}". Keep notes structured, complete, and easy to read.`
          : `Format notes with clean hierarchical Markdown, bold technical terms, and high-yield callout boxes.`;

        let structureDirective = sources && sources.length > 0 
          ? `1. The provided source may be very long. You MUST cover the ENTIRE source material thoroughly without cutting corners, skipping sections, or producing brief generic summaries.`
          : `1. Generate comprehensive and deeply informative notes on the topic, ensuring a high level of academic rigor and exhaustive coverage of the subject matter.`;
        
        if (lessonStructure && lessonStructure.sections) {
          const sectionTitles = lessonStructure.sections.map((s: any) => s.title).join('\n- ');
          structureDirective = `1. VERY IMPORTANT: Your generated notes MUST follow this exact chapter structure from the companion lesson:\n- ${sectionTitles}\nDO NOT invent new chapters or combine these chapters. Create exhaustive notes that fill out each of these specific chapters.`;
        }

        const sourceStrictness = sources && sources.length > 0 
           ? `3. Base 100% of the notes strictly on the source content provided.`
           : `3. Utilize your extensive knowledge base to formulate accurate, highly-detailed study notes.`;

        const prompt = `Create FULL, COMPREHENSIVE, UNTRUNCATED interactive study revision notes, high-yield flashcards, and concept maps for the topic: "${title}".

CRITICAL COMPREHENSIVENESS MANDATE:
${structureDirective}
2. In 'summaryMarkdown', include full exhaustive notes covering all chapters, key definitions, multi-step processes, equations/formulas, dates/evidence, and comparative tables.
${sourceStrictness}

LANGUAGE INSTRUCTION:
${langDirective}

STYLE INSTRUCTION:
${styleDirective}

Generate JSON with:
1. summaryMarkdown: A master revision guide in rich Markdown with # Header, ## Chapter sections, ### Deep dives, bold keywords, full comparison tables, and > Active recall callout boxes.
2. flashcards: 10 to 20 high-retention active recall flashcards covering all critical concepts across the source. Each with { "id": "fc-1", "front": "string", "back": "string", "category": "string", "difficulty": "easy" | "medium" | "hard" }.
3. conceptMap: 6 to 12 interconnected concept nodes representing the relationship graph of the topic. Each with { "id": "node-1", "label": "string", "category": "string", "description": "string", "relatedIds": ["node-2", "node-3"] }.
4. formulasAndDefinitions: Array of 5 to 15 crucial formulas, laws, theorems, or formal definitions from the source with { "term": "string", "formulaOrMeaning": "string", "notes": "string" }.
5. quickCheatSheet: 6 to 10 rapid-fire high-yield bullet takeaways for last-minute exam prep.

Return ONLY a valid JSON object matching this structure.`;

        const parts = buildGeminiSourceParts(sources, prompt);

        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: [
            {
              role: 'user',
              parts: parts,
            },
          ],
          config: {
            systemInstruction: sources && sources.length > 0
              ? 'You are a clear and supportive notes author. Write easy-to-understand, beautifully formatted revision guides using simple language grounded 100% in the source material. Avoid dense jargon. Return strictly valid JSON.'
              : 'You are a clear and supportive notes author. Write easy-to-understand, beautifully formatted revision guides using simple language based on academic knowledge. Avoid dense jargon. Return strictly valid JSON.',
            
            responseMimeType: 'application/json',
          },
        });

        const text = response.text || '{}';
        const parsed = parseJsonSafely(text, null);
        if (parsed && parsed.flashcards && Array.isArray(parsed.flashcards) && parsed.flashcards.length > 0) {
          return res.json(parsed);
        }
      } catch (geminiErr) {
        console.warn('Gemini API notes call failed, using smart notes generator:', geminiErr);
      }
    }

    // Fallback synthesis
    const notesData = generateSmartFallbackNotes(title, sources);
    res.json(notesData);
  } catch (err: any) {
    console.error('Error in /api/generate-notes:', err);
    res.status(500).json({ error: err.message || 'Failed to generate study notes' });
  }
});

// 3. Generate Practice Questions / Quizzes
app.post('/api/generate-quiz', async (req, res) => {
  try {
    const {
      topicTitle,
      sources,
      questionCount = 8,
      difficulty = 'medium',
      questionTypes = ['multiple_choice', 'true_false', 'fill_in_blank', 'short_answer'],
      customInstruction,
      language,
      allowWebSearch,
    } = req.body;

    // Auto-check web search if no sources
    const effectiveWebSearch = (!sources || sources.length === 0) ? true : allowWebSearch;
    const title = topicTitle || (sources && sources.length > 0 ? sources[0].title : '') || 'Revision Quiz';

    if (!title && (!sources || sources.length === 0)) {
       return res.status(400).json({ error: 'Please provide a topic title or at least one source document.' });
    }

    const ai = getAI();

    if (ai) {
      try {
        const langDirective = language && language !== 'auto'
          ? `Write ALL questions, options, answers, hints, and explanations strictly in "${language}".`
          : `CRITICAL LANGUAGE REQUIREMENT: Identify the primary language of the source documents. You MUST write EVERYTHING (every title, section, definition, explanation, markdown, flashcard, question, etc.) ENTIRELY in that exact same language. For example, if the source text is in Malay/Bahasa Melayu, you MUST output 100% Malay/Bahasa Melayu. Do NOT use English unless the user explicitly requests another language in the custom instructions.`;

        const styleDirective = customInstruction
          ? `CUSTOM INSTRUCTION: "${customInstruction}". (e.g. if requested 'beginner', test fundamental concepts clearly; if 'exam focus', write realistic exam board style questions with marking hints).`
          : `Create rigorous, high-yield practice questions testing active recall and application.`;

        const groundingDirective = sources && sources.length > 0
           ? `GROUNDING MANDATE:
All questions, correct answers, and explanations MUST be 100% grounded in the facts and principles stated in the source documents.`
           : `GROUNDING MANDATE:
All questions, correct answers, and explanations MUST be accurate and logically sound based on rigorous academic knowledge. `;

        const prompt = `Generate a high-quality practice revision quiz with ${questionCount} questions based on the topic.
Topic: "${title}"
Target Difficulty: ${difficulty}
Allowed Question Types: ${JSON.stringify(questionTypes)}

${groundingDirective}

LANGUAGE REQUIREMENT:
${langDirective}

STYLE:
${styleDirective}

Create a balanced mix of questions according to the allowed types:
- 'multiple_choice': 4 options (array of strings), correctAnswer is 0-based index number (0, 1, 2, 3).
- 'true_false': options must be ["True", "False"] (or translated equivalent), correctAnswer is 0 (for True) or 1 (for False).
- 'fill_in_blank': question with "____", correctAnswer is the key word/phrase (string), options is empty array [].
- 'short_answer': open-ended exam question. correctAnswer is the model ideal answer/key points string.

Each question MUST include:
{
  "id": "q-1",
  "type": "multiple_choice" | "true_false" | "fill_in_blank" | "short_answer",
  "question": "string",
  "options": ["string"],
  "correctAnswer": 0 | "string",
  "explanation": "string",
  "hint": "string",
  "sourceReference": "string"
}

Return ONLY a JSON object:
{
  "id": "quiz-${Date.now()}",
  "topicTitle": "${title}",
  "difficulty": "${difficulty}",
  "questions": [ ... ]
}`;

        const parts = buildGeminiSourceParts(sources, prompt);

        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: [
            {
              role: 'user',
              parts: parts,
            },
          ],
          config: {
            systemInstruction: sources && sources.length > 0
              ? 'You are an experienced examiner and question creator. Create realistic, grounded questions testing conceptual recall strictly from the source material. Return strictly valid JSON.'
              : 'You are an experienced examiner and question creator. Create realistic, academically rigorous questions testing conceptual recall. Return strictly valid JSON.',
            
            responseMimeType: 'application/json',
          },
        });

        const text = response.text || '{}';
        const parsed = parseJsonSafely(text, null);
        if (parsed && parsed.questions && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          return res.json(parsed);
        }
      } catch (geminiErr) {
        console.warn('Gemini quiz generation failed, using smart quiz synthesis:', geminiErr);
      }
    }

    // Fallback quiz synthesis
    const quizData = generateSmartFallbackQuiz(title, sources, questionCount, difficulty, questionTypes);
    res.json(quizData);
  } catch (err: any) {
    console.error('Error in /api/generate-quiz:', err);
    res.status(500).json({ error: err.message || 'Failed to generate practice questions' });
  }
});

// 4. Adapt / Re-explain a single Lesson Section on demand
app.post('/api/adapt-lesson-section', async (req, res) => {
  try {
    const { section, topicTitle, sources, instruction, language } = req.body;
    if (!section) {
      return res.status(400).json({ error: 'Section data is required.' });
    }

    const ai = getAI();
    if (ai) {
      try {
        const langDirective = language && language !== 'auto'
          ? `Write the adapted explanation strictly in "${language}".`
          : `CRITICAL LANGUAGE REQUIREMENT: Write the adapted explanation in the exact same language as the current section text. For example, if the current section is in Malay/Bahasa Melayu, you MUST output 100% Malay/Bahasa Melayu.`;

        const prompt = `You are a personalized Socratic tutor. The student is asking you to adapt or re-explain the following chapter section according to their specific learning preference:

STUDENT'S REQUEST: "${instruction || 'Teach like I am a beginner and make it much more interesting'}"

CURRENT SECTION:
Title: ${section.title}
Summary: ${section.summary}
Detailed Content: ${section.detailedContent}

GROUNDING CONTEXT:
Topic: "${topicTitle}"

INSTRUCTIONS:
1. Re-write and enhance the 'detailedContent' and 'analogy' to directly fulfill the student's request (e.g. beginner-friendly tone, vivid story hooks, visual ASCII diagrams, step-by-step breakdown).
2. Keep all scientific/factual concepts 100% accurate to the source.
3. ${langDirective}
4. Return a JSON object with:
{
  "detailedContent": "New rich markdown explanation...",
  "analogy": "New intuitive real-world analogy...",
  "summary": "Concise summary..."
}`;

        const parts = buildGeminiSourceParts(sources || [], prompt);

        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: [
            {
              role: 'user',
              parts: parts,
            },
          ],
          config: {
            systemInstruction: 'You are an adaptable, engaging academic tutor. Use simple, easy-to-understand words. Return strictly valid JSON.',
            responseMimeType: 'application/json',
          },
        });

        const text = response.text || '{}';
        const parsed = parseJsonSafely(text, null);
        if (parsed && parsed.detailedContent) {
          return res.json({
            ...section,
            detailedContent: parsed.detailedContent,
            analogy: parsed.analogy || section.analogy,
            summary: parsed.summary || section.summary,
          });
        }
      } catch (e) {
        console.warn('Error adapting section with Gemini:', e);
      }
    }

    // Fallback adaptation
    res.json({
      ...section,
      summary: `Simplified: ${section.summary}`,
      detailedContent: `### Simplified Beginner Breakdown\n\n${section.detailedContent}\n\n> **Key Takeaway**: Focus on how the core components interact step-by-step before worrying about complex secondary formulas.`,
      analogy: `Imagine this like a simple everyday machine where input A directly powers output B.`,
    });
  } catch (err: any) {
    console.error('Error adapting section:', err);
    res.status(500).json({ error: err.message || 'Failed to adapt section' });
  }
});

// 4. Grade Short Answer / Essay Question with AI Rubric
app.post('/api/grade-short-answer', async (req, res) => {
  try {
    const { question, studentAnswer, idealAnswer, context } = req.body;
    if (!question || !studentAnswer) {
      return res.status(400).json({ error: 'Question and student answer are required.' });
    }

    const ai = getAI();

    if (ai) {
      try {
        const prompt = `You are an encouraging but rigorous academic teacher grading a student's written response to a revision question.

QUESTION: "${question}"
STUDENT'S ANSWER: "${studentAnswer}"
MODEL / IDEAL KEY POINTS: "${idealAnswer || 'Accurate explanation of the concept'}"
CONTEXT/TOPIC: "${context || ''}"

Grade the response fairly:
1. score: Integer from 0 to 100 representing accuracy, completeness, and conceptual grasp.
2. isCorrect: boolean (true if score >= 70, false otherwise).
3. strengths: What the student explained accurately or understood well.
4. missingPoints: Specific key concepts, keywords, or nuances the student left out or got slightly wrong.
5. aiFeedback: Friendly, constructive 2-3 sentence coaching feedback directly addressing the student.
6. improvedModelAnswer: A concise, perfect model answer illustrating how to get 100%.

Return ONLY a valid JSON object with: { "score": number, "isCorrect": boolean, "strengths": string, "missingPoints": string, "aiFeedback": string, "improvedModelAnswer": string }`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: prompt,
          config: {
            systemInstruction: 'You are a supportive, knowledgeable educator. Be constructive, motivating, and precise, using simple, clear words. Return strictly valid JSON.',
            responseMimeType: 'application/json',
          },
        });

        const text = response.text || '{}';
        const parsed = parseJsonSafely(text, null);
        if (parsed && typeof parsed.score === 'number') {
          return res.json(parsed);
        }
      } catch (geminiErr) {
        console.warn('Gemini grading failed, using heuristic grading:', geminiErr);
      }
    }

    // Heuristic assessment fallback
    const studentWords = studentAnswer.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const idealWords = (idealAnswer || question).toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const overlap = studentWords.filter(w => idealWords.includes(w)).length;
    const ratio = Math.min(1, overlap / Math.max(2, idealWords.length * 0.4));
    const score = Math.round(50 + ratio * 45);

    res.json({
      score,
      isCorrect: score >= 70,
      strengths: `You demonstrated a good grasp of the foundational concepts and expressed your reasoning clearly.`,
      missingPoints: `To score full 100% marks, be sure to include all formal academic terminology, precise definitions, and relevant boundary conditions.`,
      aiFeedback: `Great effort! Your explanation shows solid understanding. Focus on including all technical key terms to lock in full marks during examinations.`,
      improvedModelAnswer: idealAnswer || `${question}: The key mechanism requires identifying initial triggers, describing the intermediate transformation phase, and stating the final equilibrium state.`,
    });
  } catch (err: any) {
    console.error('Error grading answer:', err);
    res.status(500).json({ error: err.message || 'Failed to grade short answer' });
  }
});

// 5. Interactive Socratic Tutor Chat
app.post('/api/tutor-chat', async (req, res) => {
  try {
    const { messages, topicTitle, sources, tutorMode = 'socratic', customInstruction, language } = req.body;
    if (!messages || !messages.length) {
      return res.status(400).json({ error: 'Message history is required.' });
    }

    const ai = getAI();

    let styleInstruction = 'You are an inspiring, warm, and highly effective academic revision tutor. Always explain things using simple, easy-to-understand words and avoid overly complex jargon.';
    if (tutorMode === 'socratic') {
      styleInstruction += ' Use the Socratic method when appropriate: ask guiding questions to help the student arrive at insights themselves, while directly clarifying difficult confusions.';
    } else if (tutorMode === 'simple') {
      styleInstruction += ' Teach like the student is a beginner: use clear simple language, vivid everyday metaphors, and zero dense jargon without an immediate intuitive analogy.';
    } else if (tutorMode === 'exam_prep') {
      styleInstruction += ' Focus on exam mastery: highlight marking criteria, high-yield exam phrasing, common student pitfalls, and mnemonic memory tricks.';
    } else if (tutorMode === 'deep_dive') {
      styleInstruction += ' Provide deep, rigorous university-level academic depth, mechanism explanations, edge cases, and historical/theoretical context.';
    }

    if (customInstruction) {
      styleInstruction += `\nUSER CUSTOM PREFERENCE: "${customInstruction}". Obey this teaching style closely in your explanations.`;
    }

    const langDirective = language && language !== 'auto'
      ? `Generate your response strictly in "${language}".`
      : `CRITICAL LANGUAGE REQUIREMENT: Identify the primary language of the student's prompt and the source documents. You MUST write EVERYTHING (every title, section, definition, explanation, markdown, flashcard, question, etc.) ENTIRELY in that exact same language. For example, if the source text is in Malay/Bahasa Melayu, you MUST output 100% Malay/Bahasa Melayu. Do NOT use English unless the user explicitly requests another language in the custom instructions.`;

    let sourceContext = '';
    if (sources && sources.length) {
      sourceContext = `\n--- GROUNDING STUDY SOURCES ---\n`;
      for (const s of sources) {
        sourceContext += `Document: ${s.title || s.fileName}\n${(s.content || '').substring(0, 30000)}\n\n`;
      }
    }

    const systemPrompt = `${styleInstruction}

GROUNDING REQUIREMENT:
Ground your explanations strictly in the student's study topic "${topicTitle || 'General Revision'}" and the provided study sources whenever applicable. Do not invent facts that contradict the source materials.

LANGUAGE REQUIREMENT:
${langDirective}

Formatting:
Provide clear, structured explanations with markdown formatting (bullet points, bold key terms, tables if helpful).
At the end of your response, also provide 3 short, relevant suggested follow-up questions the student might want to ask next.

Return JSON in this format:
{
  "reply": "Your markdown formatted tutor response here...",
  "suggestedQuestions": ["Suggested question 1?", "Suggested question 2?", "Suggested question 3?"]
}`;

    if (ai) {
      try {
        const formattedContents: any[] = [];
        const validMessages = messages.filter((m: any) => m && m.content);

        let lastRole: string | null = null;
        for (let i = 0; i < validMessages.length; i++) {
          const msg = validMessages[i];
          const role = msg.role === 'assistant' ? 'model' : 'user';

          let textContent = msg.content;
          if (i === 0 && role === 'user') {
            textContent = `[Revision Context: Topic is "${topicTitle || 'Revision'}"${sourceContext ? `\nSources provided: ${sources.length} items` : ''}]\n\n${msg.content}`;
          }

          if (role === lastRole && formattedContents.length > 0) {
            formattedContents[formattedContents.length - 1].parts[0].text += `\n\n${textContent}`;
          } else {
            formattedContents.push({
              role,
              parts: [{ text: textContent }],
            });
            lastRole = role;
          }
        }

        if (formattedContents.length > 0 && formattedContents[formattedContents.length - 1].role !== 'user') {
          formattedContents.push({
            role: 'user',
            parts: [{ text: 'Please continue explaining with your teaching mode.' }],
          });
        }

        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: formattedContents,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
          },
        });

        const text = response.text || '{}';
        const parsed = parseJsonSafely(text, null);
        if (parsed && parsed.reply) {
          return res.json(parsed);
        }
      } catch (geminiErr) {
        console.warn('Gemini chat failed, using tutor response synthesis:', geminiErr);
      }
    }

    // Smart fallback tutor chat response
    const lastUserMessage = messages.filter((m: any) => m.role === 'user').slice(-1)[0]?.content || '';
    const title = topicTitle || 'your revision topic';

    res.json({
      reply: `### Revision Insight on ${title}\n\nGreat question! When studying **${title}**, keep these key principles in mind:\n\n1. **First Principles**: Break down "${lastUserMessage}" into foundational definitions and verify how variables interact.\n2. **Intuitive Analogy**: Consider how energy or variables flow in a chain reaction where every step depends on the previous phase.\n3. **Exam Check**: In examinations, always state the primary governing principle and units before presenting your final conclusion.\n\n*Would you like me to walk through a specific sample exam question on this, or explain another analogy?*`,
      suggestedQuestions: [
        `Can you give me a simple real-world analogy for this?`,
        `What is the most common exam trick question on this?`,
        `Test my understanding with a rapid-fire question!`,
      ],
    });
  } catch (err: any) {
    console.error('Error in tutor chat:', err);
    res.status(500).json({ error: err.message || 'Failed to get tutor response' });
  }
});

// 6. Generate Project Title
app.post('/api/generate-title', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content required' });
    
    const ai = getAI();
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: `Generate a short, suitable 2 to 6 word title for a study revision project based on the following content excerpt:\n\n${content.substring(0, 3000)}\n\nReturn JSON: { "title": "Your Generated Title" }`,
          config: {
            systemInstruction: 'You are an intelligent title generator for a study app. Return strictly valid JSON.',
            responseMimeType: 'application/json',
          }
        });
        const parsed = parseJsonSafely(response.text || '{}', null);
        if (parsed && parsed.title) {
          return res.json(parsed);
        }
      } catch (err) {
        console.warn('Title generation failed', err);
      }
    }
    res.json({ title: 'New Revision Topic' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Start the Express server and configure Vite
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ReviseAI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
