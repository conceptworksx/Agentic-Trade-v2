import ResearchDashboardClient from "./ResearchDashboardClient";

interface PageProps {
  params: Promise<{ ticker: string }>;
}

export default async function ResearchPage({ params }: PageProps) {
  const resolvedParams = await params;
  return <ResearchDashboardClient ticker={resolvedParams.ticker} />;
}
