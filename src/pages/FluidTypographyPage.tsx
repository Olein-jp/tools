import { AlertTriangle, Copy, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { Seo } from '../seo/Seo';
import { PAGE_SEO } from '../seo/meta';

const STORAGE_KEY = 'olein-tools:fluid-typography:v2';
const DEFAULT_VAR_SLUG = 'fluid-type';
const DEFAULT_SUFFIX_FORMAT: SuffixFormat = 'plain';
const RADAR_SPEED_FACTOR = 1.6;

const FALLBACK_FORM: FormState = {
  minFontPx: '16',
  maxFontPx: '28',
  minViewportPx: '375',
  maxViewportPx: '1280'
};

type FormState = {
  minFontPx: string;
  maxFontPx: string;
  minViewportPx: string;
  maxViewportPx: string;
};

type TypographyPreset = {
  id: string;
  label: string;
  form: FormState;
};

type ValidPreset = {
  id: string;
  label: string;
  data: ValidFormData;
};

type SuffixFormat = 'plain' | 'zero-padded';

type FieldErrors = Partial<Record<keyof FormState, string>>;

type PresetValidation =
  | {
      ok: true;
      id: string;
      label: string;
      data: ValidFormData;
    }
  | {
      ok: false;
      id: string;
      label: string;
      errors: FieldErrors;
    };

const baseSchema = z.object({
  minFontPx: z.number().finite(),
  maxFontPx: z.number().finite(),
  minViewportPx: z.number().finite(),
  maxViewportPx: z.number().finite()
});

type ValidFormData = z.infer<typeof baseSchema>;

const schema = baseSchema.superRefine((data, ctx) => {
  if (data.maxFontPx <= data.minFontPx) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['maxFontPx'],
      message: 'Max font size must be greater than min font size.'
    });
  }

  if (data.maxViewportPx <= data.minViewportPx) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['maxViewportPx'],
      message: 'Max viewport width must be greater than min viewport width.'
    });
  }
});

