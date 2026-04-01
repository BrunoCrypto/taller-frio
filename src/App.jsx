import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";

const SERVICE_HS = 1000;
const SERVICE_DIAS = 365;

const ETAPAS_CRM = ["Lead", "Contactado", "Propuesta enviada", "Negociación", "Cerrado ganado", "Cerrado perdido"];
const ESTADOS_OT = ["Ingresado", "Diagnóstico", "Presupuestado", "Aprobado", "En proceso", "Listo", "Entregado"];

const ESTADO_COLORS = {
  "Ingresado": "#6B7280", "Diagnóstico": "#8B5CF6", "Presupuestado": "#F59E0B",
  "Aprobado": "#3B82F6", "En proceso": "#F97316", "Listo": "#10B981", "Entregado": "#059669",
};
const ETAPA_COLORS = {
  "Lead": "#6B7280", "Contactado": "#8B5CF6", "Propuesta enviada": "#3B82F6",
  "Negociación": "#F59E0B", "Cerrado ganado": "#10B981", "Cerrado perdido": "#EF4444",
};

const formatPesos = (n) => `$${Number(n || 0).toLocaleString("es-AR")}`;

const diasDesde = (fechaStr) => {
  if (!fechaStr) return 999;
  const d = new Date(fechaStr);
  const hoy = new Date();
  return Math.floor((hoy - d) / (1000 * 60 * 60 * 24));
};

const alertaService = (eq) => {
  const dias = diasDesde(eq.fecha_ultimo_service);
  const hsDesdeUltimo = eq.hs_motor % SERVICE_HS;
  const porHs = hsDesdeUltimo >= SERVICE_HS * 0.9;
  const porFecha = dias >= SERVICE_DIAS;
  const vencidoHs = hsDesdeUltimo < 50 && eq.hs_motor >= SERVICE_HS;
  if (porFecha || vencidoHs) return { nivel: "vencido", msg: porFecha ? `Venció por fecha (hace ${dias} días)` : `Venció por horas (${eq.hs_motor} hs)` };
  if (porHs) return { nivel: "proximo", msg: `Próximo en ${SERVICE_HS - hsDesdeUltimo} hs` };
  return null;
};

const waServiceRecordatorio = (cliente, equipo, alerta) =>
  `Hola ${cliente?.nombre?.split(" ")[0]} 👋, te recordamos que el equipo *${equipo?.marca} ${equipo?.modelo}* (patente *${equipo?.patente}*) ${alerta?.nivel === "vencido" ? "tiene el service *vencido*" : "está próximo al service preventivo"}.

📋 Hs actuales: *${equipo?.hs_motor} hs*
🗓 Último service: *${equipo?.fecha_ultimo_service}*
⚠️ ${alerta?.msg}

Te recomendamos coordinarlo a la brevedad. Taller Frío ❄️`;

const generateWhatsApp = (ot, cliente, equipo) => {
  const msgs = {
    "Ingresado": `Hola ${cliente?.nombre?.split(" ")[0]}, confirmamos recepción del *${equipo?.marca} ${equipo?.modelo}* (patente ${equipo?.patente}). Comenzamos el diagnóstico. Taller Frío ❄️`,
    "Presupuestado": `Hola ${cliente?.nombre?.split(" ")[0]}, diagnóstico del *${equipo?.marca} ${equipo?.modelo}*:\n\n📋 ${ot?.diagnostico}\n\nPresupuesto: *${formatPesos(ot?.presupuesto)}*\nRepuestos: ${ot?.repuestos}\n\n¿Aprobamos? Taller Frío ❄️`,
    "Listo": `Hola ${cliente?.nombre?.split(" ")[0]}, tu equipo *${equipo?.marca} ${equipo?.modelo}* está listo para retirar ✅\n\nPodés pasar cuando quieras. ¡Gracias! Taller Frío ❄️`,
  };
  return msgs[ot?.estado] || `Hola ${cliente?.nombre?.split(" ")[0]}, estado del *${equipo?.marca} ${equipo?.modelo}*: *${ot?.estado}*. Taller Frío ❄️`;
};

