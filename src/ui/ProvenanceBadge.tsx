import { PROVENANCE_LABEL } from '@/content/stations';
import type { Provenance } from '@/core/types';

export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const { label, description } = PROVENANCE_LABEL[provenance];
  return (
    <span className={`badge badge--${provenance}`} title={description}>
      {label}
    </span>
  );
}
