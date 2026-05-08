import { useState, useEffect } from "react";
import { getTraccarGroups, createTraccarGroup, updateTraccarGroup, deleteTraccarGroup } from "../services/traccarService";
import type { TraccarGroup } from "../types/user";
import StatCard from "./StatCard";
import EmptyState from "./EmptyState";

const GroupManagement = () => {
  const [groups, setGroups] = useState<TraccarGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TraccarGroup | null>(null);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "danger"; text: string } | null>(null);

  useEffect(() => { loadGroups(); }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const loadGroups = async () => {
    setLoading(true);
    try { setGroups(await getTraccarGroups()); } finally { setLoading(false); }
  };

  const handleOpenAdd = () => { setEditingGroup(null); setName(""); setNameError(""); setShowModal(true); };
  const handleOpenEdit = (g: TraccarGroup) => { setEditingGroup(g); setName(g.name); setNameError(""); setShowModal(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setNameError("Fleet name is required."); return; }
    setSaving(true);
    try {
      if (editingGroup) {
        await updateTraccarGroup(editingGroup.id, name.trim());
        setToast({ type: "success", text: "Fleet updated." });
      } else {
        await createTraccarGroup(name.trim());
        setToast({ type: "success", text: "Fleet created." });
      }
      setShowModal(false);
      await loadGroups();
    } catch { setToast({ type: "danger", text: "Failed to save fleet." }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (g: TraccarGroup) => {
    if (!confirm(`Delete fleet "${g.name}"?`)) return;
    try {
      await deleteTraccarGroup(g.id);
      setToast({ type: "success", text: "Fleet deleted." });
      await loadGroups();
    } catch { setToast({ type: "danger", text: "Failed to delete fleet." }); }
  };

  return (
    <div className="container-fluid p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">Fleet Management</h1>
        <button className="btn btn-primary" onClick={handleOpenAdd}>+ Add Fleet</button>
      </div>
      {toast && (
        <div className={`alert alert-${toast.type} alert-dismissible`} role="alert">
          {toast.text}<button type="button" className="btn-close" onClick={() => setToast(null)} />
        </div>
      )}
      <div className="row g-3 mb-4">
        <div className="col-4">
          <StatCard label="Total Fleets" value={groups.length} color="var(--c-accent)" />
        </div>
      </div>
      <div className="card">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5"><div className="spinner-border spinner-border-sm me-2" />Loading fleets…</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead><tr><th>Fleet Name</th><th>Actions</th></tr></thead>
                <tbody>
                  {groups.length === 0 ? (
                    <tr><td colSpan={2}>
                      <EmptyState
                        icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>}
                        title="No fleets yet"
                        message="Create a fleet to group devices and assign fleet managers."
                        action={{ label: "+ Add Fleet", onClick: handleOpenAdd }}
                      />
                    </td></tr>
                  ) : groups.map((g) => (
                    <tr key={g.id}>
                      <td className="fw-semibold">{g.name}</td>
                      <td>
                        <button className="btn btn-sm btn-outline-primary me-1" onClick={() => handleOpenEdit(g)}>Rename</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(g)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {showModal && (
        <>
          <div className="modal fade show" style={{ display: "block" }} tabIndex={-1}>
            <div className="modal-dialog">
              <div className="modal-content">
                <form onSubmit={handleSubmit}>
                  <div className="modal-header">
                    <h5 className="modal-title">{editingGroup ? "Rename Fleet" : "Add New Fleet"}</h5>
                    <button type="button" className="btn-close" onClick={() => setShowModal(false)} />
                  </div>
                  <div className="modal-body">
                    <label className="form-label fw-semibold">Fleet Name *</label>
                    <input className={`form-control ${nameError ? "is-invalid" : ""}`} value={name}
                      onChange={(e) => { setName(e.target.value); setNameError(""); }} placeholder="e.g. Karachi Fleet" autoFocus />
                    {nameError && <div className="invalid-feedback">{nameError}</div>}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : editingGroup ? "Save" : "Create Fleet"}</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setShowModal(false)} />
        </>
      )}
    </div>
  );
};

export default GroupManagement;
