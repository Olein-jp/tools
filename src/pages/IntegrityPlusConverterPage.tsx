import { Copy, Eraser, Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Seo } from '../seo/Seo';
import { PAGE_SEO } from '../seo/meta';

type ParsedTable = {
  headers: string[];
  rows: string[][];
};

type DetectionResult =
  | {
      format: 'csv';
      delimiter: string;
    }
  | {
      format: 'unsupported-xml';
    };

const DELIMITER_CANDIDATES = [',', '\t', ';'] as const;

function normalizeCell(value: string): string {
  return value.replace(/\t/g, ' ').replace(/\r?\n/g, ' ').trim();
}

function toTsv(table: ParsedTable): string {
  const lines = [table.headers, ...table.rows].map((row) => row.map((cell) => normalizeCell(cell)).join('\t'));
  return lines.join('\n');
}

function removeLastModifiedColumn(table: ParsedTable): ParsedTable {
  const targetIndexes = table.headers
    .map((header, index) => ({ header: header.trim().toLowerCase(), index }))
    .filter(({ header }) => header === 'last modified' || header === 'lastmod')
    .map(({ index }) => index);

  if (targetIndexes.length === 0) {
    return table;
  }

  const shouldDrop = new Set(targetIndexes);
  return {
    headers: table.headers.filter((_, index) => !shouldDrop.has(index)),
    rows: table.rows.map((row) => row.filter((_, index) => !shouldDrop.has(index)))
  };
}

function localizeHeader(header: string): string {
  const normalized = header.trim().toLowerCase();
  const map: Record<string, string> = {
    title: 'タイトル',
    url: 'URL',
    loc: 'URL',
    url_part1: '第1階層',
    url_part2: '第2階層',
    url_part3: '第3階層',
    url_part4: '第4階層',
    url_part_1: '第1階層',
    url_part_2: '第2階層',
    url_part_3: '第3階層',
    url_part_4: '第4階層'
  };

  return map[normalized] ?? header;
}

function localizeHeaders(table: ParsedTable): ParsedTable {
  return {
    headers: table.headers.map((header) => localizeHeader(header)),
    rows: table.rows
  };
}

function findUrlColumnIndex(table: ParsedTable): number {
  const headerMatch = table.headers.findIndex((header) => {
    const normalized = header.trim().toLowerCase();
    return normalized === 'loc' || normalized === 'url' || normalized === 'address';
  });

  if (headerMatch >= 0) {
    return headerMatch;
  }

  const sampleRows = table.rows.slice(0, 30);
  const maxWidth = Math.max(table.headers.length, ...sampleRows.map((row) => row.length));

  for (let columnIndex = 0; columnIndex < maxWidth; columnIndex += 1) {
    const hitCount = sampleRows.filter((row) => /^https?:\/\//i.test((row[columnIndex] ?? '').trim())).length;
    if (hitCount >= Math.max(1, Math.floor(sampleRows.length * 0.5))) {
      return columnIndex;
    }
  }

  return -1;
}

function splitUrlParts(value: string): string[] {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return [];
  }

  try {
    const parsed = new URL(trimmed);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    return [parsed.host, ...pathParts];
  } catch {
    const protocolRemoved = trimmed.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    return protocolRemoved.length > 0 ? protocolRemoved.split('/').filter(Boolean) : [];
  }
}

function stripExistingUrlPartColumns(table: ParsedTable): ParsedTable {
  const shouldRemoveByIndex = new Set<number>();

  table.headers.forEach((header, index) => {
    const normalized = header.trim().toLowerCase();
    if (/^url_part_?\d+$/.test(normalized)) {
      shouldRemoveByIndex.add(index);
      return;
    }

    if (/^第\d+階層$/.test(header.trim())) {
      shouldRemoveByIndex.add(index);
    }
  });

  if (shouldRemoveByIndex.size === 0) {
    return table;
  }

  return {
    headers: table.headers.filter((_, index) => !shouldRemoveByIndex.has(index)),
    rows: table.rows.map((row) => row.filter((_, index) => !shouldRemoveByIndex.has(index)))
  };
}

