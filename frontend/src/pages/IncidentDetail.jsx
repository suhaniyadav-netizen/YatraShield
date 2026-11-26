import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { errorMessage, incidentApi } from "../api/api.js";
import { subscribeToIncidentEvents } from "../api/socket.js";
import { Icon } from "../components/Icon.jsx";
import { useAuth } from "../context/useAuth.js";
import { Empty, Notice, PriorityChip, Select, Skeleton, StatusChip } from "../components/ui.jsx";
import { INCIDENT_EVENTS } from "../hooks/useIncidents.js";
import { GURUGRAM, incidentLatLng } from "../utils/geo.js";
import {
  NEXT_STATUSES, categoryLabel, formatCoordinates, formatTime, priorityTone, reportedByName, shortId, statusLabel,
} from "../utils/incidents.js";
import { toast } from "../utils/toast.js";

const MapView = lazy(() => import("../components/MapView.jsx"));

const FLOW = ["REPORTED", "TRIAGED", "ASSIGNED", "ACKNOWLEDGED", "EN_ROUTE", "ON_SITE", "RESOLVED", "CLOSED"];

// Keyed by id so navigating between incidents never flashes stale data.
export default function IncidentDetailRoute() {
  const { id } = useParams();
  return <IncidentDetail key={id} id={id} />;
}

