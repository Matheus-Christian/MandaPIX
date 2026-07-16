import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  // Se já estiver logado, redireciona automaticamente
  useEffect(() => {
    if (!loading && user && profile) {
      if (profile.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/app');
      }
    }
  }, [user, profile, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Por favor, preencha todos os campos.');
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message === 'Invalid login credentials') {
          setErrorMsg('E-mail ou senha incorretos.');
        } else {
          setErrorMsg(error.message);
        }
      } else if (data.user) {
        // O useEffect acima irá lidar com o redirecionamento assim que o profile for carregado
      }
    } catch (err: any) {
      setErrorMsg('Ocorreu um erro ao tentar fazer login. Tente novamente.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium text-sm">Carregando sessão...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Elementos de fundo abstratos e brilhantes */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-teal-500/5 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none"></div>
      
      {/* Card de Login Glassmorphic */}
      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-8 md:p-10 shadow-xl shadow-slate-200/50 relative z-10">
        
        {/* Logo e Título */}
        <div className="flex flex-col items-center mb-8">
          <div className="p-3.5 bg-gradient-to-tr from-teal-500 to-emerald-400 rounded-2xl text-white shadow-lg shadow-teal-500/20 mb-4 animate-bounce">
            <svg viewBox="0 0 135 135" className="w-8 h-8 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M67.5 0L135 67.5L67.5 135L0 67.5L67.5 0Z" />
              <path d="M67.5 23.5L111.5 67.5L67.5 111.5L23.5 67.5L67.5 23.5Z" className="text-slate-950/30" />
              <path d="M67.5 45L90 67.5L67.5 90L45 67.5L67.5 45Z" />
            </svg>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight text-center leading-none">
            Bem-vindo ao MandaPIX
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-2 text-center uppercase tracking-wider">
            O ERP de Gestão do Autônomo
          </p>
        </div>

        {/* Mensagem de Erro com Animação */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-600 animate-[shake_0.4s_ease-in-out]">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span className="text-xs font-semibold leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Campo de E-mail */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">E-mail</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
                className="w-full bg-slate-50/50 border border-slate-200 text-slate-900 rounded-2xl py-3.5 pl-11 pr-4 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-all font-medium placeholder-slate-400 hover:border-slate-300"
              />
            </div>
          </div>

          {/* Campo de Senha */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Senha</label>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha"
                className="w-full bg-slate-50/50 border border-slate-200 text-slate-900 rounded-2xl py-3.5 pl-11 pr-12 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-all font-medium placeholder-slate-400 hover:border-slate-300"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Botão de Envio */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold py-3.5 px-6 rounded-2xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-2 group"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <span>Acessar Painel</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>

        {/* Nota de rodapé explicativa */}
        <div className="mt-8 text-center border-t border-slate-100 pt-6">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
            Área segura criptografada
          </p>
        </div>
      </div>
      
      {/* Estilo CSS customizado injetado para a animação do shake (sacudida) */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
};