// ── Portal del Cliente ───────────────────────────────────────────────────────
function VistaCliente({ cliente, equipos, ots, onVolver }) {
  const eqs = equipos.filter(e => e.cliente_id === cliente.id);
  return (
    <div style={{ minHeight: "100vh", background: "#0D1117", color: "#E6EDF3", fontFamily: "'IBM Plex Mono',monospace" }}>
      <div style={{ background: "#161B22", borderBottom: "1px solid #21262D", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 30, height: 30, background: "linear-gradient(135deg,#00D4FF,#0088BB)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>❄</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#00D4FF" }}>TALLER FRÍO — Portal del Cliente</div>
          <div style={{ fontSize: 9, color: "#484F58" }}>Historial de equipos y trabajos</div>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={onVolver} style={{ background: "none", border: "1px solid #30363D", color: "#8B949E", padding: "5px 12px", borderRadius: 3, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>← Volver</button>
      </div>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px" }}>
        <div style={{ background: "#161B22", border: "1px solid #21262D", borderRadius: 8, padding: "18px 22px", marginBottom: 24 }}>
          <div style={{ fontSize: 9, color: "#484F58", letterSpacing: 2, marginBottom: 4 }}>CLIENTE</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{cliente.nombre}</div>
          <div style={{ fontSize: 11, color: "#8B949E", marginTop: 4 }}>{cliente.tipo} · 📞 {cliente.telefono}</div>
        </div>
        <div style={{ fontSize: 10, color: "#484F58", letterSpacing: 2, marginBottom: 14 }}>TUS EQUIPOS</div>
        {eqs.map(eq => {
          const alerta = alertaService(eq);
          const hsProx = SERVICE_HS - (eq.hs_motor % SERVICE_HS);
          const otActiva = ots.find(o => o.equipo_id === eq.id && o.estado !== "Entregado");
          const histOTs = ots.filter(o => o.equipo_id === eq.id);
          return (
            <div key={eq.id} style={{ background: "#161B22", border: `1px solid ${alerta?.nivel === "vencido" ? "#EF444433" : alerta?.nivel === "proximo" ? "#F59E0B33" : "#21262D"}`, borderRadius: 8, marginBottom: 16, overflow: "hidden" }}>
              <div style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>❄️ {eq.marca} {eq.modelo}</div>
                    <div style={{ fontSize: 11, color: "#8B949E", marginTop: 3 }}>Patente: {eq.patente} · Serie: {eq.serie}</div>
                  </div>
                  {alerta && (
                    <span style={{ background: alerta.nivel === "vencido" ? "#EF444422" : "#F59E0B22", color: alerta.nivel === "vencido" ? "#EF4444" : "#F59E0B", fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 20, border: `1px solid ${alerta.nivel === "vencido" ? "#EF444444" : "#F59E0B44"}` }}>
                      {alerta.nivel === "vencido" ? "⚠ SERVICE VENCIDO" : "⏳ SERVICE PRÓXIMO"}
                    </span>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 16 }}>
                  {[
                    { label: "Hs motor", value: `${eq.hs_motor} hs`, color: "#00D4FF" },
                    { label: "Próx. service", value: `${hsProx} hs`, color: alerta ? (alerta.nivel === "vencido" ? "#EF4444" : "#F59E0B") : "#10B981" },
                    { label: "Último service", value: eq.fecha_ultimo_service, color: "#8B5CF6" },
                  ].map(m => (
                    <div key={m.label} style={{ background: "#0D1117", borderRadius: 6, padding: "10px 12px", border: "1px solid #21262D" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: m.color }}>{m.value}</div>
                      <div style={{ fontSize: 9, color: "#484F58", letterSpacing: 1, marginTop: 3 }}>{m.label.toUpperCase()}</div>
                    </div>
                  ))}
                </div>
                {alerta && (
                  <div style={{ marginTop: 12, padding: "10px 14px", background: alerta.nivel === "vencido" ? "#EF444411" : "#F59E0B11", borderRadius: 6, fontSize: 12, color: alerta.nivel === "vencido" ? "#EF4444" : "#F59E0B" }}>
                    ⚠ {alerta.msg} — Coordiná el service con el taller a la brevedad.
                  </div>
                )}
              </div>
              {otActiva && (
                <div style={{ padding: "14px 20px", borderTop: "1px solid #21262D", background: "#0D1117" }}>
                  <div style={{ fontSize: 9, color: "#484F58", letterSpacing: 1, marginBottom: 8 }}>TRABAJO ACTUAL</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{otActiva.descripcion}</div>
                      {otActiva.diagnostico && <div style={{ fontSize: 11, color: "#8B949E", marginTop: 3 }}>📋 {otActiva.diagnostico}</div>}
                    </div>
                    <span style={{ background: `${ESTADO_COLORS[otActiva.estado]}22`, color: ESTADO_COLORS[otActiva.estado], fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 3, whiteSpace: "nowrap" }}>{otActiva.estado}</span>
                  </div>
                </div>
              )}
              {histOTs.length > 0 && (
                <div style={{ padding: "14px 20px", borderTop: "1px solid #21262D" }}>
                  <div style={{ fontSize: 9, color: "#484F58", letterSpacing: 1, marginBottom: 10 }}>HISTORIAL</div>
                  {histOTs.map(o => (
                    <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #21262D" }}>
                      <div>
                        <div style={{ fontSize: 12 }}>{o.descripcion}</div>
                        <div style={{ fontSize: 10, color: "#484F58", marginTop: 2 }}>{o.fecha}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, color: "#00D4FF", fontWeight: 700 }}>{formatPesos(o.presupuesto)}</div>
                        <span style={{ background: `${ESTADO_COLORS[o.estado]}22`, color: ESTADO_COLORS[o.estado], fontSize: 9, padding: "2px 6px", borderRadius: 3 }}>{o.estado}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div style={{ textAlign: "center", padding: 20, color: "#484F58", fontSize: 11 }}>
          ❄ Taller Frío — Refrigeración para Transporte
        </div>
      </div>
    </div>
  );
}

// ── App Principal ────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [clientes, setClientes] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [ots, setOts] = useState([]);
  const [crm, setCrm] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vistaCliente, setVistaCliente] = useState(null);
  const [whatsappMsg, setWhatsappMsg] = useState("");
  const [showWA, setShowWA] = useState(false);
  const [showNewOT, setShowNewOT] = useState(false);
  const [showNewCliente, setShowNewCliente] = useState(false);
  const [showNewEquipo, setShowNewEquipo] = useState(null);
  const [showEditEq, setShowEditEq] = useState(null);
  const [showNewCRM, setShowNewCRM] = useState(false);

  const [newOT, setNewOT] = useState({ cliente_id: "", equipo_id: "", descripcion: "", tecnico: "", presupuesto: "", repuestos: "", estado: "Ingresado" });
  const [newCliente, setNewCliente] = useState({ nombre: "", tipo: "Empresa de transporte", telefono: "", email: "" });
  const [newEquipo, setNewEquipo] = useState({ marca: "", modelo: "", serie: "", tipo: "Unidad de techo", patente: "", hs_motor: 0, fecha_ultimo_service: "" });
  const [newCRM, setNewCRM] = useState({ cliente_id: "", tipo: "Venta equipo", descripcion: "", etapa: "Lead", valor: "" });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [c, e, o, crm] = await Promise.all([
      supabase.from("clientes").select("*").order("nombre"),
      supabase.from("equipos").select("*"),
      supabase.from("ordenes_trabajo").select("*").order("created_at", { ascending: false }),
      supabase.from("crm").select("*").order("created_at", { ascending: false }),
    ]);
    setClientes(c.data || []);
    setEquipos(e.data || []);
    setOts(o.data || []);
    setCrm(crm.data || []);
    setLoading(false);
  };

  const getCliente = (id) => clientes.find(c => c.id === Number(id));
  const getEquipo = (id) => equipos.find(e => e.id === Number(id));
  const equiposDeCliente = (cid) => equipos.filter(e => e.cliente_id === Number(cid));
  const alertasActivas = equipos.filter(e => alertaService(e) !== null);

  const openWA = (msg) => { setWhatsappMsg(msg); setShowWA(true); };

  const advanceOT = async (ot) => {
    const idx = ESTADOS_OT.indexOf(ot.estado);
    if (idx >= ESTADOS_OT.length - 1) return;
    const nuevoEstado = ESTADOS_OT[idx + 1];
    await supabase.from("ordenes_trabajo").update({ estado: nuevoEstado }).eq("id", ot.id);
    setOts(prev => prev.map(o => o.id === ot.id ? { ...o, estado: nuevoEstado } : o));
  };

  const advanceCRM = async (op) => {
    const idx = ETAPAS_CRM.indexOf(op.etapa);
    if (idx >= ETAPAS_CRM.length - 1) return;
    const nuevaEtapa = ETAPAS_CRM[idx + 1];
    await supabase.from("crm").update({ etapa: nuevaEtapa }).eq("id", op.id);
    setCrm(prev => prev.map(c => c.id === op.id ? { ...c, etapa: nuevaEtapa } : c));
  };

  const submitNewCliente = async () => {
    if (!newCliente.nombre) return;
    const { data } = await supabase.from("clientes").insert([newCliente]).select();
    if (data) setClientes(prev => [...prev, data[0]]);
    setNewCliente({ nombre: "", tipo: "Empresa de transporte", telefono: "", email: "" });
    setShowNewCliente(false);
  };

  const submitNewEquipo = async () => {
    if (!newEquipo.marca || !showNewEquipo) return;
    const eq = { ...newEquipo, cliente_id: showNewEquipo, hs_motor: Number(newEquipo.hs_motor) || 0 };
    const { data } = await supabase.from("equipos").insert([eq]).select();
    if (data) setEquipos(prev => [...prev, data[0]]);
    setNewEquipo({ marca: "", modelo: "", serie: "", tipo: "Unidad de techo", patente: "", hs_motor: 0, fecha_ultimo_service: "" });
    setShowNewEquipo(null);
  };

  const submitNewOT = async () => {
    if (!newOT.cliente_id || !newOT.equipo_id || !newOT.descripcion) return;
    const ot = { ...newOT, cliente_id: Number(newOT.cliente_id), equipo_id: Number(newOT.equipo_id), presupuesto: Number(newOT.presupuesto) || 0 };
    const { data } = await supabase.from("ordenes_trabajo").insert([ot]).select();
    if (data) setOts(prev => [data[0], ...prev]);
    setNewOT({ cliente_id: "", equipo_id: "", descripcion: "", tecnico: "", presupuesto: "", repuestos: "", estado: "Ingresado" });
    setShowNewOT(false);
  };

  const submitNewCRM = async () => {
    if (!newCRM.cliente_id || !newCRM.descripcion) return;
    const op = { ...newCRM, cliente_id: Number(newCRM.cliente_id), valor: Number(newCRM.valor) || 0 };
    const { data } = await supabase.from("crm").insert([op]).select();
    if (data) setCrm(prev => [data[0], ...prev]);
    setNewCRM({ cliente_id: "", tipo: "Venta equipo", descripcion: "", etapa: "Lead", valor: "" });
    setShowNewCRM(false);
  };

  const saveEquipo = async (eq) => {
    await supabase.from("equipos").update({ hs_motor: eq.hs_motor, fecha_ultimo_service: eq.fecha_ultimo_service }).eq("id", eq.id);
    setEquipos(prev => prev.map(e => e.id === eq.id ? eq : e));
    setShowEditEq(null);
  };

  const otsPendientes = ots.filter(o => o.estado !== "Entregado").length;
  const otsListos = ots.filter(o => o.estado === "Listo").length;
  const crmAbiertos = crm.filter(c => c.etapa !== "Cerrado ganado" && c.etapa !== "Cerrado perdido");
  const valorPipeline = crmAbiertos.reduce((a, c) => a + Number(c.valor), 0);

  if (vistaCliente) return <VistaCliente cliente={vistaCliente} equipos={equipos} ots={ots} onVolver={() => setVistaCliente(null)} />;

  return (
    <div style={{ fontFamily: "'IBM Plex Mono','Courier New',monospace", minHeight: "100vh", background: "#0D1117", color: "#E6EDF3" }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap');
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0D1117}::-webkit-scrollbar-thumb{background:#00D4FF44;border-radius:2px}
        .btn-primary{background:#00D4FF;color:#0D1117;border:none;padding:8px 16px;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;border-radius:3px}
        .btn-primary:hover{background:#00BBEE}
        .btn-ghost{background:none;border:1px solid #30363D;color:#8B949E;padding:6px 12px;font-family:inherit;font-size:11px;cursor:pointer;border-radius:3px;transition:all .2s}
        .btn-ghost:hover{border-color:#00D4FF;color:#00D4FF}
        .card{background:#161B22;border:1px solid #21262D;border-radius:6px}
        .badge{display:inline-block;padding:2px 8px;border-radius:3px;font-size:10px;font-weight:600}
        input,select,textarea{background:#0D1117;border:1px solid #30363D;color:#E6EDF3;font-family:inherit;font-size:12px;padding:8px 10px;border-radius:3px;width:100%;outline:none}
        input:focus,select:focus,textarea:focus{border-color:#00D4FF}
        select option{background:#161B22}
        .overlay{position:fixed;inset:0;background:#000A;z-index:100;display:flex;align-items:center;justify-content:center;padding:20px}
        .modal{background:#161B22;border:1px solid #30363D;border-radius:8px;width:100%;max-width:520px;padding:26px;max-height:90vh;overflow-y:auto}
        .tab-btn{background:none;border:none;cursor:pointer;font-family:inherit}
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #21262D", padding: "0 24px", display: "flex", alignItems: "center", gap: 20, height: 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, background: "linear-gradient(135deg,#00D4FF,#0088BB)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>❄</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#00D4FF", letterSpacing: 1 }}>TALLER FRÍO</div>
            <div style={{ fontSize: 9, color: "#484F58", letterSpacing: 2 }}>GESTIÓN</div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {alertasActivas.length > 0 && (
          <div style={{ background: "#F59E0B22", border: "1px solid #F59E0B44", borderRadius: 4, padding: "4px 12px", fontSize: 11, color: "#F59E0B", cursor: "pointer" }} onClick={() => setTab("clientes")}>
            ⚠ {alertasActivas.length} service{alertasActivas.length > 1 ? "s" : ""} pendiente{alertasActivas.length > 1 ? "s" : ""}
          </div>
        )}
        {["dashboard", "ordenes", "clientes", "crm"].map(t => (
          <button key={t} className="tab-btn" onClick={() => setTab(t)}
            style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, padding: "6px 12px", color: tab === t ? "#00D4FF" : "#8B949E", borderBottom: tab === t ? "2px solid #00D4FF" : "2px solid transparent", textTransform: "uppercase" }}>
            {t === "dashboard" ? "Panel" : t === "ordenes" ? "OT" : t === "clientes" ? "Clientes" : "CRM"}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "#484F58", fontSize: 13 }}>
          Cargando datos... ❄️
        </div>
      ) : (
        <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>

          {/* DASHBOARD */}
          {tab === "dashboard" && (
            <div>
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 10, color: "#484F58", letterSpacing: 2, marginBottom: 4 }}>RESUMEN OPERATIVO</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>Panel Principal</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
                {[
                  { label: "OT Activas", value: otsPendientes, color: "#F97316", icon: "🔧" },
                  { label: "Listas p/ entregar", value: otsListos, color: "#10B981", icon: "✅" },
                  { label: "Alertas service", value: alertasActivas.length, color: alertasActivas.length > 0 ? "#F59E0B" : "#10B981", icon: "⚠" },
                  { label: "Pipeline CRM", value: formatPesos(valorPipeline), color: "#8B5CF6", icon: "💰" },
                ].map(m => (
                  <div key={m.label} className="card" style={{ padding: "16px 18px", borderLeft: `3px solid ${m.color}` }}>
                    <div style={{ fontSize: 18, marginBottom: 6 }}>{m.icon}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: m.color }}>{m.value}</div>
                    <div style={{ fontSize: 9, color: "#8B949E", letterSpacing: 1, marginTop: 2 }}>{m.label}</div>
                  </div>
                ))}
              </div>

              {alertasActivas.length > 0 && (
                <div className="card" style={{ marginBottom: 20, overflow: "hidden" }}>
                  <div style={{ padding: "12px 20px", borderBottom: "1px solid #21262D", background: "#F59E0B0A" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#F59E0B", letterSpacing: 1 }}>⚠ RECORDATORIOS DE SERVICE</div>
                  </div>
                  {alertasActivas.map(eq => {
                    const cliente = getCliente(eq.cliente_id);
                    const alerta = alertaService(eq);
                    return (
                      <div key={eq.id} style={{ padding: "13px 20px", borderBottom: "1px solid #21262D", display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{eq.marca} {eq.modelo} — {eq.patente}</div>
                          <div style={{ fontSize: 11, color: "#8B949E", marginTop: 2 }}>👤 {cliente?.nombre} · {alerta?.msg}</div>
                        </div>
                        <button className="btn-ghost" style={{ fontSize: 10, color: "#25D366", borderColor: "#25D36644", whiteSpace: "nowrap" }}
                          onClick={() => openWA(waServiceRecordatorio(cliente, eq, alerta))}>
                          💬 Enviar WA
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="card" style={{ overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid #21262D", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#8B949E", letterSpacing: 1 }}>ÚLTIMAS ÓRDENES</div>
                  <button className="btn-ghost" onClick={() => setTab("ordenes")}>Ver todas →</button>
                </div>
                {ots.slice(0, 5).map(ot => {
                  const cliente = getCliente(ot.cliente_id);
                  const equipo = getEquipo(ot.equipo_id);
                  return (
                    <div key={ot.id} style={{ padding: "13px 20px", borderBottom: "1px solid #21262D", display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{ot.descripcion}</div>
                        <div style={{ fontSize: 11, color: "#8B949E", marginTop: 2 }}>{cliente?.nombre} · {equipo?.marca} {equipo?.modelo}</div>
                      </div>
                      <span className="badge" style={{ background: `${ESTADO_COLORS[ot.estado]}22`, color: ESTADO_COLORS[ot.estado] }}>{ot.estado}</span>
                    </div>
                  );
                })}
                {ots.length === 0 && <div style={{ padding: "20px", textAlign: "center", color: "#484F58", fontSize: 12 }}>No hay órdenes todavía</div>}
              </div>
            </div>
          )}

          {/* ÓRDENES */}
          {tab === "ordenes" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#484F58", letterSpacing: 2, marginBottom: 4 }}>TALLER</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>Órdenes de Trabajo</div>
                </div>
                <button className="btn-primary" onClick={() => setShowNewOT(true)}>+ Nueva OT</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {ots.map(ot => {
                  const cliente = getCliente(ot.cliente_id);
                  const equipo = getEquipo(ot.equipo_id);
                  return (
                    <div key={ot.id} className="card" style={{ padding: "18px 20px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                            <span style={{ fontSize: 10, color: "#484F58", fontWeight: 700 }}>OT #{ot.id}</span>
                            <span className="badge" style={{ background: `${ESTADO_COLORS[ot.estado]}22`, color: ESTADO_COLORS[ot.estado] }}>{ot.estado}</span>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{ot.descripcion}</div>
                          <div style={{ fontSize: 11, color: "#8B949E", marginBottom: 6 }}>👤 {cliente?.nombre} · ❄ {equipo?.marca} {equipo?.modelo} ({equipo?.patente})</div>
                          {ot.diagnostico && <div style={{ fontSize: 11, color: "#8B949E", background: "#0D1117", padding: "6px 10px", borderRadius: 3, borderLeft: "2px solid #21262D", marginBottom: 4 }}>📋 {ot.diagnostico}</div>}
                          {ot.repuestos && <div style={{ fontSize: 11, color: "#8B949E" }}>🔩 {ot.repuestos}</div>}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "#00D4FF" }}>{formatPesos(ot.presupuesto)}</div>
                          <div style={{ fontSize: 10, color: "#484F58" }}>{ot.fecha} · {ot.tecnico}</div>
                          <div style={{ display: "flex", gap: 8 }}>
                            {ot.estado !== "Entregado" && <button className="btn-ghost" style={{ fontSize: 10 }} onClick={() => advanceOT(ot)}>Avanzar →</button>}
                            <button className="btn-ghost" style={{ fontSize: 10, color: "#25D366", borderColor: "#25D36644" }}
                              onClick={() => openWA(generateWhatsApp(ot, cliente, equipo))}>WA</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {ots.length === 0 && <div style={{ textAlign: "center", color: "#484F58", fontSize: 12, padding: 40 }}>No hay órdenes todavía. ¡Creá la primera!</div>}
              </div>
            </div>
          )}

          {/* CLIENTES */}
          {tab === "clientes" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#484F58", letterSpacing: 2, marginBottom: 4 }}>BASE DE DATOS</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>Clientes & Equipos</div>
                </div>
                <button className="btn-primary" onClick={() => setShowNewCliente(true)}>+ Nuevo cliente</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {clientes.map(c => {
                  const eqs = equiposDeCliente(c.id);
                  const otsCli = ots.filter(o => o.cliente_id === c.id);
                  return (
                    <div key={c.id} className="card" style={{ overflow: "hidden" }}>
                      <div style={{ padding: "16px 20px", borderBottom: "1px solid #21262D", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#00D4FF22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, border: "1px solid #00D4FF33" }}>
                              {c.tipo === "Particular" ? "👤" : c.tipo === "Empresa de transporte" ? "🚛" : "🏭"}
                            </div>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700 }}>{c.nombre}</div>
                              <div style={{ fontSize: 10, color: "#484F58" }}>{c.tipo}</div>
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: "#8B949E", marginTop: 4 }}>📞 {c.telefono} · ✉ {c.email}</div>
                        </div>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: "#00D4FF" }}>{eqs.length}</div>
                            <div style={{ fontSize: 9, color: "#484F58", letterSpacing: 1 }}>EQUIPOS</div>
                          </div>
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: "#F97316" }}>{otsCli.filter(o => o.estado !== "Entregado").length}</div>
                            <div style={{ fontSize: 9, color: "#484F58", letterSpacing: 1 }}>OT ACTIVAS</div>
                          </div>
                          <button className="btn-ghost" style={{ fontSize: 10, color: "#00D4FF", borderColor: "#00D4FF44" }} onClick={() => setVistaCliente(c)}>🔗 Portal</button>
                          <button className="btn-ghost" style={{ fontSize: 10 }} onClick={() => setShowNewEquipo(c.id)}>+ Equipo</button>
                        </div>
                      </div>
                      <div style={{ padding: "14px 20px" }}>
                        <div style={{ fontSize: 9, color: "#484F58", letterSpacing: 1, marginBottom: 10 }}>EQUIPOS</div>
                        {eqs.length === 0 && <div style={{ fontSize: 11, color: "#484F58" }}>Sin equipos registrados</div>}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {eqs.map(eq => {
                            const alerta = alertaService(eq);
                            const hsProx = SERVICE_HS - (eq.hs_motor % SERVICE_HS);
                            return (
                              <div key={eq.id} style={{ padding: "11px 14px", background: "#0D1117", borderRadius: 4, border: `1px solid ${alerta?.nivel === "vencido" ? "#EF444433" : alerta?.nivel === "proximo" ? "#F59E0B33" : "#21262D"}` }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                  <div>
                                    <div style={{ fontSize: 12, fontWeight: 600 }}>❄️ {eq.marca} {eq.modelo}</div>
                                    <div style={{ fontSize: 10, color: "#8B949E", marginTop: 2 }}>Serie: {eq.serie} · Patente: {eq.patente}</div>
                                  </div>
                                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 10, color: "#00D4FF", background: "#00D4FF11", padding: "3px 8px", borderRadius: 3 }}>🔁 {eq.hs_motor} hs</span>
                                    {alerta ? (
                                      <span style={{ background: alerta.nivel === "vencido" ? "#EF444422" : "#F59E0B22", color: alerta.nivel === "vencido" ? "#EF4444" : "#F59E0B", fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 3 }}>
                                        {alerta.nivel === "vencido" ? "⚠ VENCIDO" : `⏳ ${hsProx} hs`}
                                      </span>
                                    ) : (
                                      <span style={{ background: "#10B98122", color: "#10B981", fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 3 }}>✓ Al día</span>
                                    )}
                                    <button className="btn-ghost" style={{ fontSize: 9, padding: "3px 8px" }} onClick={() => setShowEditEq({ ...eq })}>Editar hs</button>
                                    {alerta && (
                                      <button className="btn-ghost" style={{ fontSize: 9, padding: "3px 8px", color: "#25D366", borderColor: "#25D36644" }}
                                        onClick={() => openWA(waServiceRecordatorio(c, eq, alerta))}>💬 WA</button>
                                    )}
                                  </div>
                                </div>
                                <div style={{ fontSize: 10, color: "#484F58", marginTop: 7 }}>
                                  Último service: {eq.fecha_ultimo_service} · Próximo en {hsProx} hs o {Math.max(0, SERVICE_DIAS - diasDesde(eq.fecha_ultimo_service))} días
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {clientes.length === 0 && <div style={{ textAlign: "center", color: "#484F58", fontSize: 12, padding: 40 }}>No hay clientes todavía. ¡Agregá el primero!</div>}
              </div>
            </div>
          )}

          {/* CRM */}
          {tab === "crm" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#484F58", letterSpacing: 2, marginBottom: 4 }}>VENTAS</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>CRM · Pipeline</div>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#8B5CF6" }}>{formatPesos(valorPipeline)}</div>
                    <div style={{ fontSize: 9, color: "#484F58", letterSpacing: 1 }}>EN PIPELINE</div>
                  </div>
                  <button className="btn-primary" onClick={() => setShowNewCRM(true)}>+ Nueva oportunidad</button>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {crm.map(op => {
                  const cliente = getCliente(op.cliente_id);
                  const cerrado = op.etapa === "Cerrado ganado" || op.etapa === "Cerrado perdido";
                  return (
                    <div key={op.id} className="card" style={{ padding: "18px 20px", opacity: cerrado ? 0.7 : 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                            <span style={{ background: `${ETAPA_COLORS[op.etapa]}22`, color: ETAPA_COLORS[op.etapa], fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>{op.etapa}</span>
                            <span style={{ fontSize: 10, color: "#484F58" }}>{op.tipo}</span>
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{op.descripcion}</div>
                          <div style={{ fontSize: 11, color: "#8B949E" }}>👤 {cliente?.nombre} · 📅 {op.fecha}</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "#8B5CF6" }}>{formatPesos(op.valor)}</div>
                          {!cerrado && <button className="btn-ghost" style={{ fontSize: 10 }} onClick={() => advanceCRM(op)}>Avanzar →</button>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
                        {ETAPAS_CRM.map((e, i) => {
                          const idx = ETAPAS_CRM.indexOf(op.etapa);
                          return <div key={e} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= idx ? ETAPA_COLORS[op.etapa] : "#21262D", transition: "background .3s" }} />;
                        })}
                      </div>
                    </div>
                  );
                })}
                {crm.length === 0 && <div style={{ textAlign: "center", color: "#484F58", fontSize: 12, padding: 40 }}>No hay oportunidades todavía.</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal WA */}
      {showWA && (
        <div className="overlay" onClick={() => setShowWA(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#25D366" }}>💬 Mensaje WhatsApp</div>
              <button className="btn-ghost" onClick={() => setShowWA(false)}>✕</button>
            </div>
            <textarea value={whatsappMsg} onChange={e => setWhatsappMsg(e.target.value)} rows={9} style={{ resize: "none", lineHeight: 1.7 }} />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="btn-primary" style={{ background: "#25D366", flex: 1 }}
                onClick={() => { navigator.clipboard.writeText(whatsappMsg); setShowWA(false); }}>Copiar mensaje</button>
              <button className="btn-ghost" onClick={() => setShowWA(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Cliente */}
      {showNewCliente && (
        <div className="overlay" onClick={() => setShowNewCliente(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: 18 }}><div style={{ fontSize: 14, fontWeight: 700, color: "#00D4FF" }}>+ Nuevo Cliente</div></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[["NOMBRE", "nombre", "text", "Nombre del cliente"], ["TELÉFONO", "telefono", "text", "11-0000-0000"], ["EMAIL", "email", "email", "email@ejemplo.com"]].map(([label, key, type, ph]) => (
                <div key={key}>
                  <div style={{ fontSize: 9, color: "#8B949E", marginBottom: 5, letterSpacing: 1 }}>{label}</div>
                  <input type={type} value={newCliente[key]} onChange={e => setNewCliente(p => ({ ...p, [key]: e.target.value }))} placeholder={ph} />
                </div>
              ))}
              <div>
                <div style={{ fontSize: 9, color: "#8B949E", marginBottom: 5, letterSpacing: 1 }}>TIPO</div>
                <select value={newCliente.tipo} onChange={e => setNewCliente(p => ({ ...p, tipo: e.target.value }))}>
                  <option>Empresa de transporte</option>
                  <option>Distribuidora de alimentos</option>
                  <option>Particular</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={submitNewCliente}>Guardar</button>
              <button className="btn-ghost" onClick={() => setShowNewCliente(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Equipo */}
      {showNewEquipo && (
        <div className="overlay" onClick={() => setShowNewEquipo(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: 18 }}><div style={{ fontSize: 14, fontWeight: 700, color: "#00D4FF" }}>+ Nuevo Equipo</div></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[["MARCA", "marca", "Thermo King"], ["MODELO", "modelo", "SLXi-300"], ["SERIE", "serie", "TK-0000-0000"], ["PATENTE", "patente", "AB 123 CD"]].map(([label, key, ph]) => (
                  <div key={key}>
                    <div style={{ fontSize: 9, color: "#8B949E", marginBottom: 5, letterSpacing: 1 }}>{label}</div>
                    <input value={newEquipo[key]} onChange={e => setNewEquipo(p => ({ ...p, [key]: e.target.value }))} placeholder={ph} />
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 9, color: "#8B949E", marginBottom: 5, letterSpacing: 1 }}>HS MOTOR</div>
                  <input type="number" value={newEquipo.hs_motor} onChange={e => setNewEquipo(p => ({ ...p, hs_motor: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "#8B949E", marginBottom: 5, letterSpacing: 1 }}>ÚLTIMO SERVICE</div>
                  <input type="date" value={newEquipo.fecha_ultimo_service} onChange={e => setNewEquipo(p => ({ ...p, fecha_ultimo_service: e.target.value }))} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: "#8B949E", marginBottom: 5, letterSpacing: 1 }}>TIPO</div>
                <select value={newEquipo.tipo} onChange={e => setNewEquipo(p => ({ ...p, tipo: e.target.value }))}>
                  <option>Unidad de techo</option><option>Unidad lateral</option><option>Unidad delantera</option><option>Multi-temperatura</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={submitNewEquipo}>Guardar</button>
              <button className="btn-ghost" onClick={() => setShowNewEquipo(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nueva OT */}
      {showNewOT && (
        <div className="overlay" onClick={() => setShowNewOT(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: 18 }}><div style={{ fontSize: 14, fontWeight: 700, color: "#00D4FF" }}>+ Nueva Orden de Trabajo</div></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: 9, color: "#8B949E", marginBottom: 5, letterSpacing: 1 }}>CLIENTE</div>
                <select value={newOT.cliente_id} onChange={e => setNewOT(p => ({ ...p, cliente_id: e.target.value, equipo_id: "" }))}>
                  <option value="">Seleccionar…</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              {newOT.cliente_id && (
                <div>
                  <div style={{ fontSize: 9, color: "#8B949E", marginBottom: 5, letterSpacing: 1 }}>EQUIPO</div>
                  <select value={newOT.equipo_id} onChange={e => setNewOT(p => ({ ...p, equipo_id: e.target.value }))}>
                    <option value="">Seleccionar…</option>
                    {equiposDeCliente(newOT.cliente_id).map(e => <option key={e.id} value={e.id}>{e.marca} {e.modelo} ({e.patente})</option>)}
                  </select>
                </div>
              )}
              <div>
                <div style={{ fontSize: 9, color: "#8B949E", marginBottom: 5, letterSpacing: 1 }}>DESCRIPCIÓN</div>
                <input value={newOT.descripcion} onChange={e => setNewOT(p => ({ ...p, descripcion: e.target.value }))} placeholder="Ej: No enfría, revisión general..." />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 9, color: "#8B949E", marginBottom: 5, letterSpacing: 1 }}>TÉCNICO</div>
                  <input value={newOT.tecnico} onChange={e => setNewOT(p => ({ ...p, tecnico: e.target.value }))} placeholder="Nombre" />
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "#8B949E", marginBottom: 5, letterSpacing: 1 }}>PRESUPUESTO ($)</div>
                  <input type="number" value={newOT.presupuesto} onChange={e => setNewOT(p => ({ ...p, presupuesto: e.target.value }))} placeholder="0" />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: "#8B949E", marginBottom: 5, letterSpacing: 1 }}>REPUESTOS</div>
                <input value={newOT.repuestos} onChange={e => setNewOT(p => ({ ...p, repuestos: e.target.value }))} placeholder="Repuestos necesarios…" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={submitNewOT}>Crear OT</button>
              <button className="btn-ghost" onClick={() => setShowNewOT(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nueva CRM */}
      {showNewCRM && (
        <div className="overlay" onClick={() => setShowNewCRM(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: 18 }}><div style={{ fontSize: 14, fontWeight: 700, color: "#8B5CF6" }}>+ Nueva Oportunidad</div></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: 9, color: "#8B949E", marginBottom: 5, letterSpacing: 1 }}>CLIENTE</div>
                <select value={newCRM.cliente_id} onChange={e => setNewCRM(p => ({ ...p, cliente_id: e.target.value }))}>
                  <option value="">Seleccionar…</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 9, color: "#8B949E", marginBottom: 5, letterSpacing: 1 }}>DESCRIPCIÓN</div>
                <input value={newCRM.descripcion} onChange={e => setNewCRM(p => ({ ...p, descripcion: e.target.value }))} placeholder="Ej: Venta unidad Carrier nueva..." />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 9, color: "#8B949E", marginBottom: 5, letterSpacing: 1 }}>TIPO</div>
                  <select value={newCRM.tipo} onChange={e => setNewCRM(p => ({ ...p, tipo: e.target.value }))}>
                    <option>Venta equipo</option><option>Venta repuesto</option><option>Venta carrocería</option><option>Service</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "#8B949E", marginBottom: 5, letterSpacing: 1 }}>VALOR ($)</div>
                  <input type="number" value={newCRM.valor} onChange={e => setNewCRM(p => ({ ...p, valor: e.target.value }))} placeholder="0" />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={submitNewCRM}>Guardar</button>
              <button className="btn-ghost" onClick={() => setShowNewCRM(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Horas */}
      {showEditEq && (
        <div className="overlay" onClick={() => setShowEditEq(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#00D4FF" }}>Actualizar horas de motor</div>
              <div style={{ fontSize: 11, color: "#8B949E", marginTop: 4 }}>{showEditEq.marca} {showEditEq.modelo} · {showEditEq.patente}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 9, color: "#8B949E", marginBottom: 5, letterSpacing: 1 }}>HORAS MOTOR</div>
                <input type="number" value={showEditEq.hs_motor} onChange={e => setShowEditEq(p => ({ ...p, hs_motor: Number(e.target.value) }))} />
              </div>
              <div>
                <div style={{ fontSize: 9, color: "#8B949E", marginBottom: 5, letterSpacing: 1 }}>FECHA ÚLTIMO SERVICE</div>
                <input type="date" value={showEditEq.fecha_ultimo_service} onChange={e => setShowEditEq(p => ({ ...p, fecha_ultimo_service: e.target.value }))} />
              </div>
              {(() => {
                const alerta = alertaService(showEditEq);
                const hsProx = SERVICE_HS - (showEditEq.hs_motor % SERVICE_HS);
                return (
                  <div style={{ background: alerta?.nivel === "vencido" ? "#EF444411" : alerta?.nivel === "proximo" ? "#F59E0B11" : "#10B98111", border: `1px solid ${alerta?.nivel === "vencido" ? "#EF444433" : alerta?.nivel === "proximo" ? "#F59E0B33" : "#10B98133"}`, borderRadius: 6, padding: "10px 14px", fontSize: 12, color: alerta?.nivel === "vencido" ? "#EF4444" : alerta?.nivel === "proximo" ? "#F59E0B" : "#10B981" }}>
                    {alerta ? `⚠ ${alerta.msg}` : `✓ Al día — próximo service en ${hsProx} hs`}
                  </div>
                );
              })()}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={() => saveEquipo(showEditEq)}>Guardar</button>
              <button className="btn-ghost" onClick={() => setShowEditEq(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
