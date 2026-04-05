import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode não permitida' });
  }

  try {
    const { image } = req.body;
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

    if (!apiKey) {
      console.error("API Key missing on Vercel");
      return res.status(500).json({ error: "Chave de API não configurada no painel da Vercel." });
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelName = "gemini-1.5-flash"; 
    const imageData = image.includes(",") ? image.split(",")[1] : image;

    console.log("Iniciando scan na Vercel com modelo:", modelName);

    const result = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: "user",
          parts: [
            { text: "Você é um especialista em etiquetas de supermercado. Extraia o NOME e o PREÇO (por unidade ou por kg). Identifique se o preço é 'por quilo' (is_weight_based: true). Se for pesado, sugira o peso médio unitário em gramas (ex: Pão Francês=50, Maçã=150, Banana=120) no campo 'estimated_weight_g'. Retorne APENAS JSON." },
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
            price: { type: Type.NUMBER },
            is_weight_based: { type: Type.BOOLEAN },
            estimated_weight_g: { type: Type.NUMBER }
          },
          required: ["name", "price"]
        }
      }
    });

    const text = result.text || "{}";
    console.log("Resultado da IA:", text);
    res.status(200).json(JSON.parse(text));
  } catch (error: any) {
    console.error("Erro no scanner (Vercel):", error);
    res.status(500).json({ 
      error: "Erro no processamento da IA",
      details: error.message || "Erro desconhecido"
    });
  }
}
