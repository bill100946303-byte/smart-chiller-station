import { Building2, ChevronRight, Layers3, MapPinned, Orbit, Radar } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import StatusPill from "../components/common/StatusPill";
import { zhCN } from "../i18n/zhCN";
import { getAuthSession, getCurrentProject, selectAuthProject } from "../services/auth";

export default function ProjectSelectionPage() {
  const session = getAuthSession();
  const [searchParams] = useSearchParams();
  const currentProject = getCurrentProject(session);
  const projects = session?.projects || [];
  const [switchingProjectId, setSwitchingProjectId] = useState<string | null>(null);

  function handleProjectEnter(siteId: string) {
    if (switchingProjectId) {
      return;
    }

    setSwitchingProjectId(siteId);
    const nextSession = selectAuthProject(siteId);
    const redirectPath = searchParams.get("redirect");
    const nextPath =
      redirectPath && redirectPath.startsWith("/") && !redirectPath.startsWith("/projects")
        ? redirectPath
        : "/dashboard";

    if (!nextSession) {
      setSwitchingProjectId(null);
      return;
    }

    window.location.assign(nextPath);
  }

  return (
    <div className="project-switch-page page-enter">
      <section className="project-switch-hero">
        <div>
          <p className="project-switch-eyebrow">{zhCN.projectSwitcher.heading}</p>
          <h2>{zhCN.projectSwitcher.heading}</h2>
          <p>{zhCN.projectSwitcher.subtitle}</p>
        </div>
        <div className="project-switch-summary">
          <article>
            <span>{zhCN.projectSwitcher.summaryProjects}</span>
            <strong>{projects.length}</strong>
          </article>
          <article>
            <span>{zhCN.projectSwitcher.summaryCurrent}</span>
            <strong>{currentProject?.siteName || zhCN.appShell.projectPending}</strong>
          </article>
          <article>
            <span>{zhCN.projectSwitcher.summaryMode}</span>
            <strong>{zhCN.projectSwitcher.modeLive}</strong>
          </article>
        </div>
      </section>

      {projects.length > 0 ? (
        <section className="project-switch-grid">
          {projects.map((project) => {
            const isCurrent = currentProject?.siteId === project.siteId;
            const isSwitching = switchingProjectId === project.siteId;

            return (
              <article
                key={project.siteId}
                className={`project-switch-card${isCurrent ? " is-current" : ""}`}
              >
                <div className="project-switch-card-head">
                  <div>
                    <strong>{project.siteName}</strong>
                    <p>{project.siteCode || project.appExplain || zhCN.projectSwitcher.pendingHint}</p>
                  </div>
                  {isCurrent ? <StatusPill label={zhCN.projectSwitcher.currentTag} tone="good" /> : null}
                </div>

                <div className="project-switch-meta">
                  <span>
                    <Building2 size={14} />
                    {zhCN.projectSwitcher.siteIdLabel} · {project.siteId}
                  </span>
                  <span>
                    <MapPinned size={14} />
                    {zhCN.projectSwitcher.cityLabel} · {project.city || zhCN.common.unknown}
                  </span>
                  <span>
                    <Orbit size={14} />
                    {zhCN.projectSwitcher.modelLabel} · {project.modelKey || zhCN.common.unknown}
                  </span>
                  <span>
                    <Radar size={14} />
                    {zhCN.projectSwitcher.templateLabel} · {project.template || zhCN.common.unknown}
                  </span>
                </div>

                <button type="button" onClick={() => handleProjectEnter(project.siteId)} disabled={Boolean(switchingProjectId)}>
                  <Layers3 size={15} />
                  {isSwitching
                    ? zhCN.projectSwitcher.switching
                    : isCurrent
                      ? zhCN.projectSwitcher.enterAction
                      : zhCN.projectSwitcher.switchAction}
                  <ChevronRight size={15} />
                </button>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="section-card">
          <div className="section-card-header">
            <h3>{zhCN.projectSwitcher.emptyTitle}</h3>
          </div>
          <div className="section-card-body">
            <p>{zhCN.projectSwitcher.emptySubtitle}</p>
          </div>
        </section>
      )}
    </div>
  );
}