function IncidentDetail({ id }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [state, setState] = useState({ incident: null, loading: true, error: "" });
  const [busy, setBusy] = useState(false);
  const [statusNote, setStatusNote] = useState("");
  const [noteText, setNoteText] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const { incident, loading, error } = state;

  const load = useCallback(async () => {
    try {
      const res = await incidentApi.getById(id);
      setState({ incident: res.data?.incident || null, loading: false, error: "" });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: errorMessage(err, "Incident not found or not accessible.") }));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let timer;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(load, 300);
    };
    const off = subscribeToIncidentEvents(Object.fromEntries(INCIDENT_EVENTS.map((e) => [e, schedule])));
    return () => {
      off();
      clearTimeout(timer);
    };
  }, [load]);

  async function onStatus(next) {
    if (!next || next === incident.status) return;
    setBusy(true);
    try {
      const res = await incidentApi.updateStatus(id, next, statusNote.trim());
      setState({ incident: res.data.incident, loading: false, error: "" });
      setStatusNote("");
      toast(`${shortId(incident)} → ${statusLabel(next)}`);
    } catch (err) {
      setState((s) => ({ ...s, error: errorMessage(err, "Update failed.") }));
    } finally {
      setBusy(false);
    }
  }

  async function onAddNote(e) {
    e?.preventDefault();
    if (!noteText.trim()) return;
    setSubmittingNote(true);
    try {
      const res = await incidentApi.addNote(id, noteText.trim());
      setState({ incident: res.data.incident, loading: false, error: "" });
      setNoteText("");
      toast("Note added to incident.");
    } catch (err) {
      setState((s) => ({ ...s, error: errorMessage(err, "Failed to add note.") }));
    } finally {
      setSubmittingNote(false);
    }
  }

  const position = incident ? incidentLatLng(incident) : null;
  const markers = useMemo(
    () =>
      incident && position
        ? [{
            id: incident._id,
            position,
            tone: priorityTone(incident.priority),
            kind: "incident",
            pulse: priorityTone(incident.priority) === "critical",
            label: `${shortId(incident)} location`,
          }]
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [incident?._id, incident?.priority, position?.[0], position?.[1]]
  );

  if (loading) {
    return (
      <div className="page" aria-busy="true">
        <Skeleton height={16} width={90} />
        <Skeleton height={44} width="min(460px, 80%)" style={{ marginTop: 16 }} />
        <div className="detail-grid" style={{ marginTop: 24 }}>
          <Skeleton height={380} />
          <Skeleton height={380} />
        </div>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="page">
        <Empty
          icon="clock"
          title="Incident not found"
          action={<Link to="/incidents" className="btn btn-primary">Back to incidents</Link>}
        >
          {error || "It may have been deleted, or you don’t have access."}
        </Empty>
      </div>
    );
  }

  const currentIdx = FLOW.indexOf(incident.status);
  const next = NEXT_STATUSES[incident.status] || [];
  const escalated = incident.status === "ESCALATED";
  const reporter = typeof incident.reportedBy === "object" ? incident.reportedBy : null;
  const isSos =
    Boolean(incident.description?.toUpperCase().includes("SOS")) ||
    incident.priority === "critical";

  return (
    <div className="page">
      <header className="page-head detail-head">
        <div className="page-head-copy">
          <button type="button" className="back-link" onClick={() => navigate(-1)}>
            <Icon name="arrowLeft" size={15} /> Back
          </button>
          <p className="eyebrow mono">{shortId(incident)}</p>
          <h1>{categoryLabel(incident.category)}</h1>
          <p className="page-head-sub">{formatTime(incident)}</p>
        </div>
        <div className="page-head-actions chips">
          <PriorityChip priority={incident.priority} />
          <StatusChip status={incident.status} />
        </div>
      </header>

      {error && <Notice tone="error">{error}</Notice>}

      <div className="detail-grid">
        <div className="stack">
          <section className="card map-card" aria-label="Location">
            <div className="map-stage is-medium">
              <Suspense fallback={<Skeleton height="100%" style={{ position: "absolute", inset: 0 }} />}>
                <MapView
                  className="map-fill"
                  markers={markers}
                  initialCenter={position || GURUGRAM}
                  zoom={15}
                  fit
                  label="Incident location"
                />
              </Suspense>
              <div className="map-note">
                <Icon name="pin" size={16} />
                <div><strong>Reported location</strong><span className="mono">{formatCoordinates(incident)}</span></div>
              </div>
            </div>
          </section>

          {/* Emergency Contact & Next of Kin Card for Responders on SOS */}
          {user?.role !== "tourist" && isSos && (
            <section className="card card-pad" style={{ borderLeft: "4px solid var(--signal)" }} aria-label="Emergency Contacts">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="chip" data-tone="critical">
                    <Icon name="beacon" size={13} /> Emergency SOS Contact
                  </span>
                  <h2 className="card-title" style={{ margin: 0 }}>Tourist & Next of Kin</h2>
                </div>
                {reporter?.bloodGroup && (
                  <span className="chip" data-tone="critical">
                    Blood Group: <strong>{reporter.bloodGroup}</strong>
                  </span>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
                {/* Tourist Direct Contact */}
                <div style={{ padding: "14px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line-2)", background: "var(--paper-2)" }}>
                  <small style={{ color: "var(--muted)", display: "block", fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                    Tourist Direct Line
                  </small>
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div>
                      <strong style={{ fontSize: "15px", display: "block" }}>{reporter?.name || reportedByName(incident)}</strong>
                      <span className="mono" style={{ fontSize: "14px", color: reporter?.phone ? "var(--ink)" : "var(--muted)" }}>
                        {reporter?.phone || "No direct phone provided"}
                      </span>
                    </div>
                    {reporter?.phone && (
                      <a href={`tel:${reporter.phone}`} className="btn btn-sm btn-signal" title={`Call ${reporter.name || "tourist"}`}>
                        <Icon name="phone" size={14} /> Call Tourist
                      </a>
                    )}
                  </div>
                </div>

                {/* Emergency Contact (Next of Kin) */}
                <div style={{ padding: "14px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line-2)", background: "var(--paper-2)" }}>
                  <small style={{ color: "var(--muted)", display: "block", fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                    Emergency Contact (Next of Kin)
                  </small>
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div>
                      <strong style={{ fontSize: "15px", display: "block" }}>
                        {reporter?.emergencyContact?.name || "No next of kin listed"}
                        {reporter?.emergencyContact?.relationship && (
                          <span style={{ fontSize: "13px", fontWeight: "normal", color: "var(--muted)" }}>
                            {" "}({reporter.emergencyContact.relationship})
                          </span>
                        )}
                      </strong>
                      <span className="mono" style={{ fontSize: "14px", color: reporter?.emergencyContact?.phone ? "var(--ink)" : "var(--muted)" }}>
                        {reporter?.emergencyContact?.phone || "No emergency phone provided"}
                      </span>
                    </div>
                    {reporter?.emergencyContact?.phone && (
                      <a href={`tel:${reporter.emergencyContact.phone}`} className="btn btn-sm btn-signal" title={`Call ${reporter.emergencyContact.name || "emergency contact"}`}>
                        <Icon name="phone" size={14} /> Call Contact
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="card card-pad">
            <h2 className="card-title">Description</h2>
            <p className="prose">{incident.description}</p>
            <dl className="facts">
              <div><dt>Reported by</dt><dd>{reportedByName(incident)}</dd></div>
              {reporter?.phone && (
                <div>
                  <dt>Tourist phone</dt>
                  <dd>
                    <a
                      href={`tel:${reporter.phone}`}
                      className="btn btn-sm btn-primary"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", marginTop: 4 }}
                    >
                      <Icon name="phone" size={14} /> Call ({reporter.phone})
                    </a>
                  </dd>
                </div>
              )}
              {reporter?.bloodGroup && (
                <div>
                  <dt>Blood group</dt>
                  <dd><span className="chip" data-tone="critical">{reporter.bloodGroup}</span></dd>
                </div>
              )}
              <div>
                <dt>Responder</dt>
                <dd>
                  {incident.assignedResponder?.name || "Unassigned"}
                  {incident.assignedResponder?.phone && (
                    <a
                      href={`tel:${incident.assignedResponder.phone}`}
                      style={{ marginLeft: 8, fontSize: 13, textDecoration: "underline" }}
                    >
                      ({incident.assignedResponder.phone})
                    </a>
                  )}
                </dd>
              </div>
              {incident.assignedAt && <div><dt>Assigned</dt><dd>{new Date(incident.assignedAt).toLocaleString()}</dd></div>}
            </dl>
          </section>

          <section className="card card-pad">
            <h2 className="card-title">Status Notes & Updates</h2>
            {incident.statusNotes && incident.statusNotes.length > 0 ? (
              <ul className="settings" style={{ marginTop: 12 }}>
                {incident.statusNotes.map((entry, idx) => (
                  <li key={entry._id || idx} style={{ alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span className="chip" data-tone="neutral"><i className="chip-dot" /> {statusLabel(entry.status)}</span>
                        <small className="mono" style={{ color: "var(--faint)", fontSize: "11.5px" }}>
                          {formatTime({ createdAt: entry.addedAt })}
                        </small>
                      </div>
                      <p className="prose" style={{ marginTop: 8, fontSize: "14px" }}>{entry.note}</p>
                      {entry.addedBy && (
                        <small style={{ color: "var(--muted)", display: "block", marginTop: 4 }}>
                          — {entry.addedBy.name || entry.addedBy.email || "Staff"} ({entry.addedBy.role || "staff"})
                        </small>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : incident.notes ? (
              <p className="prose" style={{ marginTop: 8 }}>{incident.notes}</p>
            ) : (
              <p style={{ color: "var(--muted)", fontSize: "14px", marginTop: 12 }}>No progress or resolution notes recorded yet.</p>
            )}

            {user?.role !== "tourist" && (
              <form onSubmit={onAddNote} style={{ marginTop: 18, display: "grid", gap: 10 }}>
                <input
                  type="text"
                  placeholder="Post a progress update or note..."
                  value={noteText}
                  disabled={submittingNote}
                  onChange={(e) => setNoteText(e.target.value)}
                  maxLength={2000}
                />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button type="submit" className="btn btn-sm btn-ghost" disabled={submittingNote || !noteText.trim()}>
                    {submittingNote ? "Posting..." : "Add Note"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>

        <div className="stack">
          <section className="card card-pad">
            <h2 className="card-title">Progress</h2>
            <ol className="timeline">
              {FLOW.map((s, i) => {
                if (s === "CLOSED" && incident.status !== "CLOSED" && currentIdx < FLOW.indexOf("RESOLVED")) return null;
                const done = currentIdx !== -1 && i < currentIdx;
                const current = s === incident.status;
                return (
                  <li key={s} className={`tl ${done ? "is-done" : ""} ${current ? "is-current" : ""}`}>
                    <span className="tl-dot">{done ? <Icon name="check" size={11} strokeWidth={2.6} /> : null}</span>
                    <div>
                      <strong>{statusLabel(s)}</strong>
                      <small>{current ? "Current status" : done ? "Completed" : "Pending"}</small>
                    </div>
                  </li>
                );
              })}
            </ol>
            {escalated && (
              <p className="callout" data-tone="critical">
                This incident was escalated and is waiting to be re-triaged or reassigned.
              </p>
            )}

            {next.length > 0 && user?.role !== "tourist" && (
              <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
                <label className="field field-tight">
                  <span>Advance status</span>
                  <Select value={incident.status} disabled={busy} onChange={(e) => onStatus(e.target.value)} className="is-block">
                    <option value={incident.status}>{statusLabel(incident.status)}</option>
                    {next.map((s) => <option key={s} value={s}>→ {statusLabel(s)}</option>)}
                  </Select>
                </label>
                <input
                  type="text"
                  placeholder="Resolution remarks or transition note (optional)..."
                  value={statusNote}
                  disabled={busy}
                  onChange={(e) => setStatusNote(e.target.value)}
                  maxLength={2000}
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
