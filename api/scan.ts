import { GoogleGenerativeAI } from "@google/generative-ai";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { image } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ 
        error: "API Key não configurada no Vercel",
        details: "Verifique as Settings > Environment Variables"
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Em 2026, o 2.0-flash é o equilíbrio perfeito entre velocidade e precisão
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const imageData = image.includes(",") ? image.split(",")[1] : image;

    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          { text: "Você é um especialista em leitura de etiquetas de supermercado. Extraia o NOME do produto e o PREÇO unitário da imagem. Retorne APENAS um JSON puro, no formato: {\"name\": \"string\", \"price\": number}. Se não conseguir ler com clareza, identifique o melhor possível." },
          { inlineData: { mimeType: "image/jpeg", data: imageData } }
        ]
      }]
    });

    const response = await result.response;
    const text = response.text();
    
    // LIMPEZA DE JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;
    
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      const pMatch = text.match(/price["\s:]+["']?([\d,.]+)/i);
      const nMatch = text.match(/name["\s:]+["']?([^"'\n},]+)["']?/i);
      parsed = {
        name: nMatch?.[1]?.trim() ?? "Produto",
        price: pMatch?.[1] ?? 0
      };
    }

    if (parsed.price) {
      let p = parsed.price.toString().replace(/R\$\s?/, "").replace(/\s/g, "").replace(",", ".");
      parsed.price = parseFloat(p) || 0;
    }
    
    res.status(200).json(parsed);
  } catch (error: any) {
    console.error("Erro no scanner (Vercel):", error);
    res.status(500).json({ 
      error: "Erro no processamento da IA (Versão 2026)",
      details: error.message || "Erro desconhecido"
    });
  }
}
