import { GoogleGenAI, Type } from "@google/genai";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { image } = req.body;
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Chave de API não configurada." });
    }

    const ai = new GoogleGenAI({ apiKey });
    const imageData = image.includes(",") ? image.split(",")[1] : image;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: "Você é um especialista em leitura de etiquetas de supermercado e preços. Extraia o NOME do produto e o PREÇO unitário da imagem. Retorne APENAS um JSON: {\"name\": \"NOME DO PRODUTO\", \"price\": 0.00}. Se não conseguir ler com clareza, tente deduzir o nome e defina o preço como 0." },
            { inlineData: { data: imageData, mimeType: "image/jpeg" } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            price: { type: Type.NUMBER }
          },
          required: ["name", "price"]
        }
      }
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    res.status(200).json(JSON.parse(text));
  } catch (error: any) {
    console.error("Erro no scanner (Vercel):", error);
    res.status(500).json({ 
      error: "Erro no processamento da IA",
      details: error.message || "Erro desconhecido"
    });
  }
}
