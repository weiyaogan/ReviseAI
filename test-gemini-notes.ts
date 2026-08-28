import { GoogleGenAI } from '@google/genai';
async function test() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `Create FULL, COMPREHENSIVE, UNTRUNCATED interactive study revision notes, high-yield flashcards, and concept maps for the topic: "Photosynthesis".

CRITICAL COMPREHENSIVENESS MANDATE:
1. Generate comprehensive and deeply informative notes on the topic, ensuring a high level of academic rigor and exhaustive coverage of the subject matter.
2. In 'summaryMarkdown', include full exhaustive notes covering all chapters, key definitions, multi-step processes, equations/formulas, dates/evidence, and comparative tables.
3. Utilize your extensive knowledge base to formulate accurate, highly-detailed study notes.

Generate JSON with:
1. summaryMarkdown: A master revision guide in rich Markdown.
2. flashcards: 10 to 20 high-retention active recall flashcards.
3. conceptMap: 6 to 12 interconnected concept nodes.
4. formulasAndDefinitions: Array of 5 to 15 crucial formulas.
5. quickCheatSheet: 6 to 10 rapid-fire high-yield bullet takeaways.

Return ONLY a valid JSON object matching this structure.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: 'You are an elite academic master notes author. Return strictly valid JSON.',
        responseMimeType: 'application/json',
      }
    });
    console.log("Success length:", response.text?.length);
    JSON.parse(response.text || '{}');
    console.log("JSON PARSED OK");
  } catch (e) {
    console.error('Error:', e);
  }
}
test();
