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

    const ai = new GoogleGenAI({ apiKey });
    const modelName = "gemini-1.5-flash"; 
    const imageData = image.includes(",") ? image.split(",")[1] : image;

    console.log("[v10-FINAL-BLINDADA] Servidor iniciando scan local com modelo:", modelName);

    const result = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: "user",
          parts: [
            { text: "Você é um especialista em leitura de etiquetas de supermercado, anotações à mão e preços. Extraia o NOME do produto e o PREÇO unitário. Retorne APENAS um JSON: {\"name\": \"string\", \"price\": number}. Se não ler nada, use {\"name\": \"\", \"price\": 0}." },
            { inlineData: { data: imageData, mimeType: "image/jpeg" } }
          ]
        }
      ],
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
            price: { type: Type.NUMBER }
          },
          required: ["name", "price"]
        }
      }
    });
  
      let text = result.text || "{}";
      console.log("Resultado da IA Bruto (Local):", text);
  
      // Blindagem Ninja: Procura o primeiro { e o último } para extrair o JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        text = jsonMatch[0];
      } else {
        throw new Error(`A IA não retornou um JSON válido localmente. Resposta: ${text.substring(0, 50)}...`);
      }
  
      try {
        const parsed = JSON.parse(text);
        // Normalização: Preço pode vir como string "34.72" ou com vírgula "34,72"
        if (typeof parsed.price === 'string') {
          const cleanedPrice = parsed.price.replace(/R\$/, "").replace(",", ".").replace(/[^\d.]/g, "").trim();
          parsed.price = parseFloat(cleanedPrice) || 0;
        }
        res.json(parsed);
      } catch (parseError) {
        console.error("Erro ao parsear JSON da IA (Local):", text);
        res.status(500).json({ 
          error: "Erro na interpretação dos dados local",
          debug: text 
        });
      }
    } catch (error: any) {
      console.error("Erro no scan do servidor:", error);
      res.status(500).json({ 
        error: "Erro no processamento da IA",
        details: error.message || "Erro desconhecido",
        quota: error.status === 429
      });
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
