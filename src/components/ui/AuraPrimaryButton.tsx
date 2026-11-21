"use client";

import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import type { MouseEventHandler, ReactNode } from "react";

type AuraPrimaryButtonProps = {
  label: string;
  href?: string;
  type?: "button" | "submit" | "reset";
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  loading?: boolean;
  size?: "compact" | "default" | "large";
  className?: string;
  icon?: ReactNode;
};

function ButtonContents({ label, loading, icon }: Pick<AuraPrimaryButtonProps, "label" | "loading" | "icon">) {
  return (
    <>
      <span className="aura-primary-track" aria-hidden="true" />
      <span className="aura-primary-icons" aria-hidden="true">
        <ArrowRight className="aura-primary-arrow" size={18} strokeWidth={2.2} />
        <img className="aura-primary-mark" src="/brand/mark-on-light.svg" alt="" />
      </span>
      <span className="aura-primary-label">{label}</span>
      {loading ? <Loader2 className="aura-primary-loading" size={15} aria-hidden="true" /> : icon ? <span className="aura-primary-extra" aria-hidden="true">{icon}</span> : null}
    </>
  );
}

export function AuraPrimaryButton({
  label,
  href,
  type = "button",
  onClick,
  disabled = false,
  loading = false,
  size = "default",
  className = "",
  icon,
}: AuraPrimaryButtonProps) {
  const classes = ["aura-primary-button", `aura-primary-button-${size}`, className].filter(Boolean).join(" ");

  if (href) {
    return <Link className={classes} href={href}><ButtonContents label={label} loading={loading} icon={icon} /></Link>;
  }

  return (
    <button
      className={classes}
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      <ButtonContents label={label} loading={loading} icon={icon} />
    </button>
  );
}
