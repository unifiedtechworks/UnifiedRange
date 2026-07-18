"use client";

import { useState } from "react";

const defaultSettings = {
  defaultPassportVisibility: "private",
  allowPublicProfile: false,
  hideExactLocations: true,
  stripImageMetadata: true,
  hideAmmoLotNumbers: true,
  hidePurchaseDetails: true,
  hidePrivateNotes: true,
  requirePreviewBeforePublishing: true
};

export function PrivacySettingsPanel() {
  const [settings, setSettings] = useState(defaultSettings);
  const [message, setMessage] = useState("");

  function updateBoolean(key: keyof typeof defaultSettings, value: boolean) {
    setSettings((current) => ({ ...current, [key]: value }));
    setMessage("");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-moss/20 bg-field p-4">
        <h3 className="text-base font-bold text-ink">Private By Default</h3>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          UnifiedRange keeps records private by default. Public sharing creates a sanitized Public Passport, and users should not share serial numbers, exact locations, private purchase details, or sensitive personal information.
        </p>
      </section>

      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft">
        <label className="block">
          <span className="text-sm font-semibold text-ink">Default passport visibility</span>
          <select
            value={settings.defaultPassportVisibility}
            onChange={(event) => {
              setSettings((current) => ({ ...current, defaultPassportVisibility: event.target.value }));
              setMessage("");
            }}
            className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss"
          >
            <option value="private">Private</option>
            <option value="public">Public after preview</option>
          </select>
        </label>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Toggle label="Allow public profile" checked={settings.allowPublicProfile} onChange={(value) => updateBoolean("allowPublicProfile", value)} />
          <Toggle label="Hide exact locations" checked={settings.hideExactLocations} onChange={(value) => updateBoolean("hideExactLocations", value)} />
          <Toggle label="Strip image metadata before public sharing" checked={settings.stripImageMetadata} onChange={(value) => updateBoolean("stripImageMetadata", value)} />
          <Toggle label="Hide ammo lot numbers from public view" checked={settings.hideAmmoLotNumbers} onChange={(value) => updateBoolean("hideAmmoLotNumbers", value)} />
          <Toggle label="Hide purchase details from public view" checked={settings.hidePurchaseDetails} onChange={(value) => updateBoolean("hidePurchaseDetails", value)} />
          <Toggle label="Hide private notes from public view" checked={settings.hidePrivateNotes} onChange={(value) => updateBoolean("hidePrivateNotes", value)} />
          <Toggle label="Require preview before publishing Public Passport" checked={settings.requirePreviewBeforePublishing} onChange={(value) => updateBoolean("requirePreviewBeforePublishing", value)} />
        </div>
        <button
          type="button"
          onClick={() => {
            setMessage("Privacy settings saved locally for this browser. Account-backed preferences are not part of the hosted dev slice yet.");
          }}
          className="mt-5 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white"
        >
          Save local settings
        </button>
        {message ? <p className="mt-3 rounded-md border border-moss/25 bg-field px-4 py-3 text-sm font-semibold text-moss">{message}</p> : null}
      </section>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 rounded-md border border-ink/10 p-3">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 rounded border-ink/20 text-moss" />
      <span className="text-sm font-semibold text-ink">{label}</span>
    </label>
  );
}
