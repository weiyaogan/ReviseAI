export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

export function exportNotesHTML(notes: any, filename: string) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${filename}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 2rem; color: #333; }
    h1 { color: #1e40af; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; }
    h2 { color: #4338ca; margin-top: 2rem; }
    h3 { color: #374151; }
    .flashcard { border: 1px solid #d1d5db; padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem; background: #f9fafb; page-break-inside: avoid; }
    .flashcard-q { font-weight: bold; margin-bottom: 0.5rem; }
    .flashcard-a { margin-top: 0.5rem; color: #4b5563; }
  </style>
</head>
<body>
  <h1>${notes.title || 'Revision Notes'}</h1>
  
  <h2>Key Concepts & Summary</h2>
  <div>${notes.coreSummary ? notes.coreSummary.replace(/\\n/g, '<br/>') : 'No summary provided.'}</div>

  <h2>Flashcards</h2>
  ${notes.flashcards?.map((f: any) => `
    <div class="flashcard">
      <div class="flashcard-q">Q: ${f.front}</div>
      <div class="flashcard-a">A: ${f.back}</div>
    </div>
  `).join('') || '<p>No flashcards.</p>'}
</body>
</html>`;
  downloadFile(html, `${filename}.html`, 'text/html');
}

export function exportNotesDoc(notes: any, filename: string) {
  // A simple HTML file saved with .doc extension opens nicely in Word
  const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><title>${filename}</title></head>
<body>
  <h1>${notes.title || 'Revision Notes'}</h1>
  <h2>Key Concepts & Summary</h2>
  <p>${notes.coreSummary || ''}</p>
  <h2>Flashcards</h2>
  ${notes.flashcards?.map((f: any) => `
    <p><b>Q:</b> ${f.front}</p>
    <p><b>A:</b> ${f.back}</p>
    <br/>
  `).join('') || ''}
</body>
</html>`;
  downloadFile(html, `${filename}.doc`, 'application/msword');
}

export function exportNotesMarkdown(notes: any, filename: string) {
  let md = `# ${notes.title || 'Revision Notes'}\n\n`;
  md += `## Key Concepts & Summary\n${notes.coreSummary || ''}\n\n`;
  if (notes.flashcards && notes.flashcards.length > 0) {
    md += `## Flashcards\n`;
    notes.flashcards.forEach((f: any, idx: number) => {
      md += `**Q${idx + 1}:** ${f.front}\n**A:** ${f.back}\n\n`;
    });
  }
  downloadFile(md, `${filename}.md`, 'text/markdown');
}
