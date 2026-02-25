import { Link } from 'react-router-dom';
import { Seo } from '../seo/Seo';
import { PAGE_SEO } from '../seo/meta';

const tools = [
  {
    id: 'fluid-typography',
    name: 'Fluid Typography (clamp) Calculator',
    description: 'Generate clamp() CSS from min/max font sizes and viewport widths'
  }
];

export function HomePage() {
  return (
    <>
      <Seo meta={PAGE_SEO.home} />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-8 pt-24 sm:px-6 sm:pb-12 sm:pt-28">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">OLEIN Tools Hub</p>
          <h1 className="text-3xl font-black leading-tight sm:text-4xl">A compact toolbox for design and development</h1>
          <p className="max-w-2xl text-sm text-muted sm:text-base">
            A focused set of daily calculators and generators. The MVP currently ships with a Fluid Typography tool.
          </p>
        </header>

        <section>
          <h2 className="mb-4 text-lg font-bold">Tools</h2>
          <ul className="grid gap-4">
            {tools.map((tool) => (
              <li key={tool.id}>
                <Link
                  to={`/${tool.id}`}
                  className="glass-panel group block rounded-2xl p-5 hover:-translate-y-0.5 hover:border-accent hover:shadow-md dark:hover:shadow-[0_24px_48px_-30px_rgba(0,0,0,0.95)]"
                >
                  <p className="text-xl font-bold text-ink transition group-hover:text-brand">{tool.name}</p>
                  <p className="mt-2 text-sm text-muted">{tool.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
