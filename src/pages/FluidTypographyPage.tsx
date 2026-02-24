import { useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { z } from 'zod';

const STORAGE_KEY = 'olein-tools:fluid-typography:v1';

type FormState = {
  minFontPx: string;
  maxFontPx: string;
  minViewportPx: string;
  maxViewportPx: string;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

const baseSchema = z.object({
  minFontPx: z.number().finite(),
  maxFontPx: z.number().finite(),
  minViewportPx: z.number().finite(),
  maxViewportPx: z.number().finite()
});

const schema = baseSchema.superRefine((data, ctx) => {
  if (data.maxFontPx <= data.minFontPx) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['maxFontPx'],
      message: '最大フォントサイズは最小フォントサイズより大きくしてください。'
    });
  }

  if (data.maxViewportPx <= data.minViewportPx) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['maxViewportPx'],
      message: '最大ビューポート幅は最小ビューポート幅より大きくしてください。'
    });
  }
});

function toNumber(value: string): number {
  return Number(value.trim());
}

function validate(form: FormState): { ok: true; data: z.infer<typeof baseSchema> } | { ok: false; errors: FieldErrors } {
  const requiredErrors: FieldErrors = {};

  (Object.keys(form) as Array<keyof FormState>).forEach((key) => {
    if (form[key].trim() === '') {
      requiredErrors[key] = '必須項目です。';
    }
  });

  if (Object.keys(requiredErrors).length > 0) {
    return { ok: false, errors: requiredErrors };
  }

  const prepared = {
    minFontPx: toNumber(form.minFontPx),
    maxFontPx: toNumber(form.maxFontPx),
    minViewportPx: toNumber(form.minViewportPx),
    maxViewportPx: toNumber(form.maxViewportPx)
  };

  const numberErrors: FieldErrors = {};
  (Object.entries(prepared) as Array<[keyof FormState, number]>).forEach(([key, value]) => {
    if (Number.isNaN(value)) {
      numberErrors[key] = '数値で入力してください。';
    }
  });

  if (Object.keys(numberErrors).length > 0) {
    return { ok: false, errors: numberErrors };
  }

  const result = schema.safeParse(prepared);
  if (!result.success) {
    const errors: FieldErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof FormState | undefined;
      if (key && !errors[key]) {
        errors[key] = issue.message;
      }
    }
    return { ok: false, errors };
  }

  return { ok: true, data: result.data };
}

function getAccessibilityMessages(minFontPx: number, maxFontPx: number): string[] {
  const messages: string[] = [];

  if (maxFontPx >= minFontPx * 2) {
    messages.push('最大フォントサイズが最小の2倍以上です。拡大幅が大きく、可読性やレイアウト安定性の面で最適でない可能性があります。');
  }

  if (minFontPx <= 11) {
    messages.push('最小フォントサイズが11px以下です。可読性が大きく低下するため強い警告です。');
  } else if (minFontPx >= 12 && minFontPx <= 15) {
    messages.push('最小フォントサイズが12〜15pxです。用途によっては小さく感じるため注意してください。');
  }

  return messages;
}

function formatDecimal(value: number): string {
  const trimmed = value.toFixed(4).replace(/\.?0+$/, '');
  if (trimmed === '-0') {
    return '0';
  }
  return trimmed;
}

function calculateClampCss(data: z.infer<typeof baseSchema>) {
  const slope = (data.maxFontPx - data.minFontPx) / (data.maxViewportPx - data.minViewportPx);
  const interceptPx = data.minFontPx - slope * data.minViewportPx;

  const minRem = formatDecimal(data.minFontPx / 16);
  const maxRem = formatDecimal(data.maxFontPx / 16);
  const interceptRem = interceptPx / 16;
  const slopeVw = formatDecimal(slope * 100);
  const remTerm = `${formatDecimal(Math.abs(interceptRem))}rem`;
  const secondArg = interceptRem < 0 ? `${slopeVw}vw - ${remTerm}` : `${slopeVw}vw + ${remTerm}`;

  return `font-size: clamp(${minRem}rem, ${secondArg}, ${maxRem}rem);`;
}

