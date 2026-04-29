'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useStore, useStoreCompletion, useStorePhotos } from '@/lib/queries';

export default function CompletionPage() {
  const { id, storeId } = useParams<{ id: string; storeId: string }>();
  const { data: store } = useStore(storeId);
  const { data: completion, isLoading } = useStoreCompletion(storeId);
  const { data: photos = [] } = useStorePhotos(storeId);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!completion) {
    return (
      <section className="space-y-4">
        <Link href={`/maps/${id}`} className="text-sm text-muted-foreground hover:text-brand">
          ← Back to map
        </Link>
        <p className="text-sm text-muted-foreground">No completion yet for this store.</p>
      </section>
    );
  }

  const beforePhotos = photos.filter((p) => p.kind === 'before' && p.completionId === completion.id);
  const afterPhotos = photos.filter((p) => p.kind === 'after' && p.completionId === completion.id);

  return (
    <section className="space-y-6">
      <header>
        <Link href={`/maps/${id}`} className="text-sm text-muted-foreground hover:text-brand">
          ← Back to map
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {store?.storeNumber} — {store?.storeName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Completed by <strong>{completion.completedByName}</strong> on{' '}
          {new Date(completion.completedAt).toLocaleString(undefined, {
            timeZone: completion.deviceTimezone,
            dateStyle: 'medium',
            timeStyle: 'short',
          })}{' '}
          ({completion.deviceTimezone})
        </p>
      </header>

      <Section title="Counts">
        {Object.keys(completion.counts).length === 0 ? (
          <p className="text-sm text-muted-foreground">No count fields recorded.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {Object.entries(completion.counts).map(([k, v]) => (
              <div key={k} className="rounded-md border bg-muted px-3 py-2">
                <dt className="text-xs text-muted-foreground">{k.replace(/_/g, ' ')}</dt>
                <dd className="text-lg font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </Section>

      <Section title="General comments">
        {completion.generalComments ? (
          <p className="whitespace-pre-wrap rounded-md border bg-muted p-3 text-sm">
            {completion.generalComments}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No comments.</p>
        )}
      </Section>

      <Section title="Signature">
        {completion.signatureUrl ? (
          <img
            src={completion.signatureUrl}
            alt="Signature"
            className="h-40 w-auto rounded-md border bg-white"
          />
        ) : (
          <p className="text-sm text-muted-foreground">No signature on file.</p>
        )}
      </Section>

      <Section title={`Before photos (${beforePhotos.length})`}>
        <PhotoGrid photos={beforePhotos} />
      </Section>

      <Section title={`After photos (${afterPhotos.length})`}>
        <PhotoGrid photos={afterPhotos} />
      </Section>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function PhotoGrid({ photos }: { photos: { id: string; url: string; fieldName: string | null }[] }) {
  if (photos.length === 0) {
    return <p className="text-sm text-muted-foreground">None.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {photos.map((p) => (
        <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.url}
            alt={p.fieldName ?? 'photo'}
            className="aspect-square w-full rounded-md border object-cover"
          />
          {p.fieldName && (
            <p className="mt-1 truncate text-xs text-muted-foreground">{p.fieldName}</p>
          )}
        </a>
      ))}
    </div>
  );
}
