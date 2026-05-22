import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Circle, Clock, AlertTriangle, Plus } from "lucide-react";
import { tasks as seed, type Task } from "@/lib/mock-data";

export const Route = createFileRoute("/tasks")({ component: TasksPage });

const columns: { key: Task["status"]; label: string; icon: typeof Circle; tone: string }[] = [
  { key: "todo", label: "To Do", icon: Circle, tone: "text-muted-foreground" },
  { key: "in_progress", label: "In Progress", icon: Clock, tone: "text-warning" },
  { key: "done", label: "Done", icon: CheckCircle2, tone: "text-success" },
];

const priorityStyles: Record<string, string> = {
  High: "bg-destructive/15 text-destructive border-destructive/30",
  Medium: "bg-warning/15 text-warning border-warning/30",
  Low: "bg-info/15 text-info border-info/30",
};
const catStyles: Record<string, string> = {
  Compliance: "bg-destructive/10 text-destructive",
  Rebalancing: "bg-success/10 text-success",
  Outreach: "bg-info/10 text-info",
  Review: "bg-primary/15 text-primary",
};

function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>(seed);

  function move(id: string, dir: 1 | -1) {
    setTasks((ts) => ts.map(t => {
      if (t.id !== id) return t;
      const order: Task["status"][] = ["todo", "in_progress", "done"];
      const i = order.indexOf(t.status) + dir;
      if (i < 0 || i > 2) return t;
      return { ...t, status: order[i] };
    }));
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Tasks & Reminders</h1>
          <p className="text-sm text-muted-foreground">Financial compliance & client follow-ups</p>
        </div>
        <button className="h-9 px-4 rounded-md bg-gradient-primary text-primary-foreground text-sm font-medium flex items-center gap-2 shadow-glow">
          <Plus className="h-4 w-4" /> New task
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((col) => {
          const items = tasks.filter(t => t.status === col.key);
          const Icon = col.icon;
          return (
            <div key={col.key} className="rounded-xl border border-border bg-card/40 p-4 min-h-[300px]">
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-sm font-semibold flex items-center gap-2 ${col.tone}`}>
                  <Icon className="h-4 w-4" /> {col.label}
                </h2>
                <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
              </div>
              <div className="space-y-2.5">
                {items.map(t => (
                  <div key={t.id} className="rounded-lg bg-gradient-surface border border-border p-3 hover:border-primary/40 transition-all animate-fade-in-up">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${catStyles[t.category]}`}>{t.category}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${priorityStyles[t.priority]}`}>{t.priority}</span>
                    </div>
                    <div className="text-sm font-medium mt-2">{t.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{t.client}</div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                      <span className={`text-xs flex items-center gap-1 ${t.due === "Overdue" ? "text-destructive" : "text-muted-foreground"}`}>
                        {t.due === "Overdue" && <AlertTriangle className="h-3 w-3" />} {t.due}
                      </span>
                      <div className="flex gap-1">
                        <button disabled={t.status === "todo"} onClick={() => move(t.id, -1)} className="h-6 w-6 rounded text-xs hover:bg-surface-elevated disabled:opacity-30">←</button>
                        <button disabled={t.status === "done"} onClick={() => move(t.id, 1)} className="h-6 w-6 rounded text-xs hover:bg-surface-elevated disabled:opacity-30">→</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
