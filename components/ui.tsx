import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type ButtonVariant = "primary" | "soft" | "ghost" | "danger";

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const base =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold transition duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100";
  const styles: Record<ButtonVariant, string> = {
    primary: "bg-primary text-white shadow-[0_8px_20px_-12px_rgba(179,95,134,0.9)] hover:bg-primary-hover",
    soft: "bg-primary-soft text-primary hover:bg-[#f3d7e4]",
    ghost: "border border-border bg-surface text-text-secondary hover:border-border-strong hover:text-text",
    danger: "bg-danger text-white hover:bg-[#a94c4c]",
  };
  return (
    <button className={`${base} ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition active:scale-95 hover:border-border-strong hover:text-text disabled:opacity-40 ${className}`}
      {...props}
    >
      <Icon name={icon} size={19} />
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input
      {...rest}
      className={`min-h-11 rounded-2xl border border-border bg-surface px-4 py-2.5 text-[15px] text-text outline-none transition placeholder:text-text-muted focus:border-primary ${className}`}
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
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[26px] border border-border/80 bg-surface/80 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon name={icon || "image"} size={23} />
      </div>
      <div className="text-[16px] font-bold tracking-[-0.02em] text-text">{title}</div>
      {description && (
        <div className="max-w-md text-[14px] leading-relaxed text-text-secondary">{description}</div>
      )}
      {action}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = "",
  label,
}: {
  options: { label: string; value: T; icon?: IconName }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex rounded-full border border-border bg-surface-soft p-1 ${className}`}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition ${
            value === option.value
              ? "bg-surface text-text shadow-[0_1px_3px_rgba(70,45,58,0.12)]"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          {option.icon && <Icon name={option.icon} size={13} />}
          {option.label}
        </button>
      ))}
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-text/30 p-0 backdrop-blur-[3px] md:items-center md:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className={`sheet-in flex max-h-[88dvh] w-full flex-col gap-4 overflow-auto rounded-t-[30px] border border-white/60 bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-float md:max-h-[85vh] md:rounded-[26px] md:p-6 ${
          wide ? "md:max-w-2xl" : "md:max-w-md"
        }`}
      >
        <div className="mx-auto h-1 w-9 rounded-full bg-border-strong md:hidden" />
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-[18px] font-bold tracking-[-0.025em] text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-soft text-text-secondary transition hover:text-text"
            aria-label="Close"
          >
            <Icon name="x" size={17} />
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
      <p className="text-[14px] leading-relaxed text-text-secondary">{description}</p>
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
