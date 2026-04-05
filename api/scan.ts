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
            { text: "Você é um especialista em leitura de etiquetas de supermercado, anotações à mão e preços. Extraia o NOME do produto e o PREÇO unitário. Retorne APENAS um JSON: {\"name\": \"string\", \"price\": number}. Se a informação for vaga ou manuscrita, tente extrair o melhor possível. Se não ler nada, use {\"name\": \"\", \"price\": 0}." },
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

    let text = result.text || "{}";
    console.log("Resultado da IA Bruto:", text);

    // Blindagem Ninja: Procura o primeiro { e o último } para extrair o JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      text = jsonMatch[0];
    } else {
      throw new Error(`A IA não retornou um JSON válido. Resposta: ${text.substring(0, 100)}...`);
    }

    try {
      const parsed = JSON.parse(text);
      // Normalização: Preço pode vir como string "34.72"
      if (typeof parsed.price === 'string') {
        const cleanedPrice = parsed.price.replace(/R\$/, "").replace(",", ".").replace(/[^\d.]/g, "").trim();
        parsed.price = parseFloat(cleanedPrice) || 0;
      }
      res.status(200).json(parsed);
    } catch (parseError) {
      console.error("Erro ao parsear JSON da IA:", text);
      res.status(500).json({ 
        error: "Erro na interpretação dos dados",
        debug: text 
      });
    }
  } catch (error: any) {
    console.error("Erro no scanner (Vercel):", error);
    res.status(500).json({ 
      error: "Erro no processamento da IA",
      details: error.message || "Erro desconhecido",
      quota: error.status === 429
    });
  }
}
