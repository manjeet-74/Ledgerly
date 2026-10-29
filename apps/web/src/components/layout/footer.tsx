import { site, telHref } from '@/content/site';

export function Footer() {
  return (
    <footer className="border-t border-card-border px-4 py-6 text-xs text-text-dim md:px-6 print:hidden">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="break-words">{site.disclaimer}</p>
        <p className="flex flex-wrap gap-3">
          <a href={`mailto:${site.contactEmail}`} className="underline-offset-4 hover:underline">
            {site.contactEmail}
          </a>
          <a href={telHref(site.contactPhone)} className="underline-offset-4 hover:underline">
            {site.contactPhone}
          </a>
          <span>© {site.year} {site.name}</span>
        </p>
      </div>
    </footer>
  );
}
