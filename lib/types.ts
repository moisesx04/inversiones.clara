export type Client = {
  id: string;
  name: string;
  phone: string;
  document: string;
  notes: string;
  createdAt: string;
};

export type Loan = {
  id: string;
  clientId: string;
  principal: number;
  reengagedCapital?: number;
  interestRate: number;
  total: number;
  startDate: string;
  frequency: "weekly" | "biweekly" | "monthly";
  installments: number;
  createdAt: string;
};

export type Payment = {
  id: string;
  loanId: string;
  number: number;
  dueDate: string;
  amount: number;
  paid: boolean;
  paidAt: string;
  paidMode?: "interest" | "capital" | "both" | "full";
  paidInterest?: number;
  paidCapital?: number;
};

export type SanGroup = {
  id: string;
  name: string;
  quotaAmount: number;
  frequency: "weekly" | "biweekly" | "monthly";
  startDate: string;
  participantCount: number;
  status: "active" | "completed" | "cancelled";
  createdAt: string;
};

export type SanClient = {
  id: string;
  sanId: string;
  name: string;
  phone: string;
  document: string;
  turnNumber: number;
  status: "active" | "withdrawn";
  notes: string;
};

export type SanPayment = {
  id: string;
  sanId: string;
  sanClientId: string;
  roundNumber: number;
  amount: number;
  paidAt: string;
};

export type StoreState = {
  clients: Client[];
  loans: Loan[];
  payments: Payment[];
  sans: SanGroup[];
  sanClients: SanClient[];
  sanPayments: SanPayment[];
};
