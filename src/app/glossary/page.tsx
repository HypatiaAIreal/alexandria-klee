import { getGlossary } from "@/lib/data";
import GlossaryClient from "@/components/GlossaryClient";

export const metadata = { title: "Glossary" };
export const dynamic = "force-dynamic";

export default async function GlossaryPage() {
  const glossary = await getGlossary();
  return <GlossaryClient glossary={glossary} />;
}
