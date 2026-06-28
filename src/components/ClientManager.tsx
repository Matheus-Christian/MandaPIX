import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Trash2, 
  X, 
  Edit, 
  Eye, 
  Mail, 
  Phone, 
  FileText, 
  ShoppingBag, 
  Calendar, 
  Clock,
  Lock,
  Printer,
  ShieldCheck
} from 'lucide-react';
import { formatBRL, parseScheduledDate } from '../utils/pix';
import type { Client, Order } from '../utils/pix';
import { supabase } from '../utils/supabaseClient';

interface ClientManagerProps {
  clients: Client[];
  orders: Order[];
  onAddClient: (client: Omit<Client, 'id'>) => void;
  onEditClient: (client: Client) => void;
  onDeleteClient: (id: string) => void;
  isClinica?: boolean;
  activeEmployee?: any;
}

export const ClientManager: React.FC<ClientManagerProps> = ({
  clients,
  orders,
  onAddClient,
  onEditClient,
  onDeleteClient,
  isClinica = false,
  activeEmployee,
}) => {
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'pedidos' | 'agendamentos' | 'prontuario'>('pedidos');

  // Prontuários & Atestados States
  const [medicalRecords, setMedicalRecords] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  
  // Form Prontuário
  const [recordDiagnosis, setRecordDiagnosis] = useState('');
  const [recordPrescription, setRecordPrescription] = useState('');
  const [recordDoctor, setRecordDoctor] = useState(activeEmployee ? activeEmployee.name : 'Dr(a). Médico(a)');

  // Form Atestado
  const [certDoctor, setCertDoctor] = useState(activeEmployee ? activeEmployee.name : 'Dr(a). Médico(a)');
  const [certCrm, setCertCrm] = useState('');
  const [certDays, setCertDays] = useState('1');
  const [certCid, setCertCid] = useState('');
  const [certDesc, setCertDesc] = useState('');
  const [hideCid, setHideCid] = useState(true);

  const [savingRecord, setSavingRecord] = useState(false);
  const [savingCert, setSavingCert] = useState(false);

  // Form State para Paciente/Cliente
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const isDoctorOrGerente = !activeEmployee || activeEmployee.role === 'GERENTE';

  React.useEffect(() => {
    if (viewingClient && isClinica) {
      loadMedicalData(viewingClient.id);
      setActiveModalTab('pedidos');
    }
  }, [viewingClient, isClinica]);

  const loadMedicalData = async (clientId: string) => {
    setLoadingRecords(true);
    try {
      // 1. Carregar prontuários
      const { data: recordsData, error: recordsErr } = await supabase
        .from('medical_records')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (recordsErr) throw recordsErr;
      setMedicalRecords(recordsData || []);

      // 2. Carregar atestados
      const { data: certsData, error: certsErr } = await supabase
        .from('medical_certificates')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (certsErr) throw certsErr;
      setCertificates(certsData || []);

    } catch (err) {
      console.warn('Erro ao carregar dados médicos do Supabase. Usando fallback local:', err);
      // Fallback local
      const localRecords = localStorage.getItem(`MANDAPIX_LOCAL_RECORDS_${clientId}`);
      if (localRecords) setMedicalRecords(JSON.parse(localRecords));
      else setMedicalRecords([]);

      const localCerts = localStorage.getItem(`MANDAPIX_LOCAL_CERTS_${clientId}`);
      if (localCerts) setCertificates(JSON.parse(localCerts));
      else setCertificates([]);
    } finally {
      setLoadingRecords(false);
    }
  };

  const handleAddMedicalRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingClient || !recordDiagnosis.trim()) return;
    setSavingRecord(true);
    
    const newRecord = {
      client_id: viewingClient.id,
      doctor_name: recordDoctor.trim(),
      diagnosis: recordDiagnosis.trim(),
      prescription: recordPrescription.trim() || null,
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase
        .from('medical_records')
        .insert([newRecord])
        .select();
      if (error) throw error;
      
      setMedicalRecords(prev => [data[0], ...prev]);
      setRecordDiagnosis('');
      setRecordPrescription('');
      alert('Registro no prontuário inserido com sucesso!');
    } catch (err) {
      console.warn('Erro ao salvar prontuário no Supabase, salvando localmente:', err);
      const localRecord = {
        id: 'record-' + Math.random().toString(36).substring(2, 9),
        ...newRecord
      };
      const updated = [localRecord, ...medicalRecords];
      setMedicalRecords(updated);
      localStorage.setItem(`MANDAPIX_LOCAL_RECORDS_${viewingClient.id}`, JSON.stringify(updated));
      setRecordDiagnosis('');
      setRecordPrescription('');
      alert('Registro no prontuário salvo localmente!');
    } finally {
      setSavingRecord(false);
    }
  };

  const handleAddCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingClient || !certDoctor.trim() || !certCrm.trim() || !certDesc.trim()) return;
    setSavingCert(true);

    const newCert = {
      client_id: viewingClient.id,
      doctor_name: certDoctor.trim(),
      doctor_crm: certCrm.trim(),
      days_off: parseInt(certDays, 10) || 1,
      cid_code: hideCid ? null : (certCid.trim() || null),
      description: certDesc.trim(),
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase
        .from('medical_certificates')
        .insert([newCert])
        .select();
      if (error) throw error;

      setCertificates(prev => [data[0], ...prev]);
      setCertCrm('');
      setCertDays('1');
      setCertCid('');
      setCertDesc('');
      alert('Atestado emitido com sucesso!');
    } catch (err) {
      console.warn('Erro ao salvar atestado no Supabase, salvando localmente:', err);
      const localCert = {
        id: 'cert-' + Math.random().toString(36).substring(2, 9),
        ...newCert
      };
      const updated = [localCert, ...certificates];
      setCertificates(updated);
      localStorage.setItem(`MANDAPIX_LOCAL_CERTS_${viewingClient.id}`, JSON.stringify(updated));
      setCertCrm('');
      setCertDays('1');
      setCertCid('');
      setCertDesc('');
      alert('Atestado salvo localmente!');
    } finally {
      setSavingCert(false);
    }
  };

  const handlePrintCertificate = (cert: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const formattedDate = new Date(cert.created_at).toLocaleDateString('pt-BR');
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Atestado Médico - ${viewingClient?.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            .header { text-align: center; margin-bottom: 50px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .header h1 { margin: 0; font-size: 24px; color: #111; }
            .header p { margin: 5px 0 0 0; font-size: 14px; color: #666; font-weight: bold; }
            .title { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 40px; text-transform: uppercase; letter-spacing: 1px; }
            .content { font-size: 16px; text-align: justify; margin-bottom: 60px; }
            .signature { text-align: center; margin-top: 80px; }
            .signature .line { border-top: 1px solid #333; width: 250px; margin: 0 auto 5px auto; }
            .signature .name { font-weight: bold; }
            .footer { text-align: center; font-size: 12px; color: #777; margin-top: 100px; border-top: 1px solid #eee; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>MandaPIX Saúde</h1>
            <p>Atestado de Aptidão Clínica / Afastamento</p>
          </div>
          
          <div class="title">Atestado Médico</div>
          
          <div class="content">
            Atesto para os devidos fins que o(a) paciente <strong>${viewingClient?.name}</strong>, inscrito(a) no documento <strong>${viewingClient?.document}</strong>, foi atendido(a) sob meus cuidados clínicos em <strong>${formattedDate}</strong>, necessitando de <strong>${cert.days_off} dia(s)</strong> de repouso para recuperação de sua saúde.
            <br/><br/>
            ${cert.description}
            ${cert.cid_code ? `<br/><br/>Diagnóstico codificado: <strong>CID: ${cert.cid_code}</strong>.` : ''}
          </div>
          
          <div class="signature">
            <div class="line"></div>
            <div class="name">${cert.doctor_name}</div>
            <div>CRM: ${cert.doctor_crm}</div>
          </div>

          <div class="footer">
            Documento emitido digitalmente em conformidade com a LGPD e regulamentações do CFM.
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintRecords = () => {
    if (!viewingClient) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const formattedRecords = medicalRecords.map(rec => {
      const date = new Date(rec.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="record-entry">
          <div class="record-meta">Registrado em ${date} por <strong>${rec.doctor_name}</strong></div>
          <div class="record-body">
            <strong>Evolução / Diagnóstico:</strong><br/>
            ${rec.diagnosis.replace(/\n/g, '<br/>')}
            ${rec.prescription ? `<br/><br/><strong>Prescrição / Recomendações:</strong><br/>${rec.prescription.replace(/\n/g, '<br/>')}` : ''}
          </div>
        </div>
      `;
    }).join('<hr/>');

    printWindow.document.write(`
      <html>
        <head>
          <title>Prontuário Completo - ${viewingClient.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #333; line-height: 1.5; }
            .header { margin-bottom: 30px; border-bottom: 2px solid #4f46e5; padding-bottom: 15px; }
            .header h1 { margin: 0; font-size: 22px; color: #111; }
            .patient-info { background: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 30px; font-size: 14px; }
            .patient-info table { width: 100%; }
            .patient-info td { padding: 5px; }
            .record-entry { margin-bottom: 25px; padding-bottom: 10px; }
            .record-meta { font-size: 12px; color: #666; margin-bottom: 10px; }
            .record-body { font-size: 14px; text-align: justify; }
            hr { border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0; }
            .footer { text-align: center; font-size: 11px; color: #999; margin-top: 50px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Prontuário de Evolução Clínica</h1>
            <p>Confidencial - Informações Médicas sob Proteção da LGPD</p>
          </div>
          
          <div class="patient-info">
            <table>
              <tr>
                <td><strong>Paciente:</strong> ${viewingClient.name}</td>
                <td><strong>Documento:</strong> ${viewingClient.document}</td>
              </tr>
              <tr>
                <td><strong>E-mail:</strong> ${viewingClient.email || '-'}</td>
                <td><strong>Telefone:</strong> ${viewingClient.phone || '-'}</td>
              </tr>
            </table>
          </div>
          
          <div class="records-list">
            ${medicalRecords.length === 0 ? '<p>Nenhum registro clínico no prontuário.</p>' : formattedRecords}
          </div>

          <div class="footer">
            MandaPIX Saúde - Dados de saúde protegidos de acordo com as diretrizes da LGPD (Lei 13.709/18).
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const startEditClient = (client: Client) => {
    setEditingClient(client);
    setName(client.name);
    setDocument(client.document);
    setEmail(client.email);
    setPhone(client.phone);
    setIsAdding(true);
    setErrors({});
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingClient(null);
    setName('');
    setDocument('');
    setEmail('');
    setPhone('');
    setErrors({});
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length <= 11) {
      val = val
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      val = val
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }
    setDocument(val.substring(0, 18));
    if (errors.document) setErrors(prev => ({ ...prev, document: '' }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length <= 10) {
      val = val.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2');
    } else {
      val = val.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');
    }
    setPhone(val.substring(0, 15));
    if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!name.trim()) newErrors.name = isClinica ? 'Nome do paciente é obrigatório' : 'Nome do cliente é obrigatório';
    if (!document.trim()) {
      newErrors.document = 'Documento é obrigatório';
    } else {
      const cleanDoc = document.replace(/\D/g, '');
      if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
        newErrors.document = 'Documento inválido';
      }
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'E-mail inválido';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (editingClient) {
      onEditClient({
        id: editingClient.id,
        storeId: editingClient.storeId,
        name: name.trim(),
        document: document.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
    } else {
      onAddClient({
        name: name.trim(),
        document: document.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
    }

    setName('');
    setDocument('');
    setEmail('');
    setPhone('');
    setEditingClient(null);
    setErrors({});
    setIsAdding(false);
  };

  const handleDelete = (id: string, name: string) => {
    const text = isClinica 
      ? `Tem certeza de que deseja excluir o paciente "${name}"? Todo o histórico continuará registrado.`
      : `Tem certeza de que deseja excluir o cliente "${name}"? Todas as cobranças vinculadas a ele continuarão registradas.`;
    if (confirm(text)) {
      onDeleteClient(id);
    }
  };

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.document.includes(search) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-pix" /> {isClinica ? 'Pacientes' : 'Clientes'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isClinica 
              ? 'Cadastre e gerencie o histórico de prontuários e consultas de seus pacientes' 
              : 'Cadastre e gerencie a base de clientes do seu negócio'}
          </p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center gap-1.5 bg-pix hover:bg-pix-dark text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" /> {isClinica ? 'Cadastrar Paciente' : 'Cadastrar Cliente'}
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {isAdding ? (
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm max-w-2xl mx-auto animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800 text-lg">
                {editingClient 
                  ? (isClinica ? 'Editar Paciente' : 'Editar Cliente') 
                  : (isClinica ? 'Cadastrar Novo Paciente' : 'Cadastrar Novo Cliente')}
              </h3>
              <button
                onClick={handleCancel}
                className="text-slate-400 hover:text-slate-655 p-1.5 rounded-lg hover:bg-slate-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                  {isClinica ? 'Nome Completo do Paciente' : 'Nome Completo / Razão Social'}
                </label>
                <input
                  type="text"
                  placeholder={isClinica ? "Ex: Maria de Souza" : "Ex: João Silva ou Empresa XYZ Ltda"}
                  value={name}
                  onChange={(e) => { setName(e.target.value); if (errors.name) setErrors(prev => ({ ...prev, name: '' })); }}
                  className={`w-full px-3 py-2 text-sm border rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all ${errors.name ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                />
                {errors.name && <p className="text-red-500 text-[10px] mt-0.5 ml-1">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
                    {isClinica ? 'CPF' : 'CPF / CNPJ'}
                  </label>
                  <input
                    type="text"
                    placeholder={isClinica ? "000.000.000-00" : "000.000.000-00 ou 00.000.000/0000-00"}
                    value={document}
                    onChange={handleDocumentChange}
                    className={`w-full px-3 py-2 text-sm border rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all font-mono ${errors.document ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                  />
                  {errors.document && <p className="text-red-500 text-[10px] mt-0.5 ml-1">{errors.document}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Telefone Celular</label>
                  <input
                    type="text"
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={handlePhoneChange}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">E-mail</label>
                <input
                  type="text"
                  placeholder="Ex: nome@email.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors(prev => ({ ...prev, email: '' })); }}
                  className={`w-full px-3 py-2 text-sm border rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-pix/50 focus:bg-white transition-all font-mono ${errors.email ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'}`}
                />
                {errors.email && <p className="text-red-500 text-[10px] mt-0.5 ml-1">{errors.email}</p>}
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-pix hover:bg-pix-dark text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm shadow-pix/20"
                >
                  {editingClient ? 'Salvar Alterações' : (isClinica ? 'Cadastrar Paciente' : 'Cadastrar Cliente')}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="flex bg-white rounded-2xl p-4 border border-slate-100 shadow-sm items-center gap-3">
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder={isClinica ? "Buscar paciente por nome, CPF ou e-mail..." : "Buscar por nome, e-mail ou documento..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent border-0 text-sm focus:outline-none text-slate-800 placeholder-slate-400"
              />
            </div>

            {/* List Table */}
            {filteredClients.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-sm">
                <Users className="w-12 h-12 text-slate-350 mx-auto mb-3" />
                <h4 className="font-bold text-slate-700 text-sm">
                  {isClinica ? 'Nenhum paciente encontrado' : 'Nenhum cliente encontrado'}
                </h4>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  {search ? 'Tente ajustar sua busca.' : (isClinica ? 'Cadastre o primeiro paciente do seu consultório.' : 'Cadastre o primeiro cliente da sua loja para iniciar.')}
                </p>
                {!search && (
                  <button
                    onClick={() => setIsAdding(true)}
                    className="inline-flex items-center gap-1.5 bg-pix/10 hover:bg-pix text-pix hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> {isClinica ? 'Criar Paciente' : 'Criar Cliente'}
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="p-4 pl-6">{isClinica ? 'Paciente' : 'Cliente'}</th>
                        <th className="p-4">{isClinica ? 'CPF' : 'CPF / CNPJ'}</th>
                        <th className="p-4">Contato</th>
                        <th className="p-4 text-right pr-6">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-xs">
                      {filteredClients.map((client) => (
                        <tr key={client.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 pl-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-pix/10 text-pix flex items-center justify-center font-bold text-xs uppercase">
                                {client.name.substring(0, 2)}
                              </div>
                              <div>
                                <span className="font-bold text-slate-800 block text-sm">{client.name}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 font-mono font-medium text-slate-600">
                            {client.document}
                          </td>
                          <td className="p-4 space-y-0.5">
                            <span className="text-slate-700 block font-medium">{client.email}</span>
                            <span className="text-slate-400 block font-semibold text-[10px]">{client.phone}</span>
                          </td>
                          <td className="p-4 text-right pr-6 space-x-1.5 flex items-center justify-end">
                            <button
                              onClick={() => { setViewingClient(client); setActiveModalTab('pedidos'); }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-pix hover:bg-pix-light border border-transparent hover:border-pix/10 transition-all active:scale-90"
                              title={isClinica ? "Ver Ficha do Paciente / Prontuário" : "Visualizar Informações"}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => startEditClient(client)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-pix hover:bg-pix-light border border-transparent hover:border-pix/10 transition-all active:scale-90"
                              title={isClinica ? "Editar Cadastro" : "Editar Cliente"}
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(client.id, client.name)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all active:scale-90"
                              title={isClinica ? "Remover Cadastro" : "Excluir Cliente"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Detalhes do Cliente / Ficha Clínica */}
      {viewingClient && (() => {
        const clientOrders = orders.filter(o => 
          o.clientDocument === viewingClient.document || 
          (viewingClient.email && o.clientEmail === viewingClient.email) ||
          (viewingClient.phone && o.clientPhone === viewingClient.phone)
        );

        const normalOrders = clientOrders.filter(o => !o.scheduledAt);
        const appointments = clientOrders.filter(o => !!o.scheduledAt);

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-slate-100 shadow-2xl animate-scale-up">
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-pix" />
                  <h3 className="font-bold text-slate-800 text-lg">
                    {isClinica ? 'Ficha do Paciente' : 'Informações do Cliente'}
                  </h3>
                </div>
                <button
                  onClick={() => setViewingClient(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Profile Card */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-pix/10 text-pix flex items-center justify-center font-black text-xl uppercase shrink-0">
                    {viewingClient.name.substring(0, 2)}
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-lg font-bold text-slate-800">{viewingClient.name}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-500 font-semibold mt-2">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-slate-450" />
                        <span>{viewingClient.document}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-4 h-4 text-slate-455" />
                        <span>{viewingClient.email || '-'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-4 h-4 text-slate-455" />
                        <span>{viewingClient.phone || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-slate-100 flex gap-4">
                  <button
                    onClick={() => setActiveModalTab('pedidos')}
                    className={`pb-2 border-b-2 text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeModalTab === 'pedidos' 
                        ? 'border-pix text-pix' 
                        : 'border-transparent text-slate-400 hover:text-slate-500'
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>{isClinica ? 'Consultas & Histórico' : 'Histórico de Pedidos'} ({normalOrders.length})</span>
                  </button>
                  <button
                    onClick={() => setActiveModalTab('agendamentos')}
                    className={`pb-2 border-b-2 text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeModalTab === 'agendamentos' 
                        ? 'border-pix text-pix' 
                        : 'border-transparent text-slate-400 hover:text-slate-500'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    <span>{isClinica ? 'Agendas Marcadas' : 'Agendamentos'} ({appointments.length})</span>
                  </button>
                  {isClinica && (
                    <button
                      onClick={() => setActiveModalTab('prontuario')}
                      className={`pb-2 border-b-2 text-xs font-bold transition-all flex items-center gap-1.5 ${
                        activeModalTab === 'prontuario' 
                          ? 'border-pix text-pix' 
                          : 'border-transparent text-slate-400 hover:text-slate-500'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Prontuário & Atestados</span>
                    </button>
                  )}
                </div>

                {/* Tab Content */}
                <div>
                  {activeModalTab === 'pedidos' && (
                    <div className="space-y-3">
                      {normalOrders.length === 0 ? (
                        <div className="text-center py-10 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl text-slate-455 text-xs">
                          {isClinica ? 'Nenhuma consulta faturada para este paciente.' : 'Nenhum pedido registrado para este cliente.'}
                        </div>
                      ) : (
                        normalOrders.map(order => (
                          <div 
                            key={order.id}
                            className="p-4 border border-slate-100 bg-slate-50/40 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-805">
                                  {isClinica ? 'Consulta #' : 'Pedido #'}
                                  {order.orderNumber}
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold">
                                  {new Date(order.dateCreated + 'T12:00:00').toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                              <div className="text-slate-500 font-medium max-w-md">
                                {order.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}
                              </div>
                            </div>
                            <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-2">
                              <span className="font-black text-slate-800 text-sm">
                                {formatBRL(order.totalAmount)}
                              </span>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                                order.status === 'APROVADO' || order.status === 'VENDA_CONCLUIDA' || order.status === 'PEDIDO_ENTREGUE' || order.status === 'ATENDIDO'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                  : order.status === 'PENDENTE' || order.status === 'REGISTRO_ITENS' || order.status === 'ENTRADA_PEDIDO'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                  : 'bg-slate-50 text-slate-650 border border-slate-150'
                              }`}>
                                {order.status.replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {activeModalTab === 'agendamentos' && (
                    <div className="space-y-3">
                      {appointments.length === 0 ? (
                        <div className="text-center py-10 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl text-slate-455 text-xs">
                          {isClinica ? 'Nenhuma consulta futura agendada.' : 'Nenhum agendamento ativo ou histórico registrado.'}
                        </div>
                      ) : (
                        appointments.map(app => {
                          const dateObj = parseScheduledDate(app.scheduledAt);
                          const isValidDate = !isNaN(dateObj.getTime());
                          const dateFormatted = isValidDate 
                            ? dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
                            : '';
                          const timeFormatted = isValidDate
                            ? dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                            : '';

                          return (
                            <div 
                              key={app.id}
                              className="p-4 border border-slate-100 bg-slate-50/40 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1 text-pix font-black">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{dateFormatted} às {timeFormatted}</span>
                                  </div>
                                </div>
                                <div className="text-slate-600 font-semibold">
                                  {app.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}
                                </div>
                                <div className="text-[10px] text-slate-400 font-medium">
                                  {isClinica ? 'Consulta #' : 'Pedido #'}
                                  {app.orderNumber} • Criado em {new Date(app.dateCreated + 'T12:00:00').toLocaleDateString('pt-BR')}
                                </div>
                              </div>
                              <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-2">
                                <span className="font-extrabold text-slate-800">
                                  {formatBRL(app.totalAmount)}
                                </span>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                                  app.status === 'APROVADO' || app.status === 'VENDA_CONCLUIDA' || app.status === 'PEDIDO_ENTREGUE' || app.status === 'ATENDIDO'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                    : app.status === 'PENDENTE' || app.status === 'REGISTRO_ITENS' || app.status === 'ENTRADA_PEDIDO'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                    : 'bg-slate-50 text-slate-650 border border-slate-150'
                                }`}>
                                  {app.status.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {activeModalTab === 'prontuario' && (
                    <div className="space-y-6">
                      {/* Privacy notice banner */}
                      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-3 text-amber-600 text-xs">
                        <Lock className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold uppercase tracking-wider">Confidencialidade & LGPD (Lei 13.709/18)</p>
                          <p className="mt-1 font-medium text-slate-600 leading-relaxed">
                            Os dados clínicos, anamneses e atestados deste paciente são dados pessoais sensíveis protegidos por sigilo médico. O acesso é restrito a profissionais autorizados.
                          </p>
                        </div>
                      </div>

                      {!isDoctorOrGerente ? (
                        <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl text-center space-y-2">
                          <Lock className="w-8 h-8 mx-auto text-slate-400" />
                          <p className="text-sm font-bold text-slate-700">Acesso Restrito</p>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto">
                            Seu perfil de acesso não possui permissão para visualizar o prontuário clínico ou emitir atestados. Apenas médicos e administradores possuem autorização.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {/* Layout em duas colunas: Listagem e Novo Registro */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            
                            {/* Coluna Esquerda: Listagem de Evoluções e Atestados */}
                            <div className="space-y-5">
                              <div>
                                <div className="flex justify-between items-center mb-3">
                                  <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Evolução Clínica / Prontuário</h5>
                                  {medicalRecords.length > 0 && (
                                    <button
                                      onClick={handlePrintRecords}
                                      className="flex items-center gap-1 text-[10px] font-bold text-pix hover:underline bg-transparent border-0 cursor-pointer"
                                    >
                                      <Printer className="w-3 h-3" /> Imprimir Prontuário
                                    </button>
                                  )}
                                </div>
                                {loadingRecords ? (
                                  <div className="text-center py-6 text-xs text-slate-400">Carregando prontuário...</div>
                                ) : medicalRecords.length === 0 ? (
                                  <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                                    Nenhum registro clínico cadastrado.
                                  </div>
                                ) : (
                                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                    {medicalRecords.map((rec) => (
                                      <div key={rec.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                                        <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold uppercase">
                                          <span>Por {rec.doctor_name}</span>
                                          <span>{new Date(rec.created_at).toLocaleDateString('pt-BR')}</span>
                                        </div>
                                        <p className="text-xs font-semibold text-slate-700 mt-1 leading-relaxed">{rec.diagnosis}</p>
                                        {rec.prescription && (
                                          <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                                            <strong>Prescrição:</strong> {rec.prescription}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="pt-2 border-t border-slate-100">
                                <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">Atestados Emitidos</h5>
                                {loadingRecords ? (
                                  <div className="text-center py-6 text-xs text-slate-400">Carregando atestados...</div>
                                ) : certificates.length === 0 ? (
                                  <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                                    Nenhum atestado emitido para este paciente.
                                  </div>
                                ) : (
                                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {certificates.map((cert) => (
                                      <div key={cert.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center hover:border-slate-200 transition-colors">
                                        <div>
                                          <p className="text-xs font-bold text-slate-750">{cert.days_off} dia(s) de afastamento</p>
                                          <p className="text-[10px] text-slate-400 mt-0.5">Emitido por {cert.doctor_name} em {new Date(cert.created_at).toLocaleDateString('pt-BR')}</p>
                                        </div>
                                        <button
                                          onClick={() => handlePrintCertificate(cert)}
                                          className="p-1.5 bg-slate-100 hover:bg-pix hover:text-white rounded-lg text-slate-550 transition-all border-0 cursor-pointer"
                                          title="Imprimir Atestado"
                                        >
                                          <Printer className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Coluna Direita: Formulários para Criar Registro */}
                            <div className="space-y-5 lg:pl-4 lg:border-l lg:border-slate-100">
                              
                              {/* Formulário 1: Evolução Clínica */}
                              <div className="bg-slate-50/50 p-4 border border-slate-100 rounded-2xl">
                                <h5 className="text-xs font-black text-slate-700 uppercase tracking-wide mb-3">Nova Evolução Clínica</h5>
                                <form onSubmit={handleAddMedicalRecord} className="space-y-3">
                                  <div>
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nome do Profissional / Médico</label>
                                    <input
                                      type="text"
                                      value={recordDoctor}
                                      onChange={(e) => setRecordDoctor(e.target.value)}
                                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-pix focus:bg-white bg-white text-slate-800"
                                      required
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Diagnóstico / Anamnese</label>
                                    <textarea
                                      value={recordDiagnosis}
                                      onChange={(e) => setRecordDiagnosis(e.target.value)}
                                      placeholder="Descreva a evolução do paciente, queixas, observações clínicas..."
                                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-pix focus:bg-white bg-white text-slate-800 h-16 resize-none"
                                      required
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Prescrição / Recomendações (Opcional)</label>
                                    <textarea
                                      value={recordPrescription}
                                      onChange={(e) => setRecordPrescription(e.target.value)}
                                      placeholder="Medicamentos receitados, exames solicitados, repouso..."
                                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-pix focus:bg-white bg-white text-slate-800 h-12 resize-none"
                                    />
                                  </div>
                                  <button
                                    type="submit"
                                    disabled={savingRecord}
                                    className="w-full py-2 bg-pix hover:bg-pix-dark text-white rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all disabled:opacity-50 border-0 cursor-pointer"
                                  >
                                    {savingRecord ? 'Salvando...' : 'Registrar no Prontuário'}
                                  </button>
                                </form>
                              </div>

                              {/* Formulário 2: Emitir Atestado */}
                              <div className="bg-slate-50/50 p-4 border border-slate-100 rounded-2xl">
                                <h5 className="text-xs font-black text-slate-700 uppercase tracking-wide mb-3">Emitir Atestado Médico</h5>
                                <form onSubmit={handleAddCertificate} className="space-y-3">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nome do Médico</label>
                                      <input
                                        type="text"
                                        value={certDoctor}
                                        onChange={(e) => setCertDoctor(e.target.value)}
                                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-pix focus:bg-white bg-white text-slate-800"
                                        required
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">CRM do Médico</label>
                                      <input
                                        type="text"
                                        placeholder="Ex: 12345-SP"
                                        value={certCrm}
                                        onChange={(e) => setCertCrm(e.target.value)}
                                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-pix focus:bg-white bg-white text-slate-800"
                                        required
                                      />
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Dias de Afastamento</label>
                                      <input
                                        type="number"
                                        min="1"
                                        max="90"
                                        value={certDays}
                                        onChange={(e) => setCertDays(e.target.value)}
                                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-pix focus:bg-white bg-white text-slate-800"
                                        required
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Código CID (Opcional)</label>
                                      <input
                                        type="text"
                                        placeholder="Ex: Z00.0 ou M54.5"
                                        value={certCid}
                                        onChange={(e) => setCertCid(e.target.value)}
                                        disabled={hideCid}
                                        className={`w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-pix focus:bg-white bg-white text-slate-800 ${hideCid ? 'bg-slate-100 opacity-60' : ''}`}
                                      />
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="checkbox"
                                      id="hideCidCheck"
                                      checked={hideCid}
                                      onChange={(e) => setHideCid(e.target.checked)}
                                      className="rounded border-slate-300 text-pix focus:ring-pix cursor-pointer"
                                    />
                                    <label htmlFor="hideCidCheck" className="text-[9px] font-bold text-slate-500 uppercase tracking-wide cursor-pointer select-none">
                                      Ocultar CID no atestado (LGPD)
                                    </label>
                                  </div>

                                  <div>
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Descrição / Diagnóstico Recomendado</label>
                                    <textarea
                                      value={certDesc}
                                      onChange={(e) => setCertDesc(e.target.value)}
                                      placeholder="Ex: O paciente necessita de afastamento por motivo de tratamento clínico, devendo permanecer em repouso domiciliar..."
                                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-pix focus:bg-white bg-white text-slate-800 h-14 resize-none"
                                      required
                                    />
                                  </div>
                                  <button
                                    type="submit"
                                    disabled={savingCert}
                                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all disabled:opacity-55 border-0 cursor-pointer"
                                  >
                                    {savingCert ? 'Emitindo...' : 'Emitir Atestado'}
                                  </button>
                                </form>
                              </div>

                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setViewingClient(null)}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 border-0 cursor-pointer"
                >
                  Fechar
                </button>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
};
export default ClientManager;
