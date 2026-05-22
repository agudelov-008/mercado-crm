export type Tier = "Conservative" | "Moderate" | "Aggressive";
export type KycStatus = "Verified" | "Pending" | "Expired";

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  tier: Tier;
  portfolioValue: number;
  targetInvestment: number;
  netWorthBracket: string;
  kyc: KycStatus;
  interests: string[];
  assignedAgent: string;
  lastContact: string;
  avatarColor: string;
}

export interface TimelineNote {
  id: string;
  clientId: string;
  agent: string;
  type: "note" | "call" | "message" | "meeting";
  text: string;
  date: string;
}

export interface AssignmentEvent {
  id: string;
  clientId: string;
  text: string;
  date: string;
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  role: "Administrator" | "Agent";
  clients: number;
  aum: number;
  status: "Active" | "Inactive";
}

export interface Task {
  id: string;
  title: string;
  client: string;
  due: string;
  priority: "High" | "Medium" | "Low";
  status: "todo" | "in_progress" | "done";
  category: "Compliance" | "Rebalancing" | "Outreach" | "Review";
}

export const agents: Agent[] = [
  { id: "a1", name: "Carlos Mendoza", email: "carlos@quantcapital.io", role: "Agent", clients: 24, aum: 18_450_000, status: "Active" },
  { id: "a2", name: "Sofia Ramírez", email: "sofia@quantcapital.io", role: "Agent", clients: 31, aum: 27_900_000, status: "Active" },
  { id: "a3", name: "Diego Navarro", email: "diego@quantcapital.io", role: "Agent", clients: 18, aum: 9_200_000, status: "Active" },
  { id: "a4", name: "Lucía Herrera", email: "lucia@quantcapital.io", role: "Administrator", clients: 12, aum: 42_300_000, status: "Active" },
  { id: "a5", name: "Mateo Vargas", email: "mateo@quantcapital.io", role: "Agent", clients: 9, aum: 4_100_000, status: "Inactive" },
];

const colors = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

export const clients: Client[] = [
  { id: "c1", name: "Ricardo Salazar", email: "r.salazar@meridian.mx", phone: "+52 55 1234 5678", tier: "Aggressive", portfolioValue: 2_450_000, targetInvestment: 3_500_000, netWorthBracket: "$5M – $10M", kyc: "Verified", interests: ["Tech Equities", "Emerging Markets", "Crypto ETFs"], assignedAgent: "Carlos Mendoza", lastContact: "2 hours ago", avatarColor: colors[0] },
  { id: "c2", name: "Adriana Beltrán", email: "a.beltran@nordel.com", phone: "+52 81 9876 5432", tier: "Moderate", portfolioValue: 1_120_000, targetInvestment: 1_500_000, netWorthBracket: "$1M – $5M", kyc: "Verified", interests: ["Index Funds", "Dividend Stocks"], assignedAgent: "Sofia Ramírez", lastContact: "Yesterday", avatarColor: colors[1] },
  { id: "c3", name: "Joaquín Espinoza", email: "joaquin@grupodelta.mx", phone: "+52 33 4567 8901", tier: "Conservative", portfolioValue: 780_000, targetInvestment: 900_000, netWorthBracket: "$500K – $1M", kyc: "Pending", interests: ["Government Bonds", "Money Market"], assignedAgent: "Carlos Mendoza", lastContact: "3 days ago", avatarColor: colors[2] },
  { id: "c4", name: "Valentina Cortés", email: "v.cortes@altavista.cl", phone: "+56 9 8765 4321", tier: "Aggressive", portfolioValue: 4_890_000, targetInvestment: 6_000_000, netWorthBracket: "$10M+", kyc: "Verified", interests: ["Hedge Funds", "Private Equity", "Tech Equities"], assignedAgent: "Sofia Ramírez", lastContact: "5 hours ago", avatarColor: colors[3] },
  { id: "c5", name: "Emilio Reyes", email: "emilio@reyesholdings.com", phone: "+52 55 2345 6789", tier: "Moderate", portfolioValue: 1_675_000, targetInvestment: 2_000_000, netWorthBracket: "$1M – $5M", kyc: "Verified", interests: ["Balanced Funds", "REITs"], assignedAgent: "Diego Navarro", lastContact: "Last week", avatarColor: colors[4] },
  { id: "c6", name: "Camila Ortega", email: "c.ortega@helix.io", phone: "+52 55 3456 7890", tier: "Aggressive", portfolioValue: 3_200_000, targetInvestment: 4_000_000, netWorthBracket: "$5M – $10M", kyc: "Verified", interests: ["Tech Equities", "Options Strategies"], assignedAgent: "Carlos Mendoza", lastContact: "1 hour ago", avatarColor: colors[5] },
  { id: "c7", name: "Andrés Fuentes", email: "a.fuentes@cresta.mx", phone: "+52 55 4567 8912", tier: "Conservative", portfolioValue: 540_000, targetInvestment: 700_000, netWorthBracket: "$500K – $1M", kyc: "Expired", interests: ["Treasury Bonds"], assignedAgent: "Diego Navarro", lastContact: "2 weeks ago", avatarColor: colors[6] },
  { id: "c8", name: "Renata Cárdenas", email: "renata@cardenasco.mx", phone: "+52 55 5678 9123", tier: "Moderate", portfolioValue: 2_100_000, targetInvestment: 2_500_000, netWorthBracket: "$1M – $5M", kyc: "Verified", interests: ["ETFs", "Corporate Bonds", "REITs"], assignedAgent: "Sofia Ramírez", lastContact: "Today", avatarColor: colors[0] },
];

