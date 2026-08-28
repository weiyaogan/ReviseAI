/**
 * Web Speech API helper for text-to-speech audio playback
 */

let currentUtterance: SpeechSynthesisUtterance | null = null;

export function speakText(
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: any) => void,
  language?: string
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Speech synthesis is not supported in this browser.');
    return false;
  }

  stopSpeaking();

  // Strip markdown formatting for cleaner speech
  const cleanText = text
    .replace(/[#*_`~>\[\]\(\)]/g, ' ')
    .replace(/\$\$.*?\$\$/g, ' equation ')
    .replace(/\$.*?\$/g, ' equation ')
    .replace(/\\rightarrow/g, ' yields ')
    .replace(/\\le/g, ' less than or equal to ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanText) return false;

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  let langCode = 'en-US';
  
  if (language && language !== 'auto') {
    const langMap: Record<string, string> = {
      'Malay': 'ms-MY',
      'Bahasa Melayu': 'ms-MY',
      'Indonesian': 'id-ID',
      'Spanish': 'es',
      'French': 'fr',
      'German': 'de',
      'Chinese': 'zh-CN',
      'Arabic': 'ar-SA',
      'Tamil': 'ta-IN',
      'Portuguese': 'pt-BR',
      'Italian': 'it-IT',
      'Japanese': 'ja-JP',
      'Korean': 'ko-KR',
      'Russian': 'ru-RU',
      'Hindi': 'hi-IN',
      'Tagalog': 'tl-PH',
      'Vietnamese': 'vi-VN',
      'Thai': 'th-TH',
    };
    langCode = langMap[language] || 'en-US';
  }
  
  utterance.lang = langCode;

  // Try to pick a natural voice for the target language
  const targetVoices = voices.filter(v => v.lang.startsWith(langCode.split('-')[0]));
  const naturalVoice = targetVoices.find(
    (v) => (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium'))
  ) || targetVoices[0];

  if (naturalVoice) {
    utterance.voice = naturalVoice;
  } else {
    // Fallback to any english voice if language voice not found
    const fallbackVoice = voices.find((v) => v.lang.startsWith('en'));
    if (fallbackVoice) utterance.voice = fallbackVoice;
  }

  utterance.onstart = () => {
    if (onStart) onStart();
  };

  utterance.onend = () => {
    currentUtterance = null;
    if (onEnd) onEnd();
  };

  utterance.onerror = (e) => {
    currentUtterance = null;
    if (onError) onError(e);
  };

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
}

export function isSpeaking(): boolean {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    return window.speechSynthesis.speaking;
  }
  return false;
}
