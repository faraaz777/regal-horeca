'use client';

import { useRef, useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { adminFetch, adminJson } from '@/lib/client/adminFetch';

export default function AdminCompanyProfilePage() {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const { data, mutate, isLoading } = useSWR('/api/admin/company-profile', (url) =>
    adminJson(url)
  );

  const profile = data?.profile;

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please select a PDF file.');
      event.target.value = '';
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error('PDF must be 25MB or smaller.');
      event.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    const toastId = toast.loading('Uploading company profile…');

    try {
      const response = await adminFetch('/api/admin/company-profile', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      toast.success('Company profile updated');
      mutate();
    } catch (error) {
      toast.error(error.message || 'Failed to upload company profile');
    } finally {
      toast.dismiss(toastId);
      setUploading(false);
      event.target.value = '';
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Company Profile</h1>
        <p className="mt-2 text-sm text-gray-600">
          Upload the business profile PDF shown on the public site at{' '}
          <a href="/company-profile" target="_blank" rel="noopener noreferrer" className="text-accent underline">
            /company-profile
          </a>
          . Replacing the file updates what visitors see immediately.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Current PDF
        </h2>

        {isLoading ? (
          <p className="mt-4 text-sm text-gray-500">Loading…</p>
        ) : profile?.fileUrl ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-gray-800">
              <span className="font-medium">File:</span>{' '}
              {profile.originalFileName || 'company-profile.pdf'}
            </p>
            {profile.updatedAt && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Last updated:</span>{' '}
                {new Date(profile.updatedAt).toLocaleString()}
              </p>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href={profile.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                View PDF
              </a>
              <a
                href="/company-profile"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Open public page
              </a>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500">No company profile has been uploaded yet.</p>
        )}

        <div className="mt-8 border-t border-gray-100 pt-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? 'Uploading…' : profile ? 'Replace PDF' : 'Upload PDF'}
          </button>
          <p className="mt-3 text-xs text-gray-500">PDF only. Maximum size: 25MB.</p>
        </div>
      </div>
    </div>
  );
}
