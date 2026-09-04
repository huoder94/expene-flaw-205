export interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: 'despesa' | 'receita' | 'poupanca';
  category: string;
  date: string;
  monthKey: string;
  icon: string;
  notes?: string;
}

export interface MonthSummary {
  monthKey: string;
  monthName: string;
  income: number;
  expense: number;
  savings: number;
  balance: number;
}

export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Support years from 2026 up to 2040 for long-term reports
export const YEARS: number[] = Array.from({ length: 15 }, (_, i) => 2026 + i);

export const getMonthsForYear = (year: number) =>
  MONTH_NAMES.map((name, idx) => ({
    key: `${year}-${String(idx + 1).padStart(2, '0')}`,
    name: `${name} ${year}`,
    year,
    monthIndex: idx + 1,
  }));

export const parseMonthKey = (key: string): { year: number; month: number } => {
  const [y, m] = key.split('-');
  return { year: parseInt(y, 10), month: parseInt(m, 10) };
};

export const getMonthName = (key: string): string => {
  const { year, month } = parseMonthKey(key);
  return `${MONTH_NAMES[month - 1]} ${year}`;
};

export const INITIAL_MONTHS = getMonthsForYear(2026);

// Legacy mock data (unused after Phase 2 - data now comes from /api/transactions)
export const INITIAL_TRANSACTIONS: Transaction[] = [];
