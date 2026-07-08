import Link from 'next/link';
import { connectToDatabase } from '@/lib/db/connect';
import CompanyProfile from '@/lib/models/CompanyProfile';
import CompanyProfileViewer from './CompanyProfileViewer';

async function getActiveProfile() {
  try {
    await connectToDatabase();
    return CompanyProfile.findOne({ isActive: true })
      .sort({ createdAt: -1 })
      .select('fileUrl originalFileName')
      .lean();
  } catch (error) {
    console.error('Company profile page load failed:', error);
    return null;
  }
}

export default async function CompanyProfilePage() {
  const profile = await getActiveProfile();

  if (!profile?.fileUrl) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-semibold text-black">Company Profile</h1>
        <p className="mt-3 max-w-md text-sm text-black/60">
          The company profile is not available yet. Please check back soon.
        </p>
        <Link
          href="/"
          className="mt-8 rounded-md bg-accent px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-red-600"
        >
          Back to Home
        </Link>
      </main>
    );
  }

  const pdfSrc = `/api/attachment/proxy?src=${encodeURIComponent(profile.fileUrl)}`;
  const downloadSrc = `/api/attachment/proxy?download=1&src=${encodeURIComponent(profile.fileUrl)}`;

  return (
    <CompanyProfileViewer
      pdfSrc={pdfSrc}
      downloadSrc={downloadSrc}
      title={profile.originalFileName || 'Company Profile'}
    />
  );
}
