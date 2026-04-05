export interface ProductInfo {
  name: string;
  price: number;
  rawText?: string;
  isWeightBased?: boolean;
  estimatedWeightG?: number;
}

export async function scanPriceTag(base64Image: string): Promise<ProductInfo | null> {
  console.log("scanPriceTag chamando servidor...");
  try {
    const response = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Servidor retornou erro:", errorData);
      
      const errorMessage = errorData.details || errorData.error || "Erro no servidor ao processar imagem.";
      const debugInfo = errorData.debug ? `\nDebug: ${errorData.debug}` : "";
      
      throw new Error(`${errorMessage}${debugInfo}`);
    }

    const result = await response.json();
    return {
      name: result.name || "",
      price: typeof result.price === 'number' ? result.price : 0,
      isWeightBased: result.is_weight_based,
      estimatedWeightG: result.estimated_weight_g,
      rawText: JSON.stringify(result)
    };
  } catch (error: any) {
    console.error("Erro no scanPriceTag:", error);
    throw error;
  }
}
