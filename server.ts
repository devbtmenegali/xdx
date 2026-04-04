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

  // SCANNER "TANQUE DE GUERRA" (RESTORED)
  app.post("/api/scan", async (req: any, res: any) => {
    try {
      const { image } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY não configurada no .env" });
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

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
      console.log("Resultado IA (Mestre):", text);

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
      console.error("Erro no servidor local:", error);
      res.status(500).json({ 
        error: "Erro no scanner local",
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
