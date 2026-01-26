import { SubmissionDetailClient } from './SubmissionDetailClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SubmissionDetailPage({ params }: PageProps) {
  const { id } = await params;
  
  return <SubmissionDetailClient submissionId={id} />;
}
