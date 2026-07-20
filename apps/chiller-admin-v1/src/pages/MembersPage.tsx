import { Pencil, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SectionCard from "../components/common/SectionCard";
import StatusPill from "../components/common/StatusPill";
import { getAdminSession } from "../services/adminAuth";
import {
  createAdminMember,
  deleteAdminMember,
  getAdminSite,
  listAdminMembers,
  updateAdminMember,
  type AdminMemberStatus,
  type AdminMember,
  type AdminRole,
  type AdminScopeType,
  type AdminSiteDetail
} from "../services/adminClient";

type DraftRecord = {
  userId: string;
  username: string;
  role: AdminRole;
  scopeType: AdminScopeType;
  scopeId: string;
  status: AdminMemberStatus;
};

const ROLE_LABELS: Record<AdminRole, string> = {
  platform_admin: "平台管理员",
  site_admin: "站点管理员",
  auditor: "审计员"
};

const SCOPE_TYPE_LABELS: Record<AdminScopeType, string> = {
  site: "站点范围",
  platform: "平台范围"
};

const MEMBER_STATUS_LABELS: Record<AdminMemberStatus, string> = {
  active: "已启用",
  invited: "已邀请",
  disabled: "已停用"
};

const emptyDraft: DraftRecord = {
  userId: "",
  username: "",
  role: "site_admin",
  scopeType: "site",
  scopeId: "",
  status: "active"
};

function toneForRole(role?: string): "good" | "warn" | "neutral" {
  if (role === "platform_admin") {
    return "good";
  }
  if (role === "auditor") {
    return "warn";
  }
  return "neutral";
}

export default function MembersPage() {
  const navigate = useNavigate();
  const { siteId = "" } = useParams();
  const session = getAdminSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [site, setSite] = useState<AdminSiteDetail | null>(null);
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftRecord>>({});
  const [newDraft, setNewDraft] = useState<DraftRecord>(emptyDraft);

  async function loadData() {
    if (!session || !siteId) {
      return;
    }
    setLoading(true);
    setErrorText("");
    try {
      const [siteRecord, memberRecords] = await Promise.all([
        getAdminSite(session.token, session.userId, siteId),
        listAdminMembers(session.token, session.userId, siteId)
      ]);
      setSite(siteRecord);
      setMembers(memberRecords);
      const nextDrafts: Record<string, DraftRecord> = {};
      memberRecords.forEach((member) => {
        nextDrafts[member.bindingId] = {
          userId: member.userId,
          username: member.username,
          role: member.role,
          scopeType: member.scopeType,
          scopeId: member.scopeId || siteId,
          status: member.status
        };
      });
      setDrafts(nextDrafts);
      setNewDraft((current) => ({
        ...current,
        scopeId: current.scopeType === "platform" ? "" : siteId
      }));
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "成员列表加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token, siteId]);

  const summary = useMemo(() => {
    const siteAdmins = members.filter((member) => member.role === "site_admin").length;
    const auditors = members.filter((member) => member.role === "auditor").length;
    return { siteAdmins, auditors };
  }, [members]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !siteId || saving) {
      return;
    }
    setSaving(true);
    setErrorText("");
    try {
      await createAdminMember(session.token, session.userId, siteId, {
        userId: newDraft.userId.trim(),
        username: newDraft.username.trim(),
        role: newDraft.role
      });
      setNewDraft(emptyDraft);
      await loadData();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "创建成员失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(member: AdminMember) {
    if (!session || !siteId || saving) {
      return;
    }
    const draft = drafts[member.bindingId];
    if (!draft) {
      return;
    }
    setSaving(true);
    setErrorText("");
    try {
      await updateAdminMember(session.token, session.userId, siteId, member.bindingId, {
        role: draft.role as AdminMember["role"]
      });
      await loadData();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "更新成员失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(member: AdminMember) {
    if (!session || !siteId || saving) {
      return;
    }
    if (!window.confirm(`确认删除成员 ${member.username} ?`)) {
      return;
    }
    setSaving(true);
    setErrorText("");
    try {
      await deleteAdminMember(session.token, session.userId, siteId, member.bindingId);
      await loadData();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "删除成员失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-page-stack">
      <SectionCard
        title="站点成员"
        headingLevel={2}
        action={
          <div className="admin-actions">
            <button className="admin-button" type="button" onClick={() => navigate(`/sites/${encodeURIComponent(siteId)}`)}>
              返回详情
            </button>
            <button className="admin-button" type="button" onClick={() => void loadData()}>
              <RefreshCw size={14} />
              刷新
            </button>
          </div>
        }
      >
        {loading ? (
          <div className="admin-loading-grid">
            <div className="admin-skeleton" />
            <div className="admin-skeleton" />
          </div>
        ) : (
          <div className="admin-section-stack">
            <div className="admin-chip-row">
              <StatusPill label={site?.siteName || siteId} tone="good" />
              <StatusPill label={`${members.length} 个成员`} tone="neutral" />
            </div>
            <div className="admin-summary-grid">
              <article className="admin-kpi">
                <span>站点管理员</span>
                <strong>{summary.siteAdmins}</strong>
              </article>
              <article className="admin-kpi">
                <span>审计员</span>
                <strong>{summary.auditors}</strong>
              </article>
            </div>

            {errorText ? <p className="admin-error">{errorText}</p> : null}

            <SectionCard title="新增成员" action={<Plus size={16} />}>
              <form className="admin-form" onSubmit={handleCreate}>
                <div className="admin-form-grid">
                  <label className="admin-field">
                    <span>用户 ID</span>
                    <input value={newDraft.userId} onChange={(event) => setNewDraft((current) => ({ ...current, userId: event.target.value }))} required />
                  </label>
                  <label className="admin-field">
                    <span>用户名</span>
                    <input value={newDraft.username} onChange={(event) => setNewDraft((current) => ({ ...current, username: event.target.value }))} required />
                  </label>
                  <label className="admin-field">
                    <span>角色</span>
                    <select
                      value={newDraft.role}
                      onChange={(event) =>
                        setNewDraft((current) => ({
                          ...current,
                          role: event.target.value as AdminRole
                        }))
                      }
                    >
                      <option value="site_admin">{ROLE_LABELS.site_admin}</option>
                      <option value="auditor">{ROLE_LABELS.auditor}</option>
                    </select>
                  </label>
                </div>
                <div className="admin-form-actions">
                  <button className="admin-button is-primary" type="submit" disabled={saving}>
                    <Save size={14} />
                    {saving ? "保存中..." : "新增成员"}
                  </button>
                </div>
              </form>
            </SectionCard>

            <SectionCard title="成员列表">
              {members.length > 0 ? (
                <div className="admin-table-shell" role="region" aria-label="站点成员权限表，可横向滚动查看更多字段" tabIndex={0}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>账号</th>
                        <th>角色</th>
                        <th>范围</th>
                        <th>状态</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((member) => {
                        const draft = drafts[member.bindingId] || {
                          userId: member.userId,
                          username: member.username,
                          role: member.role,
                          scopeType: member.scopeType,
                          scopeId: member.scopeId || siteId,
                          status: member.status
                        };
                        return (
                          <tr key={member.bindingId}>
                            <td>
                              <div className="admin-field-grid" style={{ gridTemplateColumns: "1fr", gap: 8 }}>
                                <input aria-label={`成员 ${member.username} 的用户名`} value={draft.username} onChange={(event) => setDrafts((current) => ({ ...current, [member.bindingId]: { ...draft, username: event.target.value } }))} />
                                <input aria-label={`成员 ${member.username} 的用户 ID`} value={draft.userId} onChange={(event) => setDrafts((current) => ({ ...current, [member.bindingId]: { ...draft, userId: event.target.value } }))} />
                              </div>
                            </td>
                            <td>
                              <select
                                aria-label={`成员 ${member.username} 的角色`}
                                value={draft.role}
                                onChange={(event) =>
                                  setDrafts((current) => ({
                                    ...current,
                                    [member.bindingId]: { ...draft, role: event.target.value as AdminRole }
                                  }))
                                }
                              >
                                <option value="platform_admin">{ROLE_LABELS.platform_admin}</option>
                                <option value="site_admin">{ROLE_LABELS.site_admin}</option>
                                <option value="auditor">{ROLE_LABELS.auditor}</option>
                              </select>
                            </td>
                            <td>
                              <div className="admin-field-grid" style={{ gridTemplateColumns: "1fr", gap: 8 }}>
                                <select
                                  aria-label={`成员 ${member.username} 的权限范围类型`}
                                  value={draft.scopeType}
                                  onChange={(event) =>
                                    setDrafts((current) => ({
                                      ...current,
                                      [member.bindingId]: {
                                        ...draft,
                                        scopeType: event.target.value as AdminScopeType,
                                        scopeId: event.target.value === "platform" ? "" : draft.scopeId || siteId
                                      }
                                    }))
                                  }
                                >
                                  <option value="site">{SCOPE_TYPE_LABELS.site}</option>
                                  <option value="platform">{SCOPE_TYPE_LABELS.platform}</option>
                                </select>
                                <input
                                  aria-label={`成员 ${member.username} 的范围 ID`}
                                  value={draft.scopeId}
                                  disabled={draft.scopeType === "platform"}
                                  onChange={(event) =>
                                    setDrafts((current) => ({
                                      ...current,
                                      [member.bindingId]: { ...draft, scopeId: event.target.value }
                                    }))
                                  }
                                />
                              </div>
                            </td>
                            <td>
                              <select
                                aria-label={`成员 ${member.username} 的状态`}
                                value={draft.status}
                                onChange={(event) =>
                                  setDrafts((current) => ({
                                    ...current,
                                    [member.bindingId]: { ...draft, status: event.target.value as AdminMemberStatus }
                                  }))
                                }
                              >
                                <option value="active">{MEMBER_STATUS_LABELS.active}</option>
                                <option value="invited">{MEMBER_STATUS_LABELS.invited}</option>
                                <option value="disabled">{MEMBER_STATUS_LABELS.disabled}</option>
                              </select>
                              <div className="admin-chip-row" style={{ marginTop: 8 }}>
                                <StatusPill label={ROLE_LABELS[member.role]} tone={toneForRole(member.role)} />
                              </div>
                            </td>
                            <td>
                              <div className="admin-table-actions">
                                <button className="admin-inline-action" type="button" onClick={() => void handleUpdate(member)} disabled={saving}>
                                  <Pencil size={14} />
                                  保存
                                </button>
                                <button className="admin-inline-action" type="button" onClick={() => void handleDelete(member)} disabled={saving}>
                                  <Trash2 size={14} />
                                  删除
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="admin-empty-state">当前站点还没有成员绑定。</div>
              )}
            </SectionCard>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
