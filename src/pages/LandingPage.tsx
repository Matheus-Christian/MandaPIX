import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowRight, 
  Check, 
  ShoppingBag, 
  DollarSign, 
  Users, 
  TrendingUp, 
  Star, 
  Sparkles, 
  Layers, 
  ShieldCheck, 
  ArrowUpRight 
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const handleCTA = () => {
    if (user) {
      if (profile?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/app');
      }
    } else {
      navigate('/login');
    }
  };

  const features = [
    {
      icon: Layers,
      title: "Isolamento Multi-lojas",
      description: "Gerencie múltiplos negócios ou catálogos independentes sob um mesmo painel com total controle financeiro."
    },
    {
      icon: DollarSign,
      title: "PIX Dinâmico Sem Taxas",
      description: "Gere payloads oficiais do Banco Central de forma ilimitada. Todo o dinheiro cai direto na sua conta bancária sem intermediários ou tarifas."
    },
    {
      icon: ShoppingBag,
      title: "Catálogos Digitais Integrados",
      description: "Seus clientes compram online através de links públicos sem precisar de login. Checkout simplificado por PIX ou Cartão."
    },
    {
      icon: Users,
      title: "Gestão Completa de Clientes",
      description: "Monitore o histórico de compras, controle contatos e emita faturamentos parcelados de forma intuitiva."
    }
  ];

  const plans = [
    {
      name: "Gratuito",
      price: "R$ 0",
      description: "Perfeito para profissionais que estão começando a estruturar seus faturamentos.",
      features: [
        "1 Loja/Workspace ativa",
        "Até 10 faturas emitidas por mês",
        "Integração PIX Dinâmico padrão",
        "Links de pagamentos simples",
        "Relatórios básicos"
      ],
      cta: "Começar Grátis",
      popular: false
    },
    {
      name: "Profissional",
      price: "R$ 49,90",
      description: "Ideal para MEIs e Autônomos que buscam automação completa e liberdade.",
      features: [
        "Até 3 Lojas/Workspaces ativas",
        "Até 100 faturas emitidas por mês",
        "PIX Dinâmico e Gateway de Cartões",
        "Simulador de Loja e Checkout público",
        "Painel financeiro detalhado com gráficos",
        "Suporte preferencial por e-mail"
      ],
      cta: "Assinar PRO",
      popular: true
    },
    {
      name: "Empresarial",
      price: "R$ 149,90",
      description: "O melhor custo-benefício para negócios estabelecidos e em plena escala.",
      features: [
        "Lojas/Workspaces ilimitadas",
        "Faturas ilimitadas por mês",
        "Todos os recursos inclusos e liberados",
        "Acesso à API para integrações",
        "Relatórios de faturamento avançados",
        "Suporte dedicado 24/7"
      ],
      cta: "Escolher Enterprise",
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-slate-950 overflow-x-hidden">
      {/* Background radial highlights */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-teal-500/5 rounded-full blur-[140px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-[140px] pointer-events-none"></div>

      {/* HEADER / NAVBAR */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-900">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-teal-500 to-indigo-500 rounded-xl text-white shadow-md shadow-teal-500/10">
              <svg viewBox="0 0 135 135" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M67.5 0L135 67.5L67.5 135L0 67.5L67.5 0Z" />
                <path d="M67.5 23.5L111.5 67.5L67.5 111.5L23.5 67.5L67.5 23.5Z" className="text-slate-900/30" />
                <path d="M67.5 45L90 67.5L67.5 90L45 67.5L67.5 45Z" />
              </svg>
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-white block leading-none">MandaPIX</span>
              <span className="text-[9px] text-teal-400 font-bold uppercase tracking-widest">ERP Autônomo</span>
            </div>
          </div>

          {/* Navigation links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-bold text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Recursos</a>
            <a href="#target" className="hover:text-white transition-colors">Público-Alvo</a>
            <a href="#pricing" className="hover:text-white transition-colors">Preços & Benefício</a>
          </nav>

          {/* CTA Login Button */}
          <div>
            <button
              onClick={handleCTA}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-5 rounded-full text-xs transition-all border border-slate-800/80 flex items-center gap-1.5 active:scale-95 shadow-md shadow-slate-950/20"
            >
              {user ? (
                <>
                  <span>Ir para o Painel</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-teal-400" />
                </>
              ) : (
                <>
                  <span>Acessar Conta</span>
                  <ArrowRight className="w-3.5 h-3.5 text-teal-400" />
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-16 pb-24 md:py-32 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Hero Texts */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-500/10 border border-teal-500/20 rounded-full text-[10px] font-bold text-teal-400 uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5 fill-teal-400" /> O melhor custo-benefício para Autônomos
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.05] tracking-tight">
              Faturamento sem taxas. <br />
              <span className="bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">Gestão simplificada.</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-xl">
              Esqueça as intermediadoras de pagamento que levam até 5% do seu faturamento. Com o **MandaPIX**, você emite cobranças por PIX dinâmico ou simula cartões de faturamento direto no bolso do cliente final. Toda a receita vai integralmente para a sua conta.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <button
                onClick={handleCTA}
                className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-extrabold py-3.5 px-8 rounded-2xl text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20 active:scale-[0.98]"
              >
                <span>Começar Agora</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href="#features"
                className="bg-slate-900/60 hover:bg-slate-800/60 text-slate-300 font-bold py-3.5 px-8 rounded-2xl text-xs uppercase tracking-wider transition-all border border-slate-800/80 flex items-center justify-center active:scale-[0.98]"
              >
                Conhecer Recursos
              </a>
            </div>
            {/* Trust Badges */}
            <div className="pt-8 border-t border-slate-900/80 flex flex-wrap gap-8 items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <span className="flex items-center gap-1"><ShieldCheck className="w-4 h-4 text-teal-500" /> Sem taxas por transação</span>
              <span className="flex items-center gap-1"><Star className="w-4 h-4 text-teal-500 fill-teal-500" /> 100% Autônomo e MEI</span>
            </div>
          </div>

          {/* Right Hero Preview Card Matrix */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-[400px] bg-slate-900/50 backdrop-blur-xl border border-slate-800/60 rounded-3xl p-6 shadow-2xl relative">
              <div className="absolute inset-0 bg-radial-gradient(circle_at_30%_20%,rgba(20,184,166,0.08),transparent_50%)" />
              {/* Card Header Simulation */}
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-850">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Carteira Digital</span>
                  <h4 className="font-extrabold text-white text-xs mt-0.5">Meu Pix Comercial</h4>
                </div>
                <div className="w-7 h-7 bg-teal-500/15 rounded-lg flex items-center justify-center font-black text-teal-400 text-xs">
                  PX
                </div>
              </div>

              {/* Card Value Grid */}
              <div className="space-y-4 font-sans text-left">
                <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Faturamento do Mês</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <h3 className="text-xl font-black text-white">R$ 12.450,00</h3>
                    <span className="text-[9px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3" /> +15.4%
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Faturas Recentes</span>
                  {/* Item 1 */}
                  <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-850">
                    <div>
                      <p className="font-bold text-slate-300">Ana Júlia Pinheiro</p>
                      <span className="text-[9px] text-slate-500">Desenvolvimento Web</span>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-white">R$ 1.166,67</p>
                      <span className="text-[8px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-bold uppercase">Pago</span>
                    </div>
                  </div>
                  {/* Item 2 */}
                  <div className="flex items-center justify-between text-xs py-1.5">
                    <div>
                      <p className="font-bold text-slate-300">Marcos Oliveira</p>
                      <span className="text-[9px] text-slate-500">Suporte Técnico Anual</span>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-white">R$ 450,00</p>
                      <span className="text-[8px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full font-bold uppercase">Pendente</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Small floating card simulation */}
            <div className="absolute bottom-[-20px] left-[-20px] bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex items-center gap-3 animate-bounce [animation-duration:4s] hidden sm:flex">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">PIX Recebido!</p>
                <p className="text-xs font-black text-white mt-1">R$ 1.200,00</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CORE FEATURES (Recursos) */}
      <section id="features" className="py-24 border-t border-slate-900 bg-slate-950/40 px-6">
        <div className="max-w-7xl mx-auto text-center space-y-12">
          <div className="space-y-3">
            <span className="text-[10px] text-teal-400 font-bold uppercase tracking-widest">Tecnologia Completa</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">O que o MandaPIX faz pelo seu negócio?</h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
              Diferente de sistemas complexos de faturamento corporativo, o MandaPIX foi moldado para ser prático, dinâmico e focado no Pix e na facilidade de simulação de cartões.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, idx) => {
              const Icon = f.icon;
              return (
                <div key={idx} className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6 text-left space-y-4 hover:border-slate-800 transition-all group hover:translate-y-[-4px] duration-300">
                  <div className="p-3 bg-slate-950/60 rounded-2xl text-teal-400 w-fit group-hover:bg-teal-500 group-hover:text-slate-950 transition-all">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-white text-sm">{f.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{f.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* TARGET AUDIENCE (Público-Alvo) */}
      <section id="target" className="py-24 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Visual element / Image simulation */}
          <div className="bg-gradient-to-tr from-teal-950/40 to-indigo-950/40 border border-slate-850 rounded-3xl p-8 relative min-h-[300px] flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(99,102,241,0.06),transparent_60%)]" />
            <div className="space-y-6 max-w-md text-left z-10">
              <span className="text-[10px] text-teal-400 font-bold uppercase tracking-widest">Foco de Mercado</span>
              <h3 className="text-2xl font-extrabold text-white tracking-tight">O sistema definitivo para prestadores de serviços, autônomos e MEIs</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Desenvolvemos o MandaPIX pois entendemos que a rotina de quem trabalha por conta própria é diferente. Você não precisa de telas com milhares de campos e burocracia contábil. Você precisa vender, cobrar e receber de forma ágil, segura e barata.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950/45 p-4 rounded-2xl border border-slate-850">
                  <h4 className="font-black text-white text-sm">Autônomos</h4>
                  <p className="text-[10px] text-slate-500 mt-1">Designers, Desenvolvedores, Consultores e Freelancers.</p>
                </div>
                <div className="bg-slate-950/45 p-4 rounded-2xl border border-slate-850">
                  <h4 className="font-black text-white text-sm">MEIs</h4>
                  <p className="text-[10px] text-slate-500 mt-1">Salões de beleza, infoprodutores, comércio local e pequenas agências.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Texts explaining target and value */}
          <div className="text-left space-y-6">
            <span className="text-[10px] text-teal-400 font-bold uppercase tracking-widest">Melhor Custo-Benefício</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              O mais completo e com a menor barreira de custo do mercado.
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Muitos prestadores acabam pagando taxas abusivas por link de pagamento ou sistemas caros de ERP apenas para conseguir controlar faturas em aberto.
            </p>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Com o **MandaPIX**, a lógica é simples: o sistema é seu parceiro. Não cobramos nenhuma porcentagem sobre os seus PIX dinâmicos gerados. Você escolhe seu plano e gerencia suas faturas sem surpresas no final do mês.
            </p>
            <ul className="space-y-2.5 pt-2">
              {[
                "Sem cobrança de porcentagem nas transações por PIX.",
                "Simulador de e-commerce e catálogo sem precisar programar nada.",
                "Divisão de parcelas e envio rápido de chaves Pix dinâmicas.",
                "Painel para simular e faturar no cartão quando o cliente desejar."
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-300 font-medium">
                  <div className="p-0.5 bg-teal-500/20 text-teal-400 rounded-md mt-0.5 flex-shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* PRICING PLANS (Preços) */}
      <section id="pricing" className="py-24 border-t border-slate-900 bg-slate-950/40 px-6">
        <div className="max-w-7xl mx-auto text-center space-y-16">
          <div className="space-y-3">
            <span className="text-[10px] text-teal-400 font-bold uppercase tracking-widest">Planos de Assinatura</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Investimento sob medida para o seu tamanho</h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
              Escolha o plano ideal para as suas necessidades de faturamento e expanda sua operação de acordo com a sua demanda.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((p, idx) => (
              <div 
                key={idx} 
                className={`bg-slate-900/60 border rounded-3xl p-8 text-left flex flex-col justify-between space-y-6 hover:border-slate-800 transition-all duration-300 relative ${
                  p.popular 
                    ? 'border-teal-500/80 shadow-xl shadow-teal-500/5 ring-1 ring-teal-500/30' 
                    : 'border-slate-900'
                }`}
              >
                {p.popular && (
                  <span className="absolute top-0 right-6 translate-y-[-50%] bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-black text-[9px] uppercase tracking-widest px-3 py-1 rounded-full shadow-md shadow-teal-500/10">
                    Mais Popular
                  </span>
                )}
                
                <div className="space-y-4">
                  <div>
                    <h3 className="font-extrabold text-lg text-white">{p.name}</h3>
                    <p className="text-[10px] text-slate-450 mt-1 leading-relaxed">{p.description}</p>
                  </div>

                  <div className="flex items-baseline gap-1.5 pt-2">
                    <span className="text-3xl font-black text-white">{p.price}</span>
                    <span className="text-[9px] text-slate-500 font-bold uppercase">/ mês</span>
                  </div>

                  <ul className="space-y-2.5 pt-4 border-t border-slate-850">
                    {p.features.map((f, fIdx) => (
                      <li key={fIdx} className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                        <Check className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={handleCTA}
                  className={`w-full py-3 rounded-2xl text-xs font-bold transition-all uppercase tracking-wider active:scale-[0.98] mt-4 ${
                    p.popular
                      ? 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-extrabold shadow-md'
                      : 'bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-300 hover:text-white'
                  }`}
                >
                  {p.cta}
                </button>
              </div>
            ))}
          </div>

          <div className="bg-slate-900/30 border border-slate-900 rounded-3xl p-6 max-w-2xl mx-auto flex flex-col sm:flex-row items-center gap-4 text-left">
            <div className="p-3 bg-teal-500/10 text-teal-400 rounded-2xl">
              <Star className="w-6 h-6 fill-teal-400" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-white text-xs">Cálculo de economia real:</h4>
              <p className="text-[11px] text-slate-450 leading-relaxed">
                Se você fatura R$ 10.000 por mês, uma taxa de gateway de 3% a 5% custaria até **R$ 500 mensais**. Com o plano PRO do MandaPIX, você economiza R$ 450 todos os meses ao centralizar suas chaves PIX.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-auto border-t border-slate-900 py-12 bg-slate-950 text-center px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-gradient-to-tr from-teal-500 to-indigo-500 rounded-lg text-white">
              <svg viewBox="0 0 135 135" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M67.5 0L135 67.5L67.5 135L0 67.5L67.5 0Z" />
                <path d="M67.5 23.5L111.5 67.5L67.5 111.5L23.5 67.5L67.5 23.5Z" className="text-slate-900/30" />
                <path d="M67.5 45L90 67.5L67.5 90L45 67.5L67.5 45Z" />
              </svg>
            </div>
            <span className="font-extrabold text-sm text-white">MandaPIX</span>
          </div>

          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            &copy; {new Date().getFullYear()} MandaPIX. Todos os direitos reservados.
          </p>

          <div className="flex gap-4 text-[10px] text-slate-450 font-bold uppercase tracking-wide">
            <span className="text-slate-600">Construído com React & Supabase</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
