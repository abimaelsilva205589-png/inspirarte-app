import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Music2, Mic, Play, Pause, Square, Lock, Unlock, CheckCircle2,
  Clock, Send, Settings, LogOut, User, Download, MessageCircle,
  Copy, ChevronRight, Plus, Radio, KeyRound, ArrowLeft, Upload as UploadIcon,
  Sparkles, X, Trash2
} from "lucide-react";
import { supabase } from "./supabaseClient";

const LOGO_SRC = "/logo.png";

/* ---------------------------------------------------------
   Design tokens
   ink:      #141210  (studio black)
   paper:    #ECE3D0  (aged paper / tape label)
   red:      #C6342A  (logo red)
   red-dark: #8F2019
   amber:    #E3A23D  (tape amber / VU meter)
   green:    #4E9463  (signal green / liberado)
   line:     #3A342C  (hairline on dark)
---------------------------------------------------------- */

const GENRES = ["Sertanejo", "Gospel", "Pop", "MPB", "Forró", "Pagode", "Rock", "Trap/Rap", "Funk", "Outro"];
const INSTRUMENTS = [
  { id: "teclado", label: "Teclado" },
  { id: "guitarra", label: "Guitarra" },
  { id: "violao", label: "Violão" },
  { id: "contrabaixo", label: "Contrabaixo" },
  { id: "bateria", label: "Bateria" },
];

const STATUS = {
  enviado: { label: "Enviado", color: "#E3A23D", icon: Clock },
  producao: { label: "Em produção", color: "#E3A23D", icon: Radio },
  previa: { label: "Prévia disponível", color: "#4E9463", icon: Play },
  aguardando_pgto: { label: "Aguardando pagamento", color: "#C6342A", icon: KeyRound },
  liberado: { label: "Liberado", color: "#4E9463", icon: CheckCircle2 },
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/* ---------------------------------------------------------
   Metronome hook (Web Audio API)
---------------------------------------------------------- */
function useMetronome() {
  const [bpm, setBpm] = useState(90);
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(0);
  const ctxRef = useRef(null);
  const timerRef = useRef(null);

  const tick = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 1000;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
    setBeat((b) => (b + 1) % 4);
  }, []);

  useEffect(() => {
    if (playing) {
      if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const interval = 60000 / bpm;
      tick();
      timerRef.current = setInterval(tick, interval);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, bpm]);

  return { bpm, setBpm, playing, setPlaying, beat };
}

/* ---------------------------------------------------------
   Recorder hook
---------------------------------------------------------- */
function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBase64, setAudioBase64] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(null);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Escolhe um formato realmente suportado pelo navegador atual
      // (Safari/iOS não suporta webm; costuma usar mp4/aac)
      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/aac",
      ];
      const supportedType = preferredTypes.find(
        (t) => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)
      );

      const mr = supportedType ? new MediaRecorder(stream, { mimeType: supportedType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        // Usa o mimeType que o MediaRecorder de fato usou, não um valor fixo
        const actualType = mr.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: actualType });
        setAudioUrl(URL.createObjectURL(blob));
        const b64 = await blobToBase64(blob);
        setAudioBase64(b64);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      setError("Não foi possível acessar o microfone. Verifique as permissões do navegador.");
    }
  };

  const stop = () => {
    mediaRef.current?.stop();
    setRecording(false);
    clearInterval(timerRef.current);
  };

  const reset = () => {
    setAudioUrl(null);
    setAudioBase64(null);
    setSeconds(0);
  };

  return { recording, audioUrl, audioBase64, seconds, error, start, stop, reset };
}

/* ---------------------------------------------------------
   Small UI atoms
---------------------------------------------------------- */
function TapeLabel({ children, rotate = -1 }) {
  return (
    <div
      className="relative"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <div
        className="px-4 py-3 border-2"
        style={{
          background: "#ECE3D0",
          borderColor: "#141210",
          boxShadow: "3px 3px 0 #141210",
        }}
      >
        {children}
      </div>
      <div
        className="absolute -top-1.5 -left-1.5 w-3 h-3 rotate-45"
        style={{ background: "#C6342A" }}
      />
      <div
        className="absolute -top-1.5 -right-1.5 w-3 h-3 rotate-45"
        style={{ background: "#C6342A" }}
      />
    </div>
  );
}

