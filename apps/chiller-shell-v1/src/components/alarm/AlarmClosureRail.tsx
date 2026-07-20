import { Link } from "react-router-dom";
import "./AlarmClosureRail.css";

type AlarmClosureRailProps = {
  dataReady: boolean;
  activeCount: number | null;
  recoveredHistoryCount: number;
  draftPath: string | null;
  siteId: string;
};

type ClosureStage = {
  key: string;
  label: string;
  title: string;
  detail: string;
  tone: "complete" | "action" | "unknown";
};

export default function AlarmClosureRail({
  dataReady,
  activeCount,
  recoveredHistoryCount,
  draftPath,
  siteId
}: AlarmClosureRailProps) {
  const stages: ClosureStage[] = [
    {
      key: "detect",
      label: "01 发现",
      title: dataReady ? "告警链路已读取" : "告警链路待恢复",
      detail: dataReady ? "已取得当前摘要或历史事件。" : "未取得可靠数据，不能判定无告警。",
      tone: dataReady ? "complete" : "unknown"
    },
    {
      key: "confirm",
      label: "02 确认",
      title: !dataReady ? "现场状态待确认" : (activeCount || 0) > 0 ? `${activeCount} 条活跃告警待确认` : "当前摘要未发现活跃告警",
      detail: "必须核对联锁、保护、点位质量和现场设备状态。",
      tone: !dataReady ? "unknown" : (activeCount || 0) > 0 ? "action" : "complete"
    },
    {
      key: "handle",
      label: "03 派单 / 处置",
      title: draftPath ? "可建立工单草稿" : "工单关联待建立",
      detail: "告警上下文仅用于预填，提交仍需人工补全并确认。",
      tone: draftPath ? "action" : "unknown"
    },
    {
      key: "verify",
      label: "04 复核 / 关闭",
      title: recoveredHistoryCount > 0 ? `${recoveredHistoryCount} 条恢复记录待证据复核` : "关闭证据待关联",
      detail: "告警恢复不等于闭环；需关联趋势、现场确认和工单结果。",
      tone: recoveredHistoryCount > 0 ? "action" : "unknown"
    }
  ];

  return (
    <section className="alarm-closure-panel" aria-labelledby="alarm-closure-title">
      <header className="alarm-closure-header">
        <div>
          <h3 id="alarm-closure-title">告警处置闭环</h3>
          <p>发现 → 现场确认 → 工单处置 → 复核关闭；每一步保留证据，不把“恢复”误当作“已关闭”。</p>
        </div>
        <div className="alarm-closure-header-actions">
          <span className="alarm-closure-safety">安全边界：不在告警页直接下发控制</span>
          <div className="alarm-closure-actions">
            {draftPath ? <Link className="alarm-closure-link" to={draftPath}>带入工单草稿</Link> : null}
            <Link className="alarm-closure-link" to={`/operation-records?siteId=${encodeURIComponent(siteId)}`}>
              查看操作记录
            </Link>
          </div>
        </div>
      </header>
      <div className="alarm-closure-grid">
        {stages.map((stage) => (
          <article key={stage.key} className={`alarm-closure-stage is-${stage.tone}`} data-closure-stage={stage.key}>
            <span>{stage.label}</span>
            <strong>{stage.title}</strong>
            <small>{stage.detail}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
