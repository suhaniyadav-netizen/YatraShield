import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage, userApi } from "../api/api.js";
import { Icon } from "../components/Icon.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import { Notice, PageHead, Skeleton } from "../components/ui.jsx";
import { useAuth } from "../context/useAuth.js";
import { useTheme } from "../utils/theme.js";
import { requestLogout, toast } from "../utils/toast.js";

export default function Profile() {
  const { user, updateUser } = useAuth();
  const { isDark } = useTheme();
  const [state, setState] = useState({ profile: null, loading: true, error: "" });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    userApi
      .getProfile()
      .then((res) => {
        if (!cancelled) {
          const u = res.data?.user || null;
          setState({ profile: u, loading: false, error: "" });
          if (u) setForm({ name: u.name || "", phone: u.phone || "" });
        }
      })
      .catch((err) => {
        if (!cancelled) setState({ profile: null, loading: false, error: errorMessage(err, "Failed to load profile.") });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { profile, loading, error } = state;
  const name = profile?.name || user?.name || "User";
  const email = profile?.email || user?.email || "";
  const phone = profile?.phone || user?.phone || "";
  const role = profile?.role || user?.role || "tourist";

  async function onSaveProfile(e) {
    e.preventDefault();
    setSaveError("");
    if (!form.name.trim()) return setSaveError("Name cannot be empty.");
    if (form.phone.trim() && !/^[+0-9\s\-()]{7,20}$/.test(form.phone.trim())) {
      return setSaveError("Please enter a valid phone number (7-20 digits).");
    }

    try {
      setSaving(true);
      const res = await userApi.updateProfile({
        name: form.name.trim(),
        phone: form.phone.trim(),
      });
      const updated = res.data?.user;
      if (updated) {
        setState((p) => ({ ...p, profile: { ...p.profile, ...updated } }));
        if (updateUser) updateUser(updated);
        toast("Profile updated successfully");
        setEditing(false);
      }
    } catch (err) {
      setSaveError(errorMessage(err, "Failed to update profile."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page page-narrow">
      <PageHead eyebrow="Account" title={<>Your <em>profile.</em></>}>
        Account information loaded from the server.
      </PageHead>

      {error && <Notice tone="error">{error}</Notice>}
      {saveError && <Notice tone="error">{saveError}</Notice>}

      <section className="card card-pad">
        <div className="profile-head">
          <span className="avatar avatar-lg" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
          <div>
            <h2>{name}</h2>
            <p>{email}</p>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            style={{ marginLeft: "auto" }}
            onClick={() => {
              setEditing(!editing);
              setSaveError("");
              setForm({ name, phone });
            }}
          >
            <Icon name={editing ? "x" : "edit"} size={14} />
            {editing ? "Cancel" : "Edit details"}
          </button>
        </div>

        {editing ? (
          <form onSubmit={onSaveProfile} className="form-stack" style={{ marginTop: 20 }}>
            <div className="field-row">
              <label className="field" htmlFor="prof-name">
                <span>Full name</span>
                <input
                  id="prof-name"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </label>
              <label className="field" htmlFor="prof-phone">
                <span>Emergency phone number</span>
                <input
                  id="prof-phone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </label>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        ) : loading ? (
          <div className="facts-skeleton"><Skeleton height={52} /><Skeleton height={52} /></div>
        ) : (
          <dl className="facts facts-grid">
            <div><dt>Full name</dt><dd>{name}</dd></div>
            <div><dt>Email</dt><dd>{email || "—"}</dd></div>
            <div>
              <dt>Phone (Emergency)</dt>
              <dd>
                {phone ? (
                  <a href={`tel:${phone}`} style={{ color: "inherit", textDecoration: "underline" }}>
                    {phone}
                  </a>
                ) : (
                  <span style={{ opacity: 0.6 }}>Not set — add for responders</span>
                )}
              </dd>
            </div>
            <div><dt>Role</dt><dd className="cap">{role}</dd></div>
            <div><dt>Member since</dt><dd>{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString([], { dateStyle: "medium" }) : "—"}</dd></div>
          </dl>
        )}
      </section>

      <section className="card">
        <ul className="settings">
          <li>
            <Icon name="moon" size={18} />
            <div><strong>Appearance</strong><span>Currently {isDark ? "dark" : "light"}. Follows your device until you change it.</span></div>
            <ThemeToggle />
          </li>
          <li>
            <Icon name="pin" size={18} />
            <div><strong>Location sharing</strong><span>Used to attach your position to reports.</span></div>
            <span className="chip" data-tone="ok"><i className="chip-dot" /> On report</span>
          </li>
          <li>
            <Icon name="bell" size={18} />
            <div><strong>Live notifications</strong><span>Real-time status updates while the app is open.</span></div>
            <span className="chip" data-tone="ok"><i className="chip-dot" /> On</span>
          </li>
          <li>
            <Icon name="guide" size={18} />
            <div><strong>Safety guide</strong><span>Tips and emergency numbers.</span></div>
            <Link to="/safety" className="btn btn-sm btn-ghost">Open</Link>
          </li>
        </ul>
      </section>

      <div className="profile-actions">
        <button type="button" className="btn btn-ghost" onClick={requestLogout}>
          <Icon name="logout" size={16} /> Log out
        </button>
      </div>

      <p className="fine-print left">
        <Icon name="lock" size={13} /> Location and incident data are only visible to the people involved in your safety response.
      </p>
    </div>
  );
}