function appendUrlSplitColumns(table: ParsedTable): ParsedTable {
  const cleaned = stripExistingUrlPartColumns(table);
  const urlColumnIndex = findUrlColumnIndex(cleaned);
  if (urlColumnIndex < 0) {
    return cleaned;
  }

  const splitPartsByRow = cleaned.rows.map((row) => splitUrlParts(row[urlColumnIndex] ?? ''));
  const maxParts = Math.max(0, ...splitPartsByRow.map((parts) => parts.length));

  if (maxParts === 0) {
    return cleaned;
  }

  const extraHeaders = Array.from({ length: maxParts }, (_, index) => `url_part${index + 1}`);
  const rows = cleaned.rows.map((row, rowIndex) => {
    const parts = splitPartsByRow[rowIndex];
    const padded = Array.from({ length: maxParts }, (_, index) => parts[index] ?? '');
    return [...row, ...padded];
  });

  return {
    headers: [...cleaned.headers, ...extraHeaders],
    rows
  };
}

function parseDelimited(input: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const current = input[i];
    const next = input[i + 1];

    if (current === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && current === delimiter) {
      row.push(field);
      field = '';
      continue;
    }

    if (!inQuotes && (current === '\n' || current === '\r')) {
      if (current === '\r' && next === '\n') {
        i += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += current;
  }

  const hasRemainder = field.length > 0 || row.length > 0;
  if (hasRemainder) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

function scoreDelimiter(rows: string[][]): number {
  if (rows.length === 0) {
    return -1;
  }

  const widths = rows.slice(0, 50).map((row) => row.length);
  const maxWidth = Math.max(...widths);
  if (maxWidth <= 1) {
    return -1;
  }

  const widthCounts = new Map<number, number>();
  widths.forEach((width) => {
    widthCounts.set(width, (widthCounts.get(width) ?? 0) + 1);
  });

  const consistent = Math.max(...Array.from(widthCounts.values()));
  return maxWidth * 10 + consistent;
}

function detectCsvDelimiter(input: string): string {
  let bestDelimiter = ',';
  let bestScore = -1;

  DELIMITER_CANDIDATES.forEach((candidate) => {
    const rows = parseDelimited(input, candidate);
    const score = scoreDelimiter(rows);
    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = candidate;
    }
  });

  return bestDelimiter;
}

function detectFormat(input: string): DetectionResult {
  const trimmed = input.trim();
  if (trimmed.startsWith('<')) {
    return { format: 'unsupported-xml' };
  }

  return { format: 'csv', delimiter: detectCsvDelimiter(input) };
}

function parseCsv(input: string, delimiter: string): ParsedTable {
  const rows = parseDelimited(input, delimiter);
  if (rows.length === 0) {
    throw new Error('CSVの行が見つかりませんでした。');
  }

  const [rawHeaders, ...rawRows] = rows;
  const width = Math.max(rawHeaders.length, ...rawRows.map((row) => row.length));

  const headers = Array.from({ length: width }, (_, index) => rawHeaders[index] ?? `column_${index + 1}`);
  const normalizedRows = rawRows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ''));

  return { headers, rows: normalizedRows };
}

function delimiterLabel(delimiter: string): string {
  if (delimiter === '\t') {
    return 'Tab';
  }
  if (delimiter === ';') {
    return 'Semicolon';
  }
  return 'Comma';
}

