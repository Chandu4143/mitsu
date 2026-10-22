import type { ReactNode } from "react";
import { Icon } from "./Icon";

type ButtonVariant = "primary" | "soft" | "ghost" | "danger";

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const styles: Record<ButtonVariant, string> = {
    primary: "bg-primary text-white hover:bg-primary-hover",
    soft: "bg-primary-soft text-primary hover:bg-primary-soft/70",
    ghost: "bg-surface text-text-secondary border border-border hover:border-primary hover:text-primary",
    danger: "bg-danger text-white hover:bg-danger/90",
  };
  return (
    <button className={`${base} ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`rounded-full border border-border bg-surface px-4 py-2.5 text-[14px] text-text outline-none transition focus:border-primary placeholder:text-text-muted ${
        props.className || ""
      }`}
    />
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-primary-soft flex items-center justify-center text-primary">
        <Icon name={(icon as any) || "image"} size={22} />
      </div>
      <div className="text-[15px] font-bold text-text">{title}</div>
      {description && <div className="max-w-md text-[13px] text-text-secondary">{description}</div>}
      {action}
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className={`flex max-h-[85vh] flex-col gap-4 overflow-auto rounded-lg bg-surface p-6 shadow-card ${
          wide ? "w-full max-w-2xl" : "w-full max-w-md"
        }`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-bold text-text">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-text-muted hover:bg-primary-soft hover:text-primary"
            aria-label="Close"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-[14px] text-text-secondary">{description}</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
