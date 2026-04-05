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
      // If server says key is missing, return null to show specific UI error
      if (errorData.error?.includes("Chave de API")) {
        console.warn("Servidor reportou chave ausente.");
        return null;
      }
      throw new Error(errorData.error || "Erro no servidor ao processar imagem.");
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
