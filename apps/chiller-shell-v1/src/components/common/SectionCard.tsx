import type { ReactNode } from "react";

export default function SectionCard({
  title,
  action,
  children
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="section-card">
      <header className="section-card-header">
        <h3>{title}</h3>
        {action ? <div className="section-action">{action}</div> : null}
      </header>
      <div className="section-card-body">{children}</div>
    </section>
  );
}