function StatusPill({ status }) {
  const s = STATUS[status] || STATUS.enviado;
  const Icon = s.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono uppercase tracking-wide"
      style={{ background: "#141210", color: s.color, border: `1px solid ${s.color}` }}
    >
      <Icon size={12} />
      {s.label}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-4">
      <span className="block mb-1.5 text-xs font-mono uppercase tracking-widest" style={{ color: "#8a8378" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle = {
  background: "#1D1A16",
  border: "1px solid #3A342C",
  color: "#ECE3D0",
};

function PrimaryButton({ children, onClick, disabled, type = "button", full }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 px-5 py-3 font-bold uppercase tracking-wide text-sm transition-transform ${full ? "w-full" : ""} ${disabled ? "opacity-40 cursor-not-allowed" : "hover:-translate-y-0.5"}`}
      style={{ background: "#C6342A", color: "#ECE3D0", fontFamily: "'Anton', sans-serif", letterSpacing: "0.04em" }}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-mono uppercase tracking-wide border transition-colors hover:bg-white/5 disabled:opacity-30"
      style={{ borderColor: "#3A342C", color: "#ECE3D0" }}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------
   App
---------------------------------------------------------- */
export default function App() {
  const [role, setRole] = useState("cliente");
  const [session, setSession] = useState(null); // {name, email}
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [producerAuthed, setProducerAuthed] = useState(false);
  const [producerSettings, setProducerSettings] = useState({ whatsapp: "", pix: "", password: "", aboutText: "", photos: [], audioExamples: [] });
  const [view, setView] = useState("lista"); // lista | novo | detalhe | config
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [preLoginView, setPreLoginView] = useState("apresentacao"); // apresentacao | login (antes do cliente logar)

  const loadOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("data")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setOrders((data || []).map((row) => row.data));
    } catch (e) {
      console.error("Erro ao carregar pedidos:", e.message);
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = localStorage.getItem("inspirarte_session");
        if (raw) setSession(JSON.parse(raw));
      } catch {}
      try {
        const { data } = await supabase
          .from("producer_settings")
          .select("data")
          .eq("id", 1)
          .maybeSingle();
        if (data?.data) setProducerSettings(data.data);
      } catch (e) {
        console.error("Erro ao carregar configurações:", e.message);
      }
      await loadOrders();
      setLoading(false);
    })();
  }, [loadOrders]);

  const saveOrder = async (order) => {
    const { error } = await supabase.from("orders").upsert({ id: order.id, data: order });
    if (error) console.error("Erro ao salvar pedido:", error.message);
    await loadOrders();
  };

  const deleteOrder = async (id) => {
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) console.error("Erro ao apagar pedido:", error.message);
    if (activeOrderId === id) {
      setActiveOrderId(null);
      setView("lista");
    }
    await loadOrders();
  };

  const doLogin = (name, email) => {
    const s = { name, email };
    setSession(s);
    localStorage.setItem("inspirarte_session", JSON.stringify(s));
  };

  const doLogout = () => {
    setSession(null);
    setView("lista");
    localStorage.removeItem("inspirarte_session");
  };

  const saveProducerSettings = async (next) => {
    setProducerSettings(next);
    const { error } = await supabase.from("producer_settings").upsert({ id: 1, data: next });
    if (error) console.error("Erro ao salvar configurações do produtor:", error.message);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#141210", color: "#ECE3D0" }}>
        <div className="animate-pulse font-mono text-sm tracking-widest">CARREGANDO SESSÃO…</div>
      </div>
    );
  }

  const clientOrders = orders.filter((o) => o.clientEmail === session?.email);
  const activeOrder = orders.find((o) => o.id === activeOrderId) || null;

  return (
    <div className="min-h-screen" style={{ background: "#141210", color: "#ECE3D0", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
        .font-display { font-family: 'Anton', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        input, textarea, select { font-family: 'Inter', sans-serif; }
        input:focus, textarea:focus, select:focus { outline: 2px solid #C6342A; outline-offset: 1px; }
        ::selection { background: #C6342A; color: #ECE3D0; }
      `}</style>

      {/* Header */}
      <header className="border-b" style={{ borderColor: "#3A342C" }}>
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LOGO_SRC} alt="InspirArte" className="h-12 w-12 object-contain" />
            <div>
              <div className="font-display text-xl leading-none tracking-wide">INSPIR<span style={{ color: "#C6342A" }}>ARTE</span></div>
              <div className="font-mono text-[10px] tracking-[0.25em]" style={{ color: "#8a8378" }}>APRENDA · CRIE · GRAVE</div>
            </div>
          </div>
          <nav className="flex items-center gap-1 p-1" style={{ background: "#1D1A16", border: "1px solid #3A342C" }}>
            {["cliente", "produtor"].map((r) => (
              <button
                key={r}
                onClick={() => { setRole(r); setView("lista"); }}
                className="px-4 py-2 text-xs font-mono uppercase tracking-widest transition-colors"
                style={{
                  background: role === r ? "#C6342A" : "transparent",
                  color: role === r ? "#ECE3D0" : "#8a8378",
                }}
              >
                {r}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-8">
        {role === "cliente" ? (
          !session ? (
            preLoginView === "apresentacao" ? (
              <StudioAbout settings={producerSettings} onEnter={() => setPreLoginView("login")} />
            ) : (
              <ClientLogin onLogin={doLogin} onBack={() => setPreLoginView("apresentacao")} />
            )
          ) : view === "novo" ? (
            <NewOrderWizard
              session={session}
              onCancel={() => setView("lista")}
              onSubmit={async (order) => {
                await saveOrder(order);
                setView("lista");
              }}
            />
          ) : view === "detalhe" && activeOrder ? (
            <ClientOrderDetail
              order={activeOrder}
              producerSettings={producerSettings}
              onBack={() => setView("lista")}
              onUpdate={saveOrder}
              onDelete={deleteOrder}
            />
          ) : (
            <ClientOrderList
              session={session}
              orders={clientOrders}
              onNew={() => setView("novo")}
              onOpen={(id) => { setActiveOrderId(id); setView("detalhe"); }}
              onDelete={deleteOrder}
              onLogout={doLogout}
            />
          )
        ) : !producerAuthed ? (
          <ProducerLogin
            hasPassword={!!producerSettings.password}
            onAuth={async (pwd) => {
              if (!producerSettings.password) {
                await saveProducerSettings({ ...producerSettings, password: pwd });
                setProducerAuthed(true);
              } else if (pwd === producerSettings.password) {
                setProducerAuthed(true);
              } else {
                return false;
              }
              return true;
            }}
          />
        ) : view === "detalhe" && activeOrder ? (
          <ProducerOrderDetail
            order={activeOrder}
            onBack={() => setView("lista")}
            onUpdate={saveOrder}
            onDelete={deleteOrder}
          />
        ) : view === "config" ? (
          <ProducerSettingsView
            settings={producerSettings}
            onSave={saveProducerSettings}
            onBack={() => setView("lista")}
          />
        ) : (
          <ProducerDashboard
            orders={orders}
            onOpen={(id) => { setActiveOrderId(id); setView("detalhe"); }}
            onDelete={deleteOrder}
            onConfig={() => setView("config")}
            onLogout={() => setProducerAuthed(false)}
          />
        )}
      </main>
    </div>
  );
}

/* ---------------------------------------------------------
   Client: apresentação do estúdio (antes do login)
---------------------------------------------------------- */
function StudioAbout({ settings, onEnter }) {
  const photos = settings.photos || [];
  const audioExamples = settings.audioExamples || [];
  const hasContent = !!settings.aboutText || photos.length > 0 || audioExamples.length > 0;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8 text-center">
        <img src={LOGO_SRC} alt="InspirArte" className="h-20 w-20 object-contain mx-auto mb-4" />
        <h1 className="font-display text-3xl tracking-wide">CONHEÇA O <span style={{ color: "#C6342A" }}>ESTÚDIO</span></h1>
        <p className="mt-2 text-sm" style={{ color: "#8a8378" }}>Antes de enviar sua música, dá uma olhada em quem vai produzi-la.</p>
      </div>

      {settings.aboutText && (
        <div className="p-6 mb-6" style={{ background: "#1D1A16", border: "1px solid #3A342C" }}>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{settings.aboutText}</p>
        </div>
      )}

      {photos.length > 0 && (
        <div className="mb-6">
          <div className="font-mono text-xs uppercase tracking-widest mb-3" style={{ color: "#8a8378" }}>Fotos do estúdio</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map((src, i) => (
              <img key={i} src={src} alt={`Foto do estúdio ${i + 1}`} className="w-full h-28 object-cover border" style={{ borderColor: "#3A342C" }} />
            ))}
          </div>
        </div>
      )}

      {audioExamples.length > 0 && (
        <div className="mb-8">
          <div className="font-mono text-xs uppercase tracking-widest mb-3" style={{ color: "#8a8378" }}>Exemplos de produções</div>
          <div className="space-y-3">
            {audioExamples.map((ex, i) => (
              <div key={i} className="p-4" style={{ background: "#1D1A16", border: "1px solid #3A342C" }}>
                <div className="text-sm font-medium mb-2">{ex.title || `Exemplo ${i + 1}`}</div>
                <audio controls src={ex.audio} className="w-full" />
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasContent && (
        <div className="py-10 text-center border mb-6" style={{ borderColor: "#3A342C" }}>
          <Music2 className="mx-auto mb-3" size={28} style={{ color: "#3A342C" }} />
          <p className="font-mono text-sm" style={{ color: "#8a8378" }}>Em breve, mais sobre o estúdio por aqui.</p>
        </div>
      )}

      <PrimaryButton onClick={onEnter} full>Entrar e enviar minha música <ChevronRight size={16} /></PrimaryButton>
    </div>
  );
}

/* ---------------------------------------------------------
   Client: login
---------------------------------------------------------- */
function ClientLogin({ onLogin, onBack }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  return (
    <div className="max-w-md mx-auto mt-8">
      {onBack && (
        <button onClick={onBack} className="mb-6 font-mono text-xs flex items-center gap-1.5" style={{ color: "#8a8378" }}>
          <ArrowLeft size={14} /> conhecer o estúdio
        </button>
      )}
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl tracking-wide">SUA MÚSICA, <span style={{ color: "#C6342A" }}>PRODUZIDA</span></h1>
        <p className="mt-2 text-sm" style={{ color: "#8a8378" }}>Entre com seu nome e e-mail para enviar sua letra e começar uma produção.</p>
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); if (name.trim() && email.trim()) onLogin(name.trim(), email.trim().toLowerCase()); }}
        className="p-6"
        style={{ background: "#1D1A16", border: "1px solid #3A342C" }}
      >
        <Field label="Seu nome">
          <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-3 py-2.5" style={inputStyle} placeholder="Ex: Mariana Souza" />
        </Field>
        <Field label="Seu e-mail">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-3 py-2.5" style={inputStyle} placeholder="voce@email.com" />
        </Field>
        <PrimaryButton type="submit" full>Entrar <ChevronRight size={16} /></PrimaryButton>
      </form>
    </div>
  );
}

/* ---------------------------------------------------------
   Client: order list
---------------------------------------------------------- */
function ClientOrderList({ session, orders, onNew, onOpen, onDelete, onLogout }) {
  const handleDelete = (e, o) => {
    e.stopPropagation();
    if (window.confirm(`Apagar "${o.title || "essa produção"}"? Essa ação não pode ser desfeita.`)) {
      onDelete(o.id);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="font-mono text-xs tracking-widest" style={{ color: "#8a8378" }}>SESSÃO DE</div>
          <h1 className="font-display text-2xl">{session.name.toUpperCase()}</h1>
        </div>
        <button onClick={onLogout} className="font-mono text-xs flex items-center gap-1.5" style={{ color: "#8a8378" }}>
          <LogOut size={14} /> sair
        </button>
      </div>

      <div className="mb-6">
        <PrimaryButton onClick={onNew}><Plus size={16} /> Nova produção</PrimaryButton>
      </div>

      {orders.length === 0 ? (
        <div className="py-16 text-center border" style={{ borderColor: "#3A342C" }}>
          <Music2 className="mx-auto mb-3" size={28} style={{ color: "#3A342C" }} />
          <p className="font-mono text-sm" style={{ color: "#8a8378" }}>Nenhuma produção enviada ainda.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-6">
          {orders.map((o, i) => (
            <div key={o.id} onClick={() => onOpen(o.id)} className="text-left cursor-pointer relative">
              <button
                onClick={(e) => handleDelete(e, o)}
                title="Apagar esta produção"
                className="absolute -top-2 -right-2 z-10 w-7 h-7 flex items-center justify-center rounded-full"
                style={{ background: "#8F2019", color: "#ECE3D0", boxShadow: "2px 2px 0 #141210" }}
              >
                <Trash2 size={14} />
              </button>
              <TapeLabel rotate={i % 2 === 0 ? -1 : 1}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] tracking-widest" style={{ color: "#8a8378" }}>FAIXA #{o.id.slice(-4).toUpperCase()}</span>
                  <StatusPill status={o.status} />
                </div>
                <div className="font-display text-lg" style={{ color: "#141210" }}>{o.title || "Sem título"}</div>
                <div className="text-xs mt-1" style={{ color: "#5c564b" }}>{o.genre} · {o.instruments.join(", ")}</div>
              </TapeLabel>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Client: new order wizard
---------------------------------------------------------- */
function NewOrderWizard({ session, onCancel, onSubmit }) {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [genre, setGenre] = useState(GENRES[0]);
  const [instruments, setInstruments] = useState([]);
  const rec = useRecorder();
  const met = useMetronome();
  const [submitting, setSubmitting] = useState(false);

  const steps = ["Letra", "Estilo", "Instrumentos", "Gravação", "Revisão"];

  const toggleInstrument = (id) => {
    setInstruments((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const canNext = [lyrics.trim().length > 0, !!genre, instruments.length > 0, !!rec.audioBase64, true][step];

  const handleSubmit = async () => {
    setSubmitting(true);
    const order = {
      id: uid(),
      clientEmail: session.email,
      clientName: session.name,
      title: title.trim() || "Sem título",
      lyrics,
      genre,
      instruments,
      bpm: met.bpm,
      refAudio: rec.audioBase64,
      status: "enviado",
      previewAudio: null,
      previewUnlocked: false,
      paymentProof: null,
      paymentConfirmed: false,
      finalAudio: null,
      createdAt: Date.now(),
    };
    await onSubmit(order);
    setSubmitting(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={onCancel} className="mb-6 font-mono text-xs flex items-center gap-1.5" style={{ color: "#8a8378" }}>
        <ArrowLeft size={14} /> cancelar
      </button>

      <div className="flex items-center gap-2 mb-8 flex-wrap">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="w-7 h-7 flex items-center justify-center font-mono text-xs border"
              style={{
                borderColor: i <= step ? "#C6342A" : "#3A342C",
                background: i === step ? "#C6342A" : "transparent",
                color: i === step ? "#ECE3D0" : i < step ? "#C6342A" : "#8a8378",
              }}
            >
              {i < step ? "✓" : i + 1}
            </div>
            <span className="font-mono text-xs uppercase tracking-wide hidden sm:inline" style={{ color: i === step ? "#ECE3D0" : "#8a8378" }}>{s}</span>
            {i < steps.length - 1 && <div className="w-4 h-px" style={{ background: "#3A342C" }} />}
          </div>
        ))}
      </div>

      <div className="p-6" style={{ background: "#1D1A16", border: "1px solid #3A342C" }}>
        {step === 0 && (
          <div>
            <Field label="Título da música (opcional)">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2.5" style={inputStyle} placeholder="Ex: Recomeço" />
            </Field>
            <Field label="Letra da música">
              <textarea value={lyrics} onChange={(e) => setLyrics(e.target.value)} rows={10} required className="w-full px-3 py-2.5" style={inputStyle} placeholder="Cole ou escreva a letra completa aqui…" />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div>
            <Field label="Estilo musical">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {GENRES.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGenre(g)}
                    className="px-3 py-2.5 text-sm font-medium border text-left"
                    style={{ borderColor: genre === g ? "#C6342A" : "#3A342C", background: genre === g ? "#C6342A" : "transparent", color: "#ECE3D0" }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        )}

        {step === 2 && (
          <div>
            <Field label="Instrumentos desejados">
              <div className="grid grid-cols-2 gap-2">
                {INSTRUMENTS.map((inst) => (
                  <button
                    key={inst.id}
                    onClick={() => toggleInstrument(inst.id)}
                    className="px-3 py-3 text-sm font-medium border flex items-center gap-2"
                    style={{ borderColor: instruments.includes(inst.id) ? "#C6342A" : "#3A342C", background: instruments.includes(inst.id) ? "#C6342A" : "transparent", color: "#ECE3D0" }}
                  >
                    {instruments.includes(inst.id) ? <CheckCircle2 size={16} /> : <div className="w-4 h-4 border" style={{ borderColor: "#8a8378" }} />}
                    {inst.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        )}

        {step === 3 && (
          <div>
            <Field label={`Metrônomo — ${met.bpm} BPM`}>
              <div className="flex items-center gap-4">
                <input type="range" min={50} max={180} value={met.bpm} onChange={(e) => met.setBpm(Number(e.target.value))} className="flex-1" />
                <button
                  onClick={() => met.setPlaying((p) => !p)}
                  className="w-11 h-11 flex items-center justify-center border shrink-0"
                  style={{ borderColor: "#C6342A", background: met.playing ? "#C6342A" : "transparent" }}
                >
                  {met.playing ? <Pause size={18} /> : <Play size={18} />}
                </button>
              </div>
              <div className="flex gap-1.5 mt-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-1.5 flex-1" style={{ background: met.playing && met.beat === i ? "#C6342A" : "#3A342C" }} />
                ))}
              </div>
            </Field>

            <div className="mt-6 p-4 text-center border" style={{ borderColor: "#3A342C" }}>
              {!rec.audioUrl ? (
                <>
                  <button
                    onClick={rec.recording ? rec.stop : rec.start}
                    className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                    style={{ background: rec.recording ? "#8F2019" : "#C6342A" }}
                  >
                    {rec.recording ? <Square size={22} /> : <Mic size={24} />}
                  </button>
                  <div className="mt-3 font-mono text-sm">{rec.recording ? `Gravando… ${rec.seconds}s` : "Toque para gravar seu vocal"}</div>
                  {rec.error && <div className="mt-2 text-xs" style={{ color: "#C6342A" }}>{rec.error}</div>}
                  <div className="mt-1 text-xs" style={{ color: "#8a8378" }}>Grave com o metrônomo ligado para cantar no tempo certo.</div>
                </>
              ) : (
                <div>
                  <audio controls src={rec.audioUrl} className="w-full mb-3" />
                  <GhostButton onClick={rec.reset}><Mic size={14} /> Regravar</GhostButton>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="font-mono text-xs uppercase tracking-widest" style={{ color: "#8a8378" }}>Confira antes de enviar</div>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div><span style={{ color: "#8a8378" }}>Título:</span> {title || "Sem título"}</div>
              <div><span style={{ color: "#8a8378" }}>Estilo:</span> {genre}</div>
              <div><span style={{ color: "#8a8378" }}>Instrumentos:</span> {instruments.map((i) => INSTRUMENTS.find((x) => x.id === i)?.label).join(", ")}</div>
              <div><span style={{ color: "#8a8378" }}>BPM:</span> {met.bpm}</div>
            </div>
            <div>
              <div className="font-mono text-xs uppercase tracking-widest mb-1" style={{ color: "#8a8378" }}>Letra</div>
              <div className="p-3 text-sm whitespace-pre-wrap max-h-40 overflow-auto" style={{ background: "#141210", border: "1px solid #3A342C" }}>{lyrics}</div>
            </div>
            <audio controls src={rec.audioUrl} className="w-full" />
          </div>
        )}

        <div className="flex justify-between mt-8">
          <GhostButton disabled={step === 0} onClick={() => setStep((s) => s - 1)}><ArrowLeft size={14} /> Voltar</GhostButton>
          {step < steps.length - 1 ? (
            <PrimaryButton disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Próximo <ChevronRight size={16} /></PrimaryButton>
          ) : (
            <PrimaryButton disabled={submitting} onClick={handleSubmit}><Send size={16} /> {submitting ? "Enviando…" : "Enviar produção"}</PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Client: order detail
---------------------------------------------------------- */
function ClientOrderDetail({ order, producerSettings, onBack, onUpdate, onDelete }) {
  const [proofText, setProofText] = useState(order.paymentProof || "");
  const [showPay, setShowPay] = useState(false);

  const sendProof = async () => {
    await onUpdate({ ...order, paymentProof: proofText, status: "aguardando_pgto" });
  };

  const handleDelete = () => {
    if (window.confirm(`Apagar "${order.title || "essa produção"}"? Essa ação não pode ser desfeita.`)) {
      onDelete(order.id);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="font-mono text-xs flex items-center gap-1.5" style={{ color: "#8a8378" }}>
          <ArrowLeft size={14} /> voltar
        </button>
        <button onClick={handleDelete} className="font-mono text-xs flex items-center gap-1.5" style={{ color: "#C6342A" }}>
          <Trash2 size={14} /> enviei errado, apagar
        </button>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl">{order.title}</h1>
        <StatusPill status={order.status} />
      </div>

      <div className="p-5 mb-6" style={{ background: "#1D1A16", border: "1px solid #3A342C" }}>
        <div className="grid sm:grid-cols-2 gap-3 text-sm mb-4">
          <div><span style={{ color: "#8a8378" }}>Estilo:</span> {order.genre}</div>
          <div><span style={{ color: "#8a8378" }}>Instrumentos:</span> {order.instruments.map((i) => INSTRUMENTS.find((x) => x.id === i)?.label).join(", ")}</div>
        </div>
        <div className="font-mono text-xs uppercase tracking-widest mb-1" style={{ color: "#8a8378" }}>Seu áudio de referência</div>
        {order.refAudio && <audio controls src={order.refAudio} className="w-full" />}
      </div>

      {order.status === "enviado" || order.status === "producao" ? (
        <div className="p-6 text-center border" style={{ borderColor: "#3A342C" }}>
          <Radio className="mx-auto mb-3" size={24} style={{ color: "#E3A23D" }} />
          <p className="font-mono text-sm">Sua música está na fila de produção.</p>
          <p className="text-xs mt-1" style={{ color: "#8a8378" }}>Você será avisado assim que a prévia estiver disponível.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {order.previewUnlocked && order.previewAudio && (
            <div className="p-5" style={{ background: "#1D1A16", border: "1px solid #4E9463" }}>
              <div className="font-mono text-xs uppercase tracking-widest mb-2" style={{ color: "#4E9463" }}>Prévia disponível</div>
              <audio controls src={order.previewAudio} className="w-full mb-4" />
              {!order.paymentConfirmed && (
                <PrimaryButton onClick={() => setShowPay((s) => !s)}>
                  <Sparkles size={16} /> Gostei! Quero liberar a música
                </PrimaryButton>
              )}
            </div>
          )}

          {showPay && !order.paymentConfirmed && (
            <div className="p-5" style={{ background: "#1D1A16", border: "1px solid #3A342C" }}>
              <div className="font-mono text-xs uppercase tracking-widest mb-3" style={{ color: "#8a8378" }}>Dados para pagamento</div>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex items-center gap-2"><MessageCircle size={14} style={{ color: "#4E9463" }} /> WhatsApp: {producerSettings.whatsapp || "não configurado"}</div>
                <div className="flex items-center gap-2"><KeyRound size={14} style={{ color: "#C6342A" }} /> Chave Pix: {producerSettings.pix || "não configurada"}</div>
              </div>
              <Field label="Após pagar, cole aqui o comprovante (texto, link ou ID da transação)">
                <textarea value={proofText} onChange={(e) => setProofText(e.target.value)} rows={3} className="w-full px-3 py-2.5" style={inputStyle} placeholder="Ex: Comprovante Pix às 14:32, valor R$150,00…" />
              </Field>
              <PrimaryButton onClick={sendProof} disabled={!proofText.trim()}><Send size={16} /> Enviar comprovante</PrimaryButton>
            </div>
          )}

          {order.status === "aguardando_pgto" && !order.paymentConfirmed && (
            <div className="p-5 text-center border" style={{ borderColor: "#E3A23D" }}>
              <Clock className="mx-auto mb-2" size={20} style={{ color: "#E3A23D" }} />
              <p className="font-mono text-sm">Comprovante enviado — aguardando confirmação do produtor.</p>
            </div>
          )}

          {order.paymentConfirmed && (
            <div className="p-5 text-center" style={{ background: "#1D1A16", border: "1px solid #4E9463" }}>
              <CheckCircle2 className="mx-auto mb-2" size={22} style={{ color: "#4E9463" }} />
              <p className="font-mono text-sm mb-4">Pagamento confirmado! Sua música está liberada.</p>
              <a href={order.finalAudio} download={order.title}>
                <PrimaryButton><Download size={16} /> Baixar música final</PrimaryButton>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Producer: login
---------------------------------------------------------- */
function ProducerLogin({ hasPassword, onAuth }) {
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!hasPassword && pwd !== confirm) {
      setErr("As senhas não coincidem.");
      return;
    }
    const ok = await onAuth(pwd);
    if (!ok) setErr("Senha incorreta.");
  };

  return (
    <div className="max-w-sm mx-auto mt-8">
      <div className="mb-8 text-center">
        <User className="mx-auto mb-2" size={24} style={{ color: "#C6342A" }} />
        <h1 className="font-display text-2xl">ÁREA DO PRODUTOR</h1>
        <p className="text-sm mt-1" style={{ color: "#8a8378" }}>{hasPassword ? "Digite sua senha para continuar." : "Defina uma senha de acesso."}</p>
      </div>
      <form onSubmit={submit} className="p-6" style={{ background: "#1D1A16", border: "1px solid #3A342C" }}>
        <Field label={hasPassword ? "Senha" : "Nova senha"}>
          <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} required className="w-full px-3 py-2.5" style={inputStyle} />
        </Field>
        {!hasPassword && (
          <Field label="Confirme a senha">
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="w-full px-3 py-2.5" style={inputStyle} />
          </Field>
        )}
        {err && <div className="text-xs mb-3" style={{ color: "#C6342A" }}>{err}</div>}
        <PrimaryButton type="submit" full>Entrar</PrimaryButton>
      </form>
    </div>
  );
}

/* ---------------------------------------------------------
   Producer: dashboard
---------------------------------------------------------- */
function ProducerDashboard({ orders, onOpen, onDelete, onConfig, onLogout }) {
  const handleDelete = (e, o) => {
    e.stopPropagation();
    if (window.confirm(`Apagar o pedido "${o.title}" de ${o.clientName}? Essa ação não pode ser desfeita.`)) {
      onDelete(o.id);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="font-mono text-xs tracking-widest" style={{ color: "#8a8378" }}>PAINEL DO</div>
          <h1 className="font-display text-2xl">PRODUTOR</h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onConfig} className="font-mono text-xs flex items-center gap-1.5" style={{ color: "#8a8378" }}><Settings size={14} /> config</button>
          <button onClick={onLogout} className="font-mono text-xs flex items-center gap-1.5" style={{ color: "#8a8378" }}><LogOut size={14} /> sair</button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="py-16 text-center border" style={{ borderColor: "#3A342C" }}>
          <Music2 className="mx-auto mb-3" size={28} style={{ color: "#3A342C" }} />
          <p className="font-mono text-sm" style={{ color: "#8a8378" }}>Nenhum pedido recebido ainda.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-6">
          {orders.map((o, i) => (
            <div key={o.id} onClick={() => onOpen(o.id)} className="text-left cursor-pointer relative">
              <button
                onClick={(e) => handleDelete(e, o)}
                title="Apagar pedido"
                className="absolute -top-2 -right-2 z-10 w-7 h-7 flex items-center justify-center rounded-full"
                style={{ background: "#8F2019", color: "#ECE3D0", boxShadow: "2px 2px 0 #141210" }}
              >
                <Trash2 size={14} />
              </button>
              <TapeLabel rotate={i % 2 === 0 ? 1 : -1}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] tracking-widest" style={{ color: "#8a8378" }}>{o.clientName}</span>
                  <StatusPill status={o.status} />
                </div>
                <div className="font-display text-lg" style={{ color: "#141210" }}>{o.title}</div>
                <div className="text-xs mt-1" style={{ color: "#5c564b" }}>{o.genre} · {o.bpm} BPM</div>
              </TapeLabel>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Producer: order detail
---------------------------------------------------------- */
function ProducerOrderDetail({ order, onBack, onUpdate, onDelete }) {
  const previewInputRef = useRef(null);
  const finalInputRef = useRef(null);

  const handleDelete = () => {
    if (window.confirm(`Apagar o pedido "${order.title}" de ${order.clientName}? Essa ação não pode ser desfeita.`)) {
      onDelete(order.id);
    }
  };

  const handleFileUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await blobToBase64(file);
    const next = { ...order, [field]: b64 };
    if (field === "previewAudio") next.status = "previa";
    await onUpdate(next);
  };

  const togglePreviewLock = async () => {
    await onUpdate({ ...order, previewUnlocked: !order.previewUnlocked });
  };

  const confirmPayment = async () => {
    await onUpdate({ ...order, paymentConfirmed: true, status: "liberado" });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="font-mono text-xs flex items-center gap-1.5" style={{ color: "#8a8378" }}>
          <ArrowLeft size={14} /> voltar ao painel
        </button>
        <button onClick={handleDelete} className="font-mono text-xs flex items-center gap-1.5" style={{ color: "#C6342A" }}>
          <Trash2 size={14} /> apagar pedido
        </button>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl">{order.title}</h1>
          <div className="text-sm" style={{ color: "#8a8378" }}>{order.clientName} · {order.clientEmail}</div>
        </div>
        <StatusPill status={order.status} />
      </div>

      <div className="p-5 mb-5" style={{ background: "#1D1A16", border: "1px solid #3A342C" }}>
        <div className="grid sm:grid-cols-3 gap-3 text-sm mb-4">
          <div><span style={{ color: "#8a8378" }}>Estilo:</span> {order.genre}</div>
          <div><span style={{ color: "#8a8378" }}>BPM:</span> {order.bpm}</div>
          <div><span style={{ color: "#8a8378" }}>Instrumentos:</span> {order.instruments.map((i) => INSTRUMENTS.find((x) => x.id === i)?.label).join(", ")}</div>
        </div>
        <div className="font-mono text-xs uppercase tracking-widest mb-1" style={{ color: "#8a8378" }}>Letra</div>
        <div className="p-3 text-sm whitespace-pre-wrap max-h-48 overflow-auto mb-4" style={{ background: "#141210", border: "1px solid #3A342C" }}>{order.lyrics}</div>
        <div className="font-mono text-xs uppercase tracking-widest mb-1" style={{ color: "#8a8378" }}>Áudio de referência do cliente</div>
        {order.refAudio && <audio controls src={order.refAudio} className="w-full" />}
      </div>

      <div className="p-5 mb-5" style={{ background: "#1D1A16", border: "1px solid #3A342C" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="font-mono text-xs uppercase tracking-widest" style={{ color: "#8a8378" }}>Prévia da produção</div>
          {order.previewAudio && (
            <button onClick={togglePreviewLock} className="flex items-center gap-1.5 text-xs font-mono" style={{ color: order.previewUnlocked ? "#4E9463" : "#C6342A" }}>
              {order.previewUnlocked ? <Unlock size={14} /> : <Lock size={14} />}
              {order.previewUnlocked ? "Liberada p/ cliente" : "Bloqueada"}
            </button>
          )}
        </div>
        {order.previewAudio && <audio controls src={order.previewAudio} className="w-full mb-3" />}
        <input ref={previewInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileUpload(e, "previewAudio")} />
        <GhostButton onClick={() => previewInputRef.current?.click()}><UploadIcon size={14} /> {order.previewAudio ? "Substituir prévia" : "Enviar prévia"}</GhostButton>
      </div>

      {order.paymentProof && (
        <div className="p-5 mb-5" style={{ background: "#1D1A16", border: "1px solid #E3A23D" }}>
          <div className="font-mono text-xs uppercase tracking-widest mb-2" style={{ color: "#E3A23D" }}>Comprovante enviado pelo cliente</div>
          <div className="text-sm mb-4">{order.paymentProof}</div>
          {!order.paymentConfirmed ? (
            <PrimaryButton onClick={confirmPayment}><CheckCircle2 size={16} /> Confirmar pagamento e liberar</PrimaryButton>
          ) : (
            <div className="flex items-center gap-2 text-sm" style={{ color: "#4E9463" }}><CheckCircle2 size={16} /> Pagamento confirmado</div>
          )}
        </div>
      )}

      {order.paymentConfirmed && (
        <div className="p-5" style={{ background: "#1D1A16", border: "1px solid #3A342C" }}>
          <div className="font-mono text-xs uppercase tracking-widest mb-3" style={{ color: "#8a8378" }}>Arquivo final para download do cliente</div>
          {order.finalAudio && <audio controls src={order.finalAudio} className="w-full mb-3" />}
          <input ref={finalInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => handleFileUpload(e, "finalAudio")} />
          <GhostButton onClick={() => finalInputRef.current?.click()}><UploadIcon size={14} /> {order.finalAudio ? "Substituir arquivo final" : "Enviar arquivo final"}</GhostButton>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Producer: settings
---------------------------------------------------------- */
function ProducerSettingsView({ settings, onSave, onBack }) {
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp || "");
  const [pix, setPix] = useState(settings.pix || "");
  const [aboutText, setAboutText] = useState(settings.aboutText || "");
  const [photos, setPhotos] = useState(settings.photos || []);
  const [audioExamples, setAudioExamples] = useState(settings.audioExamples || []);
  const [newExampleTitle, setNewExampleTitle] = useState("");
  const [saved, setSaved] = useState(false);
  const photoInputRef = useRef(null);
  const audioInputRef = useRef(null);

  const save = async () => {
    await onSave({ ...settings, whatsapp, pix, aboutText, photos, audioExamples });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const b64s = await Promise.all(files.map(blobToBase64));
    setPhotos((prev) => [...prev, ...b64s]);
    e.target.value = "";
  };

  const removePhoto = (i) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== i));
  };

  const pickAudioExample = () => {
    if (!newExampleTitle.trim()) {
      window.alert("Dê um nome para o exemplo antes de escolher o áudio.");
      return;
    }
    audioInputRef.current?.click();
  };

  const addAudioExample = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await blobToBase64(file);
    setAudioExamples((prev) => [...prev, { title: newExampleTitle.trim(), audio: b64 }]);
    setNewExampleTitle("");
    e.target.value = "";
  };

  const removeAudioExample = (i) => {
    setAudioExamples((prev) => prev.filter((_, idx) => idx !== i));
  };

  return (
    <div className="max-w-md mx-auto">
      <button onClick={onBack} className="mb-6 font-mono text-xs flex items-center gap-1.5" style={{ color: "#8a8378" }}>
        <ArrowLeft size={14} /> voltar
      </button>
      <h1 className="font-display text-2xl mb-6">DADOS DE PAGAMENTO</h1>
      <div className="p-6 mb-8" style={{ background: "#1D1A16", border: "1px solid #3A342C" }}>
        <Field label="WhatsApp para contato">
          <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="w-full px-3 py-2.5" style={inputStyle} placeholder="(00) 00000-0000" />
        </Field>
        <Field label="Chave Pix">
          <input value={pix} onChange={(e) => setPix(e.target.value)} className="w-full px-3 py-2.5" style={inputStyle} placeholder="CPF, e-mail, telefone ou chave aleatória" />
        </Field>
      </div>

      <h1 className="font-display text-2xl mb-2">APRESENTAÇÃO DO ESTÚDIO</h1>
      <p className="text-xs mb-6" style={{ color: "#8a8378" }}>Isso aparece para o cliente antes de ele fazer login.</p>
      <div className="p-6 mb-8" style={{ background: "#1D1A16", border: "1px solid #3A342C" }}>
        <Field label="Texto sobre o estúdio">
          <textarea value={aboutText} onChange={(e) => setAboutText(e.target.value)} rows={5} className="w-full px-3 py-2.5" style={inputStyle} placeholder="Conte um pouco sobre você, sua experiência e o estúdio…" />
        </Field>

        <div className="mb-5">
          <span className="block mb-1.5 text-xs font-mono uppercase tracking-widest" style={{ color: "#8a8378" }}>Fotos do estúdio</span>
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {photos.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt={`Foto ${i + 1}`} className="w-full h-16 object-cover border" style={{ borderColor: "#3A342C" }} />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full"
                    style={{ background: "#8F2019", color: "#ECE3D0" }}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={addPhotos} />
          <GhostButton onClick={() => photoInputRef.current?.click()}><UploadIcon size={14} /> Adicionar fotos</GhostButton>
        </div>

        <div>
          <span className="block mb-1.5 text-xs font-mono uppercase tracking-widest" style={{ color: "#8a8378" }}>Exemplos de áudio</span>
          {audioExamples.length > 0 && (
            <div className="space-y-2 mb-3">
              {audioExamples.map((ex, i) => (
                <div key={i} className="p-3 flex items-center justify-between gap-2" style={{ background: "#141210", border: "1px solid #3A342C" }}>
                  <span className="text-sm truncate">{ex.title}</span>
                  <button onClick={() => removeAudioExample(i)} style={{ color: "#C6342A" }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input value={newExampleTitle} onChange={(e) => setNewExampleTitle(e.target.value)} className="flex-1 px-3 py-2.5 text-sm" style={inputStyle} placeholder="Nome do exemplo" />
            <GhostButton onClick={pickAudioExample}><UploadIcon size={14} /> Áudio</GhostButton>
          </div>
          <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={addAudioExample} />
        </div>
      </div>

      <PrimaryButton onClick={save} full>{saved ? <><CheckCircle2 size={16} /> Salvo!</> : "Salvar tudo"}</PrimaryButton>
    </div>
  );
}
