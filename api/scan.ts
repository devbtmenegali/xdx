import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { image } = req.body;
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

    if (!apiKey) {
      return res.status(500).json({ 
        error: "API Key ausente na Vercel!",
        details: "Vá em Vercel Dashboard > Project Settings > Environment Variables e adicione GEMINI_API_KEY."
      });
    }

    const modelName = "gemini-1.5-pro"; 
    const imageData = image.includes(",") ? image.split(",")[1] : image;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Você é um especialista em ler etiquetas de mercado. Extraia o NOME do produto e o PREÇO unitário da imagem. Retorne APENAS um JSON no formato: {\"name\": \"string\", \"price\": number}." },
            { inlineData: { mimeType: "image/jpeg", data: imageData } }
          ]
        }]
      })
    });

    const data: any = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Erro na API do Google");

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(jsonStr);

    if (parsed.price && typeof parsed.price === 'string') {
      parsed.price = parseFloat(parsed.price.replace(",", ".")) || 0;
    }
    
    res.status(200).json(parsed);
  } catch (error: any) {
    console.error("Erro no scanner (Vercel):", error);
    res.status(500).json({ 
      error: "Erro no processamento da IA",
      details: error.message || "Erro desconhecido"
    });
  }
}
