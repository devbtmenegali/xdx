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

    const modelName = "gemini-1.5-flash"; 
    const imageData = image.includes(",") ? image.split(",")[1] : image;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Extract: Product Name, Price. Format ONLY JSON: {\"name\": \"string\", \"price\": number}" },
            { inlineData: { mimeType: "image/jpeg", data: imageData } }
          ]
        }]
      })
    });

    const data: any = await response.json();
    console.log("Raw Response from Google:", JSON.stringify(data));
    
    if (!response.ok) {
      throw new Error(data.error?.message || "Erro na API do Google");
    }

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    // LIMPEZA ULTRA-ROBUSTA
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
      error: "Erro no processamento da IA",
      details: error.message || "Erro desconhecido"
    });
  }
}
