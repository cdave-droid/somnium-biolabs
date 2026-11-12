import type { Block } from '../technology/content';

// One block of a section: a paragraph, a list with bold lead-ins, or a titled subsection.
export default function SectionBlock({ block }: { block: Block }) {
  if (block.kind === 'list') {
    return (
      <ul className="list-disc pl-6 space-y-3 marker:text-gray-400">
        {block.items.map((item) => (
          <li key={item.lead} className="text-gray-700 leading-relaxed text-lg">
            <strong className="font-semibold text-gray-900">{item.lead}</strong> {item.text}
          </li>
        ))}
      </ul>
    );
  }
  if (block.kind === 'subsection') {
    return (
      <div className="pt-2">
        <h4 className="text-xl font-semibold text-gray-900">{block.title}</h4>
        <p className="mt-1 text-gray-600 italic">{block.tagline}</p>
        <p className="mt-3 text-gray-700 leading-relaxed text-lg">{block.text}</p>
      </div>
    );
  }
  if (block.kind === 'link') {
    return (
      <p className="text-gray-700 leading-relaxed text-lg">
        <a href={block.href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 font-medium underline underline-offset-4">{block.text}</a>{block.after}
      </p>
    );
  }
  return <p className="text-gray-700 leading-relaxed text-lg">{block.text}</p>;
}
