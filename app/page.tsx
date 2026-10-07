import WorkLab from "@/components/lab/work-lab";
import { redirect } from "next/navigation";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const query = await searchParams;
  if (query.run) redirect("/analyses?run=" + encodeURIComponent(query.run));
  return <WorkLab />;
}
