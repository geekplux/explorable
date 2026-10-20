import type { ExplorableDoc } from '@kit/doc/types.ts';
import { samples, sourceChip } from '../samples/index.ts';

const thumbs = import.meta.glob<string>('../samples/thumbs/*.svg', { eager: true, query: '?url', import: 'default' });

export function SampleCard({ doc }: { doc: ExplorableDoc }) {
  return (
    <li className="card">
      <img src={thumbs[`../samples/thumbs/${doc.id}.svg`]} alt="" width={320} height={180} />
      <h3 className="card-title">
        <a href={`/s/${doc.id}`}>{doc.title}</a>
      </h3>
      <p className="card-dek">{doc.dek}</p>
      <p className="card-source">{sourceChip(doc.source)}</p>
    </li>
  );
}

export function SampleCards() {
  return (
    <ul className="cards">
      {samples.map((doc) => (
        <SampleCard key={doc.id} doc={doc} />
      ))}
    </ul>
  );
}
