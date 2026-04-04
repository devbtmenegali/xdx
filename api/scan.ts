import { GoogleGenAI, Type } from "@google/genai";

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

    const result = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{
        role: "user",
        parts: [
          { text: "Extract product name and unit price from this supermarket tag. Return ONLY JSON: {\"name\": \"string\", \"price\": number}. If unreadable, use empty name and 0 price." },
          { inlineData: { data: imageData, mimeType: "image/jpeg" } }
        ]
      }],
      config: { responseMimeType: "application/json" }
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
