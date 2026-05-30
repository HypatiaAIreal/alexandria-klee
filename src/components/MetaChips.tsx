import type { ArticleMetadata } from "@/lib/types";
import {
  complexityLabel,
  contentTypeLabel,
  domainColor,
  domainLabel,
  COMPLEXITY_COLORS,
  tagLabel,
} from "@/lib/labels";

export function DomainChip({ domain }: { domain: string }) {
  const c = domainColor(domain);
  return (
    <span
      className="chip"
      style={{ borderColor: `${c}55`, color: c }}
      title="Bauhaus domain"
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {domainLabel(domain)}
    </span>
  );
}

export function ComplexityChip({ level }: { level: string }) {
  const c = COMPLEXITY_COLORS[level] ?? "#a99d88";
  return (
    <span className="chip" style={{ color: c }} title="Complexity level">
      {complexityLabel(level)}
    </span>
  );
}

export function ContentTypeChip({ type }: { type: string }) {
  return <span className="chip" title="Content type">{contentTypeLabel(type)}</span>;
}

export function MetaChips({ metadata }: { metadata: ArticleMetadata }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <DomainChip domain={metadata.bauhaus_domain} />
      <ContentTypeChip type={metadata.content_type} />
      <ComplexityChip level={metadata.complexity_level} />
      {metadata.has_diagrams && <span className="chip text-parchment-300">◊ diagrams</span>}
      {metadata.has_mathematical_notation && (
        <span className="chip text-parchment-300">∑ notation</span>
      )}
    </div>
  );
}

export function TagList({ tags }: { tags: string[] }) {
  if (!tags?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span key={t} className="chip text-parchment-300">
          #{tagLabel(t)}
        </span>
      ))}
    </div>
  );
}