export function IntegrityPlusConverterPage() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [detected, setDetected] = useState<string>('未判定');
  const [rowCount, setRowCount] = useState(0);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const canGenerate = input.trim().length > 0;
  const canCopy = output.length > 0;
  const outputStats = useMemo(() => `${rowCount.toLocaleString()} 行`, [rowCount]);

  const handleGenerate = () => {
    setCopied(false);
    setError('');

    if (!canGenerate) {
      setError('入力テキストを貼り付けてください。');
      setOutput('');
      setDetected('未判定');
      setRowCount(0);
      return;
    }

    try {
      const detection = detectFormat(input);
      if (detection.format === 'unsupported-xml') {
        throw new Error('XMLは現在サポート対象外です。CSVを入力してください。');
      }

      const parsedTable = parseCsv(input, detection.delimiter);
      const withUrlParts = appendUrlSplitColumns(parsedTable);
      const withoutLastModified = removeLastModifiedColumn(withUrlParts);
      const table = localizeHeaders(withoutLastModified);
      const tsv = toTsv(table);

      setOutput(tsv);
      setRowCount(table.rows.length);

      setDetected(`CSV (${delimiterLabel(detection.delimiter)})`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '変換中に不明なエラーが発生しました。';
      setError(message);
      setOutput('');
      setDetected('判定失敗');
      setRowCount(0);
    }
  };

  const handleCopy = async () => {
    if (!canCopy) {
      return;
    }

    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
      setError('クリップボードへのコピーに失敗しました。ブラウザ権限を確認してください。');
    }
  };

  const handleClear = () => {
    setInput('');
    setOutput('');
    setDetected('未判定');
    setRowCount(0);
    setError('');
    setCopied(false);
  };

  return (
    <>
      <Seo meta={PAGE_SEO.integrityPlusConverter} />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-10 pt-10 sm:px-6 sm:pb-12 sm:pt-12">
        <header className="space-y-3">
          <Link
            to="/"
            className="inline-flex items-center text-xs font-semibold uppercase tracking-[0.18em] text-accent transition hover:text-brand"
          >
            Tools Hub
          </Link>
          <h1 className="text-2xl font-black leading-tight sm:text-3xl">Integrity Plus Converter</h1>
          <p className="w-full text-sm text-muted sm:text-base">
            Integrity Plus の CSV 出力テキストを貼り付けると、Googleスプレッドシートに貼り付けやすいTSV（Tab-Separated Values）へ変換します。
          </p>
        </header>

        <section className="glass-panel rounded-2xl p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
            <div className="space-y-2">
              <label htmlFor="integrity-input" className="block text-sm font-semibold">
                Input (CSV)
              </label>
              <textarea
                id="integrity-input"
                aria-label="Integrity Plus input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="ここに Integrity Plus のCSVを貼り付けてください"
                className="h-[360px] w-full resize-y rounded-xl border border-border bg-panel px-3 py-2 font-mono text-xs leading-relaxed text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
            </div>

            <div className="flex flex-row items-center justify-center gap-2 lg:flex-col lg:pt-8">
              <button
                type="button"
                onClick={handleGenerate}
                className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-xl border border-accent bg-accent px-4 py-2 text-sm font-extrabold text-slate-950 shadow-[0_10px_28px_-12px_rgba(234,166,83,0.95)] ring-1 ring-accent/70 transition hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_18px_34px_-14px_rgba(234,166,83,0.95)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canGenerate}
              >
                <Play size={16} /> 生成
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-xl border border-border bg-panel px-4 py-2 text-sm font-semibold text-ink transition hover:border-accent hover:text-brand"
              >
                <Eraser size={16} /> クリア
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="integrity-output" className="block text-sm font-semibold">
                  Output (TSV: Tab-Separated Values)
                </label>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-panel px-3 py-1.5 text-xs font-semibold transition hover:border-accent hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canCopy}
                >
                  <Copy size={14} /> {copied ? 'コピー完了' : 'コピー'}
                </button>
              </div>
              <textarea
                id="integrity-output"
                aria-label="Converted TSV output"
                value={output}
                readOnly
                placeholder="変換結果がここに表示されます"
                className="h-[360px] w-full resize-y rounded-xl border border-border bg-panelSoft px-3 py-2 font-mono text-xs leading-relaxed text-ink outline-none"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted sm:text-sm">
            <span className="rounded-md border border-border px-2 py-1">判定: {detected}</span>
            <span className="rounded-md border border-border px-2 py-1">データ行数: {outputStats}</span>
          </div>

          {error ? (
            <p role="alert" className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}
        </section>
      </main>
    </>
  );
}
