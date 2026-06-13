import { useId, type ReactNode } from "react";

export default function SectionCard({
  title,
  action,
  children
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();

  return (
    <section className="section-card" aria-labelledby={headingId}>
      <header className="section-card-header">
        <h3 id={headingId}>
          {title}
        </h3>
        {action ? <div className="section-action">{action}</div> : null}
      </header>
      <div className="section-card-body">{children}</div>
    </section>
  );
}
