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
};

export type StoreState = {
  clients: Client[];
  loans: Loan[];
  payments: Payment[];
};
