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

  // API de Escaneamento (Servidor)
  app.post("/api/scan", async (req, res) => {
    try {
      const { image } = req.body;
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

      if (!apiKey) {
        return res.status(500).json({ 
          error: "API Key ausente!",
          details: "Configure GEMINI_API_KEY no servidor."
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

      let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      
      // LIMPEZA ULTRA-ROBUSTA
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text;
      
      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        console.warn("JSON Fail, trying manual extraction...");
        const pMatch = text.match(/price["\s:]+([\d,.]+)/i);
        const nMatch = text.match(/name["\s:]+["']?([^"'\n}]+)["']?/i);
        parsed = {
          name: nMatch ? nMatch[1].trim() : "Produto",
          price: pMatch ? pMatch[1] : 0
        };
      }

      if (parsed.price) {
        let p = parsed.price.toString().replace(/R\$\s?/, "").replace(/\s/g, "").replace(",", ".");
        parsed.price = parseFloat(p) || 0;
      }
      
      res.status(200).json(parsed);

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
