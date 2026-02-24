import { Link } from 'react-router-dom';

const tools = [
  {
    id: 'fluid-typography',
    name: 'Fluid Typography (clamp) 計算',
    description: '最小/最大フォントサイズとビューポートから clamp() CSS を生成'
  }
];

export function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand">OLEIN Tools Hub</p>
        <h1 className="text-3xl font-black leading-tight sm:text-4xl">制作・開発の小さな道具箱</h1>
        <p className="max-w-2xl text-sm text-gray-700 sm:text-base">
          日々使う計算・ジェネレータ系ツールを集約。MVPでは Fluid Typography ツールを提供します。
        </p>
      </header>

      <section>
        <h2 className="mb-4 text-lg font-bold">ツール一覧</h2>
        <ul className="grid gap-4">
          {tools.map((tool) => (
            <li key={tool.id}>
              <Link
                to={`/${tool.id}`}
                className="group block rounded-2xl border border-gray-300 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand hover:shadow-md"
              >
                <p className="text-xl font-bold text-ink transition group-hover:text-brand">{tool.name}</p>
                <p className="mt-2 text-sm text-gray-600">{tool.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
