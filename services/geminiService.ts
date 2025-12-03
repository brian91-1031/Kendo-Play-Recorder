import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeBracketImage = async (base64Image: string): Promise<ExtractedData> => {
  try {
    const prompt = `
      Analyze this Kendo tournament bracket image.
      
      Tasks:
      1. **Title**: Find the main title at the top (e.g., "個人賽-國中女子組").
      2. **Total Matches**: Look for the number at the very top root of the bracket tree. This number usually represents the total number of matches or the final match ID. Return this as 'totalMatches'.
      3. **Players**: Identify all player names. 
         - They are usually located at the very bottom of the tree.
         - **Crucial**: The names are often written vertically (one character per line) in Chinese.
         - Read the vertical columns from left to right (or based on the numbers 1, 2, 3... above them if present).
         - Combine the vertical characters into full names (e.g., "王小明").
      
      Return JSON only.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            totalMatches: { type: Type.INTEGER },
            players: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ["title", "totalMatches", "players"],
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as ExtractedData;
    }
    throw new Error("No response text from Gemini");
  } catch (error) {
    console.error("Error analyzing image:", error);
    throw error;
  }
};