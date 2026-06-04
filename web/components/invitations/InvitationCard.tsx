'use client';
import { useState } from 'react';

export function InvitationCard(props: {
  email: string;
  name: string;
  link: string;
  expiresAt: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(props.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const expires = new Date(props.expiresAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
        Invitation for {props.name}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{props.email}</p>
      <p className="mt-1 text-xs text-gray-400">Link expires {expires}</p>

      <div className="mt-3 flex gap-2">
        <input
          readOnly
          value={props.link}
          aria-label="Magic link"
          className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        />
        <button
          type="button"
          onClick={copy}
          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-500"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
        Paste this link into an email to {props.name}. They&apos;ll set a password and their
        account becomes active. This link is shown only once.
      </p>
    </div>
  );
}
