import React, { useState } from 'react';
import { Database, AlertCircle, Key, ArrowRight, Check } from 'lucide-react';

export const SupabaseSetupScreen: React.FC = () => {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !key) return;

    localStorage.setItem('VITE_SUPABASE_URL', url.trim());
    localStorage.setItem('VITE_SUPABASE_ANON_KEY', key.trim());
    setSaved(true);

    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-xl bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 md:p-10 shadow-2xl relative z-10 space-y-6">
        
        {/* Title and Icon */}
        <div className="flex flex-col items-center text-center">
          <div className="p-3.5 bg-gradient-to-tr from-teal-500 to-indigo-500 rounded-2xl text-white shadow-lg shadow-teal-500/20 mb-4 animate-pulse">
            <Database className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            Conexão com o Supabase Requerida
          </h2>
          <p className="text-xs text-slate-400 font-semibold mt-2 max-w-md">
            A última implementação ativou a persistência de banco de dados e autenticação com o Supabase, mas as credenciais de conexão ainda não foram configuradas.
          </p>
        </div>

        {/* Informational guide */}
        <div className="bg-slate-950/60 border border-slate-800/60 rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-bold text-slate-350 uppercase tracking-wider flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-teal-400" /> Configuração Permanente (.env)
          </h3>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Recomendamos criar um arquivo chamado <code className="text-teal-455 bg-teal-950/40 px-1.5 py-0.5 rounded font-mono font-bold">.env</code> na raiz do projeto e adicionar as seguintes linhas:
          </p>
          <pre className="bg-slate-950 border border-slate-850 rounded-xl p-3.5 text-[10px] font-mono text-slate-300 overflow-x-auto select-all">
{`VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key-publica-aqui`}
          </pre>
        </div>

        {/* Temporary LocalStorage config */}
        <div className="space-y-4">
          <div className="text-center">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Ou salve temporariamente no navegador</span>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Project URL (VITE_SUPABASE_URL)</label>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-project.supabase.co"
                className="w-full bg-slate-950/50 border border-slate-800 text-white rounded-2xl py-3.5 px-4 text-xs focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/50 transition-all font-medium placeholder-slate-700"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">API Key (VITE_SUPABASE_ANON_KEY)</label>
              <div className="relative">
                <Key className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="eyJhbGciOi..."
                  className="w-full bg-slate-950/50 border border-slate-800 text-white rounded-2xl py-3.5 pl-11 pr-4 text-xs focus:outline-none focus:border-teal-500/80 focus:ring-1 focus:ring-teal-500/50 transition-all font-medium placeholder-slate-700"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saved}
              className={`w-full font-bold py-3.5 px-6 rounded-2xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] mt-2 ${
                saved
                  ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/10'
                  : 'bg-gradient-to-r from-teal-500 to-indigo-500 text-white shadow-teal-500/10 hover:shadow-teal-500/20 hover:from-teal-600 hover:to-indigo-600'
              }`}
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Salvo! Conectando...</span>
                </>
              ) : (
                <>
                  <span>Salvar & Conectar</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default SupabaseSetupScreen;
