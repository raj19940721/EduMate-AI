import type { ReactNode } from "react";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps) {
  return (
    <main className="auth-screen">
      <div className="auth-shell-card">
        <div className="auth-shell-card__brand" aria-label="EduMate AI logo">
          <span className="brand-mark">E</span>
          <span>EduMate AI</span>
        </div>

        <div className="auth-card__header">
          <div className="auth-card__eyebrow">Welcome</div>
          <h2 className="auth-card__title">{title}</h2>
          <p className="auth-card__subtitle">{subtitle}</p>
        </div>

        {children}

        {footer && <div className="auth-card__footer">{footer}</div>}
      </div>
    </main>
  );
}
