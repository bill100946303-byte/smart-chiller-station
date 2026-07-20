import type { ReactNode } from "react";

export default function SectionCard({
  title,
  action,
  children,
  headingLevel = 3
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  headingLevel?: 2 | 3 | 4;
}) {
  const heading =
    headingLevel === 2 ? <h2>{title}</h2> : headingLevel === 4 ? <h4>{title}</h4> : <h3>{title}</h3>;

  return (
    <section className="section-card">
      <header className="section-card-header">
        {heading}
        {action ? <div className="section-action">{action}</div> : null}
      </header>
      <div className="section-card-body">{children}</div>
    </section>
  );
}
