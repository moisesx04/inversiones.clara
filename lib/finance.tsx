import { StoreState, Payment } from "@/lib/types";

const peso = new Intl.NumberFormat("es-DO", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function money(value: number) {
  return `RD$ ${peso.format(roundMoney(value || 0))}`;
}

export function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function sum(values: number[]) {
  return roundMoney(values.reduce((acc, value) => acc + Number(value || 0), 0));
}

export function loanPaidTotal(payments: Payment[], loanId: string) {
  return sum(payments.filter((payment) => payment.loanId === loanId && payment.paid).map((payment) => payment.amount));
}

export function clientPaidTotal(state: StoreState, clientId: string) {
  const loanIds = state.loans.filter((loan) => loan.clientId === clientId).map((loan) => loan.id);
  return sum(state.payments.filter((payment) => loanIds.includes(payment.loanId) && payment.paid).map((payment) => payment.amount));
}

export function clientDebt(state: StoreState, clientId: string) {
  const loanIds = state.loans.filter((loan) => loan.clientId === clientId).map((loan) => loan.id);
  return sum(state.payments.filter((payment) => loanIds.includes(payment.loanId) && !payment.paid).map((payment) => payment.amount));
}

export function clientNextPayment(state: StoreState, clientId: string) {
  const loanIds = state.loans.filter((loan) => loan.clientId === clientId).map((loan) => loan.id);
  return state.payments
    .filter((payment) => loanIds.includes(payment.loanId) && !payment.paid)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
}

export function daysUntil(date: string) {
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00`);
  const target = new Date(`${date}T00:00:00`);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

export function dueSoonPayments(state: StoreState, daysBefore: number) {
  return state.payments
    .filter((payment) => {
      if (payment.paid) return false;
      const days = daysUntil(payment.dueDate);
      return days >= 0 && days <= daysBefore;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function addPeriod(startDate: string, frequency: "weekly" | "biweekly" | "monthly", periods: number) {
  const date = new Date(`${startDate}T00:00:00`);
  if (frequency === "weekly") date.setDate(date.getDate() + periods * 7);
  if (frequency === "biweekly") date.setDate(date.getDate() + periods * 15);
  if (frequency === "monthly") date.setMonth(date.getMonth() + periods);
  return date.toISOString().slice(0, 10);
}

export function isLate(date: string) {
  return date < new Date().toISOString().slice(0, 10);
}

export function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function statusLabel(status: "paid" | "late" | "pending") {
  return { paid: "Pagado", late: "Atrasado", pending: "Pendiente" }[status];
}

export function emptyState(message: string, columns: number) {
  return (
    <tr>
      <td className="border-b px-3 py-10 text-center text-sm text-muted-foreground" colSpan={columns}>
        {message}
      </td>
    </tr>
  );
}
