import type { ButtonHTMLAttributes, ReactNode } from "react";

export const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

type Variant = "primary" | "secondary" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-300",
  secondary: "border border-slate-300 bg-white hover:border-indigo-600 disabled:opacity-50",
  danger: "border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50",
};

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export function Notice({ kind, children }: { kind: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "bg-red-50 text-red-800",
    success: "bg-emerald-50 text-emerald-800",
    info: "bg-amber-50 text-amber-800",
  } as const;
  return (
    <p className={`rounded-md p-3 text-sm ${styles[kind]}`} role={kind === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
}

export function Badge({ tone, children }: { tone: "green" | "gray" | "amber"; children: ReactNode }) {
  const styles = {
    green: "bg-emerald-100 text-emerald-800",
    gray: "bg-slate-100 text-slate-600",
    amber: "bg-amber-100 text-amber-800",
  } as const;
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[tone]}`}>{children}</span>;
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">{title}</h1>
      {action}
    </div>
  );
}

export function Checkbox({
  id,
  checked,
  onChange,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {children}
    </label>
  );
}