function readInitialFormState(): FormState {
  const fallback: FormState = {
    minFontPx: '16',
    maxFontPx: '28',
    minViewportPx: '375',
    maxViewportPx: '1280'
  };

  if (typeof window === 'undefined') {
    return fallback;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<FormState>;
    return {
      minFontPx: parsed.minFontPx ?? fallback.minFontPx,
      maxFontPx: parsed.maxFontPx ?? fallback.maxFontPx,
      minViewportPx: parsed.minViewportPx ?? fallback.minViewportPx,
      maxViewportPx: parsed.maxViewportPx ?? fallback.maxViewportPx
    };
  } catch {
    return fallback;
  }
}

export function FluidTypographyPage() {
  const [form, setForm] = useState<FormState>(() => readInitialFormState());
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'error'>('idle');

  const validation = useMemo(() => validate(form), [form]);
  const errors = validation.ok ? {} : validation.errors;
  const canGenerate = validation.ok;

  const cssOutput = validation.ok ? calculateClampCss(validation.data) : '';
  const accessibilityMessages = validation.ok
    ? getAccessibilityMessages(validation.data.minFontPx, validation.data.maxFontPx)
    : [];

  const onChange = (key: keyof FormState, value: string) => {
    const next = { ...form, [key]: value };
    setForm(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setCopyState('idle');
  };

  const onCopy = async () => {
    if (!cssOutput) {
      return;
    }

    try {
      await navigator.clipboard.writeText(cssOutput);
      setCopyState('done');
    } catch {
      setCopyState('error');
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="space-y-3">
        <Link to="/" className="inline-block text-sm font-semibold text-brand hover:underline">
          ← ツール一覧へ戻る
        </Link>
        <h1 className="text-3xl font-black leading-tight sm:text-4xl">Fluid Typography (clamp) 計算</h1>
        <p className="max-w-3xl text-sm text-gray-700 sm:text-base">
          フォントサイズとビューポート幅を入力すると、流体的に変化する `clamp()` の CSS を生成します。
        </p>
      </header>

      <section className="space-y-6">
        <form className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
          <InputField
            label="最小フォントサイズ (px)"
            value={form.minFontPx}
            error={errors.minFontPx}
            onChange={(value) => onChange('minFontPx', value)}
          />
          <InputField
            label="最大フォントサイズ (px)"
            value={form.maxFontPx}
            error={errors.maxFontPx}
            onChange={(value) => onChange('maxFontPx', value)}
          />
          <InputField
            label="切り替え最小ビューポート幅 (px)"
            value={form.minViewportPx}
            error={errors.minViewportPx}
            onChange={(value) => onChange('minViewportPx', value)}
          />
          <InputField
            label="切り替え最大ビューポート幅 (px)"
            value={form.maxViewportPx}
            error={errors.maxViewportPx}
            onChange={(value) => onChange('maxViewportPx', value)}
          />
          </div>
        </form>

        <div className="space-y-4 rounded-2xl border border-gray-300 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold">生成結果</h2>
          <div className="relative rounded-xl border border-gray-200 bg-gray-50 p-4 pr-14">
            <button
              type="button"
              onClick={onCopy}
              disabled={!canGenerate}
              aria-label="clamp() CSSをコピー"
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Copy className="h-4 w-4" />
            </button>
            <code className="break-all text-sm">{canGenerate ? cssOutput : '入力が有効になるとここにCSSが表示されます。'}</code>
          </div>

          {copyState === 'done' && <p className="text-sm font-semibold text-green-700">コピーしました。</p>}
          {copyState === 'error' && (
            <p className="text-sm font-semibold text-red-700">コピーに失敗しました。ブラウザ権限をご確認ください。</p>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-bold">アクセシビリティ注意</h3>
            {accessibilityMessages.length > 0 ? (
              <ul className="space-y-2">
                {accessibilityMessages.map((message) => (
                  <li key={message} className="rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900">
                    {message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">
                現在の設定に大きな注意点はありません。
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

type InputFieldProps = {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

function InputField({ label, value, error, onChange }: InputFieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-lg border px-3 py-2 text-base outline-none transition ${
          error ? 'border-red-500 bg-red-50' : 'border-gray-300 focus:border-brand'
        }`}
        placeholder="数値を入力"
      />
      {error && <span className="mt-1 block text-sm text-red-700">{error}</span>}
    </label>
  );
}
