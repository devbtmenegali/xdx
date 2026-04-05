import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API de Escaneamento (Servidor) - Mantido para proteger a chave Gemini
  app.post("/api/scan", async (req, res) => {
    try {
      const { image } = req.body;
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

      if (!apiKey) {
        console.error("API Key missing on server");
        return res.status(500).json({ error: "Chave de API não configurada no servidor." });
      }

    const imageData = image.includes('base64,') ? image.split('base64,')[1] : image;

    async function tryDirectScan(model: string) {
      console.log(`[DIRETO-LOCAL] Chamando: ${model}`);
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `Você é um especialista em leitura de etiquetas. 
              Siga este processo (Cadeia de Pensamento):
              1. Analise toda a imagem em busca de preços e nomes.
              2. Se a letra estiver difícil (manuscrito), procure padrões numéricos.
              3. Extraia NOME e PREÇO.
              4. Retorne APENAS JSON: {"name": "string", "price": "string"}` },
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

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      return text;
    }

    async function tryOpenAIScan() {
      if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI Key missing locally");
      console.log(`[OPENAI-LOCAL] Ativando Motor de Emergência Direto...`);
      
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: "Você é um especialista em leitura de etiquetas. Extraia NOME e PREÇO. Retorne APENAS o JSON: {\"name\": \"string\", \"price\": \"string\"}." },
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
    
    // SEQUÊNCIA DE RESGATE LOCAL (QUADRI-MOTOR)
    try {
      resultText = await tryDirectScan("gemini-1.5-flash");
      engineUsed = "1.5-FLASH";
      
      if (resultText.includes('"price": "0"') || resultText.includes('"price": ""')) {
        throw new Error("RETRY_FOR_QUALITY");
      }
    } catch (e1: any) {
      console.warn(`[FALLBACK-LOCAL] Falhou motor principal, tentando 8B...`);
      try {
        resultText = await tryDirectScan("gemini-1.5-flash-8b");
        engineUsed = "1.5-FLASH-8B";
      } catch (e2: any) {
        console.warn(`[FALLBACK-LOCAL] 8B falhou, indo para 2.0...`);
        try {
          resultText = await tryDirectScan("gemini-2.0-flash");
          engineUsed = "2.0-FLASH";
        } catch (e3: any) {
          console.warn(`[FALLBACK-LOCAL] Gemini Exaurido, acionando OPENAI (Failsafe)...`);
          try {
            resultText = await tryOpenAIScan();
            engineUsed = "GPT-4O-MINI";
          } catch (e4: any) {
            throw new Error(`Exaustão Local Total: ${e1.message} | ${e2.message} | ${e3.message} | ${e4.message}`);
          }
        }
      }
    }

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
    console.error("Erro no servidor local:", error);
    res.status(500).json({ error: error.message });
  }
});

  // Health check and Debug
  app.get("/api/health", (req, res) => {
    const key = process.env.GEMINI_API_KEY || process.env.API_KEY;
    res.json({ 
      status: "ok", 
      env: process.env.NODE_ENV || "development",
      hasKey: !!key,
      version: "3.0-b2c"
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Global Server Error:", err);
    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "Erro interno. Tente novamente."
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
