import { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/auth.store';
import { useWorkspaceStore } from '../../stores/workspace.store';
import { useUpdateProfile, useChangePassword } from '../../hooks/useAuthProfile';
import { useWorkCalendars } from '../../hooks/useWorkCalendars';
import { Button } from '../../components/ui';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);
  const { data: workspaceCalendars } = useWorkCalendars(currentWorkspace?.id);
  const { mutate: updateProfile, isPending: savingProfile, error: profileError } =
    useUpdateProfile();
  const { mutate: changePassword, isPending: savingPw, error: pwError } = useChangePassword();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [timezone, setTimezone] = useState(user?.timezone ?? '');
  const [workCalendarId, setWorkCalendarId] = useState<string>(user?.workCalendarId ?? '');
  const [standardRate, setStandardRate] = useState(
    user?.resourceStandardRatePerHour != null ? String(user.resourceStandardRatePerHour) : '',
  );
  const [overtimeRate, setOvertimeRate] = useState(
    user?.resourceOvertimeRatePerHour != null ? String(user.resourceOvertimeRatePerHour) : '',
  );
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMessage, setPwMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setTimezone(user.timezone ?? '');
      setWorkCalendarId(user.workCalendarId ?? '');
      setStandardRate(
        user.resourceStandardRatePerHour != null ? String(user.resourceStandardRatePerHour) : '',
      );
      setOvertimeRate(
        user.resourceOvertimeRatePerHour != null ? String(user.resourceOvertimeRatePerHour) : '',
      );
    }
  }, [user]);

  if (!user) {
    return <p className="text-gray-600">Not signed in.</p>;
  }

  const submitProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const std =
      standardRate.trim() === '' ? null : Number.parseFloat(standardRate.replace(',', '.'));
    const ot =
      overtimeRate.trim() === '' ? null : Number.parseFloat(overtimeRate.replace(',', '.'));
    updateProfile({
      displayName: displayName.trim(),
      timezone: timezone.trim() || undefined,
      workCalendarId: workCalendarId === '' ? null : workCalendarId,
      resourceStandardRatePerHour:
        standardRate.trim() === '' ? null : Number.isFinite(std) ? std : undefined,
      resourceOvertimeRatePerHour:
        overtimeRate.trim() === '' ? null : Number.isFinite(ot) ? ot : undefined,
    });
  };

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage(null);
    if (newPassword !== confirmPassword) {
      setPwMessage('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setPwMessage('New password must be at least 8 characters');
      return;
    }
    changePassword(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
          setPwMessage('Password updated');
        },
      },
    );
  };

  const profileErr =
    profileError && 'response' in profileError
      ? (profileError as { response?: { data?: { message?: string } } }).response?.data?.message
      : null;
  const passwordErr =
    pwError && 'response' in pwError
      ? (pwError as { response?: { data?: { message?: string } } }).response?.data?.message
      : (pwError as Error | null)?.message;

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Profile</h2>
        <p className="text-sm text-gray-600 mb-4">Name and timezone for your account.</p>
        <form onSubmit={submitProfile} className="max-w-md space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={user.email}
              disabled
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600"
            />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed here.</p>
          </div>
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
              Display name
            </label>
            <input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1">
              Timezone
            </label>
            <input
              id="timezone"
              placeholder="e.g. America/New_York"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="workCal" className="block text-sm font-medium text-gray-700 mb-1">
              Personal work calendar
            </label>
            <select
              id="workCal"
              value={workCalendarId}
              onChange={(e) => setWorkCalendarId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">None</option>
              {(workspaceCalendars ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Calendars from your current workspace ({currentWorkspace?.name ?? 'select a workspace'}
              ). Used for resource-style scheduling hints; project CPM uses the project calendar.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="stdRate" className="block text-sm font-medium text-gray-700 mb-1">
                Standard rate (per hour)
              </label>
              <input
                id="stdRate"
                type="number"
                min={0}
                step="0.01"
                placeholder="e.g. 120"
                value={standardRate}
                onChange={(e) => setStandardRate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="otRate" className="block text-sm font-medium text-gray-700 mb-1">
                Overtime rate (per hour)
              </label>
              <input
                id="otRate"
                type="number"
                min={0}
                step="0.01"
                placeholder="Optional"
                value={overtimeRate}
                onChange={(e) => setOvertimeRate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
          {profileErr && <p className="text-sm text-red-600">{String(profileErr)}</p>}
          <Button type="submit" disabled={savingProfile}>
            {savingProfile ? 'Saving…' : 'Save profile'}
          </Button>
        </form>
      </section>

      <section className="border-t border-gray-200 pt-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Password</h2>
        <p className="text-sm text-gray-600 mb-4">Change your login password.</p>
        <form onSubmit={submitPassword} className="max-w-md space-y-4">
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Current password
            </label>
            <input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              minLength={8}
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              minLength={8}
            />
          </div>
          {(passwordErr || pwMessage) && (
            <p className={`text-sm ${pwMessage && !passwordErr ? 'text-green-700' : 'text-red-600'}`}>
              {passwordErr || pwMessage}
            </p>
          )}
          <Button type="submit" variant="secondary" disabled={savingPw}>
            {savingPw ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </section>
    </div>
  );
}
