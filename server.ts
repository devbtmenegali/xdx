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
  
      console.log("Servidor iniciando scan com modelo:", modelName);
  
      const result = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: "user",
            parts: [
              { text: "Você é um especialista em extração de preços e nomes de produtos (em etiquetas, anotações à mão ou cartazes). Extraia o NOME e o PREÇO (por unidade ou por kg). Identifique se o preço é 'por quilo' (is_weight_based: true). Se for pesado, sugira o peso médio unitário em gramas (ex: Maçã=150, Banana=120) no campo 'estimated_weight_g'. Se a informação for vaga, use o contexto para extrair o melhor resultado possível. Retorne APENAS JSON." },
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
      res.json(JSON.parse(text));
    } catch (error: any) {
      console.error("Erro no scan do servidor:", error);
      res.status(500).json({ 
        error: "Erro no processamento da IA",
        details: error.message || "Erro desconhecido"
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
