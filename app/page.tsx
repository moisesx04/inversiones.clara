"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Printer,
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
const notificationKey = "clara-last-device-notification-v1";

function whatsappPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `1${digits}` : digits;
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

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
  const [clientFilter, setClientFilter] = useState<"all" | "pending" | "late" | "current">("all");
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
  const [issuedLoanId, setIssuedLoanId] = useState("");
  const [reengageClientId, setReengageClientId] = useState("");
  const [deleteClientId, setDeleteClientId] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingClient, setDeletingClient] = useState(false);
  const [sanOpen, setSanOpen]           = useState(false);
  const [sanClientOpen, setSanClientOpen] = useState(false);
  const [selectedRound, setSelectedRound] = useState(1);
  const [ready, setReady]               = useState(false);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [notifOpen, setNotifOpen]       = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const reminderToastRef = useRef("");
  const lastSavedStateRef = useRef("");
  const headingRef  = useRef<HTMLHeadingElement>(null);
  const contentRef  = useRef<HTMLDivElement>(null);
  const { toast, ToastViewport } = useToast();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if ("Notification" in window) setNotificationPermission(Notification.permission);
    else setNotificationPermission("unsupported");

    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => null);
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "OPEN_PENDING_PAYMENTS") {
          setActiveTab("pagos");
          setPaymentFilter("pending");
        }
      });
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    setIsAuthed(sessionStorage.getItem(sessionKey) === "ok");
    fetch("/api/loans")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: StoreState | null) => {
        if (!data) return;
        const loadedState = {
          ...emptyState,
          ...data,
          sans: data.sans || [],
          sanClients: data.sanClients || [],
          sanPayments: data.sanPayments || [],
        };
        lastSavedStateRef.current = JSON.stringify(loadedState);
        setState(loadedState);
      })
      .catch(() => null)
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    const serialized = JSON.stringify(state);
    if (serialized === lastSavedStateRef.current) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: serialized,
        signal: controller.signal,
      })
        .then((response) => { if (response.ok) lastSavedStateRef.current = serialized; })
        .catch(() => null);
    }, 450);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [ready, state]);

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
    return state.clients
      .filter((c) => `${c.name} ${c.phone} ${c.document}`.toLowerCase().includes(q))
      .filter((client) => {
        const loans = state.loans.filter((loan) => loan.clientId === client.id);
        const payments = state.payments.filter((payment) => loans.some((loan) => loan.id === payment.loanId));
        const hasPending = payments.some((payment) => !payment.paid);
        const hasLate = payments.some((payment) => !payment.paid && isLate(payment.dueDate));
        if (clientFilter === "pending") return hasPending;
        if (clientFilter === "late") return hasLate;
        if (clientFilter === "current") return !hasPending;
        return true;
      });
  }, [clientFilter, clientSearch, state.clients, state.loans, state.payments]);

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

  const pendingRows = useMemo(() => {
    return state.payments
      .filter((payment) => !payment.paid)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((payment) => {
        const loan = state.loans.find((item) => item.id === payment.loanId);
        const client = state.clients.find((item) => item.id === loan?.clientId);
        return client ? { client, payment, loan } : null;
      })
      .filter(Boolean) as { client: Client; payment: Payment; loan: Loan | undefined }[];
  }, [state]);

  const pendingClientRows = useMemo(() => {
    const grouped = new Map<string, { client: Client; payment: Payment; pendingCount: number; lateCount: number }>();
    pendingRows.forEach(({ client, payment }) => {
      const current = grouped.get(client.id);
      if (!current) {
        grouped.set(client.id, { client, payment, pendingCount: 1, lateCount: isLate(payment.dueDate) ? 1 : 0 });
      } else {
        current.pendingCount += 1;
        if (isLate(payment.dueDate)) current.lateCount += 1;
        if (payment.dueDate < current.payment.dueDate) current.payment = payment;
      }
    });
    return Array.from(grouped.values()).sort((a, b) => a.payment.dueDate.localeCompare(b.payment.dueDate));
  }, [pendingRows]);

  const overdueSanRows = useMemo(() => {
    const list: { clientName: string; phone: string; amount: number; sanName: string; round: number }[] = [];
    state.sans.forEach(san => {
      if (san.status !== "active") return;
      const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00`);
      const target = new Date(`${san.startDate}T00:00:00`);
      const daysDiff = Math.floor((today.getTime() - target.getTime()) / 86_400_000); // positive means past start date
      
      let currentRound = 1;
      if (daysDiff > 0) {
        if (san.frequency === "weekly") currentRound = Math.floor(daysDiff / 7) + 1;
        if (san.frequency === "biweekly") currentRound = Math.floor(daysDiff / 15) + 1;
        if (san.frequency === "monthly") currentRound = Math.floor(daysDiff / 30) + 1;
      }
      currentRound = Math.max(1, Math.min(san.participantCount, currentRound));

      const clients = state.sanClients.filter(c => c.sanId === san.id && c.status === "active");
      clients.forEach(client => {
        // They should have paid all rounds up to currentRound
        for (let r = 1; r <= currentRound; r++) {
          const paid = state.sanPayments.some(p => p.sanClientId === client.id && p.roundNumber === r);
          if (!paid) {
            list.push({ clientName: client.name, phone: client.phone, amount: san.quotaAmount, sanName: san.name, round: r });
          }
        }
      });
    });
    return list;
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

  useEffect(() => {
    if (!ready || !isAuthed || pendingClientRows.length === 0 || notificationPermission !== "granted") return;
    const today = new Date().toISOString().slice(0, 10);
    const notificationId = `${today}:${pendingClientRows.map(({ client }) => client.id).join(",")}`;
    if (localStorage.getItem(notificationKey) === notificationId) return;
    navigator.serviceWorker?.ready.then((registration) => {
      const overdue = pendingClientRows.filter(({ lateCount }) => lateCount > 0).length;
      registration.showNotification("Clara Inversiones", {
        body: overdue > 0
          ? `${pendingClientRows.length} clientes deben pagos; ${overdue} están atrasados.`
          : `${pendingClientRows.length} clientes tienen pagos pendientes.`,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "pending-payments",
      });
      localStorage.setItem(notificationKey, notificationId);
    }).catch(() => null);
  }, [isAuthed, notificationPermission, pendingClientRows, ready]);

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

    if (reengageClientId) {
      const currentLoan = state.loans
        .filter((item) => item.clientId === clientId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

      if (!currentLoan) {
        toast("Sin préstamo para reenganchar", "Este cliente todavía no tiene un préstamo. Crea uno nuevo primero.", "error");
        return;
      }

      const paidCapital = sum(
        state.payments
          .filter((payment) => payment.loanId === currentLoan.id && payment.paid)
          .map((payment) => payment.paidCapital || 0),
      );
      const newPrincipal = roundMoney(currentLoan.principal + principal);
      const remainingCapital = Math.max(0, newPrincipal - paidCapital);
      let ratePerPeriod = interestRate;
      if (frequency === "weekly") ratePerPeriod = interestRate / 4;
      else if (frequency === "biweekly") ratePerPeriod = interestRate / 2;

      const nextPayment: Payment = {
        id: crypto.randomUUID(),
        loanId: currentLoan.id,
        number: Math.max(0, ...state.payments.filter((payment) => payment.loanId === currentLoan.id).map((payment) => payment.number)) + 1,
        dueDate: addPeriod(startDate, frequency, 1),
        amount: roundMoney(remainingCapital * (ratePerPeriod / 100)),
        paid: false,
        paidAt: "",
      };

      setState((current) => ({
        ...current,
        loans: current.loans.map((item) => item.id === currentLoan.id ? {
          ...item,
          principal: newPrincipal,
          total: newPrincipal,
          reengagedCapital: roundMoney((item.reengagedCapital || 0) + principal),
          interestRate,
          frequency,
          startDate,
        } : item),
        payments: [
          ...current.payments.filter((payment) => payment.loanId !== currentLoan.id || payment.paid),
          nextPayment,
        ],
      }));
      setLoanOpen(false);
      setReengageClientId("");
      setIssuedLoanId(currentLoan.id);
      toast("Reenganche sumado al capital", `${money(principal)} se agregó al préstamo existente. Capital acumulado: ${money(newPrincipal)}.`, "success");
      return;
    }

    const loan: Loan = { id: loanId, clientId, principal, reengagedCapital: 0, interestRate, total: principal, installments, frequency, startDate, createdAt: new Date().toISOString() };
    const payments: Payment[] = Array.from({ length: installments }, (_, i) => ({
      id: crypto.randomUUID(), loanId, number: i + 1,
      dueDate: addPeriod(startDate, frequency, i + 1),
      amount: roundMoney(principal * (interestRate / 100)),
      paid: false, paidAt: "",
    }));

    setState((c) => ({ ...c, loans: [...c.loans, loan], payments: [...c.payments, ...payments] }));
    setLoanOpen(false);
    setIssuedLoanId(loanId);
    toast("Préstamo creado", "El volante de entrega está listo para imprimir.", "success");
  }

  function printLoanVoucher(loan: Loan, client: Client, firstInterest: number) {
    const receiptNumber = loan.id.slice(0, 8).toUpperCase();
    const issuedAt = new Date(loan.createdAt).toLocaleString("es-DO", {
      dateStyle: "long",
      timeStyle: "short",
    });
    const nextDueDate = state.payments
      .filter((payment) => payment.loanId === loan.id)
      .sort((a, b) => a.number - b.number)[0]?.dueDate;
    const safe = (value: string) =>
      value.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
      })[character] || character);
    const popup = window.open("", "_blank", "width=760,height=900");
    if (!popup) {
      toast("No se pudo abrir", "Permite las ventanas emergentes para imprimir el volante.", "error");
      return;
    }
    popup.document.write(`<!doctype html>
      <html lang="es"><head><meta charset="utf-8"><title>Volante ${receiptNumber}</title>
      <style>
        *{box-sizing:border-box} body{margin:0;padding:36px;font-family:Arial,sans-serif;color:#172033;background:#fff}
        .voucher{max-width:680px;margin:auto;border:2px solid #172033;border-radius:18px;overflow:hidden}
        header{padding:26px 30px;background:#172033;color:#fff;display:flex;justify-content:space-between;gap:20px}
        h1{font-size:23px;margin:0 0 5px}.muted{color:#64748b}.number{text-align:right;font-size:13px}
        main{padding:30px}.client{display:grid;grid-template-columns:1fr 1fr;gap:12px 28px;padding-bottom:24px}
        .label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:700}
        .value{margin-top:5px;font-size:15px;font-weight:700}
        table{width:100%;border-collapse:collapse;margin:8px 0 24px}th,td{padding:14px;border-bottom:1px solid #dbe2ea}
        th{text-align:left;background:#f1f5f9;font-size:12px;text-transform:uppercase;color:#475569}td:last-child,th:last-child{text-align:right}
        .total{display:flex;justify-content:space-between;padding:17px 18px;background:#eff6ff;border-radius:12px;font-size:18px;font-weight:800}
        .note{margin:22px 0 0;font-size:12px;line-height:1.55;color:#64748b}
        footer{padding:17px 30px;background:#f8fafc;text-align:center;font-size:11px;color:#64748b}
        @media print{body{padding:0}.voucher{border-radius:0} @page{margin:14mm}}
      </style></head><body>
      <section class="voucher">
        <header><div><h1>CLARA INVERSIONES</h1><div>Volante de entrega de préstamo</div></div>
        <div class="number"><strong>N.º ${receiptNumber}</strong><br>${safe(issuedAt)}</div></header>
        <main>
          <div class="client">
            <div><div class="label">Cliente</div><div class="value">${safe(client.name)}</div></div>
            <div><div class="label">Documento</div><div class="value">${safe(client.document || "No indicado")}</div></div>
            <div><div class="label">Teléfono</div><div class="value">${safe(client.phone)}</div></div>
            <div><div class="label">Fecha del préstamo</div><div class="value">${safe(formatDate(loan.startDate))}</div></div>
          </div>
          <table><thead><tr><th>Concepto</th><th>Monto</th></tr></thead><tbody>
            <tr><td>Capital acumulado</td><td>${money(loan.principal)}</td></tr>
            ${(loan.reengagedCapital || 0) > 0 ? `<tr><td>Incluido por reenganches</td><td>${money(loan.reengagedCapital || 0)}</td></tr>` : ""}
            <tr><td>Réditos del primer período (${loan.interestRate}%)</td><td>${money(firstInterest)}</td></tr>
            <tr><td>Frecuencia de pago</td><td>${loan.frequency === "weekly" ? "Semanal" : loan.frequency === "biweekly" ? "Quincenal" : "Mensual"}</td></tr>
            ${nextDueDate ? `<tr><td>Fecha del primer pago</td><td>${safe(formatDate(nextDueDate))}</td></tr>` : ""}
          </tbody></table>
          <div class="total"><span>Primer pago acordado</span><span>${money(firstInterest)}</span></div>
          <p class="note">El capital acumulado incluye los reenganches indicados; el reenganche está sumado al préstamo y no constituye un préstamo separado. Los abonos a capital se registrarán por separado.</p>
        </main><footer>Conserve este volante como constancia de la entrega.</footer>
      </section><script>window.onload=()=>{window.print()}<\/script></body></html>`);
    popup.document.close();
  }

  function openLoanPdf(loanId: string) {
    const popup = window.open(`/api/loan-voucher/${loanId}`, "_blank", "noopener,noreferrer");
    if (!popup) toast("No se pudo abrir el PDF", "Permite ventanas emergentes e intenta nuevamente.", "error");
  }

  function sendLoanVoucher(loan: Loan, client: Client) {
    const phone = whatsappPhone(client.phone);
    if (phone.length < 7) {
      toast("Teléfono inválido", "Corrige el teléfono del cliente antes de enviar el volante.", "error");
      return;
    }
    const voucherUrl = `${window.location.origin}/api/loan-voucher/${loan.id}`;
    const message = [
      `Hola ${client.name},`,
      "te compartimos el volante de entrega de tu préstamo.",
      `Puedes ver y descargar el PDF aquí: ${voucherUrl}`,
    ].join("\n\n");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
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

  function deleteSan(id: string) {
    if (!confirm("¿Seguro que deseas eliminar este SAN? Se borrarán todos sus participantes y pagos.")) return;
    setState(c => ({
      ...c,
      sans: c.sans.filter(s => s.id !== id),
      sanClients: c.sanClients.filter(sc => sc.sanId !== id),
      sanPayments: c.sanPayments.filter(sp => sp.sanId !== id)
    }));
    setActiveSanId("");
    toast("SAN eliminado", "El grupo ha sido borrado.", "success");
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

  function requestDeleteClient(id: string) {
    setDeletePassword("");
    setDeleteClientId(id);
  }

  async function confirmDeleteClient() {
    if (!deleteClientId || !deletePassword) {
      toast("Contraseña requerida", "Escribe la contraseña del administrador.", "error");
      return;
    }
    setDeletingClient(true);
    try {
      const response = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      if (!response.ok) {
        toast("Contraseña incorrecta", "No se eliminó la persona.", "error");
        return;
      }
      setState((current) => {
        const loanIds = new Set(current.loans.filter((loan) => loan.clientId === deleteClientId).map((loan) => loan.id));
        return {
          ...current,
          clients: current.clients.filter((client) => client.id !== deleteClientId),
          loans: current.loans.filter((loan) => loan.clientId !== deleteClientId),
          payments: current.payments.filter((payment) => !loanIds.has(payment.loanId)),
        };
      });
      setDeleteClientId("");
      setDeletePassword("");
      toast("Persona eliminada", "También se eliminó su historial de préstamos y pagos.", "success");
    } finally {
      setDeletingClient(false);
    }
  }

  function startReengagement(clientId: string) {
    setReengageClientId(clientId);
    setActiveTab("prestamos");
    setLoanOpen(true);
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
    const phone = whatsappPhone(client.phone);
    return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `sms:?body=${encodeURIComponent(text)}`;
  }

  async function notifyUpcomingPayments() {
    if (!("Notification" in window))   { toast("No disponible", "Tu navegador no permite notificaciones.", "error"); return; }
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission !== "granted") { toast("Permiso pendiente", "Activa las notificaciones del navegador.", "info"); return; }
    setNotificationPermission(permission);
    try {
      const registration = await navigator.serviceWorker?.ready;
      if (registration) {
        await registration.showNotification("Notificaciones activadas", {
          body: pendingClientRows.length ? `Hay ${pendingClientRows.length} clientes con pagos pendientes.` : "Todo está al día.",
          icon: "/icon-192.png", badge: "/icon-192.png", tag: "notifications-enabled",
        });
      } else {
        new Notification("Notificaciones activadas", { body: "Clara te avisará sobre tus cobros." });
      }
      localStorage.removeItem(notificationKey);
      toast("Notificaciones activadas", "Recibirás un resumen por cliente, sin avisos duplicados.", "success");
    } catch {
      toast("No se pudieron activar", "Abre Clara desde HTTPS o instálala en la pantalla de inicio y vuelve a intentar.", "error");
    }
  }

  async function installApp() {
    if (!installPrompt) {
      toast("Instalación", "En iPhone usa Compartir → Agregar a pantalla de inicio. En Android abre el menú del navegador → Instalar app.", "info");
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
      toast("Aplicación instalada", "Clara ya está disponible en tu pantalla de inicio.", "success");
    }
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
                    <Input id="user" name="user" required className="h-12 rounded-xl text-base border-slate-200" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password" className="text-sm font-bold text-slate-700">Clave</Label>
                    <Input id="password" name="password" type="password" required className="h-12 rounded-xl text-base border-slate-200" />
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
    <div className="app-shell flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)} />
        )}
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-950 text-white shadow-2xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:shadow-none ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Brand */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500 text-xl font-black shadow-lg shadow-blue-950/30">C</div>
            <div>
              <p className="text-xl font-extrabold leading-none tracking-tight text-white">Clara</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">Inversiones</p>
            </div>
          </div>
          <button className="rounded-xl p-2 text-blue-200 hover:bg-white/20 hover:text-white transition-colors lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="px-3 pb-2 pt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Navegación</p>
          {navItems.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleTabChange(id)}
                className={`group flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all duration-200 ${active ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30" : "text-slate-400 hover:bg-white/10 hover:text-white"}`}
              >
                <Icon className={`h-5 w-5 flex-shrink-0 ${active ? "text-white" : "text-slate-500 group-hover:text-white"}`} />
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
        <div className="border-t border-white/10 p-3">
          <Button
            type="button"
            onClick={logout}
            className="h-11 w-full justify-start gap-3 rounded-xl bg-transparent px-3 text-slate-400 shadow-none hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            <span>Cerrar sesión</span>
          </Button>
        </div>
      </aside>

      {/* ── Content ── */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="relative z-40 flex flex-shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 bg-white/95 px-3 py-3 shadow-sm backdrop-blur-xl sm:px-5 lg:px-8 lg:py-4">
          <div className="mr-auto flex min-w-0 items-center gap-4">
            <button type="button" className="rounded-xl p-2.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Menú">
              <Menu className="h-6 w-6" />
            </button>
            <div>
              <p className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 lg:block">{activeNav?.label}</p>
              <h1 ref={headingRef} className="text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl lg:text-3xl leading-tight">
                {headingMap[activeTab]}
              </h1>
            </div>
          </div>
          {/* Notification bell - always visible */}
          <div className="relative order-3 shrink-0">
            <button aria-label="Ver clientes con pagos pendientes"
              type="button"
              onClick={() => setNotifOpen((o) => !o)}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <BellRing className="h-5 w-5" />
              {(pendingClientRows.length + overdueSanRows.length) > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-extrabold text-white">
                  {pendingClientRows.length + overdueSanRows.length}
                </span>
              )}
            </button>
            {/* Dropdown */}
            <AnimatePresence>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.18 }}
                    className="fixed inset-x-3 top-[4.5rem] z-[60] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96"
                  >
                    <div className="border-b border-slate-100 bg-slate-50 px-5 py-4 flex items-center justify-between">
                      <div>
                        <p className="font-extrabold text-slate-900 text-sm">Clientes por cobrar</p>
                        <p className="text-xs text-slate-500 mt-0.5">{pendingClientRows.length} cliente{pendingClientRows.length !== 1 ? "s" : ""} con pagos pendientes</p>
                      </div>
                      <button onClick={() => setNotifOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="max-h-[min(65dvh,32rem)] divide-y divide-slate-100 overflow-y-auto overscroll-contain">
                      {pendingClientRows.length === 0 && overdueSanRows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <CheckCircle2 className="h-8 w-8 text-emerald-400 mb-2" />
                          <p className="text-sm font-bold text-slate-600">Todo al día</p>
                          <p className="text-xs text-slate-400 mt-0.5">No hay pagos vencidos.</p>
                        </div>
                      ) : (
                        <>
                          {pendingClientRows.map(({ client, payment, pendingCount, lateCount }) => {
                            const late = lateCount > 0;
                            return (
                            <div key={payment.id} className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${late ? "hover:bg-red-50" : "hover:bg-amber-50"}`}>
                              <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${late ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                                {client.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-slate-900 text-sm truncate">{client.name}</p>
                                <p className={`text-xs font-semibold ${late ? "text-red-600" : "text-amber-700"}`}>{pendingCount} pendiente{pendingCount !== 1 ? "s" : ""} · {late ? `${lateCount} atrasado${lateCount !== 1 ? "s" : ""}` : `próximo ${formatDate(payment.dueDate)}`}</p>
                              </div>
                              <Button asChild size="sm" className="h-8 rounded-xl bg-blue-600 hover:bg-blue-700 flex-shrink-0">
                                <a href={reminderLink(client)} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5" /></a>
                              </Button>
                            </div>
                          )})}
                          {overdueSanRows.map((row, idx) => (
                            <div key={`san-${idx}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-purple-50 transition-colors">
                              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-600 text-sm font-extrabold">
                                S
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-slate-900 text-sm truncate">{row.clientName}</p>
                                <p className="text-xs text-purple-600 font-semibold">{row.sanName} · Ronda {row.round} · {money(row.amount)}</p>
                              </div>
                              <Button asChild size="sm" className="h-8 rounded-xl bg-purple-600 hover:bg-purple-700 flex-shrink-0">
                                <a href={`https://wa.me/${whatsappPhone(row.phone)}?text=${encodeURIComponent(`Hola ${row.clientName}, recuerda tu pago pendiente del SAN "${row.sanName}" (Ronda ${row.round}) por un monto de ${money(row.amount)}.`)}`} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5" /></a>
                              </Button>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                    {pendingClientRows.length > 0 && (
                      <div className="border-t border-slate-100 px-5 py-3">
                        <button onClick={() => { setActiveTab("pagos"); setPaymentFilter("pending"); setNotifOpen(false); }}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors">
                          Ver todos los pagos pendientes →
                        </button>
                      </div>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Header CTA */}
          <div className="order-2 flex shrink-0 items-center gap-2 sm:gap-3">
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
              <Dialog open={loanOpen} onOpenChange={(open) => { setLoanOpen(open); if (!open) setReengageClientId(""); }}>
                <DialogTrigger asChild>
                  <Button disabled={!state.clients.length} onClick={() => setReengageClientId("")} className="h-10 gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-bold shadow-sm px-5">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Nuevo préstamo</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{reengageClientId ? "Sumar reenganche al capital" : "Nuevo préstamo"}</DialogTitle>
                    {reengageClientId && <p className="text-sm text-slate-500">El monto del reenganche se agregará al capital del préstamo existente; no se creará otro préstamo.</p>}
                  </DialogHeader>
                  <form action={addLoan} className="grid gap-4 mt-2">
                    <div className="grid gap-2">
                      <Label>Cliente</Label>
                      <Select key={reengageClientId || "new-loan"} name="clientId" defaultValue={reengageClientId || state.clients[0]?.id} required>
                        <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                        <SelectContent>{state.clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field name="principal" label={reengageClientId ? "Monto del reenganche (se suma al capital)" : "Capital prestado"} type="number" min="1" step="0.01" required />
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
                    <Button type="submit" className="h-11 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold">{reengageClientId ? "Crear reenganche" : "Crear préstamo"}</Button>
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
                  <SelectTrigger className="h-10 w-32 rounded-xl sm:w-44"><SelectValue /></SelectTrigger>
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
        <main className="relative z-0 flex-1 overflow-y-auto px-4 pb-28 pt-5 sm:px-5 lg:p-8">
          <div ref={contentRef} className="mx-auto w-full max-w-[1500px]">

            {/* ════ INICIO ════ */}
            {activeTab === "inicio" && (
              <div className="space-y-6">
                <section className="overflow-hidden rounded-3xl bg-slate-950 px-6 py-6 text-white shadow-xl shadow-slate-300/40 sm:px-8 sm:py-7">
                  <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
                    <div>
                      <p className="text-sm font-semibold text-blue-300">Resumen de hoy</p>
                      <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Todo tu negocio, más claro.</h2>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Revisa lo pendiente y registra lo importante desde un solo lugar.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                      <Button onClick={() => { setActiveTab("clientes"); setClientOpen(true); }} className="h-11 rounded-xl bg-white px-4 font-bold text-slate-950 hover:bg-slate-100">
                        <UserPlus className="h-4 w-4" /> Nuevo cliente
                      </Button>
                      <Button disabled={!state.clients.length} onClick={() => { setActiveTab("prestamos"); setReengageClientId(""); setLoanOpen(true); }} className="h-11 rounded-xl bg-blue-600 px-4 font-bold text-white hover:bg-blue-500">
                        <Plus className="h-4 w-4" /> Préstamo
                      </Button>
                    </div>
                  </div>
                </section>
                {/* KPI cards */}
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MiniStat label="Total clientes" value={String(state.clients.length)} tone="blue" />
                  <MiniStat label="Con pagos pendientes" value={String(pendingClientRows.length)} tone="amber" />
                  <MiniStat label="Atrasados" value={String(pendingClientRows.filter((row) => row.lateCount > 0).length)} tone="red" />
                  <MiniStat label="Al día" value={String(Math.max(0, state.clients.length - pendingClientRows.length))} tone="emerald" />
                </section>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input className="pl-12 h-12 text-base rounded-2xl border-slate-200 bg-white shadow-sm focus:border-blue-400" placeholder="Buscar por nombre, teléfono o documento…" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {([
                    ["all", "Todos"], ["pending", "Deben"], ["late", "Atrasados"], ["current", "Al día"],
                  ] as const).map(([value, label]) => (
                    <button key={value} type="button" onClick={() => setClientFilter(value)} className={`h-10 shrink-0 rounded-xl px-4 text-sm font-bold transition-colors ${clientFilter === value ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {filteredClients.length === 0
                  ? <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white py-20 text-center"><Users className="h-12 w-12 text-slate-300 mb-4" /><p className="text-lg font-bold text-slate-600">No se encontraron clientes</p><p className="mt-1 text-sm text-slate-400">Agrega uno con el botón superior.</p></div>
                  : (
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                      {filteredClients.map((client) => {
                        const next = clientNextPayment(state, client.id);
                        const debt = clientDebt(state, client.id);
                        const clientLoans = state.loans.filter((loan) => loan.clientId === client.id);
                        const clientPayments = state.payments.filter((payment) => clientLoans.some((loan) => loan.id === payment.loanId));
                        const latePayments = clientPayments.filter((payment) => !payment.paid && isLate(payment.dueDate));
                        const pendingPayments = clientPayments.filter((payment) => !payment.paid);
                        return (
                          <Card key={client.id} className={`rounded-2xl bg-white shadow-sm transition-all hover:shadow-md ${latePayments.length ? "border-2 border-red-300" : pendingPayments.length ? "border border-amber-200" : "border border-slate-200"}`}>
                            <CardContent className="grid gap-4 p-4 sm:p-5">
                              <div className="flex items-start gap-4">
                                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 text-lg font-extrabold">
                                  {client.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="text-lg font-extrabold text-slate-900 truncate">{client.name}</h3>
                                  <p className="text-sm text-slate-500">{client.phone}</p>
                                  <p className="text-xs text-slate-400">{client.document || "Sin documento"}</p>
                                </div>
                                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${latePayments.length ? "bg-red-100 text-red-700" : pendingPayments.length ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                                  {latePayments.length ? "NO HA PAGADO" : pendingPayments.length ? "PENDIENTE" : "AL DÍA"}
                                </span>
                              </div>
                              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Saldo pendiente</p>
                                <strong className={`text-2xl font-extrabold ${debt > 0 ? "text-red-600" : "text-emerald-600"}`}>{money(debt)}</strong>
                                <p className="text-xs text-slate-500 mt-1">{next ? `Próximo: ${formatDate(next.dueDate)} (${money(next.amount)})` : "Sin pagos pendientes"}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <Button asChild variant="outline" size="sm" className="h-10 rounded-xl text-sm font-semibold">
                                  <a href={reminderLink(client)} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /> Avisar</a>
                                </Button>
                                  <Button variant="outline" size="sm" className="h-10 rounded-xl text-sm font-semibold text-blue-600 hover:bg-blue-50 hover:border-blue-200" onClick={() => startReengagement(client.id)}>
                                    <Banknote className="mr-1.5 h-3.5 w-3.5" /> Reenganche
                                  </Button>
                                  <Button variant="outline" size="sm" className="col-span-2 h-9 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50 hover:border-red-200" onClick={() => requestDeleteClient(client.id)}>
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
                <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MiniStat label="Préstamos activos" value={String(state.loans.filter((loan) => loanBreakdown(loan.id).remainingCapital > 0).length)} tone="blue" />
                  <MiniStat label="Capital activo" value={money(sum(state.loans.map((loan) => loanBreakdown(loan.id).remainingCapital)))} tone="amber" />
                  <MiniStat label="Con atraso" value={String(state.loans.filter((loan) => state.payments.some((payment) => payment.loanId === loan.id && !payment.paid && isLate(payment.dueDate))).length)} tone="red" />
                  <MiniStat label="Completados" value={String(state.loans.filter((loan) => loanBreakdown(loan.id).remainingCapital <= 0).length)} tone="emerald" />
                </section>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input className="h-12 rounded-2xl border-slate-200 bg-white pl-12 text-base shadow-sm focus:border-blue-400" placeholder="Buscar prestamo por cliente, telefono o monto..." value={loanSearch} onChange={(e) => setLoanSearch(e.target.value)} />
                </div>
                <Card className="hidden rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden lg:block">
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
                              <Td>
                                <span className="font-semibold">{money(loan.principal)}</span>
                                {(loan.reengagedCapital || 0) > 0 && <span className="mt-1 block text-xs font-medium text-blue-600">Incluye {money(loan.reengagedCapital || 0)} de reenganche</span>}
                              </Td>
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
                              <Td>
                                <div className="flex items-center gap-2">
                                  <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg text-xs" onClick={() => setIssuedLoanId(loan.id)}>
                                    <Printer className="h-3.5 w-3.5" /> Volante
                                  </Button>
                                  <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg text-red-500 hover:bg-red-50 hover:border-red-200" onClick={() => deleteLoan(loan.id)}>Eliminar</Button>
                                </div>
                              </Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </TableShell>
                  )}
                </Card>
                {filteredLoans.length > 0 && (
                  <div className="grid gap-3 lg:hidden">
                    {filteredLoans.map((loan) => {
                      const client = findClient(loan.clientId);
                      const breakdown = loanBreakdown(loan.id);
                      const progress = loan.principal > 0 ? Math.min(100, Math.round((breakdown.paidCapital / loan.principal) * 100)) : 0;
                      const late = state.payments.some((payment) => payment.loanId === loan.id && !payment.paid && isLate(payment.dueDate));
                      return (
                        <Card key={loan.id} className={`rounded-2xl bg-white shadow-sm ${late ? "border-2 border-red-300" : "border border-slate-200"}`}>
                          <CardContent className="space-y-4 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0"><p className="truncate font-extrabold text-slate-950">{client?.name || "Sin cliente"}</p><p className="text-xs text-slate-500">Capital: {money(loan.principal)} · {loan.interestRate}%</p></div>
                              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${late ? "bg-red-100 text-red-700" : breakdown.remainingCapital > 0 ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>{late ? "ATRASADO" : breakdown.remainingCapital > 0 ? "ACTIVO" : "PAGADO"}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3"><div><p className="text-[10px] font-bold uppercase text-slate-400">Capital pagado</p><p className="font-extrabold text-emerald-600">{money(breakdown.paidCapital)}</p></div><div><p className="text-[10px] font-bold uppercase text-slate-400">Saldo capital</p><p className="font-extrabold text-red-600">{money(breakdown.remainingCapital)}</p></div></div>
                            <div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div><p className="mt-1 text-xs font-bold text-slate-500">{progress}% pagado</p></div>
                            <div className="grid grid-cols-2 gap-2"><Button variant="outline" className="h-10 rounded-xl" onClick={() => setIssuedLoanId(loan.id)}><Printer className="h-4 w-4" /> Volante</Button><Button variant="outline" className="h-10 rounded-xl text-red-500" onClick={() => deleteLoan(loan.id)}>Eliminar</Button></div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
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
                        <Card key={san.id} className="rounded-3xl border border-slate-200 bg-white shadow-sm hover:shadow-lg transition-all cursor-pointer" onClick={() => {
                          setActiveSanId(san.id);
                          const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00`);
                          const target = new Date(`${san.startDate}T00:00:00`);
                          const daysDiff = Math.floor((today.getTime() - target.getTime()) / 86_400_000);
                          let round = 1;
                          if (daysDiff > 0) {
                            if (san.frequency === "weekly") round = Math.floor(daysDiff / 7) + 1;
                            if (san.frequency === "biweekly") round = Math.floor(daysDiff / 15) + 1;
                            if (san.frequency === "monthly") round = Math.floor(daysDiff / 30) + 1;
                          }
                          setSelectedRound(Math.max(1, Math.min(san.participantCount, round)));
                        }}>
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
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Button variant="outline" size="sm" onClick={() => setActiveSanId("")} className="rounded-xl border-slate-200">
                            Volver a SANs
                          </Button>
                          <h3 className="text-lg font-bold text-slate-800">{san.name} - Detalles</h3>
                        </div>
                        <Button variant="default" size="sm" onClick={() => deleteSan(san.id)} className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold h-8 text-xs">
                          Eliminar SAN
                        </Button>
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
                              <Label className="text-xs text-slate-500">Número:</Label>
                              <Select value={String(selectedRound)} onValueChange={(val) => setSelectedRound(Number(val))}>
                                <SelectTrigger className="h-8 w-auto min-w-32 text-xs font-bold rounded-lg border-slate-200"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: san.participantCount }, (_, i) => i + 1).map(round => {
                                    const receiver = clients.find(c => c.turnNumber === round);
                                    return (
                                      <SelectItem key={round} value={String(round)}>
                                        Número {round} {receiver ? `- ${receiver.name}` : ""}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {(() => {
                              const recaudado = sum(state.sanPayments.filter(p => p.sanId === san.id && p.roundNumber === selectedRound).map(p => p.amount));
                              const totalEsperado = san.quotaAmount * clients.length;
                              return (
                                <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-xl mb-4 font-medium flex justify-between items-center">
                                  <div className="flex flex-col">
                                    <span>Esta ronda la cobra el <b>Turno {selectedRound}</b></span>
                                    <span className={`text-[10px] mt-0.5 ${recaudado >= totalEsperado ? 'text-emerald-600' : 'text-blue-600'}`}>
                                      Recaudado: {money(recaudado)} / {money(totalEsperado)}
                                    </span>
                                  </div>
                                  <div className="flex flex-col w-32 text-right">
                                    <span>Total a cobrar: <b>{money(totalEsperado)}</b></span>
                                    <div className="mt-1.5 h-1.5 w-full bg-blue-200 rounded-full overflow-hidden">
                                      <div className={`h-full ${recaudado >= totalEsperado ? 'bg-emerald-500' : 'bg-blue-600'} transition-all`} style={{ width: `${Math.min(100, (recaudado / totalEsperado) * 100 || 0)}%` }}></div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
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

                {/* Aplicación móvil */}
                <Card className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
                  <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
                        <Download className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-lg font-extrabold text-slate-900">Clara en tu celular</p>
                        <p className="mt-1 text-sm leading-5 text-slate-500">Instala la aplicación para abrirla desde tu pantalla de inicio y recibir avisos de cobros.</p>
                      </div>
                    </div>
                    <Button onClick={installApp} className="h-12 shrink-0 gap-2 rounded-xl bg-blue-600 px-6 font-bold hover:bg-blue-700">
                      <Download className="h-4 w-4" /> Instalar aplicación
                    </Button>
                  </CardContent>
                </Card>

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
                        {notificationPermission === "granted" ? "Notificaciones activas" : "Activar notificaciones"}
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

      {/* ── Password confirmation for deleting a client ── */}
      <AnimatePresence>
        {deleteClientId && (() => {
          const client = state.clients.find((item) => item.id === deleteClientId);
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={(event) => { if (event.target === event.currentTarget && !deletingClient) setDeleteClientId(""); }}>
              <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
                <h2 className="text-xl font-extrabold text-slate-900">Eliminar persona</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Se eliminará a <strong>{client?.name || "esta persona"}</strong> junto con todos sus préstamos y pagos. Esta acción requiere la contraseña del administrador.
                </p>
                <div className="mt-5 grid gap-2">
                  <Label htmlFor="deletePassword">Contraseña</Label>
                  <Input id="deletePassword" type="password" autoFocus value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void confirmDeleteClient(); }} placeholder="Escribe la contraseña actual" className="h-12 rounded-xl" />
                </div>
                <div className="mt-6 flex gap-3">
                  <Button variant="outline" disabled={deletingClient} className="h-12 flex-1 rounded-xl font-bold" onClick={() => setDeleteClientId("")}>Cancelar</Button>
                  <Button disabled={deletingClient || !deletePassword} className="h-12 flex-1 rounded-xl bg-red-600 font-bold hover:bg-red-700" onClick={() => void confirmDeleteClient()}>
                    {deletingClient ? "Verificando…" : "Eliminar definitivamente"}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ── Loan delivery voucher ── */}
      <AnimatePresence>
        {issuedLoanId && (() => {
          const loan = state.loans.find((item) => item.id === issuedLoanId);
          const client = loan ? state.clients.find((item) => item.id === loan.clientId) : undefined;
          const firstPayment = loan
            ? state.payments.filter((item) => item.loanId === loan.id).sort((a, b) => a.number - b.number)[0]
            : undefined;
          if (!loan || !client) return null;
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm"
              onClick={(event) => { if (event.target === event.currentTarget) setIssuedLoanId(""); }}
            >
              <motion.div initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }} className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
                <div className="flex items-start justify-between bg-slate-900 px-6 py-5 text-white">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Clara Inversiones</p>
                    <h2 className="mt-1 text-xl font-extrabold">Volante de entrega de préstamo</h2>
                    <p className="mt-1 text-xs text-slate-300">N.º {loan.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <button type="button" onClick={() => setIssuedLoanId("")} className="rounded-xl p-2 text-slate-300 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
                </div>
                <div className="space-y-5 p-6">
                  <div className="grid grid-cols-2 gap-4 rounded-2xl bg-slate-50 p-4 text-sm">
                    <div><p className="text-xs font-bold uppercase text-slate-400">Cliente</p><p className="mt-1 font-bold text-slate-800">{client.name}</p></div>
                    <div><p className="text-xs font-bold uppercase text-slate-400">Documento</p><p className="mt-1 font-bold text-slate-800">{client.document || "No indicado"}</p></div>
                    <div><p className="text-xs font-bold uppercase text-slate-400">Fecha</p><p className="mt-1 font-bold text-slate-800">{formatDate(loan.startDate)}</p></div>
                    <div><p className="text-xs font-bold uppercase text-slate-400">Frecuencia</p><p className="mt-1 font-bold text-slate-800">{loan.frequency === "weekly" ? "Semanal" : loan.frequency === "biweekly" ? "Quincenal" : "Mensual"}</p></div>
                  </div>
                  <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200">
                    <div className="flex justify-between px-5 py-4"><span className="font-semibold text-slate-600">Capital entregado</span><span className="text-lg font-extrabold text-blue-700">{money(loan.principal)}</span></div>
                    <div className="flex justify-between px-5 py-4"><span className="font-semibold text-slate-600">Réditos ({loan.interestRate}%)</span><span className="text-lg font-extrabold text-violet-700">{money(firstPayment?.amount || 0)}</span></div>
                    <div className="flex justify-between bg-emerald-50 px-5 py-4"><span className="font-bold text-emerald-800">Primer pago acordado</span><span className="text-lg font-extrabold text-emerald-700">{money(firstPayment?.amount || 0)}</span></div>
                  </div>
                  {firstPayment && <p className="text-center text-sm text-slate-500">Primer pago: <strong className="text-slate-700">{formatDate(firstPayment.dueDate)}</strong></p>}
                  <div className="flex gap-3">
                    <Button variant="outline" className="h-12 flex-1 rounded-xl font-bold" onClick={() => setIssuedLoanId("")}>Cerrar</Button>
                    <Button className="h-12 flex-1 gap-2 rounded-xl bg-emerald-600 font-bold hover:bg-emerald-700" onClick={() => sendLoanVoucher(loan, client)}>
                      <MessageCircle className="h-4 w-4" /> Enviar al cliente
                    </Button>
                  </div>
                  <Button variant="ghost" className="h-10 w-full gap-2 text-sm font-semibold text-slate-600" onClick={() => openLoanPdf(loan.id)}>
                    <Download className="h-4 w-4" /> Abrir PDF completo / imprimir
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      <nav className="mobile-nav fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-2xl backdrop-blur-xl lg:hidden">
        {navItems.slice(0, 5).map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button key={id} type="button" onClick={() => handleTabChange(id)} className={`relative flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-bold transition-colors ${active ? "bg-blue-50 text-blue-700" : "text-slate-500"}`}>
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate">{id === "prestamos" ? "Préstamos" : label}</span>
              {id === "pagos" && lateCount > 0 && <span className="absolute right-2 top-1 h-2 w-2 rounded-full bg-red-500" />}
            </button>
          );
        })}
      </nav>

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
      <CardContent className="p-3.5 sm:p-5">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 sm:text-xs sm:tracking-wider">{label}</p>
        <strong className={`mt-1.5 block break-words text-xl font-extrabold sm:mt-2 sm:text-2xl ${c.icon}`}>{value}</strong>
      </CardContent>
    </Card>
  );
}

function MetricCard({ icon: Icon, label, value, color = "blue" }: { icon: typeof Banknote; label: string; value: string; color?: keyof typeof colorMap }) {
  const c = colorMap[color];
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
        <CardContent className="flex items-start justify-between gap-4 p-5 sm:p-6">
          <div>
            <p className="text-xs font-semibold text-slate-500">{label}</p>
            <strong className="mt-2 block text-2xl font-extrabold tracking-tight text-slate-950 sm:text-[28px] leading-tight">{value}</strong>
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
