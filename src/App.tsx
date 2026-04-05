/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, useState, useRef, useEffect } from 'react';
import { Camera, Plus, Trash2, ShoppingCart, Loader2, X, Check, Image as ImageIcon, Zap, ZapOff, Calculator, LogOut, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { scanPriceTag, ProductInfo } from './services/gemini';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
// @ts-ignore
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
// @ts-ignore
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
// Safely init to avoid hard crash when env vars are missing
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const XDXLogo = ({ className = "w-12 h-12" }: { className?: string }) => (
  <svg viewBox="0 0 100 115" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feFlood floodColor="#4ade80" floodOpacity="0.5" result="glowColor" />
        <feComposite in="glowColor" in2="blur" operator="in" result="softGlow" />
        <feMerge>
          <feMergeNode in="softGlow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#004d61" />
        <stop offset="100%" stopColor="#002d3a" />
      </linearGradient>
      <filter id="buttonShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.3" />
      </filter>
    </defs>
    <rect x="8" y="5" width="84" height="105" rx="20" fill="url(#bodyGrad)" stroke="#10b981" strokeWidth="1.5" />
    <g filter="url(#neonGlow)">
      <rect x="18" y="15" width="64" height="32" rx="8" fill="#bbf7d0" />
      <text x="50" y="38" fontSize="20" fontWeight="900" fill="#003d4d" textAnchor="middle" fontFamily="sans-serif">XĐX</text>
    </g>
    <g transform="translate(18, 54)" filter="url(#buttonShadow)">
      <rect x="0" y="0" width="14" height="10" rx="3" fill="#ef4444" opacity="0.9" />
      <rect x="18" y="0" width="14" height="10" rx="3" fill="#005d75" />
      <rect x="36" y="0" width="14" height="10" rx="3" fill="#005d75" />
      <rect x="54" y="0" width="14" height="10" rx="3" fill="#10b981" />
      <rect x="0" y="15" width="14" height="10" rx="3" fill="#10b981" opacity="0.6" />
      <rect x="18" y="15" width="14" height="10" rx="3" fill="#10b981" opacity="0.6" />
      <rect x="36" y="15" width="14" height="10" rx="3" fill="#10b981" opacity="0.6" />
      <rect x="54" y="15" width="14" height="10" rx="3" fill="#10b981" />
      <rect x="0" y="30" width="14" height="10" rx="3" fill="#10b981" opacity="0.6" />
      <rect x="18" y="30" width="14" height="10" rx="3" fill="#10b981" opacity="0.6" />
      <rect x="36" y="30" width="14" height="10" rx="3" fill="#10b981" opacity="0.6" />
      <rect x="54" y="30" width="14" height="10" rx="3" fill="#10b981" />
      <rect x="0" y="45" width="14" height="10" rx="3" fill="#10b981" opacity="0.6" />
      <rect x="18" y="45" width="14" height="10" rx="3" fill="#10b981" opacity="0.6" />
      <rect x="36" y="45" width="14" height="10" rx="3" fill="#10b981" opacity="0.6" />
      <rect x="54" y="45" width="14" height="10" rx="3" fill="#10b981" />
      <rect x="0" y="60" width="32" height="10" rx="3" fill="#10b981" opacity="0.6" />
      <rect x="36" y="60" width="14" height="10" rx="3" fill="#10b981" opacity="0.6" />
      <rect x="54" y="60" width="14" height="10" rx="3" fill="#10b981" />
    </g>
  </svg>
);

// Error Boundary Component
class ErrorBoundary extends (Component as any) {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("App Crash:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
          <XDXLogo className="w-16 h-16 mb-6 opacity-50" />
          <h2 className="text-2xl font-black text-gray-900 mb-2 uppercase italic tracking-tighter">Ops! Algo deu errado</h2>
          <button onClick={() => window.location.reload()} className="bg-emerald text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg">Recarregar</button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface CartItem extends ProductInfo {
  id: string;
  quantity: number;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  // --- UI STATE ---
  const [items, setItems] = useState<CartItem[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'dashboard'>('list');
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<ProductInfo | null>(null);
  const [lastCapturedImage, setLastCapturedImage] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [storeName, setStoreName] = useState<string>('Mercado XĐX');
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [lastPriceInfo, setLastPriceInfo] = useState<{ price: number; store: string } | null>(null);

  // --- AUTH STATE ---
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [onboardingData, setOnboardingData] = useState({
    full_name: '',
    phone: '',
    city: '',
    state: '',
    birth_date: '',
    email: ''
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // --- REFS ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    if (!supabase) {
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // Auto sign-in anonymously for frictionless access
        supabase.auth.signInAnonymously().then(({ data }) => setSession(data.session));
      } else {
        setSession(session);
        fetchProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setItems([]);
      }
    });

    // Forced accessibility styles
    const style = document.createElement('style');
    style.innerHTML = `
      :root, html, body { background-color: #ffffff !important; color: #1a202c !important; color-scheme: light !important; }
      * { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif !important; }
    `;
    document.head.appendChild(style);

    return () => {
      subscription.unsubscribe();
      if (document.head.contains(style)) document.head.removeChild(style);
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setProfile(data);
      // If profile is incomplete, trigger onboarding
      if (!data.full_name) setIsOnboarding(true);
      else setIsOnboarding(false);
    } else {
      // Create empty profile if none exists (for anonymous users)
      await supabase.from('profiles').insert([{ id: userId }]);
      setIsOnboarding(true);
    }
  };

  const saveOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setAuthLoading(true);
    const { error } = await supabase.from('profiles').update({
      ...onboardingData,
      updated_at: new Date()
    }).eq('id', session.user.id);

    if (!error) {
      fetchProfile(session.user.id);
      setIsOnboarding(false);
    } else {
      setMessage({ type: 'error', text: 'Erro ao salvar perfil. Tente novamente.' });
    }
    setAuthLoading(false);
  };

  const fetchItems = async () => {
    if (!session) return;
    const { data, error } = await supabase.from('items')
      .select('*')
      .eq('is_session', true)
      .order('created_at', { ascending: false });
    if (data) {
      setItems(data.map(i => ({ ...i, rawText: i.raw_text })));
    }
  };

  useEffect(() => {
    if (session) fetchItems();
  }, [session]);

  const checkLastPrice = async (name: string) => {
    if (!session || !name) return;
    const { data } = await supabase.from('items').select('price, store_name').eq('name', name).order('created_at', { ascending: false }).limit(1);
    if (data && data.length > 0) setLastPriceInfo({ price: data[0].price, store: data[0].store_name });
    else setLastPriceInfo(null);
  };

  useEffect(() => {
    if (scannedProduct?.name) checkLastPrice(scannedProduct.name);
  }, [scannedProduct]);

  const handleLogout = async () => {
    if (window.confirm('Ao sair do acesso anônimo, seus dados podem ser perdidos. Continuar?')) {
      await supabase.auth.signOut();
    }
  };

  // --- CAMERA LOGIC ---
  useEffect(() => {
    if (isCameraOpen) startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [isCameraOpen]);

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities() as any;
        setHasTorch(!!caps.torch);
        setZoom(1);
      }
    } catch (err: any) {
      setError('Erro ao acessar câmera. Verifique permissões.');
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsTorchOn(false);
  };

  const toggleTorch = async () => {
    if (!streamRef.current || !hasTorch) return;
    const track = streamRef.current.getVideoTracks()[0];
    const newState = !isTorchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: newState }] as any });
      setIsTorchOn(newState);
    } catch (e) { console.error(e); }
  };

  const captureAndScan = async () => {
    if (isScanning || !videoRef.current || !canvasRef.current) return;
    setIsScanning(true);
    setError(null);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = 800;
    canvas.height = (800 * video.videoHeight) / video.videoWidth;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.8);
    setLastCapturedImage(base64);

    try {
      const result = await scanPriceTag(base64);
      setIsCameraOpen(false);
      setQuantity(1);
      
      if (result && result.name) {
        setScannedProduct(result);
      } else {
        const msg = 'Não foi possível identificar o produto. Tente um ângulo melhor.';
        setError(msg);
        setMessage({ type: 'error', text: msg });
        setScannedProduct({ name: '', price: 0 });
      }
    } catch (e: any) {
      console.error("Erro no processamento:", e);
      let errMsg = e.message || 'Erro no processamento';
      
      // Amigável para erro de limite (429)
      if (errMsg.includes('429') || errMsg.includes('RESOURSE_EXHAUSTED')) {
        errMsg = "O Google está cansado! 😴 Aguarde 15 segundos e tente novamente.";
      }

      setError(errMsg);
      setMessage({ type: 'error', text: errMsg });
      setScannedProduct({ name: '', price: 0 });
    } finally {
      setIsScanning(false);
    }
  };

  // --- ITEM HANDLERS ---
  const addToCart = async () => {
    if (!scannedProduct || !session) return;
    
    // For weighed products, calculate total price to save
    const unitWeight = scannedProduct.estimatedWeightG || 100;
    const finalPrice = scannedProduct.isWeightBased 
      ? (scannedProduct.price * (quantity * unitWeight / 1000))
      : scannedProduct.price;
    
    if (finalPrice <= 0) {
      setMessage({ type: 'error', text: 'Preço inválido (R$ 0,00).' });
      return;
    }
    
    // For weighed products, save as 1 unit with calculated price
    const finalQuantity = scannedProduct.isWeightBased ? 1 : quantity;
    
    // Append weight info to name if applicable
    const pName = scannedProduct.name.trim() || 'Produto';
    const displayName = scannedProduct.isWeightBased 
      ? `${pName} (~${((quantity * unitWeight) / 1000).toFixed(3)}kg)`
      : pName;

    const { error } = await supabase.from('items').insert([{
      name: displayName,
      price: finalPrice,
      quantity: finalQuantity,
      raw_text: scannedProduct.rawText,
      store_name: storeName,
      user_id: session.user.id
    }]);
    
    if (!error) {
      setScannedProduct(null);
      setQuantity(1);
      fetchItems();
      setLastCapturedImage(null);
    } else setError('Erro ao salvar item.');
  };

  const updateQty = async (id: string, delta: number, current: number) => {
    const next = Math.max(1, current + delta);
    const { error } = await supabase.from('items').update({ quantity: next }).eq('id', id);
    if (!error) fetchItems();
  };

  const removeItem = async (id: string) => {
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (!error) fetchItems();
  };

  const finalizePurchase = async () => {
    if (!session || items.length === 0) return;
    if (!window.confirm('Deseja finalizar esta compra e salvar no seu histórico?')) return;
    
    setAuthLoading(true);
    const tripId = crypto.randomUUID();
    const { error } = await supabase.from('items')
      .update({ is_session: false, trip_id: tripId })
      .eq('user_id', session.user.id)
      .eq('is_session', true);

    if (!error) {
       setItems([]);
       setMessage({ type: 'success', text: 'Compra finalizada e salva com sucesso!' });
       setTimeout(() => setMessage(null), 3000);
    } else {
       setError('Erro ao finalizar compra.');
    }
    setAuthLoading(false);
  };

  const clearList = async () => {
    if (!window.confirm('Limpar lista atual? (Os itens não serão salvos no histórico)')) return;
    const { error } = await supabase.from('items').delete().eq('is_session', true);
    if (!error) setItems([]);
  };

  const total = items.reduce((acc, i) => acc + i.price * i.quantity, 0);

  // --- RENDER HELPERS ---
  if (!supabase) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md space-y-8 p-10 bg-red-50 rounded-[3rem] border-2 border-red-100 shadow-xl">
        <XDXLogo className="w-24 h-24 mx-auto mb-4 opacity-50 grayscale" />
        <h2 className="text-3xl font-black text-red-600 uppercase italic tracking-tighter">Erro de Configuração</h2>
        <div className="space-y-4 text-left">
          <p className="text-gray-600 font-bold text-sm">O aplicativo não conseguiu carregar as chaves do Supabase. Verifique seu arquivo <code className="bg-white px-2 py-1 rounded">.env</code>:</p>
          <div className="text-xs font-mono bg-white p-4 rounded-2xl border border-red-100 space-y-2">
            <p className="text-red-500 line-through">SUPABASE_URL=...</p>
            <p className="text-green-600 font-bold">VITE_SUPABASE_URL=...</p>
            <p className="text-red-500 line-through mt-2">SUPABASE_ANON_KEY=...</p>
            <p className="text-green-600 font-bold">VITE_SUPABASE_ANON_KEY=...</p>
          </div>
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest text-center mt-6">O prefixo VITE_ é obrigatório para o frontend.</p>
        </div>
      </div>
    </div>
  );



  return (
    <div className="min-h-screen bg-white text-gray-900 pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <header className="max-w-2xl mx-auto p-4 flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <XDXLogo className="w-10 h-10" />
          <div>
            <h1 className="text-2xl font-black text-[#003d4d] tracking-tighter italic leading-none">XĐX</h1>
            <p className="text-[8px] font-black text-emerald uppercase tracking-widest">Global Shopping v8</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {items.length > 0 && activeTab === 'list' && (
            <button 
              onClick={finalizePurchase} 
              className="bg-emerald text-white px-4 py-2 rounded-xl font-black uppercase text-[10px] shadow-sm active:scale-95 transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4" /> Finalizar
            </button>
          )}
          <button onClick={handleLogout} className="p-2 bg-gray-50 rounded-xl text-gray-400 hover:text-red-500 transition-colors"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>
  
      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-20 left-4 right-4 z-50 p-4 rounded-2xl shadow-lg border ${
              message.type === 'success' ? 'bg-green-50 border-green-100 text-green-600' : 'bg-red-50 border-red-100 text-red-600'
            }`}
          >
            <div className="flex items-center gap-3">
              {message.type === 'success' ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
              <p className="font-bold text-sm">{message.text}</p>
            </div>
            <button onClick={() => setMessage(null)} className="absolute top-2 right-2 p-1 opacity-20"><X className="w-4 h-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>
  
      <main className="max-w-2xl mx-auto p-6 space-y-8">
        {/* Tabs - Only for Admins */}
        {profile?.role === 'admin' && (
          <div className="flex gap-4 p-2 bg-gray-100 rounded-[2rem]">
            <button onClick={() => setActiveTab('list')} className={`flex-1 py-4 rounded-3xl font-black uppercase text-xs tracking-widest transition-all ${activeTab === 'list' ? 'bg-white text-emerald shadow-md' : 'text-gray-400'}`}>Calculadora</button>
            <button onClick={() => { setActiveTab('dashboard'); supabase.from('analytics_summary').select('*').then(({data}) => data && setAnalytics(data)); }} className={`flex-1 py-4 rounded-3xl font-black uppercase text-xs tracking-widest transition-all ${activeTab === 'dashboard' ? 'bg-white text-emerald shadow-md' : 'text-gray-400'}`}>Relatórios</button>
          </div>
        )}

        {activeTab === 'list' ? (
          <div className="space-y-4">
            <div className="flex justify-between items-end px-1">
              <h2 className="text-lg font-black uppercase tracking-tighter text-[#003d4d]">Sua Lista</h2>
              {items.length > 0 && <button onClick={clearList} className="text-[10px] font-black text-red-400 uppercase tracking-widest">Limpar Tudo</button>}
            </div>
            
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {items.length === 0 && (
                  <div className="text-center py-20 opacity-20">
                    <ShoppingCart className="w-32 h-32 mx-auto mb-4" />
                    <p className="font-black uppercase tracking-widest text-sm">Nenhum item detectado</p>
                  </div>
                )}
                {items.map(item => (
                  <motion.div key={item.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white p-3 rounded-2xl border border-gray-100 flex justify-between items-center group shadow-sm">
                    <div className="flex-1 min-w-0 pr-3">
                      <h3 className="text-sm font-black text-[#1a202c] uppercase">{item.name}</h3>
                      <p className="text-base font-black text-emerald">R$ {item.price.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-100">
                        <button onClick={() => updateQty(item.id, -1, item.quantity)} className="w-8 h-8 bg-white text-emerald rounded-lg font-black shadow-sm">-</button>
                        <span className="font-black text-sm min-w-[1rem] text-center">{item.quantity}</span>
                        <button onClick={() => updateQty(item.id, 1, item.quantity)} className="w-8 h-8 bg-white text-emerald rounded-lg font-black shadow-sm">+</button>
                      </div>
                      <button onClick={() => removeItem(item.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-emerald/5 p-8 rounded-[3rem] border border-emerald/10">
                <BarChart3 className="w-8 h-8 text-emerald mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald/60">Gasto Global</p>
                <p className="text-4xl font-black text-[#003d4d] tracking-tighter">R$ {analytics.reduce((a,c) => a + (c.total_spent || 0), 0).toFixed(2)}</p>
              </div>
              <div className="bg-emerald/5 p-8 rounded-[3rem] border border-emerald/10">
                <Calculator className="w-8 h-8 text-emerald mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald/60">Operações</p>
                <p className="text-4xl font-black text-[#003d4d] tracking-tighter">{analytics.length}</p>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-black uppercase tracking-tighter px-2">Histórico por Loja</h3>
              {analytics.map(store => (
                <div key={store.store_name} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex justify-between items-center">
                  <div>
                    <h4 className="font-black uppercase text-lg text-[#003d4d]">{store.store_name}</h4>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{store.total_scans} itens detectados</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-emerald">R$ {store.total_spent.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* FIXED FOOTER TOTAL & SCANNER TRIGGER */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-white/95 backdrop-blur-3xl border-t border-gray-100 z-40 max-w-2xl mx-auto shadow-[0_-15px_50px_rgba(0,0,0,0.1)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
             <p className="text-[8px] font-black text-gray-400 uppercase tracking-[0.3em] mb-1">Total da Compra</p>
             <p className="text-4xl font-black text-[#003d4d] tracking-tighter italic leading-none whitespace-nowrap overflow-visible">R$ {total.toFixed(2)}</p>
          </div>
          <button onClick={() => setIsCameraOpen(true)} className="w-18 h-18 sm:w-20 sm:h-20 bg-[#003d4d] text-white rounded-[1.8rem] shadow-2xl flex items-center justify-center active:scale-90 transition-all">
            <Camera className="w-8 h-8 sm:w-10 sm:h-10" />
          </button>
        </div>
      </div>

      {/* CAMERA OVERLAY */}
      <AnimatePresence>
        {isCameraOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black flex flex-col">
            <div className="relative flex-1 overflow-hidden">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center p-10 pointer-events-none">
                <div className="w-full max-w-sm aspect-[4/3] border-4 border-emerald rounded-[3rem] relative shadow-[0_0_0_100vmax_rgba(0,0,0,0.5)]">
                  <div className="absolute top-1/2 left-0 right-0 h-1 bg-emerald opacity-50 shadow-[0_0_15px_#10b981]" />
                </div>
              </div>
              <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-6">
                <button onClick={captureAndScan} disabled={isScanning} className="w-24 h-24 bg-white rounded-full border-8 border-emerald group active:scale-90 transition-all flex items-center justify-center">
                  {isScanning ? <Loader2 className="w-10 h-10 text-emerald animate-spin" /> : <div className="w-12 h-12 bg-emerald rounded-full group-hover:scale-110 transition-all" />}
                </button>
                <p className="font-black text-white uppercase tracking-widest text-xs drop-shadow-lg">Toque para Capturar</p>
              </div>
              <button onClick={() => setIsCameraOpen(false)} className="absolute top-10 right-6 p-4 bg-black/20 text-white rounded-2xl backdrop-blur-md"><X className="w-8 h-8" /></button>
              {hasTorch && <button onClick={toggleTorch} className={`absolute top-10 left-6 p-4 rounded-2xl backdrop-blur-md ${isTorchOn ? 'bg-emerald text-white' : 'bg-black/20 text-white'}`}><Zap className="w-8 h-8" /></button>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SCANNED PRODUCT MODAL */}
      <AnimatePresence>
        {scannedProduct && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 pb-10 shadow-2xl border border-gray-100 space-y-5">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-black uppercase tracking-tighter text-[#003d4d]">Confirmar Item</h2>
                <button onClick={() => setScannedProduct(null)} className="p-2"><X className="w-6 h-6 text-gray-300" /></button>
              </div>
 
              <div className="flex gap-4">
                {lastCapturedImage && <img src={lastCapturedImage} className="w-24 h-24 object-cover rounded-2xl border shadow-inner" />}
                <div className="flex-1 space-y-3">
                  <div>
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Identificação</label>
                    <input type="text" value={scannedProduct.name} onChange={e => setScannedProduct({...scannedProduct, name: e.target.value})} className="w-full bg-gray-50 px-4 py-3 rounded-xl font-black text-lg uppercase outline-emerald" />
                  </div>
                  <div>
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                      {scannedProduct.isWeightBased ? 'Preço por QUILO (Kg)' : 'Preço Unitário'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-sm text-gray-400">R$</span>
                      <input type="number" step="0.01" value={scannedProduct.price} onChange={e => setScannedProduct({...scannedProduct, price: parseFloat(e.target.value) || 0})} className={`w-full bg-gray-50 px-4 py-3 pl-10 rounded-xl font-black text-xl outline-emerald ${scannedProduct.isWeightBased ? 'border-2 border-emerald/20' : ''}`} />
                    </div>
                  </div>
                </div>
              </div>
 
              {lastPriceInfo && (
                <div className={`p-3 rounded-xl flex items-center gap-3 border ${scannedProduct.price > lastPriceInfo.price ? 'bg-red-50 border-red-100 text-red-500' : scannedProduct.price < lastPriceInfo.price ? 'bg-green-50 border-green-100 text-green-500' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-black uppercase text-[8px] tracking-widest">{scannedProduct.price > lastPriceInfo.price ? '⚠️ Subiu!' : scannedProduct.price < lastPriceInfo.price ? '✅ Baixou!' : 'Mesmo preço'}</p>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full ${scannedProduct.price > lastPriceInfo.price ? 'bg-red-100' : scannedProduct.price < lastPriceInfo.price ? 'bg-green-100' : 'bg-gray-100'}`}>
                        {scannedProduct.price > lastPriceInfo.price ? '+' : ''} R$ {(scannedProduct.price - lastPriceInfo.price).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs font-bold mt-1">Última compra: R$ {lastPriceInfo.price.toFixed(2)}</p>
                  </div>
                  {scannedProduct.price > lastPriceInfo.price ? <Zap className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                </div>
              )}
 
              <div className="bg-gray-50 p-4 rounded-2xl flex items-center justify-center gap-6">
                <button 
                  onClick={() => setScannedProduct({...scannedProduct, isWeightBased: false})}
                  className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${!scannedProduct.isWeightBased ? 'bg-white text-[#003d4d] shadow-sm' : 'text-gray-400'}`}
                >
                  📦 Unidade
                </button>
                <button 
                  onClick={() => setScannedProduct({...scannedProduct, isWeightBased: true})}
                  className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${scannedProduct.isWeightBased ? 'bg-white text-emerald shadow-sm' : 'text-gray-400'}`}
                >
                  ⚖️ Peso Estimado
                </button>
              </div>

              {scannedProduct.isWeightBased && (
                <div className="p-4 bg-emerald/5 rounded-2xl border border-emerald/10 space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-[8px] font-black text-emerald uppercase tracking-widest">Peso Unitário Médio</p>
                    <div className="flex items-center gap-2">
                       <input 
                        type="number" 
                        value={scannedProduct.estimatedWeightG || 0} 
                        onChange={e => setScannedProduct({...scannedProduct, estimatedWeightG: parseInt(e.target.value) || 0})}
                        className="w-16 bg-white border border-emerald/20 rounded-lg p-1 text-center font-black text-emerald"
                      />
                      <span className="text-[10px] font-black text-emerald">g</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-emerald/60 font-medium leading-tight">Baseado no peso médio de {scannedProduct.name || 'item'} encontrado na internet.</p>
                </div>
              )}
 
              <div className="flex items-center justify-between py-4 border-y border-gray-50">
                <div>
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-2">QUANTIDADE (UN)</p>
                  <div className="flex items-center gap-6">
                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 bg-gray-50 rounded-xl font-black text-xl border">-</button>
                    <span className="text-3xl font-black text-[#003d4d]">{quantity}</span>
                    <button onClick={() => setQuantity(quantity + 1)} className="w-10 h-10 bg-gray-50 rounded-xl font-black text-xl border">+</button>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex flex-col items-end gap-1">
                    {scannedProduct.isWeightBased && (
                      <span className="bg-emerald text-white text-[8px] font-black px-2 py-0.5 rounded-full animate-bounce">VALOR ESTIMADO</span>
                    )}
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">SUBTOTAL</p>
                  </div>
                  <p className="text-3xl font-black text-emerald italic">
                    R$ {scannedProduct.isWeightBased 
                      ? (scannedProduct.price * (quantity * (scannedProduct.estimatedWeightG || 100) / 1000)).toFixed(2)
                      : (scannedProduct.price * quantity).toFixed(2)
                    }
                  </p>
                  {scannedProduct.isWeightBased && (
                    <p className="text-[10px] font-bold text-gray-400 italic">~ {((quantity * (scannedProduct.estimatedWeightG || 100)) / 1000).toFixed(3)}kg total</p>
                  )}
                </div>
              </div>
 
              <button onClick={addToCart} className="w-full bg-emerald text-white py-5 rounded-2xl font-black uppercase text-base shadow-lg active:scale-[0.98] transition-all">Confirmar e Adicionar</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <canvas ref={canvasRef} className="hidden" />
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsScanning(true);
        const reader = new FileReader();
        reader.onload = async () => {
          const result = await scanPriceTag(reader.result as string);
          if (result) setScannedProduct(result);
          setIsScanning(false);
        };
        reader.readAsDataURL(file);
      }} />
    </div>
  );
}
