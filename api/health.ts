import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.GEMINI_API_KEY || process.env.API_KEY;
  res.status(200).json({ 
    status: "ok", 
    hasKey: !!key,
    env: process.env.NODE_ENV || "production",
    message: key ? "API Key Detectada!" : "ERRO: API Key não configurada na Vercel"
  });
}
