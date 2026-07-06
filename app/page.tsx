"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import gsap from "gsap";
import {
  Banknote,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Download,
  Home as HomeIcon,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Send,
  Settings,
  TrendingUp,
  Upload,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { Client, Loan, Payment, StoreState, SanGroup, SanClient, SanPayment } from "@/lib/types";
import {
  addPeriod,
  clientDebt,
  clientNextPayment,
  daysUntil,
  dueSoonPayments,
  emptyState,
  formatDate,
  isLate,
  loanPaidTotal,
  money,
  roundMoney,
  statusLabel,
  sum,
} from "@/lib/finance";

const storeKey = "clara-next-prestamos-v1";
const sessionKey = "clara-session-v1";
const passwordKey = "clara-admin-password-v1";

const initialState: StoreState = {
  clients: [
    {
      id: "demo-client",
      name: "Cliente ejemplo",
      phone: "59170000000",
      document: "000000",
      notes: "Puedes cambiar o borrar este ejemplo.",
      createdAt: new Date().toISOString(),
    },
  ],
  loans: [],
  payments: [],
  sans: [],
  sanClients: [],
  sanPayments: [],
};

const navItems = [
  { id: "inicio",       label: "Inicio",         icon: HomeIcon },
  { id: "clientes",     label: "Clientes",        icon: Users },
  { id: "prestamos",    label: "Préstamos",       icon: Banknote },
  { id: "pagos",        label: "Pagos",           icon: CalendarClock },
  { id: "san",          label: "SAN",             icon: Wallet },
  { id: "configuracion",label: "Configuración",   icon: Settings },
];

export default function Home() {
  const [mounted, setMounted]           = useState(false);
  const [isAuthed, setIsAuthed]         = useState(false);
  const [loginError, setLoginError]     = useState("");
  const [state, setState]               = useState<StoreState>(initialState);
  const [activeTab, setActiveTab]       = useState("inicio");
  const [clientSearch, setClientSearch] = useState("");
  const [loanSearch, setLoanSearch]     = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [sanSearch, setSanSearch]       = useState("");
  const [activeSanId, setActiveSanId]   = useState("");
  const [paymentFilter, setPaymentFilter] = useState("pending");
  const [selectedPaymentId, setSelectedPaymentId] = useState("");
  const [customInterest, setCustomInterest] = useState<string>("");
  const [customCapital, setCustomCapital] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<"interest" | "capital" | "both" | "full">("interest");
  const [reminderDays, setReminderDays] = useState("2");
  const [clientOpen, setClientOpen]     = useState(false);
  const [loanOpen, setLoanOpen]         = useState(false);
  const [sanOpen, setSanOpen]           = useState(false);
  const [sanClientOpen, setSanClientOpen] = useState(false);
  const [selectedRound, setSelectedRound] = useState(1);
  const [ready, setReady]               = useState(false);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [notifOpen, setNotifOpen]       = useState(false);
  const reminderToastRef = useRef("");
  const headingRef  = useRef<HTMLHeadingElement>(null);
  const contentRef  = useRef<HTMLDivElement>(null);
  const { toast, ToastViewport } = useToast();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    setIsAuthed(sessionStorage.getItem(sessionKey) === "ok");
    const saved = localStorage.getItem(storeKey);
    const savedState = saved ? (JSON.parse(saved) as StoreState) : null;
    if (savedState) {
      setState({
        ...savedState,
        sans: savedState.sans || [],
        sanClients: savedState.sanClients || [],
        sanPayments: savedState.sanPayments || [],
      });
    }
    fetch("/api/loans")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: StoreState | null) => {
        if (!data?.clients?.length) return;
        const localPayments = new Map((savedState?.payments || []).map((payment) => [payment.id, payment]));
        setState({
          ...data,
          sans: data.sans || [],
          sanClients: data.sanClients || [],
          sanPayments: data.sanPayments || [],
          payments: data.payments.map((payment) => {
            const local = localPayments.get(payment.id);
            return local
              ? {
                  ...payment,
                  paid: local.paid,
                  paidAt: local.paidAt,
                  paidInterest: local.paidInterest,
                  paidCapital: local.paidCapital,
                }
              : payment;
          }),
        });
      })
      .catch(() => null)
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(storeKey, JSON.stringify(state));
    fetch("/api/loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    }).catch(() => null);
  }, [ready, state]);

  useEffect(() => {
    if (!headingRef.current) return;
    gsap.fromTo(headingRef.current, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" });
  }, [activeTab, isAuthed]);

  useEffect(() => {
    if (!contentRef.current) return;
    gsap.fromTo(contentRef.current, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.38, ease: "power2.out" });
  }, [activeTab]);

  // ── Metrics ──────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const principal   = sum(state.loans.map((l) => l.principal));
    const total       = sum(state.loans.map((l) => l.total));
    const paidTotal   = sum(state.payments.filter((p) => p.paid).map((p) => (p.paidCapital || 0) + (p.paidInterest || 0)));
    const principalPaid = sum(state.loans.map((l) => Math.min(l.principal, loanPaidTotal(state.payments, l.id))));
    const overduePayments = state.payments.filter((p) => !p.paid && isLate(p.dueDate));
    const pendingPayments = state.payments.filter((p) => !p.paid);
    const pendingClientIds = new Set(
      pendingPayments
        .map((payment) => state.loans.find((loan) => loan.id === payment.loanId)?.clientId)
        .filter(Boolean),
    );
    const interestWithBreakdown = sum(state.payments.filter((p) => p.paid).map((p) => p.paidInterest || 0));
    return {
      principal,
      balance:        total - paidTotal,
      expectedProfit: total - principal,
      paidProfit:     Math.max(0, paidTotal - principalPaid),
      profit:          interestWithBreakdown > 0 ? interestWithBreakdown : Math.max(0, paidTotal - principalPaid),
      paidTotal,
      total,
      overdueBalance: sum(overduePayments.map((p) => p.amount)),
      overdueCount: overduePayments.length,
      pendingCount: pendingPayments.length,
      pendingPeople: pendingClientIds.size,
      collectionRate: total > 0 ? Math.round((paidTotal / total) * 100) : 0,
    };
  }, [state]);

  const upcomingPayments = useMemo(
    () => state.payments.filter((p) => !p.paid).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 8),
    [state.payments],
  );

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    return state.clients.filter((c) => `${c.name} ${c.phone} ${c.document}`.toLowerCase().includes(q));
  }, [clientSearch, state.clients]);

  const filteredLoans = useMemo(() => {
    const q = loanSearch.trim().toLowerCase();
    return state.loans.filter((loan) => {
      const client = state.clients.find((c) => c.id === loan.clientId);
      return `${client?.name || ""} ${client?.phone || ""} ${loan.principal} ${loan.total}`.toLowerCase().includes(q);
    });
  }, [loanSearch, state.clients, state.loans]);

  // One entry per client: next pending, or last paid if no pending
  const clientPaymentRows = useMemo(() => {
    return state.clients
      .map((client) => {
        const clientLoans = state.loans.filter((l) => l.clientId === client.id);
        const allPayments = state.payments.filter((p) => clientLoans.some((l) => l.id === p.loanId));
        const pending = allPayments.filter((p) => !p.paid).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        const paid    = allPayments.filter((p) => p.paid).sort((a, b) => (b.paidAt || "").localeCompare(a.paidAt || ""));
        const next    = pending[0] || paid[0];
        if (!next) return null;
        const loan = clientLoans.find((l) => l.id === next.loanId);
        return { client, payment: next, loan, pendingCount: pending.length, paidCount: paid.length };
      })
      .filter(Boolean)
      .filter((row) => {
        const q = paymentSearch.trim().toLowerCase();
        if (!q) return true;
        return `${row!.client.name} ${row!.client.phone} ${row!.client.document}`.toLowerCase().includes(q);
      })
      .filter((row) => {
        if (paymentFilter === "all")     return true;
        if (paymentFilter === "paid")    return row!.payment.paid;
        if (paymentFilter === "late")    return !row!.payment.paid && isLate(row!.payment.dueDate);
        return !row!.payment.paid;
      }) as { client: Client; payment: Payment; loan: Loan | undefined; pendingCount: number; paidCount: number }[];
  }, [paymentFilter, paymentSearch, state.clients, state.loans, state.payments]);

  // All overdue across all clients (for notifications)
  const overdueRows = useMemo(() => {
    return state.payments
      .filter((p) => !p.paid && isLate(p.dueDate))
      .map((p) => {
        const loan   = state.loans.find((l) => l.id === p.loanId);
        const client = state.clients.find((c) => c.id === loan?.clientId);
        return client ? { client, payment: p, loan } : null;
      })
      .filter(Boolean) as { client: Client; payment: Payment; loan: Loan | undefined }[];
  }, [state]);

  const reminderPayments = useMemo(() => dueSoonPayments(state, Number(reminderDays || 0)), [reminderDays, state]);

  // Chart data: last 6 months payments
  const chartData = useMemo(() => {
    const months: { label: string; collected: number; expected: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("es", { month: "short" });
      const collected = sum(
        state.payments.filter((p) => p.paid && p.paidAt?.startsWith(key)).map((p) => p.amount),
      );
      const expected = sum(
        state.payments.filter((p) => p.dueDate?.startsWith(key)).map((p) => p.amount),
      );
      months.push({ label, collected, expected });
    }
    return months;
  }, [state.payments]);

  const lateCount = state.payments.filter((p) => !p.paid && isLate(p.dueDate)).length;

  useEffect(() => {
    if (!ready || !isAuthed || reminderPayments.length === 0) return;
    const key = reminderPayments.map((p) => p.id).join("-");
    if (reminderToastRef.current === key) return;
    reminderToastRef.current = key;
    toast(`${reminderPayments.length} recordatorio${reminderPayments.length === 1 ? "" : "s"}`, "Hay clientes con pagos próximos.", "info");
  }, [isAuthed, ready, reminderPayments, toast]);

  // ── Handlers ─────────────────────────────────────────────────
  async function handleLogin(formData: FormData) {
    setLoginError("");
    const user = String(formData.get("user") || "");
    const password = String(formData.get("password") || "");
    const savedPassword = localStorage.getItem(passwordKey);
    if (user === "admin" && savedPassword && password === savedPassword) {
      sessionStorage.setItem(sessionKey, "ok");
      setIsAuthed(true);
      return;
    }
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, password }),
    });
    if (!response.ok) { setLoginError("Usuario o clave incorrectos."); return; }
    sessionStorage.setItem(sessionKey, "ok");
    setIsAuthed(true);
  }

  function logout() { sessionStorage.removeItem(sessionKey); setIsAuthed(false); }

  async function changePassword(formData: FormData) {
    const current = String(formData.get("currentPassword") || "");
    const next    = String(formData.get("newPassword") || "");
    const confirm = String(formData.get("confirmPassword") || "");

    if (next.length < 6) {
      toast("Clave muy corta", "Usa al menos 6 caracteres.", "error");
      return;
    }
    if (next !== confirm) {
      toast("Las claves no coinciden", "Confirma la nueva clave correctamente.", "error");
      return;
    }

    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });

    const data = await response.json() as { ok: boolean; error?: string };

    if (!response.ok || !data.ok) {
      toast("Error", data.error || "No se pudo cambiar la clave.", "error");
      return;
    }

    // También borra la copia local por si existía de antes
    localStorage.removeItem("clara-admin-password-v1");
    toast("Clave actualizada", "Desde ahora inicia sesión con la nueva clave.", "success");
  }

  function addClient(formData: FormData) {
    const name = String(formData.get("name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const document = String(formData.get("document") || "").trim();
    const notes = String(formData.get("notes") || "").trim();

    if (name.length < 2) {
      toast("Nombre incompleto", "Escribe al menos 2 caracteres para guardar el cliente.", "error");
      return;
    }
    if (phone.replace(/\D/g, "").length < 7) {
      toast("Telefono invalido", "Agrega un numero con al menos 7 digitos.", "error");
      return;
    }
    if (state.clients.some((client) => client.phone.replace(/\D/g, "") === phone.replace(/\D/g, ""))) {
      toast("Cliente duplicado", "Ya existe un cliente con ese telefono.", "error");
      return;
    }

    const client: Client = {
      id: crypto.randomUUID(),
      name,
      phone,
      document,
      notes,
      createdAt: new Date().toISOString(),
    };
    setState((c) => ({ ...c, clients: [...c.clients, client] }));
    setClientOpen(false);
    toast("Cliente guardado", "Ya puedes crearle un préstamo.", "success");
  }

  function addLoan(formData: FormData) {
    const principal    = Number(formData.get("principal") || 0);
    const interestRate = Number(formData.get("interestRate") || 0);
    const installments = 1;
    const clientId     = String(formData.get("clientId") || "");
    const total        = roundMoney(principal + principal * (interestRate / 100));
    const amount       = roundMoney(total / installments);
    const loanId       = crypto.randomUUID();
    const frequency    = String(formData.get("frequency") || "weekly") as Loan["frequency"];
    const startDate    = String(formData.get("startDate") || new Date().toISOString().slice(0, 10));

    if (!state.clients.some((client) => client.id === clientId)) {
      toast("Cliente requerido", "Selecciona un cliente valido para el prestamo.", "error");
      return;
    }
    if (!Number.isFinite(principal) || principal <= 0) {
      toast("Capital invalido", "El capital prestado debe ser mayor que cero.", "error");
      return;
    }
    if (!Number.isFinite(interestRate) || interestRate < 0 || interestRate > 1000) {
      toast("Interes invalido", "Usa un porcentaje entre 0 y 1000.", "error");
      return;
    }

    const loan: Loan = { id: loanId, clientId, principal, interestRate, total: principal, installments, frequency, startDate, createdAt: new Date().toISOString() };
    const payments: Payment[] = Array.from({ length: installments }, (_, i) => ({
      id: crypto.randomUUID(), loanId, number: i + 1,
      dueDate: addPeriod(startDate, frequency, i + 1),
      amount: roundMoney(principal * (interestRate / 100)),
      paid: false, paidAt: "",
    }));

    setState((c) => ({ ...c, loans: [...c.loans, loan], payments: [...c.payments, ...payments] }));
    setLoanOpen(false);
    toast("Préstamo creado", "Las cuotas quedaron generadas automáticamente.", "success");
  }

  function addSan(formData: FormData) {
    const name        = String(formData.get("name") || "");
    const quotaAmount = Number(formData.get("quotaAmount") || 0);
    const frequency   = String(formData.get("frequency") || "weekly") as SanGroup["frequency"];
    const startDate   = String(formData.get("startDate") || new Date().toISOString().slice(0, 10));
    const participantCount = Number(formData.get("participantCount") || 10);

    if (quotaAmount <= 0) {
      toast("Error", "La cuota debe ser mayor a 0", "error");
      return;
    }

    const newSan: SanGroup = {
      id: crypto.randomUUID(),
      name, quotaAmount, frequency, startDate, participantCount,
      status: "active", createdAt: new Date().toISOString()
    };

    setState((c) => ({ ...c, sans: [...c.sans, newSan] }));
    setSanOpen(false);
    toast("SAN creado", `Grupo "${name}" creado exitosamente.`, "success");
  }

  function addSanClient(formData: FormData) {
    const sanId = activeSanId;
    const name = String(formData.get("name") || "");
    const phone = String(formData.get("phone") || "");
    const document = String(formData.get("document") || "");
    const turnNumber = Number(formData.get("turnNumber") || 0);
    const notes = String(formData.get("notes") || "");

    const newSanClient: SanClient = {
      id: crypto.randomUUID(), sanId, name, phone, document, turnNumber, status: "active", notes
    };

    setState((c) => ({ ...c, sanClients: [...c.sanClients, newSanClient] }));
    setSanClientOpen(false);
    toast("Participante añadido", `Agregado al turno ${turnNumber}.`, "success");
  }

  function toggleSanPayment(sanClientId: string, amount: number) {
    const existing = state.sanPayments.find(p => p.sanClientId === sanClientId && p.roundNumber === selectedRound);
    if (existing) {
      setState(c => ({ ...c, sanPayments: c.sanPayments.filter(p => p.id !== existing.id) }));
    } else {
      const newPayment: SanPayment = {
        id: crypto.randomUUID(), sanId: activeSanId, sanClientId, roundNumber: selectedRound, amount, paidAt: new Date().toISOString()
      };
      setState(c => ({ ...c, sanPayments: [...c.sanPayments, newPayment] }));
    }
  }

  function loanBreakdown(loanId: string) {
    const loan = findLoan(loanId);
    const paidPayments = state.payments.filter((payment) => payment.loanId === loanId && payment.paid);
    const paidInterest = sum(paidPayments.map((payment) => payment.paidInterest || 0));
    const paidCapital = sum(paidPayments.map((payment) => payment.paidCapital || 0));
    return {
      paidInterest,
      paidCapital,
      remainingInterest: Math.max(0, (loan ? loan.total - loan.principal : 0) - paidInterest),
      remainingCapital: Math.max(0, (loan?.principal || 0) - paidCapital),
    };
  }

  function openPaymentDialog(id: string) {
    const payment = state.payments.find((p) => p.id === id);
    if (payment) {
      setPaymentMode("interest");
      setCustomInterest(String(payment.amount));
      setCustomCapital("0");
    }
    setSelectedPaymentId(id);
  }

  function confirmPayment() {
    const payment = state.payments.find((p) => p.id === selectedPaymentId);
    if (!payment) return;
    const loan = state.loans.find((l) => l.id === payment.loanId);
    if (!loan) return;

    const breakdown = loanBreakdown(loan.id);
    let paidInterest = 0;
    let paidCapital = 0;

    if (paymentMode === "interest") {
      paidInterest = payment.amount;
    } else if (paymentMode === "full") {
      paidInterest = payment.amount;
      paidCapital = breakdown.remainingCapital;
    } else if (paymentMode === "capital") {
      paidCapital = Number(customCapital) || 0;
    } else {
      paidInterest = Number(customInterest) || 0;
      paidCapital = Number(customCapital) || 0;
    }

    const remainingCapitalAfterPayment = Math.max(0, breakdown.remainingCapital - paidCapital);

    let newPayments = state.payments.map((p) =>
      p.id === selectedPaymentId
        ? { ...p, paid: true, paidAt: new Date().toISOString(), paidMode: paymentMode, paidInterest, paidCapital }
        : p
    );

    if (remainingCapitalAfterPayment > 0) {
      let ratePerPeriod = loan.interestRate;
      if (loan.frequency === "weekly") ratePerPeriod = loan.interestRate / 4;
      else if (loan.frequency === "biweekly") ratePerPeriod = loan.interestRate / 2;

      const nextInterestAmount = roundMoney(remainingCapitalAfterPayment * (ratePerPeriod / 100));
      
      const nextPayment: Payment = {
        id: crypto.randomUUID(),
        loanId: loan.id,
        number: payment.number + 1,
        dueDate: addPeriod(payment.dueDate, loan.frequency, 1),
        amount: nextInterestAmount,
        paid: false,
        paidAt: "",
      };
      newPayments.push(nextPayment);
    }

    setState((c) => ({ ...c, payments: newPayments }));
    setSelectedPaymentId("");
    toast("Pago registrado", `Réditos: ${money(paidInterest)} · Capital: ${money(paidCapital)}.`, "success");
  }

  function unmarkPayment(id: string) {
    setState((c) => ({
      ...c,
      payments: c.payments.map((p) =>
        p.id === id
          ? { ...p, paid: false, paidAt: "", paidMode: undefined, paidInterest: undefined, paidCapital: undefined }
          : p,
      ),
    }));
  }

  function deleteLoan(id: string) {
    setState((c) => ({ ...c, loans: c.loans.filter((l) => l.id !== id), payments: c.payments.filter((p) => p.loanId !== id) }));
    toast("Préstamo eliminado", "El préstamo y sus cuotas fueron removidos.", "success");
  }

  function deleteClient(id: string) {
    if (state.loans.some((l) => l.clientId === id)) { toast("No se puede borrar", "Este cliente tiene préstamos registrados.", "error"); return; }
    setState((c) => ({ ...c, clients: c.clients.filter((cl) => cl.id !== id) }));
    toast("Cliente eliminado", "El cliente fue removido correctamente.", "success");
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `clara-prestamos-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
    toast("Datos exportados", "El archivo fue descargado correctamente.", "success");
  }

  function exportPaymentsCsv() {
    const rows = [
      ["Cliente", "Telefono", "Prestamo", "Cuota", "Vence", "Monto", "Reditos", "Capital", "Tipo", "Estado", "Pagado el"],
      ...state.payments
        .slice()
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .map((payment) => {
          const loan = findLoan(payment.loanId);
          const client = findClient(loan?.clientId);
          return [
            client?.name || "Sin cliente",
            client?.phone || "",
            loan ? money(loan.total) : "",
            String(payment.number),
            payment.dueDate,
            String(payment.amount),
            String(payment.paidInterest || 0),
            String(payment.paidCapital || 0),
            payment.paidMode === "interest" ? "Reditos" : payment.paidMode === "capital" ? "Capital" : payment.paidMode === "both" ? "Ambos" : "",
            payment.paid ? "Pagado" : isLate(payment.dueDate) ? "Atrasado" : "Pendiente",
            payment.paidAt ? payment.paidAt.slice(0, 10) : "",
          ];
        }),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clara-pagos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Pagos exportados", "El CSV quedo listo para abrir en Excel.", "success");
  }

  async function importData(file: File | null) {
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text()) as StoreState;
      if (!Array.isArray(imported.clients) || !Array.isArray(imported.loans) || !Array.isArray(imported.payments)) {
        toast("Archivo inválido", "Selecciona un respaldo exportado por esta app.", "error"); return;
      }
      const clientIds = new Set(imported.clients.map((client) => client.id));
      const loanIds = new Set(imported.loans.map((loan) => loan.id));
      if (
        imported.loans.some((loan) => !clientIds.has(loan.clientId)) ||
        imported.payments.some((payment) => !loanIds.has(payment.loanId))
      ) {
        toast("Respaldo inconsistente", "Hay prestamos o pagos que no coinciden con sus clientes.", "error");
        return;
      }
      setState(imported);
      toast("Datos importados", "El sistema fue actualizado con tu respaldo.", "success");
    } catch { toast("Error al importar", "El archivo no pudo ser leído.", "error"); }
  }

  function findClient(clientId?: string) { return state.clients.find((c) => c.id === clientId); }
  function findLoan(loanId?: string)     { return state.loans.find((l) => l.id === loanId); }

  function reminderText(client: Client) {
    const debt = clientDebt(state, client.id);
    const next = clientNextPayment(state, client.id);
    return next
      ? `Hola ${client.name}, le recordamos que su saldo pendiente es ${money(debt)}. Su próximo pago vence el ${formatDate(next.dueDate)} por ${money(next.amount)}. Gracias.`
      : `Hola ${client.name}, no tiene pagos pendientes registrados. Gracias.`;
  }

  function reminderLink(client: Client) {
    const text  = reminderText(client);
    const phone = client.phone.replace(/\D/g, "");
    return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `sms:?body=${encodeURIComponent(text)}`;
  }

  async function notifyUpcomingPayments() {
    if (reminderPayments.length === 0) { toast("Sin recordatorios", "No hay pagos dentro del rango seleccionado.", "info"); return; }
    if (!("Notification" in window))   { toast("No disponible", "Tu navegador no permite notificaciones.", "error"); return; }
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission !== "granted") { toast("Permiso pendiente", "Activa las notificaciones del navegador.", "info"); return; }
    reminderPayments.slice(0, 5).forEach((payment) => {
      const loan   = findLoan(payment.loanId);
      const client = findClient(loan?.clientId);
      if (!client) return;
      new Notification(`Pago próximo: ${client.name}`, { body: `${formatDate(payment.dueDate)} - ${money(payment.amount)}.` });
    });
    toast("Notificaciones enviadas", "Los botones de WhatsApp/SMS están listos.", "success");
  }

  function handleTabChange(tab: string) { setActiveTab(tab); setSidebarOpen(false); }

  // ── Hydration guard ──────────────────────────────────────────
  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
          <p className="text-base font-semibold text-slate-400">Cargando…</p>
        </div>
      </div>
    );
  }

  // ── Login ────────────────────────────────────────────────────
  if (!isAuthed) {
    return (
      <main className="soft-grid min-h-screen bg-slate-50">
        <div className="mx-auto grid min-h-screen w-full max-w-7xl items-center gap-12 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.section initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} className="hidden lg:block">
            <Badge className="mb-6 border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm text-blue-700 hover:bg-blue-50">
              Clara Inversiones
            </Badge>
            <h1 ref={headingRef} className="max-w-xl text-6xl font-extrabold leading-tight tracking-tight text-slate-900">
              Control claro para préstamos, clientes y ganancias.
            </h1>
            <p className="mt-6 max-w-lg text-xl text-slate-500 leading-relaxed">
              Administra cuotas, atrasos, saldos y avisos de cobro desde una experiencia limpia, rápida y responsiva.
            </p>
            <div className="mt-10 grid max-w-xl grid-cols-3 gap-4">
              {[
                { label: "Clientes", icon: Users, color: "bg-blue-50 text-blue-600 border-blue-200" },
                { label: "Pagos", icon: CalendarClock, color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
                { label: "Ganancias", icon: Wallet, color: "bg-violet-50 text-violet-600 border-violet-200" },
              ].map(({ label, icon: Icon, color }) => (
                <Card key={label} className="rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5">
                  <CardContent className="grid gap-4 p-5">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-base font-bold text-slate-700">{label}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
            <Card className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/60">
              <CardHeader className="space-y-4 p-8 pb-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 shadow-xl shadow-blue-200">
                  <LockKeyhole className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-3xl text-slate-900">Entrar al sistema</CardTitle>
                  <p className="text-base text-slate-500 mt-1">Login seguro para tu panel de préstamos.</p>
                </div>
              </CardHeader>
              <CardContent className="p-8 pt-4">
                <form action={handleLogin} className="grid gap-5">
                  <div className="grid gap-2">
                    <Label htmlFor="user" className="text-sm font-bold text-slate-700">Usuario</Label>
                    <Input id="user" name="user" defaultValue="admin" required className="h-12 rounded-xl text-base border-slate-200" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password" className="text-sm font-bold text-slate-700">Clave</Label>
                    <Input id="password" name="password" type="password" defaultValue="admin123" required className="h-12 rounded-xl text-base border-slate-200" />
                  </div>
                  {loginError && (
                    <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                      <p className="text-sm font-semibold text-red-600">{loginError}</p>
                    </div>
                  )}
                  <Button className="h-12 w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-base font-bold shadow-sm" type="submit">
                    Entrar
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.section>
        </div>
        <ToastViewport />
      </main>
    );
  }

  // ── Dashboard ────────────────────────────────────────────────
  const activeNav   = navItems.find((n) => n.id === activeTab);
  const headingMap: Record<string, string> = {
    inicio: "Panel de control",
    clientes: "Mis clientes",
    prestamos: "Préstamos",
    pagos: "Gestión de cobros",
    san: "Ahorros Colectivos (SAN)",
    configuracion: "Configuración",
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)} />
        )}
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white border-r border-slate-200 shadow-xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:shadow-none ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Brand */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-6" style={{ background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #3b82f6 100%)" }}>
          <div>
            <p className="text-5xl font-black leading-none tracking-tight text-white drop-shadow-sm">Clara</p>
            <p className="mt-1 text-base font-bold leading-tight text-blue-100 tracking-wide">Inversiones</p>
          </div>
          <button className="rounded-xl p-2 text-blue-200 hover:bg-white/20 hover:text-white transition-colors lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <p className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">Menú</p>
          {navItems.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleTabChange(id)}
                className={`group flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-[15px] font-semibold transition-all duration-200 ${active ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
              >
                <Icon className={`h-5 w-5 flex-shrink-0 ${active ? "text-white" : "text-slate-400 group-hover:text-slate-600"}`} />
                <span className="flex-1 text-left">{label}</span>
                {id === "pagos" && lateCount > 0 && (
                  <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold ${active ? "bg-white/20 text-white" : "bg-red-500 text-white"}`}>
                    {lateCount}
                  </span>
                )}
                {id === "configuracion" && reminderPayments.length > 0 && (
                  <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-extrabold ${active ? "bg-white/20 text-white" : "bg-amber-500 text-white"}`}>
                    {reminderPayments.length}
                  </span>
                )}
                {active && <ChevronRight className="h-4 w-4 text-white/60" />}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-100 p-4">
          <Button
            type="button"
            onClick={logout}
            className="h-12 w-full justify-center gap-3 rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold shadow-lg shadow-red-200 transition-all hover:shadow-red-300 hover:-translate-y-0.5"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            <span>Cerrar sesión</span>
          </Button>
        </div>
      </aside>

      {/* ── Content ── */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4 lg:px-8">
          <div className="flex items-center gap-4">
            <button type="button" className="rounded-xl p-2.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Menú">
              <Menu className="h-6 w-6" />
            </button>
            <div>
              <p className="hidden text-xs font-extrabold uppercase tracking-widest text-blue-600 lg:block">{activeNav?.label}</p>
              <h1 ref={headingRef} className="text-2xl font-extrabold text-slate-900 lg:text-3xl leading-tight">
                {headingMap[activeTab]}
              </h1>
            </div>
          </div>
          {/* Notification bell - always visible */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen((o) => !o)}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <BellRing className="h-5 w-5" />
              {overdueRows.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-extrabold text-white">
                  {overdueRows.length}
                </span>
              )}
            </button>
            {/* Dropdown */}
            <AnimatePresence>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.18 }}
                    className="absolute right-0 top-12 z-40 w-80 rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
                  >
                    <div className="border-b border-slate-100 bg-slate-50 px-5 py-4 flex items-center justify-between">
                      <div>
                        <p className="font-extrabold text-slate-900 text-sm">Clientes con atraso</p>
                        <p className="text-xs text-slate-500 mt-0.5">{overdueRows.length} pago{overdueRows.length !== 1 ? "s" : ""} vencido{overdueRows.length !== 1 ? "s" : ""}</p>
                      </div>
                      <button onClick={() => setNotifOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {overdueRows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <CheckCircle2 className="h-8 w-8 text-emerald-400 mb-2" />
                          <p className="text-sm font-bold text-slate-600">Todo al día</p>
                          <p className="text-xs text-slate-400 mt-0.5">No hay pagos vencidos.</p>
                        </div>
                      ) : overdueRows.map(({ client, payment, loan }) => (
                        <div key={payment.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-red-50 transition-colors">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 text-sm font-extrabold">
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-900 text-sm truncate">{client.name}</p>
                            <p className="text-xs text-red-600 font-semibold">{money(payment.amount)} · venció {formatDate(payment.dueDate)}</p>
                          </div>
                          <Button asChild size="sm" className="h-8 rounded-xl bg-blue-600 hover:bg-blue-700 flex-shrink-0">
                            <a href={reminderLink(client)} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5" /></a>
                          </Button>
                        </div>
                      ))}
                    </div>
                    {overdueRows.length > 0 && (
                      <div className="border-t border-slate-100 px-5 py-3">
                        <button onClick={() => { setActiveTab("pagos"); setPaymentFilter("late"); setNotifOpen(false); }}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors">
                          Ver todos los atrasados →
                        </button>
                      </div>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Header CTA */}
          <div className="flex items-center gap-3">
            {activeTab === "clientes" && (
              <Dialog open={clientOpen} onOpenChange={setClientOpen}>
                <DialogTrigger asChild>
                  <Button className="h-10 gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-bold shadow-sm px-5">
                    <UserPlus className="h-4 w-4" />
                    <span className="hidden sm:inline">Nuevo cliente</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nuevo cliente</DialogTitle></DialogHeader>
                  <form action={addClient} className="grid gap-4 mt-2">
                    <Field name="name"     label="Nombre completo"  placeholder="Ej. María Pérez" required />
                    <Field name="phone"    label="Teléfono"         placeholder="Ej. 59170000000" required />
                    <Field name="document" label="Documento"        placeholder="CI o NIT" />
                    <div className="grid gap-2">
                      <Label htmlFor="notes">Dirección o nota</Label>
                      <Textarea id="notes" name="notes" rows={3} placeholder="Dirección, referencia o detalle" />
                    </div>
                    <Button type="submit" className="h-11 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold">Guardar cliente</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
            {activeTab === "prestamos" && (
              <Dialog open={loanOpen} onOpenChange={setLoanOpen}>
                <DialogTrigger asChild>
                  <Button disabled={!state.clients.length} className="h-10 gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-bold shadow-sm px-5">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Nuevo préstamo</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nuevo préstamo</DialogTitle></DialogHeader>
                  <form action={addLoan} className="grid gap-4 mt-2">
                    <div className="grid gap-2">
                      <Label>Cliente</Label>
                      <Select name="clientId" defaultValue={state.clients[0]?.id} required>
                        <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                        <SelectContent>{state.clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field name="principal"   label="Capital prestado"   type="number" min="1"  step="0.01" required />
                      <Field name="interestRate" label="Interés mensual (%)"  type="number" min="0"  step="0.01" required />
                    </div>
                    <div className="grid gap-4">
                      <Field name="startDate" label="Fecha de inicio" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
                    </div>
                    <div className="grid gap-2">
                      <Label>Frecuencia de pago</Label>
                      <Select name="frequency" defaultValue="weekly">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Semanal</SelectItem>
                          <SelectItem value="biweekly">Quincenal</SelectItem>
                          <SelectItem value="monthly">Mensual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="h-11 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold">Crear préstamo</Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
            {activeTab === "pagos" && (
              <>
                <Button onClick={exportPaymentsCsv} variant="outline" className="h-10 gap-2 rounded-xl text-sm font-bold">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">CSV pagos</span>
                </Button>
                <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                  <SelectTrigger className="h-10 w-44 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendientes</SelectItem>
                    <SelectItem value="late">Atrasados</SelectItem>
                    <SelectItem value="paid">Pagados</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto p-5 lg:p-8">
          <div ref={contentRef}>

            {/* ════ INICIO ════ */}
            {activeTab === "inicio" && (
              <div className="space-y-8">
                {/* KPI cards */}
                <section className="grid gap-5 md:grid-cols-3">
                  <MetricCard icon={Banknote}      label="Capital prestado"  value={money(metrics.principal)}       color="blue" />
                  <MetricCard icon={TrendingUp}     label="Ganancia"          value={money(metrics.profit)}           color="emerald" />
                  <MetricCard icon={Users}          label="Personas pendientes por pagos" value={String(metrics.pendingPeople)} color="amber" />
                </section>

                {/* Chart + pie row */}
                <section className="grid gap-6">
                  {/* Bar chart */}
                  <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-2">
                    <CardHeader className="border-b border-slate-100 bg-white px-6 py-5">
                      <CardTitle className="text-lg font-bold text-slate-900">Cobros últimos 6 meses</CardTitle>
                      <p className="text-sm text-slate-500 mt-0.5">Comparación entre monto esperado y cobrado por mes.</p>
                    </CardHeader>
                    <CardContent className="p-6 flex justify-center">
                      <div className="w-full max-w-4xl max-h-64 flex items-center justify-center">
                        <BarChart data={chartData} />
                      </div>
                    </CardContent>
                  </Card>

                </section>

                {/* Upcoming + debtors */}
                <section className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
                  <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <CardHeader className="border-b border-slate-100 bg-white px-6 py-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg font-bold text-slate-900">Cobros pendientes</CardTitle>
                          <p className="text-sm text-slate-500 mt-0.5">La cuota más próxima de cada cliente.</p>
                        </div>
                        <Button variant="outline" className="h-9 rounded-xl text-xs font-semibold shadow-sm" onClick={() => handleTabChange("pagos")}>
                          Ver todos
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y divide-slate-100">
                        {clientPaymentRows.length > 0 ? clientPaymentRows.slice(0, 6).map(({ client, payment }) => {
                          const isLatePayment = !payment.paid && isLate(payment.dueDate);
                          return (
                            <div key={payment.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                              <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-600">
                                  {client.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-900">{client.name}</p>
                                  <p className="text-xs font-medium text-slate-500">{formatDate(payment.dueDate)}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-6">
                                <div className="text-right hidden sm:block">
                                  <p className="text-sm font-extrabold text-slate-900">{money(payment.amount)}</p>
                                  <p className={`text-[11px] font-bold mt-0.5 ${isLatePayment ? "text-red-500" : "text-amber-500"}`}>
                                    {isLatePayment ? "Atrasado" : "Pendiente"}
                                  </p>
                                </div>
                                <Button asChild variant="outline" size="sm" className="h-8 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700">
                                  <a href={reminderLink(client)} target="_blank" rel="noreferrer">
                                    <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> Avisar
                                  </a>
                                </Button>
                              </div>
                            </div>
                          );
                        }) : (
                          <div className="py-12 text-center">
                            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400 mb-3" />
                            <p className="text-sm font-bold text-slate-600">No hay cobros pendientes</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <CardHeader className="border-b border-slate-100 bg-white px-6 py-5">
                      <CardTitle className="text-lg font-bold text-slate-900">Mayores Deudores</CardTitle>
                      <p className="text-sm text-slate-500 mt-0.5">Clientes con saldo pendiente.</p>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y divide-slate-100">
                        {state.clients
                          .map((client) => ({ client, debt: clientDebt(state, client.id) }))
                          .filter((x) => x.debt > 0)
                          .sort((a, b) => b.debt - a.debt)
                          .slice(0, 5)
                          .map(({ client, debt }) => (
                            <div key={client.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                              <div className="min-w-0 pr-4">
                                <p className="text-sm font-bold text-slate-900 truncate">{client.name}</p>
                                <p className="text-xs text-slate-500 mt-0.5 truncate">{client.phone}</p>
                              </div>
                              <span className="shrink-0 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600 border border-red-100">
                                {money(debt)}
                              </span>
                            </div>
                          ))}
                        {!state.clients.some((c) => clientDebt(state, c.id) > 0) && (
                          <div className="py-12 text-center">
                            <p className="text-sm font-medium text-slate-400">Todos están al día</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </section>
              </div>
            )}

            {/* ════ CLIENTES ════ */}
            {activeTab === "clientes" && (
              <div className="space-y-5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input className="pl-12 h-12 text-base rounded-2xl border-slate-200 bg-white shadow-sm focus:border-blue-400" placeholder="Buscar por nombre, teléfono o documento…" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} />
                </div>
                {filteredClients.length === 0
                  ? <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white py-20 text-center"><Users className="h-12 w-12 text-slate-300 mb-4" /><p className="text-lg font-bold text-slate-600">No se encontraron clientes</p><p className="mt-1 text-sm text-slate-400">Agrega uno con el botón superior.</p></div>
                  : (
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                      {filteredClients.map((client) => {
                        const next = clientNextPayment(state, client.id);
                        const debt = clientDebt(state, client.id);
                        return (
                          <Card key={client.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5">
                            <CardContent className="grid gap-5 p-6">
                              <div className="flex items-start gap-4">
                                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 text-lg font-extrabold">
                                  {client.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <h3 className="text-lg font-extrabold text-slate-900 truncate">{client.name}</h3>
                                  <p className="text-sm text-slate-500">{client.phone}</p>
                                  <p className="text-xs text-slate-400">{client.document || "Sin documento"}</p>
                                </div>
                              </div>
                              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Saldo pendiente</p>
                                <strong className={`text-2xl font-extrabold ${debt > 0 ? "text-red-600" : "text-emerald-600"}`}>{money(debt)}</strong>
                                <p className="text-xs text-slate-500 mt-1">{next ? `Próximo: ${formatDate(next.dueDate)} (${money(next.amount)})` : "Sin pagos pendientes"}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button asChild variant="outline" size="sm" className="flex-1 h-9 rounded-xl text-sm font-semibold">
                                  <a href={reminderLink(client)} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /> Avisar</a>
                                </Button>
                                <Button variant="outline" size="sm" className="h-9 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 hover:border-red-200" onClick={() => deleteClient(client.id)}>
                                  Eliminar
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
              </div>
            )}

            {/* ════ PRÉSTAMOS ════ */}
            {activeTab === "prestamos" && (
              <div className="space-y-5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input className="h-12 rounded-2xl border-slate-200 bg-white pl-12 text-base shadow-sm focus:border-blue-400" placeholder="Buscar prestamo por cliente, telefono o monto..." value={loanSearch} onChange={(e) => setLoanSearch(e.target.value)} />
                </div>
                <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {filteredLoans.length === 0
                  ? <div className="flex flex-col items-center justify-center py-24 text-center"><Banknote className="h-14 w-14 text-slate-300 mb-4" /><p className="text-lg font-bold text-slate-600">No hay préstamos registrados</p><p className="mt-1 text-sm text-slate-400">Agrega uno con el botón superior.</p></div>
                  : (
                    <TableShell>
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                          <Th>Cliente</Th><Th>Capital</Th><Th>Interés</Th><Th>Abonos Réditos</Th><Th>Capital Pagado</Th><Th>Progreso</Th><Th>Saldo Capital</Th><Th />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLoans.map((loan) => {
                          const client = findClient(loan.clientId);
                          const breakdown = loanBreakdown(loan.id);
                          const paid = breakdown.paidCapital;
                          const saldo = breakdown.remainingCapital;
                          const progress = loan.principal > 0 ? Math.min(100, Math.round((paid / loan.principal) * 100)) : 0;
                          return (
                            <tr key={loan.id} className="hover:bg-slate-50/80 transition-colors">
                              <Td><span className="font-semibold text-slate-800">{client?.name || "Sin cliente"}</span></Td>
                              <Td>{money(loan.principal)}</Td>
                              <Td><span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-700">{loan.interestRate}%</span></Td>
                              <Td><span className="font-bold text-slate-600">{money(breakdown.paidInterest)}</span></Td>
                              <Td><span className="text-emerald-600 font-semibold">{money(paid)}</span></Td>
                              <Td>
                                <div className="min-w-28">
                                  <div className="h-2 rounded-full bg-slate-100">
                                    <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                                  </div>
                                  <p className="mt-1 text-xs font-bold text-slate-500">{progress}% cobrado</p>
                                </div>
                              </Td>
                              <Td><span className={`font-bold ${saldo > 0 ? "text-red-600" : "text-emerald-600"}`}>{money(saldo)}</span></Td>
                              <Td><Button variant="outline" size="sm" className="h-7 text-xs rounded-lg text-red-500 hover:bg-red-50 hover:border-red-200" onClick={() => deleteLoan(loan.id)}>Eliminar</Button></Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </TableShell>
                  )}
                </Card>
              </div>
            )}

            {/* ════ PAGOS ════ */}
            {activeTab === "pagos" && (
              <div className="space-y-5">
                {/* Stats */}
                <section className="grid gap-4 sm:grid-cols-3">
                  <MiniStat label="Clientes pendientes" value={String(metrics.pendingPeople)} tone="blue" />
                  <MiniStat label="Clientes atrasados"  value={String(new Set(overdueRows.map(r => r.client.id)).size)} tone="red" />
                  <MiniStat label="Monto vencido"       value={money(metrics.overdueBalance)} tone="amber" />
                </section>
                {/* Search */}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input className="h-12 rounded-2xl border-slate-200 bg-white pl-12 text-base shadow-sm focus:border-blue-400" placeholder="Buscar cliente por nombre o teléfono…" value={paymentSearch} onChange={(e) => setPaymentSearch(e.target.value)} />
                </div>
                {/* Cards — one per client */}
                {clientPaymentRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white py-24 text-center">
                    <CalendarClock className="h-14 w-14 text-slate-300 mb-4" />
                    <p className="text-lg font-bold text-slate-600">No hay pagos en esta vista</p>
                    <p className="mt-1 text-sm text-slate-400">Cambia el filtro para ver otros pagos.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {clientPaymentRows.map(({ client, payment, loan, pendingCount, paidCount }) => {
                      const late    = !payment.paid && isLate(payment.dueDate);
                      const paidLate = payment.paid && payment.paidAt ? isLate(payment.dueDate) : false;
                      return (
                        <motion.div key={client.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                          <Card className={`rounded-2xl border-2 bg-white shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5 ${
                            late ? "border-red-300" : payment.paid ? "border-emerald-200" : "border-slate-200"
                          }`}>
                            <CardContent className="p-5 grid gap-4">
                              {/* Client header */}
                              <div className="flex items-start gap-3">
                                <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-base font-extrabold ${
                                  late ? "bg-red-100 text-red-700" : payment.paid ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                                }`}>
                                  {client.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="font-extrabold text-slate-900 truncate">{client.name}</h3>
                                  <p className="text-xs text-slate-500">{client.phone}</p>
                                  {client.notes && <p className="text-xs text-slate-400 truncate mt-0.5">{client.notes}</p>}
                                </div>
                                <PaymentBadge payment={payment} />
                              </div>

                              {/* Payment info */}
                              <div className={`rounded-xl p-4 space-y-2 ${
                                late ? "bg-red-50 border border-red-200" : payment.paid ? "bg-emerald-50 border border-emerald-200" : "bg-slate-50 border border-slate-200"
                              }`}>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Monto del pago</span>
                                  <span className={`text-xl font-extrabold ${
                                    late ? "text-red-700" : payment.paid ? "text-emerald-700" : "text-slate-900"
                                  }`}>{money(payment.amount)}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                  <span>Vence: <span className={`font-semibold ${ late ? "text-red-600" : "text-slate-700"}`}>{formatDate(payment.dueDate)}</span></span>
                                  {loan && <span>Préstamo: {money(loan.total)}</span>}
                                </div>
                                {payment.paid && (
                                  <div className="pt-1 border-t border-dashed border-emerald-200 space-y-1">
                                    <div className="flex justify-between text-xs">
                                      <span className="text-slate-500">Pagado el:</span>
                                      <span className={`font-bold ${ paidLate ? "text-red-600" : "text-emerald-600"}`}>
                                        {payment.paidAt ? formatDate(payment.paidAt.slice(0,10)) : "-"}
                                        {paidLate && " (con retraso)"}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                      <span className="text-slate-500">Réditos:</span>
                                      <span className="font-bold text-violet-700">{money(payment.paidInterest || 0)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                      <span className="text-slate-500">Capital:</span>
                                      <span className="font-bold text-blue-700">{money(payment.paidCapital || 0)}</span>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Counters */}
                              <div className="flex gap-2 text-xs">
                                <span className="rounded-lg bg-amber-100 text-amber-700 font-bold px-2.5 py-1">{pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}</span>
                                <span className="rounded-lg bg-emerald-100 text-emerald-700 font-bold px-2.5 py-1">{paidCount} pagado{paidCount !== 1 ? "s" : ""}</span>
                              </div>

                              {/* Actions */}
                              <div className="flex gap-2">
                                {!payment.paid ? (
                                  <Button
                                    className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm gap-1.5"
                                    onClick={() => openPaymentDialog(payment.id)}
                                  >
                                    <CheckCircle2 className="h-4 w-4" /> Registrar pago
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    className="flex-1 h-10 rounded-xl text-sm font-semibold text-slate-500"
                                    onClick={() => unmarkPayment(payment.id)}
                                  >
                                    Desmarcar
                                  </Button>
                                )}
                                <Button asChild variant="outline" size="icon" className="h-10 w-10 rounded-xl flex-shrink-0">
                                  <a href={reminderLink(client)} target="_blank" rel="noreferrer" aria-label="Avisar">
                                    <MessageCircle className="h-4 w-4" />
                                  </a>
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ════ SAN (Ahorros Colectivos) ════ */}
            {activeTab === "san" && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900">Ahorros Colectivos (SAN)</h2>
                    <p className="text-sm text-slate-500 mt-1">Gestiona grupos de ahorro y cobros por turnos.</p>
                  </div>
                  <Dialog open={sanOpen} onOpenChange={setSanOpen}>
                    <DialogTrigger asChild>
                      <Button className="h-12 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-200 gap-2">
                        <Plus className="h-5 w-5" />
                        Nuevo SAN
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Nuevo grupo SAN</DialogTitle>
                      </DialogHeader>
                      <form action={addSan} className="space-y-6 pt-4">
                        <Field name="name" label="Nombre del grupo" placeholder="Ej. SAN Enero 2026" required />
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field name="quotaAmount" label="Monto por cuota" type="number" min="1" step="0.01" required />
                          <Field name="participantCount" label="Participantes" type="number" min="2" max="100" defaultValue="10" required />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field name="startDate" label="Fecha de inicio" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
                          <div className="grid gap-2">
                            <Label className="text-sm font-bold text-slate-700">Frecuencia</Label>
                            <Select name="frequency" defaultValue="weekly">
                              <SelectTrigger className="h-11 rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="weekly">Semanal</SelectItem>
                                <SelectItem value="biweekly">Quincenal</SelectItem>
                                <SelectItem value="monthly">Mensual</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button type="submit" className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold">Crear grupo SAN</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                {!activeSanId ? (
                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {state.sans.length === 0 ? (
                      <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-200">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                          <Wallet className="h-8 w-8 text-slate-400" />
                        </div>
                        <h3 className="mt-4 text-lg font-bold text-slate-800">No hay SANs activos</h3>
                        <p className="mt-1 text-sm text-slate-500">Crea tu primer SAN para empezar a gestionar ahorros colectivos.</p>
                      </div>
                    ) : (
                      state.sans.map((san) => (
                        <Card key={san.id} className="rounded-3xl border border-slate-200 bg-white shadow-sm hover:shadow-lg transition-all cursor-pointer" onClick={() => setActiveSanId(san.id)}>
                          <CardHeader className="pb-3 border-b border-slate-100">
                            <CardTitle className="text-lg font-bold text-slate-900 flex items-center justify-between">
                              {san.name}
                              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{san.status}</Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-4 pb-4">
                            <div className="space-y-3">
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500 font-medium">Cuota:</span>
                                <span className="font-bold text-slate-800">{money(san.quotaAmount)} ({san.frequency})</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500 font-medium">Participantes:</span>
                                <span className="font-bold text-slate-800">{state.sanClients.filter(c => c.sanId === san.id).length} / {san.participantCount}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                ) : (() => {
                  const san = state.sans.find(s => s.id === activeSanId);
                  if (!san) return null;
                  const clients = state.sanClients.filter(c => c.sanId === san.id).sort((a, b) => a.turnNumber - b.turnNumber);
                  
                  return (
                    <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <Button variant="outline" size="sm" onClick={() => setActiveSanId("")} className="rounded-xl border-slate-200">
                          Volver a SANs
                        </Button>
                        <h3 className="text-lg font-bold text-slate-800">{san.name} - Detalles</h3>
                      </div>

                      <div className="grid lg:grid-cols-2 gap-6">
                        {/* Clientes y Turnos */}
                        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                          <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-base font-bold text-slate-800">Participantes y Turnos</CardTitle>
                            <Dialog open={sanClientOpen} onOpenChange={setSanClientOpen}>
                              <DialogTrigger asChild>
                                <Button size="sm" className="rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold gap-1">
                                  <UserPlus className="h-4 w-4" /> Agregar
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader><DialogTitle>Agregar Participante</DialogTitle></DialogHeader>
                                <form action={addSanClient} className="space-y-4 pt-4">
                                  <Field name="name" label="Nombre" required />
                                  <div className="grid gap-4 md:grid-cols-2">
                                    <Field name="phone" label="Teléfono" required />
                                    <Field name="document" label="Cédula (Opcional)" />
                                  </div>
                                  <div className="grid gap-4 md:grid-cols-2">
                                    <Field name="turnNumber" label="Número de Turno" type="number" min="1" max={san.participantCount} required />
                                  </div>
                                  <Field name="notes" label="Observaciones (Opcional)" />
                                  <Button type="submit" className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold">Guardar</Button>
                                </form>
                              </DialogContent>
                            </Dialog>
                          </CardHeader>
                          <CardContent>
                            {clients.length === 0 ? (
                              <p className="text-sm text-slate-500 py-6 text-center">No hay participantes agregados.</p>
                            ) : (
                              <div className="space-y-3 mt-4">
                                {clients.map(client => (
                                  <div key={client.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                    <div>
                                      <p className="font-bold text-slate-800 flex items-center gap-2">
                                        <Badge className="bg-slate-200 text-slate-700">Turno {client.turnNumber}</Badge>
                                        {client.name}
                                      </p>
                                      <p className="text-xs text-slate-500 mt-1">{client.phone} {client.document && `- ${client.document}`}</p>
                                    </div>
                                    <Badge className="bg-emerald-100 text-emerald-700">{client.status}</Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Pagos por Ronda */}
                        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                          <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-base font-bold text-slate-800">Pagos de Cuota</CardTitle>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-slate-500">Ronda / Cuota:</Label>
                              <Select value={String(selectedRound)} onValueChange={(val) => setSelectedRound(Number(val))}>
                                <SelectTrigger className="h-8 w-24 text-xs font-bold rounded-lg border-slate-200"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: san.participantCount }, (_, i) => i + 1).map(round => (
                                    <SelectItem key={round} value={String(round)}>Ronda {round}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-xl mb-4 font-medium flex justify-between items-center">
                              <span>Esta ronda la cobra el <b>Turno {selectedRound}</b></span>
                              <span>Total a cobrar: <b>{money(san.quotaAmount * clients.length)}</b></span>
                            </div>
                            {clients.length === 0 ? (
                              <p className="text-sm text-slate-500 text-center py-4">Agrega participantes primero.</p>
                            ) : (
                              <div className="space-y-2">
                                {clients.map(client => {
                                  const paid = state.sanPayments.some(p => p.sanClientId === client.id && p.roundNumber === selectedRound);
                                  return (
                                    <div key={client.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-colors">
                                      <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-700">{client.name}</span>
                                        <span className="text-xs text-slate-500">Turno {client.turnNumber}</span>
                                      </div>
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => toggleSanPayment(client.id, san.quotaAmount)}
                                        className={`rounded-xl h-8 text-xs font-bold w-24 ${paid ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-transparent' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                                      >
                                        {paid ? "Pagado ✓" : "Cobrar"}
                                      </Button>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ════ CONFIGURACIÓN ════ */}
            {activeTab === "configuracion" && (
              <div className="grid gap-6 max-w-4xl">

                {/* Recordatorios */}
                <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <CardHeader className="border-b border-slate-100 px-7 py-6" style={{ background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)" }}>
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-200">
                        <BellRing className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-xl text-slate-900">Recordatorios de pago</CardTitle>
                        <p className="text-sm text-amber-700 mt-0.5">Configura con cuántos días de anticipación avisar a los clientes.</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-7 grid gap-7 lg:grid-cols-[1fr_1.6fr]">
                    <div className="space-y-5">
                      <div className="grid gap-2">
                        <Label className="text-sm font-bold text-slate-700">Anticipación del aviso</Label>
                        <Select value={reminderDays} onValueChange={setReminderDays}>
                          <SelectTrigger className="h-12 rounded-xl text-base"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 día antes</SelectItem>
                            <SelectItem value="2">2 días antes</SelectItem>
                            <SelectItem value="3">3 días antes</SelectItem>
                            <SelectItem value="7">7 días antes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button className="h-12 w-full rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-base font-bold shadow-md shadow-amber-200" onClick={notifyUpcomingPayments}>
                        <BellRing className="h-5 w-5" />
                        Activar alertas
                        {reminderPayments.length > 0 && (
                          <span className="ml-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-white/25 px-1.5 text-xs font-extrabold">
                            {reminderPayments.length}
                          </span>
                        )}
                      </Button>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        También puedes enviar avisos individuales por WhatsApp o SMS desde la tarjeta de cada cliente.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <p className="text-sm font-bold text-slate-600">Clientes con pagos próximos</p>
                      {reminderPayments.length ? (
                        reminderPayments.slice(0, 6).map((payment) => {
                          const loan   = findLoan(payment.loanId);
                          const client = findClient(loan?.clientId);
                          if (!client) return null;
                          const days = daysUntil(payment.dueDate);
                          return (
                            <div key={payment.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:bg-white transition-colors">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-900">{client.name}</span>
                                  <Badge variant={days === 0 ? "destructive" : "secondary"} className={days === 0 ? "" : "bg-amber-100 text-amber-700 border-amber-200"}>
                                    {days === 0 ? "Hoy" : `${days}d`}
                                  </Badge>
                                </div>
                                <p className="text-sm text-slate-500 mt-0.5">{money(payment.amount)} · {formatDate(payment.dueDate)}</p>
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <Button asChild size="sm" className="h-9 rounded-xl bg-blue-600 hover:bg-blue-700">
                                  <a href={reminderLink(client)} target="_blank" rel="noreferrer"><Send className="h-3.5 w-3.5" /></a>
                                </Button>
                                <Button size="sm" variant="outline" className="h-9 rounded-xl text-xs"
                                  onClick={() => navigator.clipboard.writeText(reminderText(client)).then(() => toast("Copiado", "Pégalo en WhatsApp o SMS.", "success"))}>
                                  Copiar
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-10 text-center">
                          <CheckCircle2 className="h-8 w-8 text-emerald-400 mb-3" />
                          <p className="font-bold text-slate-700">Todo al día</p>
                          <p className="text-sm text-slate-400 mt-1">No hay pagos próximos en el rango seleccionado.</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Importar / Exportar */}
                <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <CardHeader className="border-b border-slate-100 px-7 py-6" style={{ background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)" }}>
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
                        <Download className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-xl text-slate-900">Importar y exportar datos</CardTitle>
                        <p className="text-sm text-blue-700 mt-0.5">Haz un respaldo completo o restaura desde uno anterior.</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-7">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={exportData}
                        className="group flex flex-col items-start gap-3 rounded-2xl border-2 border-slate-200 bg-slate-50 p-6 text-left hover:border-blue-400 hover:bg-blue-50 transition-all hover:shadow-md"
                      >
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                          <Download className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">Exportar datos</p>
                          <p className="text-xs text-slate-500 mt-0.5">Descarga un respaldo JSON con todos tus datos.</p>
                        </div>
                      </button>
                      <Label className="group flex cursor-pointer flex-col items-start gap-3 rounded-2xl border-2 border-slate-200 bg-slate-50 p-6 text-left hover:border-emerald-400 hover:bg-emerald-50 transition-all hover:shadow-md">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                          <Upload className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">Importar datos</p>
                          <p className="text-xs text-slate-500 mt-0.5">Restaura desde un respaldo JSON exportado.</p>
                        </div>
                        <input className="hidden" type="file" accept="application/json" onChange={(e) => importData(e.target.files?.[0] ?? null)} />
                      </Label>
                    </div>
                  </CardContent>
                </Card>

                {/* Cambio de contraseña */}
                <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <CardHeader className="border-b border-slate-100 px-7 py-6" style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)" }}>
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-200">
                        <LockKeyhole className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-xl text-slate-900">Cambio de contraseña</CardTitle>
                        <p className="text-sm text-violet-700 mt-0.5">Actualiza la clave de acceso al sistema.</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-7">
                    <form action={changePassword} className="grid gap-4 max-w-md">
                      <div className="grid gap-2">
                        <Label htmlFor="currentPassword" className="text-sm font-bold text-slate-700">Contraseña actual</Label>
                        <Input id="currentPassword" name="currentPassword" type="password" placeholder="••••••••" className="h-12 rounded-xl border-slate-200" required />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="newPassword" className="text-sm font-bold text-slate-700">Nueva contraseña</Label>
                        <Input id="newPassword" name="newPassword" type="password" placeholder="Mínimo 6 caracteres" className="h-12 rounded-xl border-slate-200" required />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="confirmPassword" className="text-sm font-bold text-slate-700">Confirmar contraseña</Label>
                        <Input id="confirmPassword" name="confirmPassword" type="password" placeholder="Repite la nueva contraseña" className="h-12 rounded-xl border-slate-200" required />
                      </div>
                      <Button type="submit" className="h-12 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold shadow-md shadow-violet-200 mt-1 gap-2">
                        <LockKeyhole className="h-4 w-4" />
                        Actualizar contraseña
                      </Button>
                    </form>
                  </CardContent>
                </Card>

              </div>
            )}

           </div>
         </main>
       </div>

      {/* ── Payment Mode Dialog ── */}
      <AnimatePresence>
        {selectedPaymentId && (() => {
          const payment = state.payments.find((p) => p.id === selectedPaymentId);
          const loan    = payment ? findLoan(payment.loanId) : null;
          const client  = loan ? findClient(loan.clientId) : null;
          const breakdown = payment ? loanBreakdown(payment.loanId) : null;
          const paidInterestVal = Number(customInterest) || 0;
          const paidCapitalVal  = Number(customCapital) || 0;
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
              onClick={(e) => { if (e.target === e.currentTarget) setSelectedPaymentId(""); }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                transition={{ duration: 0.22 }}
                className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900">Registrar pago</h2>
                    <p className="text-sm text-slate-500 mt-0.5">{client?.name || "Cliente"} · Cuota #{payment?.number}</p>
                  </div>
                  <button type="button" onClick={() => setSelectedPaymentId("")} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-6 space-y-5">
                  <div className="rounded-2xl bg-slate-50 border border-slate-200 px-5 py-4 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600">Réditos generados (Mes)</span>
                    <span className="text-2xl font-extrabold text-slate-900">{payment ? money(payment.amount) : "-"}</span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label className="text-xs font-bold text-slate-700 uppercase">Tipo de pago</Label>
                      <Select value={paymentMode} onValueChange={(v: any) => setPaymentMode(v)}>
                        <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-white font-bold text-slate-800">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="interest">Pago a Réditos (Sólo interés)</SelectItem>
                          <SelectItem value="capital">Abono a Capital (Sólo capital)</SelectItem>
                          <SelectItem value="both">Abono a Ambos (Personalizado)</SelectItem>
                          <SelectItem value="full">Saldar Préstamo (Pago total)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {(paymentMode === "both" || paymentMode === "capital") && (
                      <div className="grid gap-4 sm:grid-cols-2 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                        {paymentMode === "both" && (
                          <div className="grid gap-2">
                            <Label className="text-xs font-bold text-violet-700 uppercase">Pago a Réditos</Label>
                            <Input 
                              type="number" min="0" step="0.01" 
                              value={customInterest} onChange={(e) => setCustomInterest(e.target.value)}
                              className="h-12 rounded-xl border-white bg-white text-lg font-bold shadow-sm"
                            />
                          </div>
                        )}
                        <div className="grid gap-2">
                          <Label className="text-xs font-bold text-blue-700 uppercase">Abono a Capital</Label>
                          <Input 
                            type="number" min="0" step="0.01" 
                            value={customCapital} onChange={(e) => setCustomCapital(e.target.value)}
                            className="h-12 rounded-xl border-white bg-white text-lg font-bold shadow-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {breakdown && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 divide-y divide-slate-200 overflow-hidden mt-4">
                      {paymentMode === "full" ? (
                         <div className="flex items-center justify-between px-5 py-3.5 bg-emerald-50">
                           <span className="text-sm font-bold text-emerald-700">El préstamo quedará saldado</span>
                           <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                         </div>
                      ) : (
                         <div className="flex items-center justify-between px-5 py-3.5 bg-white">
                           <span className="text-xs text-slate-500 font-medium">Capital pendiente tras este pago</span>
                           <span className="text-sm font-bold text-slate-800">
                             {paymentMode === "interest" 
                               ? money(breakdown.remainingCapital)
                               : money(Math.max(0, breakdown.remainingCapital - paidCapitalVal))
                             }
                           </span>
                         </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-3 pt-1">
                    <Button type="button" variant="outline" className="flex-1 h-12 rounded-2xl font-semibold" onClick={() => setSelectedPaymentId("")}>
                      Cancelar
                    </Button>
                    <Button type="button" className="flex-1 h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-lg shadow-emerald-200" onClick={confirmPayment}>
                      <CheckCircle2 className="h-5 w-5" />
                      Confirmar pago
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      <ToastViewport />
    </div>
  );
}

// ═══════════════ CHART COMPONENTS ════════════════════════════════

interface BarChartData { label: string; collected: number; expected: number }

function BarChart({ data }: { data: BarChartData[] }) {
  const maxVal = Math.max(...data.flatMap((d) => [d.collected, d.expected]), 1);
  const W = 540; const H = 180; const PAD = 32; const BAR_W = 28; const GAP = 10;
  const slotW = (W - PAD * 2) / data.length;

  return (
    <div className="w-full overflow-hidden flex justify-center">
      <svg viewBox={`0 0 ${W} ${H + 40}`} className="w-full h-auto max-h-[260px]" style={{ minWidth: 320 }}>

        {/* Y grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD + (1 - t) * H;
          return (
            <g key={t}>
              <line x1={PAD} x2={W - PAD} y1={y} y2={y} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
              {t > 0 && (
                <text x={PAD - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#94a3b8" fontWeight="500">
                  {`${Math.round(maxVal * t / 1000)}k`}
                </text>
              )}
            </g>
          );
        })}
        {/* Bars */}
        {data.map((d, i) => {
          const cx   = PAD + i * slotW + slotW / 2;
          const expH = (d.expected  / maxVal) * H;
          const colH = (d.collected / maxVal) * H;
          return (
            <g key={i}>
              {/* Expected bar (ghost) */}
              <rect x={cx - BAR_W / 2 - GAP / 2} y={PAD + H - expH} width={BAR_W} height={expH} rx="6" fill="#eff6ff" />
              {/* Collected bar */}
              <rect x={cx + GAP / 2} y={PAD + H - colH} width={BAR_W} height={colH} rx="6" fill="#3b82f6" />
              {/* Label */}
              <text x={cx} y={PAD + H + 22} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="700">
                {d.label}
              </text>
            </g>
          );
        })}
        {/* Legend */}
        <g transform={`translate(${W / 2 - 80}, ${PAD + H + 38})`}>
          <rect width="12" height="12" rx="3" fill="#eff6ff" />
          <text x="18" y="10" fontSize="10" fill="#64748b" fontWeight="600">Esperado</text>
          <rect x="76" width="12" height="12" rx="3" fill="#3b82f6" />
          <text x="94" y="10" fontSize="10" fill="#64748b" fontWeight="600">Cobrado</text>
        </g>
      </svg>
    </div>
  );
}

interface DonutSegment { label: string; value: number; color: string }
function DonutChart({ segments, total }: { segments: DonutSegment[]; total: number }) {
  const R = 60; const CX = 80; const CY = 80; const STROKE = 22;
  let cumulative = 0;
  const paths = segments.map((seg) => {
    const pct   = seg.value / total;
    const start = cumulative * 2 * Math.PI - Math.PI / 2;
    cumulative += pct;
    const end   = cumulative * 2 * Math.PI - Math.PI / 2;
    const laf   = pct > 0.5 ? 1 : 0;
    const x1 = CX + R * Math.cos(start); const y1 = CY + R * Math.sin(start);
    const x2 = CX + R * Math.cos(end);   const y2 = CY + R * Math.sin(end);
    if (pct === 0) return null;
    if (pct >= 0.9999) {
      return <circle key={seg.label} cx={CX} cy={CY} r={R} fill="none" stroke={seg.color} strokeWidth={STROKE} />;
    }
    return (
      <path key={seg.label} d={`M${x1},${y1} A${R},${R} 0 ${laf},1 ${x2},${y2}`}
        fill="none" stroke={seg.color} strokeWidth={STROKE} strokeLinecap="round" />
    );
  });
  return (
    <svg viewBox={`0 0 160 160`} className="w-36 h-36 flex-shrink-0">
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f1f5f9" strokeWidth={STROKE} />
      {paths}
      <text x={CX} y={CY - 6} textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="700">Total</text>
      <text x={CX} y={CY + 10} textAnchor="middle" fontSize="10" fill="#94a3b8">{`${money(total).slice(0, 10)}`}</text>
    </svg>
  );
}

// ═══════════════ SHARED COMPONENTS ═══════════════════════════════

const colorMap = {
  blue:    { bg: "bg-blue-50",    icon: "text-blue-600",    border: "border-blue-200" },
  violet:  { bg: "bg-violet-50",  icon: "text-violet-600",  border: "border-violet-200" },
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", border: "border-emerald-200" },
  amber:   { bg: "bg-amber-50",   icon: "text-amber-600",   border: "border-amber-200" },
  red:     { bg: "bg-red-50",     icon: "text-red-600",     border: "border-red-200" },
};

function MiniStat({ label, value, tone = "blue" }: { label: string; value: string; tone?: keyof typeof colorMap }) {
  const c = colorMap[tone];
  return (
    <Card className={`rounded-2xl border ${c.border} ${c.bg} shadow-sm`}>
      <CardContent className="p-5">
        <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">{label}</p>
        <strong className={`mt-2 block text-2xl font-extrabold ${c.icon}`}>{value}</strong>
      </CardContent>
    </Card>
  );
}

function MetricCard({ icon: Icon, label, value, color = "blue" }: { icon: typeof Banknote; label: string; value: string; color?: keyof typeof colorMap }) {
  const c = colorMap[color];
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5">
        <CardContent className="flex items-start justify-between gap-4 p-6">
          <div>
            <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">{label}</p>
            <strong className="mt-2 block text-[28px] font-extrabold text-slate-900 leading-tight">{value}</strong>
          </div>
          <div className={`flex h-13 w-13 flex-shrink-0 items-center justify-center rounded-2xl border ${c.bg} ${c.border}`} style={{ width: 52, height: 52 }}>
            <Icon className={`h-6 w-6 ${c.icon}`} />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Field(props: React.ComponentProps<typeof Input> & { label: string; name: string; selectOnFocus?: boolean }) {
  const { label, name, selectOnFocus, onFocus, ...inputProps } = props;
  return (
    <div className="grid gap-2">
      <Label htmlFor={name} className="text-sm font-bold text-slate-700">{label}</Label>
      <Input
        id={name}
        name={name}
        className="h-11 rounded-xl border-slate-200"
        onFocus={(event) => {
          if (selectOnFocus) event.currentTarget.select();
          onFocus?.(event);
        }}
        {...inputProps}
      />
    </div>
  );
}

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse">{children}</table>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="border-b border-slate-100 px-5 py-4 text-left text-xs font-extrabold uppercase tracking-wider text-slate-400">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="border-b border-slate-100 px-5 py-4 text-sm text-slate-600">{children}</td>;
}

function PaymentBadge({ payment }: { payment: Payment }) {
  const status = payment.paid ? "paid" : isLate(payment.dueDate) ? "late" : "pending";
  const styles = { paid: "bg-emerald-100 text-emerald-700 border-emerald-200", late: "bg-red-100 text-red-700 border-red-200", pending: "bg-amber-100 text-amber-700 border-amber-200" };
  return <span className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-bold ${styles[status]}`}>{statusLabel(status)}</span>;
}
