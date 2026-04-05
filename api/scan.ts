import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { image } = req.body;
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    // Extrair base64 se vier com prefixo data:image/jpeg;base64,
    const imageData = image.includes('base64,') ? image.split('base64,')[1] : image;

    async function tryDirectScan(model: string) {
      console.log(`[DIRETO] Chamando: ${model}`);
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `Você é um especialista em leitura de etiquetas. 
              Siga este processo (Cadeia de Pensamento):
              1. Analise toda a imagem em busca de preços e nomes.
              2. Se a letra estiver difícil (manuscrito), procure padrões numéricos.
              3. Converta 'o'/'O' para '0' se estiver em preços.
              4. Extraia NOME e PREÇO.
              5. Retorne APENAS JSON: {"name": "string", "price": "string"}` },
              { inlineData: { mimeType: "image/jpeg", data: imageData } }
            ]
          }],
          generationConfig: {
            responseMimeType: "application/json"
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ]
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(JSON.stringify(data.error || data));
      }

      // Extração resiliente do JSON no texto da resposta
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      return text;
    }

    async function tryOpenAIScan() {
      if (!openaiKey) throw new Error("OpenAI Key missing");
      console.log(`[OPENAI] Ativando Motor de Emergência Direto...`);
      
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: "Você é um especialista em leitura de etiquetas. Extraia NOME e PREÇO. Retorne APENAS o JSON: {\"name\": \"string\", \"price\": \"string\"}. Atenção a caligrafia 'o'/'O' em preços é '0'." },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageData}` } }
            ]
          }],
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(JSON.stringify(data.error || data));
      return data.choices[0].message.content || "{}";
    }

    let resultText = "";
    let engineUsed = "";
    
    // SEQUÊNCIA DE RESGATE (QUADRI-MOTOR)
    try {
      if (!apiKey) throw new Error("GEMINI_KEY_MISSING");
      resultText = await tryDirectScan("gemini-1.5-flash");
      engineUsed = "1.5-FLASH";
      
      if (resultText.includes('"price": "0"') || resultText.includes('"price": ""')) {
        throw new Error("RETRY_FOR_QUALITY");
      }
    } catch (e1: any) {
      console.warn(`[FALLBACK] Motor Principal falhou, tentando 8B...`);
      try {
        if (!apiKey) throw new Error("GEMINI_KEY_MISSING");
        resultText = await tryDirectScan("gemini-1.5-flash-8b");
        engineUsed = "1.5-FLASH-8B";
      } catch (e2: any) {
        console.warn(`[FALLBACK] 8B falhou, indo para 2.0...`);
        try {
          if (!apiKey) throw new Error("GEMINI_KEY_MISSING");
          resultText = await tryDirectScan("gemini-2.0-flash");
          engineUsed = "2.0-FLASH";
        } catch (e3: any) {
          console.warn(`[FALLBACK] Gemini Exaurido, acionando OPENAI (Failsafe)...`);
          try {
            resultText = await tryOpenAIScan();
            engineUsed = "GPT-4O-MINI";
          } catch (e4: any) {
            throw new Error(`Colapso Total: ${e1.message} | ${e2.message} | ${e3.message} | ${e4.message}`);
          }
        }
      }
    }

    // Normalização Ninja (Bypassing SDK constraints)
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    const textToParse = jsonMatch ? jsonMatch[0] : "{}";
    const parsed = JSON.parse(textToParse);
    
    let rawPrice = String(parsed.price || "0");
    const cleanedPrice = rawPrice
      .replace(/[oO]/g, "0")
      .replace(/R\$/, "")
      .replace(",", ".")
      .replace(/[^\d.]/g, "")
      .trim();
    
    parsed.price = parseFloat(cleanedPrice) || 0;
    parsed.engine = engineUsed;

    res.status(200).json(parsed);

  } catch (error: any) {
    console.error("Erro Final Scanner:", error.message);
    res.status(500).json({ 
      error: error.message, 
      status: "exhausted",
      quota: error.message.includes("429")
    });
  }
}