function toNumber(value: string): number {
  return Number(value.trim());
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function seededRandom(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function formatDecimal(value: number): string {
  const trimmed = value.toFixed(4).replace(/\.?0+$/, '');
  return trimmed === '-0' ? '0' : trimmed;
}

function formatFixed3(value: number): string {
  return value.toFixed(3);
}

function sanitizeVarSlugInput(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
}

function resolveVarSlug(value: string): string {
  const resolved = value.replace(/^-+|-+$/g, '');
  return resolved || DEFAULT_VAR_SLUG;
}

function getFontSizeAtViewport(data: ValidFormData, viewport: number): number {
  if (viewport <= data.minViewportPx) {
    return data.minFontPx;
  }
  if (viewport >= data.maxViewportPx) {
    return data.maxFontPx;
  }
  const ratio = (viewport - data.minViewportPx) / (data.maxViewportPx - data.minViewportPx);
  return data.minFontPx + (data.maxFontPx - data.minFontPx) * ratio;
}

function getScanOpacity(progress: number): number {
  const fadeInEnd = 0.12;
  const fadeOutStart = 0.9;
  const fadeOutEnd = 0.98;

  if (progress < fadeInEnd) {
    return progress / fadeInEnd;
  }

  if (progress < fadeOutStart) {
    return 1;
  }

  if (progress < fadeOutEnd) {
    return (fadeOutEnd - progress) / (fadeOutEnd - fadeOutStart);
  }

  return 0;
}

function getTypedSlice(fullText: string, elapsedSec: number, lineStartSec: number, charsPerSec: number): string {
  const progress = (elapsedSec - lineStartSec) * charsPerSec;
  if (progress <= 0) {
    return '';
  }
  return fullText.slice(0, Math.min(fullText.length, Math.floor(progress)));
}

let textMeasureContext: CanvasRenderingContext2D | null = null;

function measureTerminalTextWidth(text: string, fontSizePx: number): number {
  if (typeof document === 'undefined') {
    return text.length * fontSizePx * 0.62;
  }

  if (!textMeasureContext) {
    const canvas = document.createElement('canvas');
    textMeasureContext = canvas.getContext('2d');
  }

  if (!textMeasureContext) {
    return text.length * fontSizePx * 0.62;
  }

  textMeasureContext.font = `${fontSizePx}px "IBM Plex Mono", "JetBrains Mono", "SFMono-Regular", Menlo, monospace`;
  return textMeasureContext.measureText(text).width;
}

function calculateClampCss(data: ValidFormData): string {
  const slope = (data.maxFontPx - data.minFontPx) / (data.maxViewportPx - data.minViewportPx);
  const interceptPx = data.minFontPx - slope * data.minViewportPx;

  const minRem = formatDecimal(data.minFontPx / 16);
  const maxRem = formatDecimal(data.maxFontPx / 16);
  const interceptRem = interceptPx / 16;
  const slopeVw = formatDecimal(slope * 100);
  const remTerm = `${formatDecimal(Math.abs(interceptRem))}rem`;
  const secondArg = interceptRem < 0 ? `${slopeVw}vw - ${remTerm}` : `${slopeVw}vw + ${remTerm}`;

  return `clamp(${minRem}rem, ${secondArg}, ${maxRem}rem)`;
}

function getAccessibilityMessages(minFontPx: number, maxFontPx: number): string[] {
  const messages: string[] = [];

  if (maxFontPx >= minFontPx * 2) {
    messages.push('Max font size is at least twice the min size. The scaling range may be too aggressive for readability and layout stability.');
  }

  if (minFontPx <= 11) {
    messages.push('Min font size is 11px or below. This is a strong warning because readability can drop significantly.');
  } else if (minFontPx >= 12 && minFontPx <= 15) {
    messages.push('Min font size is between 12px and 15px. Depending on usage, this may still feel too small.');
  }

  return messages;
}

function validate(form: FormState): { ok: true; data: ValidFormData } | { ok: false; errors: FieldErrors } {
  const requiredErrors: FieldErrors = {};

  (Object.keys(form) as Array<keyof FormState>).forEach((key) => {
    if (form[key].trim() === '') {
      requiredErrors[key] = 'This field is required.';
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
      numberErrors[key] = 'Please enter a numeric value.';
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

function createPresetLabel(index: number): string {
  return `Preset ${index + 1}`;
}

function createPreset(index: number, seed?: FormState): TypographyPreset {
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    label: createPresetLabel(index),
    form: seed ?? FALLBACK_FORM
  };
}

function createNextPreset(presets: TypographyPreset[]): TypographyPreset {
  const base = presets[presets.length - 1]?.form ?? FALLBACK_FORM;

  const nextMinFont = clampNumber(toNumber(base.minFontPx) + 2, 10, 96);
  const nextMaxFont = clampNumber(toNumber(base.maxFontPx) + 4, 12, 144);
  const nextMinViewport = clampNumber(toNumber(base.minViewportPx), 240, 1920);
  const nextMaxViewport = clampNumber(toNumber(base.maxViewportPx) + 160, 320, 3840);

  return createPreset(presets.length, {
    minFontPx: formatDecimal(nextMinFont),
    maxFontPx: formatDecimal(Math.max(nextMaxFont, nextMinFont + 1)),
    minViewportPx: formatDecimal(nextMinViewport),
    maxViewportPx: formatDecimal(Math.max(nextMaxViewport, nextMinViewport + 1))
  });
}

function readInitialPresets(): TypographyPreset[] {
  const fallback = [createPreset(0, FALLBACK_FORM)];

  if (typeof window === 'undefined') {
    return fallback;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as { presets?: Array<Partial<TypographyPreset>> } | Partial<FormState>;

    if ('presets' in parsed && Array.isArray(parsed.presets) && parsed.presets.length > 0) {
      return parsed.presets.map((preset, index) => {
        const form = (preset.form ?? {}) as Partial<FormState>;
        return {
          id: typeof preset.id === 'string' ? preset.id : createPreset(index).id,
          label: typeof preset.label === 'string' && preset.label.trim() ? preset.label : createPresetLabel(index),
          form: {
            minFontPx: typeof form.minFontPx === 'string' ? form.minFontPx : FALLBACK_FORM.minFontPx,
            maxFontPx: typeof form.maxFontPx === 'string' ? form.maxFontPx : FALLBACK_FORM.maxFontPx,
            minViewportPx: typeof form.minViewportPx === 'string' ? form.minViewportPx : FALLBACK_FORM.minViewportPx,
            maxViewportPx: typeof form.maxViewportPx === 'string' ? form.maxViewportPx : FALLBACK_FORM.maxViewportPx
          }
        };
      });
    }

    const single = parsed as Partial<FormState>;
    return [
      createPreset(0, {
        minFontPx: typeof single.minFontPx === 'string' ? single.minFontPx : FALLBACK_FORM.minFontPx,
        maxFontPx: typeof single.maxFontPx === 'string' ? single.maxFontPx : FALLBACK_FORM.maxFontPx,
        minViewportPx: typeof single.minViewportPx === 'string' ? single.minViewportPx : FALLBACK_FORM.minViewportPx,
        maxViewportPx: typeof single.maxViewportPx === 'string' ? single.maxViewportPx : FALLBACK_FORM.maxViewportPx
      })
    ];
  } catch {
    return fallback;
  }
}

function readInitialVarSlug(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_VAR_SLUG;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return DEFAULT_VAR_SLUG;
  }

  try {
    const parsed = JSON.parse(raw) as { varSlug?: unknown };
    return typeof parsed.varSlug === 'string' ? sanitizeVarSlugInput(parsed.varSlug) : DEFAULT_VAR_SLUG;
  } catch {
    return DEFAULT_VAR_SLUG;
  }
}

function readInitialSuffixFormat(): SuffixFormat {
  if (typeof window === 'undefined') {
    return DEFAULT_SUFFIX_FORMAT;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return DEFAULT_SUFFIX_FORMAT;
  }

  try {
    const parsed = JSON.parse(raw) as { suffixFormat?: unknown };
    return parsed.suffixFormat === 'zero-padded' || parsed.suffixFormat === 'plain'
      ? parsed.suffixFormat
      : DEFAULT_SUFFIX_FORMAT;
  } catch {
    return DEFAULT_SUFFIX_FORMAT;
  }
}

function formatVariableSuffix(index: number, suffixFormat: SuffixFormat): string {
  const value = index + 1;
  return suffixFormat === 'zero-padded' ? String(value).padStart(2, '0') : String(value);
}

function buildCssOutput(validPresets: ValidPreset[], varSlug: string, suffixFormat: SuffixFormat): string {
  return validPresets
    .map((preset, index) => {
      const varName = `--${varSlug}-${formatVariableSuffix(index, suffixFormat)}`;
      return `/* ${preset.label} */\n${varName}: ${calculateClampCss(preset.data)};`;
    })
    .join('\n\n');
}

export function FluidTypographyPage() {
  const [presets, setPresets] = useState<TypographyPreset[]>(() => readInitialPresets());
  const [varSlugInput, setVarSlugInput] = useState<string>(() => readInitialVarSlug());
  const [suffixFormat, setSuffixFormat] = useState<SuffixFormat>(() => readInitialSuffixFormat());
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'error'>('idle');
  const resolvedVarSlug = useMemo(() => resolveVarSlug(varSlugInput), [varSlugInput]);

  const validations = useMemo<PresetValidation[]>(() => {
    return presets.map((preset) => {
      const result = validate(preset.form);
      if (result.ok) {
        return { ok: true, id: preset.id, label: preset.label, data: result.data };
      }
      return { ok: false, id: preset.id, label: preset.label, errors: result.errors };
    });
  }, [presets]);

  const errorsById = useMemo(() => {
    const map: Record<string, FieldErrors> = {};
    validations.forEach((item) => {
      if (!item.ok) {
        map[item.id] = item.errors;
      }
    });
    return map;
  }, [validations]);

  const validPresets = useMemo<ValidPreset[]>(() => {
    return validations.filter((item): item is Extract<PresetValidation, { ok: true }> => item.ok).map((item) => ({
      id: item.id,
      label: item.label,
      data: item.data
    }));
  }, [validations]);

  const canGenerate = presets.length > 0 && validations.every((item) => item.ok);
  const cssOutput = canGenerate ? buildCssOutput(validPresets, resolvedVarSlug, suffixFormat) : '';

  const accessibilityWarningsByPresetId = useMemo(() => {
    const map: Record<string, string[]> = {};
    validPresets.forEach((preset) => {
      const notes = getAccessibilityMessages(preset.data.minFontPx, preset.data.maxFontPx);
      if (notes.length > 0) {
        map[preset.id] = notes;
      }
    });
    return map;
  }, [validPresets]);

  const persistPresets = (nextPresets: TypographyPreset[]) => {
    setPresets(nextPresets);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ presets: nextPresets, varSlug: varSlugInput, suffixFormat })
    );
    setCopyState('idle');
  };

  const onVarSlugChange = (value: string) => {
    const nextSlugInput = sanitizeVarSlugInput(value);
    setVarSlugInput(nextSlugInput);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ presets, varSlug: nextSlugInput, suffixFormat }));
    setCopyState('idle');
  };

  const onSuffixFormatChange = (value: SuffixFormat) => {
    setSuffixFormat(value);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ presets, varSlug: varSlugInput, suffixFormat: value }));
    setCopyState('idle');
  };

  const onChange = (presetId: string, key: keyof FormState, value: string) => {
    const next = presets.map((preset) => {
      if (preset.id !== presetId) {
        return preset;
      }
      return {
        ...preset,
        form: {
          ...preset.form,
          [key]: value
        }
      };
    });

    persistPresets(next);
  };

  const addPreset = () => {
    const next = [...presets, createNextPreset(presets)];
    persistPresets(next.map((preset, index) => ({ ...preset, label: createPresetLabel(index) })));
  };

  const removePreset = (presetId: string) => {
    if (presets.length === 1) {
      return;
    }

    const next = presets.filter((preset) => preset.id !== presetId);
    persistPresets(next.map((preset, index) => ({ ...preset, label: createPresetLabel(index) })));
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
    <>
      <Seo meta={PAGE_SEO.fluidTypography} />
      <main className="relative">
        <FullscreenTypographyBackdrop presets={validPresets} />

      <div className="relative z-20 mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-8 pt-24 sm:px-6 sm:pb-12 sm:pt-28">
        <header className="space-y-3">
          <Link to="/" className="inline-block text-sm font-semibold text-accent hover:underline">
            ← Back to tools
          </Link>
          <h1 className="text-3xl font-black leading-tight sm:text-4xl">Fluid Typography (clamp) Calculator</h1>
          <p className="max-w-3xl text-sm text-muted sm:text-base">
            Use the `+` button to add presets and generate multiple `clamp()` values at once. The background graph overlays all preset curves.
          </p>
        </header>

        <section className="space-y-6">
          <form className="fluid-input-shell p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-end gap-3">
                <label className="block min-w-0">
                  <span className="fluid-input-label mb-1 block text-sm font-semibold">Variable Slug</span>
                  <input
                    value={varSlugInput}
                    onChange={(event) => onVarSlugChange(event.target.value)}
                    className="fluid-input-control w-60 border px-3 py-2 text-base outline-none transition sm:w-72"
                    placeholder={DEFAULT_VAR_SLUG}
                  />
                </label>
                <fieldset className="block">
                  <legend className="fluid-input-label mb-1 block text-sm font-semibold">Suffix</legend>
                  <div className="fluid-radio-group fluid-input-control flex items-center gap-2 border px-2 py-1.5 text-sm">
                    <label className="fluid-radio-option inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="suffix-format"
                        value="plain"
                        checked={suffixFormat === 'plain'}
                        onChange={() => onSuffixFormatChange('plain')}
                        className="fluid-radio-input"
                      />
                      <span>1</span>
                    </label>
                    <label className="fluid-radio-option inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="suffix-format"
                        value="zero-padded"
                        checked={suffixFormat === 'zero-padded'}
                        onChange={() => onSuffixFormatChange('zero-padded')}
                        className="fluid-radio-input"
                      />
                      <span>01</span>
                    </label>
                  </div>
                </fieldset>
              </div>
              <button
                type="button"
                onClick={addPreset}
                className="neo-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
              >
                <Plus className="h-4 w-4" />
                Add Preset
              </button>
            </div>

            <div className="space-y-4">
              {presets.map((preset, index) => {
                const errors = errorsById[preset.id] ?? {};
                const warnings = accessibilityWarningsByPresetId[preset.id] ?? [];
                return (
                  <div key={preset.id} className="fluid-preset-card p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="fluid-preset-title text-sm font-bold tracking-wide">{preset.label}</p>
                      <button
                        type="button"
                        onClick={() => removePreset(preset.id)}
                        disabled={presets.length === 1}
                        className="fluid-inline-button inline-flex items-center gap-1 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <InputField
                        label="Min Font Size (px)"
                        value={preset.form.minFontPx}
                        error={errors.minFontPx}
                        onChange={(value) => onChange(preset.id, 'minFontPx', value)}
                      />
                      <InputField
                        label="Max Font Size (px)"
                        value={preset.form.maxFontPx}
                        error={errors.maxFontPx}
                        onChange={(value) => onChange(preset.id, 'maxFontPx', value)}
                      />
                      <InputField
                        label="Min Viewport Width (px)"
                        value={preset.form.minViewportPx}
                        error={errors.minViewportPx}
                        onChange={(value) => onChange(preset.id, 'minViewportPx', value)}
                      />
                      <InputField
                        label="Max Viewport Width (px)"
                        value={preset.form.maxViewportPx}
                        error={errors.maxViewportPx}
                        onChange={(value) => onChange(preset.id, 'maxViewportPx', value)}
                      />
                    </div>

                    <p className="mt-3 text-xs text-muted">{`Output variable: --${resolvedVarSlug}-${formatVariableSuffix(index, suffixFormat)}`}</p>
                    {warnings.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {warnings.map((warning) => (
                          <li
                            key={`${preset.id}-${warning}`}
                            className="fluid-warning-note"
                          >
                            <span className="fluid-warning-icon" aria-hidden="true">
                              <AlertTriangle className="h-4 w-4" />
                            </span>
                            <span>{warning}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </form>

          <div className="fluid-result-shell space-y-4 p-5 sm:p-6">
            <h2 className="text-lg font-bold">Generated Output</h2>
            <div className="fluid-result-code relative p-4 pr-14">
              <button
                type="button"
                onClick={onCopy}
                disabled={!canGenerate}
                aria-label="Copy clamp() CSS"
                className="fluid-inline-button absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center text-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Copy className="h-4 w-4" />
              </button>
              <code className="whitespace-pre-wrap break-all text-sm">
                {canGenerate ? cssOutput : 'When all presets are valid, multiple CSS variable outputs will appear here.'}
              </code>
            </div>

            {copyState === 'done' && <p className="text-sm font-semibold text-green-700 dark:text-green-200">Copied to clipboard.</p>}
            {copyState === 'error' && (
              <p className="text-sm font-semibold text-red-700 dark:text-red-200">Copy failed. Please check browser permissions.</p>
            )}

          </div>
        </section>
      </div>
      </main>
    </>
  );
}

type FullscreenTypographyBackdropProps = {
  presets: ValidPreset[];
};

function FullscreenTypographyBackdrop({ presets }: FullscreenTypographyBackdropProps) {
  const [screenSize, setScreenSize] = useState(() => ({
    width: typeof window === 'undefined' ? 1440 : window.innerWidth,
    height: typeof window === 'undefined' ? 900 : window.innerHeight
  }));

  const linePalette = [
    'rgb(15 26 39 / 0.9)',
    'rgb(20 33 48 / 0.88)',
    'rgb(25 41 58 / 0.86)',
    'rgb(30 48 67 / 0.84)',
    'rgb(36 56 77 / 0.82)',
    'rgb(44 66 89 / 0.8)'
  ];

  const fallbackPreset: ValidPreset = {
    id: 'fallback',
    label: 'Preset 1',
    data: { minFontPx: 16, maxFontPx: 28, minViewportPx: 375, maxViewportPx: 1280 }
  };
  const targetPresets = presets.length > 0 ? presets : [fallbackPreset];
  const [animatedPresets, setAnimatedPresets] = useState<ValidPreset[]>(targetPresets);
  const [scanTime, setScanTime] = useState(0);

  useEffect(() => {
    let rafId = 0;
    let active = true;
    const easing = 0.16;
    const snapThreshold = 0.02;

    const animate = () => {
      if (!active) {
        return;
      }

      let isDone = true;

      setAnimatedPresets((prev) => {
        const prevMap = new Map(prev.map((item) => [item.id, item]));

        return targetPresets.map((target) => {
          const current = prevMap.get(target.id) ?? target;
          const nextData = {
            minFontPx: current.data.minFontPx + (target.data.minFontPx - current.data.minFontPx) * easing,
            maxFontPx: current.data.maxFontPx + (target.data.maxFontPx - current.data.maxFontPx) * easing,
            minViewportPx: current.data.minViewportPx + (target.data.minViewportPx - current.data.minViewportPx) * easing,
            maxViewportPx: current.data.maxViewportPx + (target.data.maxViewportPx - current.data.maxViewportPx) * easing
          };

          const isPresetDone =
            Math.abs(nextData.minFontPx - target.data.minFontPx) < snapThreshold &&
            Math.abs(nextData.maxFontPx - target.data.maxFontPx) < snapThreshold &&
            Math.abs(nextData.minViewportPx - target.data.minViewportPx) < snapThreshold &&
            Math.abs(nextData.maxViewportPx - target.data.maxViewportPx) < snapThreshold;

          if (!isPresetDone) {
            isDone = false;
          }

          return {
            id: target.id,
            label: target.label,
            data: isPresetDone ? target.data : nextData
          };
        });
      });

      if (!isDone) {
        rafId = window.requestAnimationFrame(animate);
      }
    };

    rafId = window.requestAnimationFrame(animate);

    return () => {
      active = false;
      window.cancelAnimationFrame(rafId);
    };
  }, [targetPresets]);

  useEffect(() => {
    let rafId = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      setScanTime((now - startedAt) / 1000);
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const width = Math.max(360, screenSize.width);
  const height = Math.max(520, screenSize.height);

  const plotLeft = width < 760 ? 58 : 84;
  const plotRight = width - 36;
  const plotTop = width < 760 ? 94 : 116;
  const plotBottom = width < 760 ? height - 88 : height - 112;
  const plotArea = { left: plotLeft, right: plotRight, top: plotTop, bottom: plotBottom };
  const viewportAxisMin = 0;
  const maxPresetViewport = Math.max(...animatedPresets.map((preset) => preset.data.maxViewportPx));
  const viewportAxisMax = Math.max(1, maxPresetViewport + 400);
  const fontAxisMin = 0;
  const fontAxisMax = Math.max(
    1,
    ...animatedPresets.map((preset) => getFontSizeAtViewport(preset.data, viewportAxisMax))
  );
  const viewportSpan = Math.max(1, viewportAxisMax - viewportAxisMin);
  const fontSpan = Math.max(1, fontAxisMax - fontAxisMin);

  const mapX = (viewport: number) =>
    plotArea.left + ((viewport - viewportAxisMin) / viewportSpan) * (plotArea.right - plotArea.left);
  const mapY = (font: number) =>
    plotArea.bottom - ((font - fontAxisMin) / fontSpan) * (plotArea.bottom - plotArea.top);

  const tickSegments = width < 760 ? 3 : 5;
  const xTicks = Array.from({ length: tickSegments + 1 }, (_, index) => viewportAxisMin + (viewportSpan * index) / tickSegments);
  const yTicks = Array.from({ length: tickSegments + 1 }, (_, index) => fontAxisMin + (fontSpan * index) / tickSegments);

  const curves = animatedPresets.map((preset, index) => {
    const minFont = preset.data.minFontPx;
    const maxFont = preset.data.maxFontPx;
    const minViewport = preset.data.minViewportPx;
    const maxViewport = preset.data.maxViewportPx;

    const fontRange = Math.max(1, maxFont - minFont);
    const leftX = mapX(viewportAxisMin);
    const minX = mapX(minViewport);
    const maxX = mapX(maxViewport);
    const rightX = mapX(viewportAxisMax);
    const leftY = mapY(getFontSizeAtViewport(preset.data, viewportAxisMin));
    const minY = mapY(minFont);
    const maxY = mapY(maxFont);
    const rightY = mapY(getFontSizeAtViewport(preset.data, viewportAxisMax));
    const speedSeed = seededRandom(`${preset.id}-speed`);
    const cycleDuration = (9.2 + speedSeed * 4.6) * RADAR_SPEED_FACTOR;
    const phaseOffset = seededRandom(`${preset.id}-phase`) * cycleDuration;
    const activeDuration = cycleDuration * (0.82 + seededRandom(`${preset.id}-active`) * 0.08);

    return {
      id: preset.id,
      label: preset.label,
      color: linePalette[index % linePalette.length],
      primary: `M ${leftX} ${leftY} L ${minX} ${minY} L ${maxX} ${maxY} L ${rightX} ${rightY}`,
      secondary: `M ${leftX} ${plotArea.bottom} L ${rightX} ${plotArea.bottom}`,
      phaseOffset,
      cycleDuration,
      activeDuration,
      minFont,
      maxFont,
      minViewport,
      maxViewport
    };
  });

  const terminalLines = [
    `olein@metrics:~$ scan --presets ${presets.length} --mode spectral`,
    '[ok] data stream online',
    ...curves.slice(0, 5).map(
      (curve) => `> ${curve.label.toLowerCase()} :: ${formatDecimal(curve.minFont)}-${formatDecimal(curve.maxFont)}px @ ${formatDecimal(curve.minViewport)}-${formatDecimal(curve.maxViewport)}px`
    ),
    `olein@metrics:~$ render --graph-lines ${curves.length}`
  ];
  const charsPerSec = 28;
  const lineGapSec = 0.32;
  const commandFontSize = width < 760 ? 18 : 25;
  const commandLineHeight = Math.round(commandFontSize * 1.45);
  const commandStartX = 0;
  const commandStartY = commandFontSize;
  const commandLines = terminalLines;
  const lineStartTimes = commandLines.reduce<number[]>((acc, line, index) => {
    if (index === 0) {
      acc.push(0);
      return acc;
    }
    const prevStart = acc[index - 1] ?? 0;
    const prevLine = commandLines[index - 1] ?? '';
    acc.push(prevStart + prevLine.length / charsPerSec + lineGapSec);
    return acc;
  }, []);
  const terminalTypingDuration = (lineStartTimes[lineStartTimes.length - 1] ?? 0) + (commandLines[commandLines.length - 1]?.length ?? 0) / charsPerSec;
  const typingLeadInSec = 0.24;
  const typingHoldSec = 0.56;
  const typingFadeOutSec = 0.72;
  const typingRestartPauseSec = 0.24;
  const typingCycleDuration = typingLeadInSec + terminalTypingDuration + typingHoldSec + typingFadeOutSec + typingRestartPauseSec;
  const typingCycleSec = Number.isFinite(scanTime) ? scanTime % typingCycleDuration : 0;
  const typingEndSec = typingLeadInSec + terminalTypingDuration;
  const holdEndSec = typingEndSec + typingHoldSec;
  const fadeEndSec = holdEndSec + typingFadeOutSec;
  const typingElapsed =
    typingCycleSec <= typingLeadInSec
      ? 0
      : typingCycleSec <= typingEndSec
        ? typingCycleSec - typingLeadInSec
        : typingCycleSec <= fadeEndSec
          ? terminalTypingDuration
          : 0;
  const fadeProgress = typingCycleSec > holdEndSec && typingCycleSec <= fadeEndSec ? (typingCycleSec - holdEndSec) / typingFadeOutSec : 0;
  const inLeadOrRestartGap = typingCycleSec <= typingLeadInSec || typingCycleSec > fadeEndSec;
  const commandBlockOpacity = inLeadOrRestartGap ? 0 : 0.38 * (1 - Math.max(0, Math.min(1, fadeProgress)));
  const typedCommandLines = commandLines.map((line, index) => getTypedSlice(line, typingElapsed, lineStartTimes[index] ?? 0, charsPerSec));

  return (
    <div className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
      <div className="absolute left-[-12rem] top-[-8rem] h-[28rem] w-[28rem] rounded-full bg-cyan-300/18 blur-3xl dark:bg-cyan-300/8" />
      <div className="absolute bottom-[-14rem] right-[-10rem] h-[34rem] w-[34rem] rounded-full bg-amber-300/24 blur-3xl dark:bg-amber-300/12" />

      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full opacity-90 dark:opacity-80">
        <defs>
          <linearGradient id="hero-grid-glow" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(39 105 168 / 0.07)" />
            <stop offset="100%" stopColor="rgb(238 168 76 / 0.16)" />
          </linearGradient>
          <radialGradient id="hero-pulse" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgb(255 222 173 / 0.5)" />
            <stop offset="100%" stopColor="rgb(255 222 173 / 0)" />
          </radialGradient>
          <pattern id="hero-grid" width="84" height="84" patternUnits="userSpaceOnUse">
            <path d="M 84 0 L 0 0 0 84" fill="none" stroke="rgb(64 92 115 / 0.13)" strokeWidth="1" />
          </pattern>
          <filter id="hero-neon" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.8" floodColor="rgb(122 208 255 / 0.45)" />
          </filter>
          <filter id="hero-radar-neon" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.45" result="blurred" />
            <feDropShadow in="blurred" dx="0" dy="0" stdDeviation="2.4" floodColor="rgb(120 255 160 / 0.95)" />
          </filter>
          <filter id="hero-terminal-fog" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="0.95" />
          </filter>
        </defs>

        <rect x="0" y="0" width={width} height={height} fill="url(#hero-grid-glow)" />
        <rect x="0" y="0" width={width} height={height} fill="url(#hero-grid)" />
        <g filter="url(#hero-terminal-fog)">
          <text
            x={commandStartX}
            y={commandStartY}
            fill="rgb(174 215 239 / 0.36)"
            fontSize={commandFontSize}
            letterSpacing="0.18"
            style={{
              opacity: commandBlockOpacity,
              fontFamily: "'IBM Plex Mono', 'JetBrains Mono', 'SFMono-Regular', Menlo, monospace"
            }}
          >
            {typedCommandLines.map((line, index) => (
              <tspan key={`bg-terminal-line-${index}`} x={commandStartX} dy={index === 0 ? 0 : commandLineHeight}>
                {line}
              </tspan>
            ))}
          </text>
        </g>

        {curves.map((curve, index) => (
          <g key={curve.id}>
            <path
              d={curve.secondary}
              fill="none"
              stroke={curve.color}
              strokeWidth={1.3}
              strokeOpacity={0.22}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="6 10"
              className={index % 2 === 0 ? 'type-graph-flow-slow' : 'type-graph-flow-fast'}
            />
            <path d={curve.primary} fill="none" stroke={curve.color} strokeWidth={5.9} strokeLinecap="round" className="type-graph-pulse" />

          </g>
        ))}

        <g className="type-axis-overlay">
          {xTicks.map((tick) => {
            const x = mapX(tick);
            return (
              <g key={`x-${tick}`}>
                <line x1={x} y1={plotArea.top} x2={x} y2={plotArea.bottom} stroke="rgb(76 100 120 / 0.28)" strokeWidth="1" />
                <text
                  x={x}
                  y={plotArea.bottom + 26}
                  textAnchor="middle"
                  fill="rgb(187 214 232 / 0.58)"
                  fontSize="12"
                  style={{ fontFamily: "'IBM Plex Mono', 'JetBrains Mono', 'SFMono-Regular', Menlo, monospace" }}
                >
                  {`${Math.round(tick)}px`}
                </text>
              </g>
            );
          })}
          {yTicks.map((tick) => {
            const y = mapY(tick);
            return (
              <g key={`y-${tick}`}>
                <line x1={plotArea.left} y1={y} x2={plotArea.right} y2={y} stroke="rgb(76 100 120 / 0.28)" strokeWidth="1" />
                <text
                  x={plotArea.left - 14}
                  y={y + 4}
                  textAnchor="end"
                  fill="rgb(187 214 232 / 0.58)"
                  fontSize="12"
                  style={{ fontFamily: "'IBM Plex Mono', 'JetBrains Mono', 'SFMono-Regular', Menlo, monospace" }}
                >
                  {`${formatDecimal(tick)}px`}
                </text>
              </g>
            );
          })}
          <line x1={plotArea.left} y1={plotArea.bottom} x2={plotArea.right} y2={plotArea.bottom} stroke="rgb(146 178 201 / 0.55)" strokeWidth="1.6" />
          <line x1={plotArea.left} y1={plotArea.top} x2={plotArea.left} y2={plotArea.bottom} stroke="rgb(146 178 201 / 0.55)" strokeWidth="1.6" />
          <text
            x={(plotArea.left + plotArea.right) / 2}
            y={plotArea.bottom + 54}
            textAnchor="middle"
            fill="rgb(205 228 244 / 0.68)"
            fontSize="14"
            letterSpacing="1.4"
            style={{ fontFamily: "'IBM Plex Mono', 'JetBrains Mono', 'SFMono-Regular', Menlo, monospace" }}
          >
            VIEWPORT WIDTH (px)
          </text>
          <text
            x={plotArea.left + 10}
            y={plotArea.top - 14}
            fill="rgb(205 228 244 / 0.68)"
            fontSize="14"
            letterSpacing="1.4"
            style={{ fontFamily: "'IBM Plex Mono', 'JetBrains Mono', 'SFMono-Regular', Menlo, monospace" }}
          >
            FONT SIZE (px)
          </text>
        </g>

        {curves.map((curve, index) => {
          const elapsed = scanTime + curve.phaseOffset;
          const cycleProgressSec = elapsed % curve.cycleDuration;
          const startT = 0;
          const endT = 1;

          if (cycleProgressSec > curve.activeDuration) {
            return null;
          }

          const moveProgress = cycleProgressSec / curve.activeDuration;
          const t = startT + (endT - startT) * moveProgress;
          const opacity = getScanOpacity(moveProgress);
          if (opacity <= 0.001) {
            return null;
          }

          const currentViewport = viewportAxisMin + (viewportAxisMax - viewportAxisMin) * t;
          const currentFont = getFontSizeAtViewport(
            {
              minFontPx: curve.minFont,
              maxFontPx: curve.maxFont,
              minViewportPx: curve.minViewport,
              maxViewportPx: curve.maxViewport
            },
            currentViewport
          );
          const point = {
            x: mapX(currentViewport),
            y: mapY(currentFont)
          };
          const viewportLabel = `viewport width : ${formatFixed3(currentViewport)}px`;
          const fontSizeLabel = `font-size : ${formatFixed3(currentFont)}px`;

          return (
            <g key={`${curve.id}-node`} className="type-radar-node" style={{ animationDelay: `${index * 0.22}s`, opacity }}>
              <circle
                cx={point.x}
                cy={point.y}
                r="1"
                fill="none"
                stroke="rgb(137 255 177 / 0.88)"
                strokeWidth="1.2"
                filter="url(#hero-radar-neon)"
              >
                <animate attributeName="r" values="1;34" dur="3.1s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.88;0" dur="3.1s" repeatCount="indefinite" />
              </circle>
              <circle
                cx={point.x}
                cy={point.y}
                r="1"
                fill="none"
                stroke="rgb(137 255 177 / 0.7)"
                strokeWidth="1"
                filter="url(#hero-radar-neon)"
              >
                <animate attributeName="r" values="1;28" dur="3.1s" begin="0.9s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0" dur="3.1s" begin="0.9s" repeatCount="indefinite" />
              </circle>
              <circle cx={point.x} cy={point.y} r="6.5" fill="rgb(137 255 177 / 0.98)" filter="url(#hero-radar-neon)" />
              <text
                x={point.x + 16}
                y={point.y - 18 - (index % 3) * 8}
                fill="rgb(166 255 192 / 0.95)"
                fontSize="13"
                className="type-radar-label"
                filter="url(#hero-radar-neon)"
                style={{ fontFamily: "'IBM Plex Mono', 'JetBrains Mono', 'SFMono-Regular', Menlo, monospace" }}
              >
                <tspan x={point.x + 16}>{viewportLabel}</tspan>
                <tspan x={point.x + 16} dy="1.2em">
                  {fontSizeLabel}
                </tspan>
              </text>
            </g>
          );
        })}

      </svg>
    </div>
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
      <span className="fluid-input-label mb-1 block text-sm font-semibold">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`fluid-input-control w-full border px-3 py-2 text-base outline-none transition ${
          error
            ? 'fluid-input-control-error'
            : 'focus:border-accent'
        }`}
        placeholder="Enter a value"
      />
      {error && <span className="fluid-input-error mt-1 block text-sm">{error}</span>}
    </label>
  );
}
