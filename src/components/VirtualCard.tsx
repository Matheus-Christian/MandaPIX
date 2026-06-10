import React, { useState } from 'react';
import { Copy, Check, Wifi, Shield, CreditCard } from 'lucide-react';
import { BANKS } from '../utils/pix';
import type { SavedPixKey } from '../utils/pix';

interface VirtualCardProps {
  primaryKey?: SavedPixKey;
  onNavigateToKeys?: () => void;
}

export const PixIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 135 135" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M67.5 0L135 67.5L67.5 135L0 67.5L67.5 0Z" />
    <path d="M67.5 23.5L111.5 67.5L67.5 111.5L23.5 67.5L67.5 23.5Z" className="text-black/30" />
    <path d="M67.5 45L90 67.5L67.5 90L45 67.5L67.5 45Z" />
  </svg>
);

export const VirtualCard: React.FC<VirtualCardProps> = ({ primaryKey, onNavigateToKeys }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!primaryKey) return;
    navigator.clipboard.writeText(primaryKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getBankGradient = (wallet?: SavedPixKey) => {
    if (!wallet) return 'from-teal-600 via-pix to-emerald-700';
    if (wallet.walletType !== 'PIX') {
      if (wallet.cardProvider === 'Stripe') return 'from-indigo-950 via-slate-900 to-indigo-900';
      if (wallet.cardProvider === 'Mercado Pago') return 'from-blue-600 via-sky-600 to-blue-800';
      if (wallet.cardProvider === 'Cielo') return 'from-cyan-600 via-slate-800 to-zinc-950';
      return 'from-slate-800 via-slate-900 to-zinc-950';
    }
    const bank = BANKS.find(b => b.name.toLowerCase() === wallet.bankName.toLowerCase());
    return bank ? bank.gradient : 'from-teal-600 via-pix to-emerald-700';
  };

  return (
    <div className="relative w-full aspect-[1.586/1] rounded-3xl p-5 md:p-6 overflow-hidden text-white shadow-xl shadow-slate-950/30 transition-all select-none animate-scale-in group">
      {/* Dynamic Gradient Background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${getBankGradient(primaryKey)} z-0`} />
      
      {/* Background Holographic Glow Patterns */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_45%)] z-0" />
      <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-white/5 blur-2xl group-hover:scale-125 transition-transform duration-700" />
      
      {/* Hologram Card Overlay effect */}
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0)_30%,rgba(255,255,255,0.08)_40%,rgba(255,255,255,0.18)_45%,rgba(255,255,255,0.08)_50%,rgba(255,255,255,0)_60%)] -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-out z-0" />

      {primaryKey ? (
        <div className="relative h-full flex flex-col justify-between z-10">
          {/* Card Top Row */}
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest text-white/60 font-semibold">
                {primaryKey.walletType === 'PIX'
                  ? 'Chave Principal'
                  : primaryKey.walletType === 'CREDIT_CARD'
                  ? 'Carteira Crédito'
                  : 'Carteira Débito'}
              </span>
              <span className="font-extrabold text-base tracking-wide mt-0.5">{primaryKey.label}</span>
            </div>
            
            {/* Holographic logo & Wi-Fi indicator */}
            <div className="flex items-center gap-3">
              <Wifi className="w-5 h-5 text-white/40 rotate-90" />
              <div className="text-white flex items-center justify-center p-1 bg-white/10 rounded-lg backdrop-blur-sm border border-white/10">
                {primaryKey.walletType === 'PIX' ? (
                  <PixIcon className="w-5 h-5" />
                ) : (
                  <CreditCard className="w-5 h-5" />
                )}
              </div>
            </div>
          </div>

          {/* Card Middle: Gold Chip & Key info */}
          <div className="flex items-center justify-between my-2">
            {/* Simulated Gold Chip */}
            <div className="w-9 h-7 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 rounded-lg relative overflow-hidden border border-amber-300/40 shadow-inner flex flex-col justify-between p-1.5">
              <div className="grid grid-cols-3 gap-0.5 h-full opacity-40">
                <div className="border-r border-b border-black/30"></div>
                <div className="border-r border-b border-black/30"></div>
                <div className="border-b border-black/30"></div>
                <div className="border-r border-black/30"></div>
                <div className="border-r border-black/30"></div>
                <div></div>
              </div>
            </div>
            
            {/* Bank text branding */}
            <span className="font-bold text-xs uppercase tracking-widest bg-white/10 px-2.5 py-1 rounded-full border border-white/10 backdrop-blur-sm">
              {primaryKey.walletType === 'PIX' ? primaryKey.bankName : primaryKey.cardProvider || 'Gateway'}
            </span>
          </div>

          {/* Card Bottom Row: Holder Name & Action */}
          <div className="flex justify-between items-end border-t border-white/10 pt-3">
            <div className="flex flex-col max-w-[70%]">
              <span className="text-[9px] uppercase tracking-widest text-white/50 font-semibold">
                {primaryKey.walletType === 'PIX' ? 'Titular' : 'Provedor'}
              </span>
              <span className="font-bold text-xs tracking-wide truncate uppercase">
                {primaryKey.walletType === 'PIX' ? primaryKey.name : `${primaryKey.cardProvider || 'Gateway'} Gateway`}
              </span>
              <span className="font-mono text-[10px] text-white/80 mt-1 truncate">
                {primaryKey.walletType === 'PIX' 
                  ? primaryKey.key 
                  : `ID: •••• •••• •••• ${primaryKey.accountIdentifier?.slice(-4) || 'CARD'}`}
              </span>
            </div>

            <button
              onClick={handleCopy}
              className={`p-2 rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs font-bold border backdrop-blur-sm ${
                copied
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : 'bg-white/10 border-white/20 text-white hover:bg-white/20 active:scale-95'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> {primaryKey.walletType === 'PIX' ? 'Copiar Chave' : 'Copiar ID'}
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="relative h-full flex flex-col justify-between z-10 text-center items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center border border-white/20 mb-3 shadow-inner">
              <Shield className="w-6 h-6 text-white/70" />
            </div>
            <h4 className="font-bold text-sm">Nenhuma Carteira Cadastrada</h4>
            <p className="text-[11px] text-white/60 max-w-[200px] mt-1">
              Cadastre sua primeira carteira para faturar e ver seu cartão virtual aqui.
            </p>
            <button
              onClick={onNavigateToKeys}
              className="mt-4 bg-white text-slate-900 px-4 py-1.5 rounded-full text-xs font-bold hover:bg-slate-100 transition-all active:scale-95"
            >
              Configurar Carteiras
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default VirtualCard;
