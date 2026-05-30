import { getGlossary } from "@/lib/data";
import GlossaryClient from "@/components/GlossaryClient";

export const metadata = { title: "Glossary" };

export default async function GlossaryPage() {
  const glossary = await getGlossary();
  return <GlossaryClient glossary={glossary} />;
}
