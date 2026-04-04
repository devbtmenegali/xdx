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

  app.post("/api/scan", async (req, res) => {
    try {
      const { image } = req.body;
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

      if (!apiKey) {
        console.error("API Key missing on server");
        return res.status(500).json({ error: "Chave de API não configurada no servidor." });
      }

      const ai = new GoogleGenAI({ apiKey });
      const modelName = "gemini-1.5-pro"; 
      const imageData = image.includes(",") ? image.split(",")[1] : image;

      console.log("Servidor iniciando scan com modelo:", modelName);

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: "user",
            parts: [
              { text: "Você é um especialista em leitura de etiquetas de supermercado. Extraia o NOME do produto e o PREÇO unitário da imagem. Retorne APENAS um JSON puro, sem markdown, no formato: {\"name\": \"string\", \"price\": number}. Se não conseguir ler, tente o seu melhor para identificar o produto e o preço." },
              { inlineData: { data: imageData, mimeType: "image/jpeg" } }
            ]
          }
        ]
      });

      let text = response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      // Limpa possível markdown da resposta
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();
      
      console.log("Resultado da IA (Pro):", text);
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
