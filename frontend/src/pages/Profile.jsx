import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage, userApi } from "../api/api.js";
import { Icon } from "../components/Icon.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import { Notice, PageHead, Select, Skeleton } from "../components/ui.jsx";
import { useAuth } from "../context/useAuth.js";
import { useTheme } from "../utils/theme.js";
import { requestLogout, toast } from "../utils/toast.js";

const BLOOD_GROUPS = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function Profile() {
  const { user, updateUser } = useAuth();
  const { isDark } = useTheme();
  const [state, setState] = useState({ profile: null, loading: true, error: "" });

  // Profile & emergency contact form state
  const [profileForm, setProfileForm] = useState({
    name: "",
    phone: "",
    bloodGroup: "",
    emergencyName: "",
    emergencyPhone: "",
    emergencyRelationship: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState(null);

  // Change password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState(null);

  useEffect(() => {
    let cancelled = false;
    userApi
      .getProfile()
      .then((res) => {
        if (!cancelled) {
          const fetched = res.data?.user || null;
          setState({ profile: fetched, loading: false, error: "" });
          if (fetched) {
            setProfileForm({
              name: fetched.name || "",
              phone: fetched.phone || "",
              bloodGroup: fetched.bloodGroup || "",
              emergencyName: fetched.emergencyContact?.name || "",
              emergencyPhone: fetched.emergencyContact?.phone || "",
              emergencyRelationship: fetched.emergencyContact?.relationship || "",
            });
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ profile: null, loading: false, error: errorMessage(err, "Failed to load profile.") });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { profile, loading, error } = state;
  const name = profile?.name || user?.name || "User";
  const email = profile?.email || user?.email || "";
  const role = profile?.role || user?.role || "tourist";

  async function onSaveProfile(e) {
    e.preventDefault();
    setProfileFeedback(null);

    if (!profileForm.name.trim()) {
      setProfileFeedback({ tone: "error", text: "Full name cannot be empty." });
      return;
    }

    setSavingProfile(true);
    try {
      const res = await userApi.updateProfile({
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim(),
        bloodGroup: profileForm.bloodGroup.trim(),
        emergencyContact: {
          name: profileForm.emergencyName.trim(),
          phone: profileForm.emergencyPhone.trim(),
          relationship: profileForm.emergencyRelationship.trim(),
        },
      });

      const updated = res.data?.user;
      setState((prev) => ({ ...prev, profile: updated }));
      if (updateUser && updated?.name) {
        updateUser({ name: updated.name });
      }
      setProfileFeedback({ tone: "ok", text: "Profile and emergency contacts saved successfully." });
      toast("Profile updated successfully");
    } catch (err) {
      setProfileFeedback({ tone: "error", text: errorMessage(err, "Failed to update profile.") });
    } finally {
      setSavingProfile(false);
    }
  }

  async function onChangePassword(e) {
    e.preventDefault();
    setPasswordFeedback(null);

    if (!passwordForm.currentPassword) {
      setPasswordFeedback({ tone: "error", text: "Please enter your current password." });
      return;
    }
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 8) {
      setPasswordFeedback({ tone: "error", text: "New password must be at least 8 characters long." });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordFeedback({ tone: "error", text: "New password and confirmation do not match." });
      return;
    }

    setSavingPassword(true);
    try {
      await userApi.updatePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordFeedback({ tone: "ok", text: "Password changed successfully." });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast("Password changed successfully");
    } catch (err) {
      setPasswordFeedback({ tone: "error", text: errorMessage(err, "Failed to change password.") });
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="page page-narrow">
      <PageHead eyebrow="Account" title={<>Your <em>profile.</em></>}>
        Manage your personal information, emergency contacts, and security settings.
      </PageHead>

      {error && <Notice tone="error">{error}</Notice>}

      {/* Account Overview Card */}
      <section className="card card-pad">
        <div className="profile-head">
          <span className="avatar avatar-lg" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
          <div>
            <h2>{name}</h2>
            <p>{email}</p>
          </div>
          <span className="chip" data-tone="ok"><i className="chip-dot" /> Active</span>
        </div>

        {loading ? (
          <div className="facts-skeleton"><Skeleton height={52} /><Skeleton height={52} /></div>
        ) : (
          <dl className="facts facts-grid">
            <div><dt>Full name</dt><dd>{name}</dd></div>
            <div><dt>Email</dt><dd>{email || "—"}</dd></div>
            <div>
              <dt>Phone</dt>
              <dd>
                {profile?.phone ? (
                  <a href={`tel:${profile.phone}`} className="inline-link">{profile.phone}</a>
                ) : (
                  <span style={{ color: "var(--muted)" }}>Not registered</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Blood group</dt>
              <dd>
                {profile?.bloodGroup ? (
                  <span className="chip" data-tone="critical"><i className="chip-dot" /> {profile.bloodGroup}</span>
                ) : (
                  <span style={{ color: "var(--muted)" }}>Not specified</span>
                )}
              </dd>
            </div>
            <div><dt>Role</dt><dd className="cap">{role}</dd></div>
            <div>
              <dt>Member since</dt>
              <dd>{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString([], { dateStyle: "medium" }) : "—"}</dd>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <dt>Emergency contact (next of kin)</dt>
              <dd>
                {profile?.emergencyContact?.name ? (
                  <span>
                    <strong>{profile.emergencyContact.name}</strong>
                    {profile.emergencyContact.relationship && ` (${profile.emergencyContact.relationship})`}
                    {profile.emergencyContact.phone && (
                      <> · <a href={`tel:${profile.emergencyContact.phone}`} className="inline-link">{profile.emergencyContact.phone}</a></>
                    )}
                  </span>
                ) : (
                  <span style={{ color: "var(--muted)" }}>
                    No emergency contact listed — add next of kin below for rapid responder contact during an SOS.
                  </span>
                )}
              </dd>
            </div>
          </dl>
        )}
      </section>

      {/* Edit Profile & Emergency Contacts Section */}
      <section className="card card-pad">
        <div style={{ marginBottom: 18 }}>
          <h2 className="card-title">Edit Profile & Emergency Contacts</h2>
          <p className="card-sub">
            This contact number and next-of-kin info are shared with responders and authorities when you trigger an emergency SOS.
          </p>
        </div>

        {profileFeedback && <Notice tone={profileFeedback.tone}>{profileFeedback.text}</Notice>}

        <form onSubmit={onSaveProfile} className="form-stack" style={{ marginTop: profileFeedback ? 16 : 0 }}>
          <div className="field-row">
            <label className="field">
              <span>Full Name</span>
              <input
                type="text"
                value={profileForm.name}
                onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Your full name"
                required
                maxLength={100}
                disabled={savingProfile || loading}
              />
            </label>

            <label className="field">
              <span>Your Phone Number</span>
              <input
                type="tel"
                value={profileForm.phone}
                onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+91 98765 43210"
                maxLength={25}
                disabled={savingProfile || loading}
              />
              <small>Used by responders to reach you directly.</small>
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span>Blood Group (optional)</span>
              <Select
                value={profileForm.bloodGroup}
                onChange={(e) => setProfileForm((f) => ({ ...f, bloodGroup: e.target.value }))}
                className="is-block"
                disabled={savingProfile || loading}
              >
                <option value="">Select blood group (optional)</option>
                {BLOOD_GROUPS.filter(Boolean).map((bg) => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </Select>
              <small>Displayed to medical responders on critical alerts.</small>
            </label>

            <label className="field">
              <span>Registered Email</span>
              <input
                type="email"
                value={email}
                disabled
                readOnly
                title="Email cannot be changed directly."
              />
              <small>Account login identity.</small>
            </label>
          </div>

          <div style={{ borderTop: "1px solid var(--line-2)", paddingTop: 18, marginTop: 4 }}>
            <h3 style={{ fontSize: "14.5px", fontWeight: 600, marginBottom: 12 }}>
              Next of Kin / Emergency Contact
            </h3>
            <div className="field-row">
              <label className="field">
                <span>Contact Name</span>
                <input
                  type="text"
                  value={profileForm.emergencyName}
                  onChange={(e) => setProfileForm((f) => ({ ...f, emergencyName: e.target.value }))}
                  placeholder="e.g. Priya Sharma"
                  maxLength={100}
                  disabled={savingProfile || loading}
                />
              </label>

              <label className="field">
                <span>Relationship</span>
                <input
                  type="text"
                  value={profileForm.emergencyRelationship}
                  onChange={(e) => setProfileForm((f) => ({ ...f, emergencyRelationship: e.target.value }))}
                  placeholder="e.g. Spouse, Parent, Sibling, Friend"
                  maxLength={50}
                  disabled={savingProfile || loading}
                />
              </label>
            </div>

            <label className="field" style={{ marginTop: 14 }}>
              <span>Emergency Contact Phone</span>
              <input
                type="tel"
                value={profileForm.emergencyPhone}
                onChange={(e) => setProfileForm((f) => ({ ...f, emergencyPhone: e.target.value }))}
                placeholder="+91 91234 56789"
                maxLength={25}
                disabled={savingProfile || loading}
              />
              <small>Phone number of family or close contact to notify in an emergency.</small>
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingProfile || loading}
            >
              <Icon name="check" size={16} />
              {savingProfile ? "Saving..." : "Save Profile & Contacts"}
            </button>
          </div>
        </form>
      </section>

      {/* Change Password Section */}
      <section className="card card-pad">
        <div style={{ marginBottom: 18 }}>
          <h2 className="card-title">Change Password</h2>
          <p className="card-sub">
            Update your account password. Must be at least 8 characters.
          </p>
        </div>

        {passwordFeedback && <Notice tone={passwordFeedback.tone}>{passwordFeedback.text}</Notice>}

        <form onSubmit={onChangePassword} className="form-stack" style={{ marginTop: passwordFeedback ? 16 : 0 }}>
          <label className="field">
            <span>Current Password</span>
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
              placeholder="Enter current password"
              required
              disabled={savingPassword}
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span>New Password</span>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
                placeholder="Min 8 characters"
                required
                minLength={8}
                disabled={savingPassword}
              />
            </label>

            <label className="field">
              <span>Confirm New Password</span>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                placeholder="Re-enter new password"
                required
                minLength={8}
                disabled={savingPassword}
              />
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button
              type="submit"
              className="btn btn-ghost"
              disabled={savingPassword}
            >
              <Icon name="lock" size={16} />
              {savingPassword ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </section>

      {/* App Preferences & Information */}
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