export const timelineNotes: TimelineNote[] = [
  { id: "n1", clientId: "c1", agent: "Carlos Mendoza", type: "call", text: "Discussed Q1 reallocation. Client interested in increasing exposure to semiconductor sector by 8%.", date: "2026-05-22T14:30:00" },
  { id: "n2", clientId: "c1", agent: "Carlos Mendoza", type: "message", text: "Sent quarterly performance report via WhatsApp. Client confirmed receipt.", date: "2026-05-20T09:12:00" },
  { id: "n3", clientId: "c1", agent: "Sofia Ramírez", type: "meeting", text: "In-person meeting at Polanco office. Reviewed risk profile and updated KYC documentation.", date: "2026-05-15T16:00:00" },
  { id: "n4", clientId: "c1", agent: "Carlos Mendoza", type: "note", text: "Client mentioned upcoming liquidity event in June (~$1.2M inflow). Schedule rebalancing call.", date: "2026-05-10T11:45:00" },
  { id: "n5", clientId: "c1", agent: "Lucía Herrera", type: "note", text: "Reassigned from Sofia to Carlos given sector specialization match.", date: "2026-04-28T10:00:00" },
];

export const assignmentHistory: AssignmentEvent[] = [
  { id: "h1", clientId: "c1", text: "Client created by Admin Lucía Herrera", date: "Oct 02, 2024" },
  { id: "h2", clientId: "c1", text: "Assigned to Agent Sofia Ramírez", date: "Oct 05, 2024" },
  { id: "h3", clientId: "c1", text: "Transferred to Agent Carlos Mendoza", date: "Apr 28, 2026" },
];

export const tasks: Task[] = [
  { id: "t1", title: "Renew Investor Profile – Ricardo Salazar", client: "Ricardo Salazar", due: "Tomorrow", priority: "High", status: "todo", category: "Compliance" },
  { id: "t2", title: "Send Portfolio Rebalancing Proposal", client: "Adriana Beltrán", due: "May 24", priority: "High", status: "in_progress", category: "Rebalancing" },
  { id: "t3", title: "KYC Documentation Refresh", client: "Joaquín Espinoza", due: "May 26", priority: "Medium", status: "todo", category: "Compliance" },
  { id: "t4", title: "Q2 Strategy Call", client: "Valentina Cortés", due: "May 28", priority: "Medium", status: "in_progress", category: "Review" },
  { id: "t5", title: "Send Market Outlook Report", client: "Camila Ortega", due: "Today", priority: "High", status: "todo", category: "Outreach" },
  { id: "t6", title: "Tax-Loss Harvesting Review", client: "Emilio Reyes", due: "Jun 02", priority: "Low", status: "done", category: "Rebalancing" },
  { id: "t7", title: "Expired KYC Follow-up", client: "Andrés Fuentes", due: "Overdue", priority: "High", status: "todo", category: "Compliance" },
  { id: "t8", title: "Annual Performance Review", client: "Renata Cárdenas", due: "Done", priority: "Medium", status: "done", category: "Review" },
];

export const marketTicker = [
  { symbol: "S&P 500", value: "5,847.32", change: "+0.84%", up: true },
  { symbol: "NASDAQ", value: "18,902.15", change: "+1.21%", up: true },
  { symbol: "DOW", value: "42,378.91", change: "-0.18%", up: false },
  { symbol: "IPC MEX", value: "53,420.67", change: "+0.42%", up: true },
  { symbol: "IPSA CL", value: "6,712.04", change: "-0.31%", up: false },
  { symbol: "BOVESPA", value: "129,847", change: "+0.93%", up: true },
  { symbol: "MERVAL", value: "1,847,233", change: "+2.14%", up: true },
  { symbol: "MXN/USD", value: "19.47", change: "-0.22%", up: false },
  { symbol: "BTC", value: "98,420", change: "+3.12%", up: true },
  { symbol: "GOLD", value: "2,684.30", change: "+0.45%", up: true },
  { symbol: "OIL WTI", value: "73.18", change: "-1.04%", up: false },
  { symbol: "10Y TSY", value: "4.28%", change: "+0.03", up: true },
];

export function formatCurrency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
