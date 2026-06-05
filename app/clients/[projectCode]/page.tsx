import ClientWorkspace from "./ClientWorkspace";

interface Props {
  params: Promise<{ projectCode: string }>;
}

export default async function ClientPage({ params }: Props) {
  const { projectCode } = await params;
  return <ClientWorkspace projectCode={decodeURIComponent(projectCode)} />;
}
