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
    const imageData = image.includes(",") ? image.split(",")[1] : image;

    async function tryScan(model: string) {
      console.log(`[TURBINA] Tentando scan com: ${model}`);
      return await ai.models.generateContent({
        model,
        contents: [{
          role: "user",
          parts: [
            { text: `Você é um especialista em leitura de etiquetas de supermercado, anotações à mão e preços. 
            Siga este processo (Cadeia de Pensamento):
            1. Analise toda a imagem em busca de preços e nomes de produtos.
            2. Se a letra estiver difícil (manuscrito), procure padrões de preços (ex: 34.72 ou 1.99).
            3. Atenção extrema: A letra "o" ou "O" manuscrita em um preço costuma ser o número "0".
            4. Extraia o NOME e o PREÇO unitário.
            5. Retorne APENAS um JSON: {"name": "string", "price": number}. 
            6. Se não ler nada, use {"name": "", "price": 0}.` },
            { inlineData: { data: imageData, mimeType: "image/jpeg" } }
          ]
        }],
        config: {
          responseMimeType: "application/json",
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT' as any, threshold: 'BLOCK_NONE' as any },
            { category: 'HARM_CATEGORY_HATE_SPEECH' as any, threshold: 'BLOCK_NONE' as any },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as any, threshold: 'BLOCK_NONE' as any },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as any, threshold: 'BLOCK_NONE' as any },
          ],
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              price: { type: Type.STRING } // Mudamos para STRING para evitar que o Google trave no formato numérico
            },
            required: ["name", "price"]
          }
        }
      });
    }

    let result;
    let engineUsed = "";
    
    // Tenta Motor 1.5 primeiro (Estável/Cota Alta)
    try {
      // Mudamos para 'gemini-1.5-flash-latest' ou 'gemini-1.5-flash' explicitamente
      // Alguns ambientes 404 com o nome simples
      try {
        result = await tryScan("gemini-1.5-flash-latest");
      } catch (inner404) {
        console.warn("[RE-TRY] 1.5-latest falhou, tentando 1.5-flash padrão...");
        result = await tryScan("gemini-1.5-flash");
      }
      
      engineUsed = "1.5-FLASH-STÁVEL";
      
      // BLINDAGEM DE QUALIDADE: Se o 1.5 retornar preço 0, vamos forçar o backup (2.0)
      // para ver se ele lê melhor o manuscrit.
      const rawText = result.text || "{}";
      if (rawText.includes('"price": 0') || rawText.includes('"price":0') || rawText.includes('"price": "0') || rawText.includes('"price": ""')) {
        console.warn("[QUALIDADE] 1.5 retornou preço Zero/Vazio. Acionando 2.0 para contra-prova...");
        throw new Error("RE-TRY_FOR_QUALITY");
      }

    } catch (e1: any) {
      const isQualityRetry = e1.message === "RE-TRY_FOR_QUALITY";
      const is404 = JSON.stringify(e1).includes("404") || e1.message?.includes("404");
      
      console.warn(isQualityRetry ? "[RESGATE] Acionando Backup por qualidade..." : "[BACKUP] Motor 1.5 falhou (404 ou outros), tentando 2.0...", e1.message);
      
      try {
        // O 2.0 flash costuma estar em preview e funciona bem com o nome simples
        result = await tryScan("gemini-1.5-flash-8b"); // Tenta o 8B como última esperança se o 1.5 falhou
        engineUsed = "1.5-FLASH-8B (RESGATE)";
      } catch (e8b) {
        try {
          result = await tryScan("gemini-2.0-flash");
          engineUsed = "2.0-FLASH-RESERVA";
        } catch (e2: any) {
          throw new Error(`Ambos os motores falharam. Erro 1.5: ${e1.message}. Erro 2.0: ${e2.message}`);
        }
      }
    }

    console.log(`[SUCESSO] ${engineUsed} Finalizado.`);
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
      
      // SUPER NORMALIZAÇÃO: O Google às vezes retorna string ou number
      let rawPrice = parsed.price;
      
      if (rawPrice !== undefined && rawPrice !== null) {
        let priceStr = String(rawPrice).trim();
        
        // 1. Corretor de Caligrafia: 'o' ou 'O' vira '0'
        priceStr = priceStr.replace(/[oO]/g, "0");
        
        // 2. Limpeza profunda: Remove R$, espaços, e acerta a vírgula
        const cleanedPrice = priceStr
          .replace(/R\$/, "")
          .replace(",", ".")
          .replace(/[^\d.]/g, "")
          .trim();
          
        parsed.price = parseFloat(cleanedPrice) || 0;
      } else {
        parsed.price = 0;
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
