// Summarize the timeline with GenAI

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { MinimizedTimeline } from "./mastodon";

export default function makeSummarizer(options: {
  api_key: string;
  system_instruction: string;
}) {
  const genAI = new GoogleGenerativeAI(options.api_key);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-8b",
    systemInstruction: options.system_instruction,
  });

  const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain",
  };

  return async function summarize(timeline: MinimizedTimeline) {
    const chatSession = model.startChat({
      generationConfig,
    });

    return chatSession.sendMessage(JSON.stringify(timeline));
  };
}
