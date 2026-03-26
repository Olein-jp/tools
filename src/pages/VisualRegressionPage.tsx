import pixelmatch from 'pixelmatch';
import { AlertTriangle, Eye, EyeOff, ImagePlus, LoaderCircle, RefreshCcw, Upload } from 'lucide-react';
import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Seo } from '../seo/Seo';
import { PAGE_SEO } from '../seo/meta';

const ACCEPTED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const PIXELMATCH_THRESHOLD = 0.1;

type SlotKey = 'before' | 'after';

type LoadedImage = {
  file: File;
  fileName: string;
  width: number;
  height: number;
  objectUrl: string;
  imageData: ImageData;
};

type DiffResult = {
  width: number;
  height: number;
  diffPixelCount: number;
  diffRatio: number;
  overlayDataUrl: string;
};

const EMPTY_SLOT_LABEL = {
  before: 'Before画像を選択',
  after: 'After画像を選択'
} satisfies Record<SlotKey, string>;

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

function formatRatio(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('ja-JP').format(value);
}

function isAcceptedMimeType(file: File): boolean {
  return ACCEPTED_MIME_TYPES.includes(file.type as (typeof ACCEPTED_MIME_TYPES)[number]);
}

async function loadFileAsImageData(file: File): Promise<LoadedImage> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error('Failed to load image.'));
      nextImage.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Canvas context is not available.');
    }

    context.drawImage(image, 0, 0);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    return {
      file,
      fileName: file.name,
      width: canvas.width,
      height: canvas.height,
      objectUrl,
      imageData
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function buildOverlayDataUrl(width: number, height: number, diffImageData: ImageData): string {
  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.width = width;
  overlayCanvas.height = height;

  const context = overlayCanvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas context is not available.');
  }

  context.putImageData(diffImageData, 0, 0);
  return overlayCanvas.toDataURL('image/png');
}

async function compareImages(beforeImage: LoadedImage, afterImage: LoadedImage): Promise<DiffResult> {
  const width = beforeImage.width;
  const height = Math.max(beforeImage.height, afterImage.height);
  const beforeData = new Uint8ClampedArray(width * height * 4);
  const afterData = new Uint8ClampedArray(width * height * 4);

  beforeData.set(beforeImage.imageData.data);
  afterData.set(afterImage.imageData.data);

  const diffImageData = new ImageData(width, height);
  const diffPixelCount = pixelmatch(
    beforeData,
    afterData,
    diffImageData.data,
    width,
    height,
    {
      threshold: PIXELMATCH_THRESHOLD,
      includeAA: false,
      alpha: 0.9,
      diffMask: true,
      diffColor: [255, 92, 92],
      diffColorAlt: [255, 179, 71]
    }
  );

  const overlayDataUrl = buildOverlayDataUrl(width, height, diffImageData);
  const totalPixels = width * height;

  return {
    width,
    height,
    diffPixelCount,
    diffRatio: totalPixels === 0 ? 0 : diffPixelCount / totalPixels,
    overlayDataUrl
  };
}

type UploadCardProps = {
  slot: SlotKey;
  title: string;
  description: string;
  image: LoadedImage | null;
  isDragging: boolean;
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: DragEvent<HTMLLabelElement>) => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDragOver: (event: DragEvent<HTMLLabelElement>) => void;
};

function UploadCard({
  slot,
  title,
  description,
  image,
  isDragging,
  onInputChange,
  onDrop,
  onDragEnter,
  onDragLeave,
  onDragOver
}: UploadCardProps) {
  return (
    <section className="glass-panel rounded-3xl p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{title}</p>
          <h2 className="mt-2 text-xl font-bold text-ink">{EMPTY_SLOT_LABEL[slot]}</h2>
          <p className="mt-2 text-sm text-muted">{description}</p>
        </div>
        <span className="rounded-full border border-border/70 bg-panelSoft/70 px-3 py-1 text-xs text-muted">
          PNG / JPEG / WebP
        </span>
      </div>

      <label
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        className={`vr-dropzone group flex min-h-[16rem] cursor-pointer flex-col items-center justify-center rounded-[1.75rem] border border-dashed px-5 py-6 text-center transition ${
          isDragging ? 'border-accent bg-accent/10 shadow-[0_0_0_1px_rgba(234,166,83,0.3)]' : 'border-border/70'
        }`}
      >
        <input
          type="file"
          accept={ACCEPTED_MIME_TYPES.join(',')}
          className="sr-only"
          onChange={onInputChange}
          aria-label={title}
        />

        {image ? (
          <div className="flex w-full flex-col items-center gap-4">
            <div className="vr-preview-shell flex max-h-[19rem] w-full items-center justify-center overflow-hidden rounded-[1.25rem] px-3 py-3">
              <img
                src={image.objectUrl}
                alt={`${title} のプレビュー`}
                className="max-h-[17rem] w-auto max-w-full rounded-xl object-contain shadow-[0_18px_38px_-28px_rgba(0,0,0,0.8)]"
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-ink">{image.fileName}</p>
              <p className="text-xs text-muted">
                {image.width} × {image.height}px / {formatBytes(image.file.size)}
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-panel/60 px-4 py-2 text-sm font-medium text-muted transition group-hover:border-accent group-hover:text-ink">
              <ImagePlus className="h-4 w-4" />
              画像を差し替える
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-border/70 bg-panel/75 text-accent shadow-[0_12px_32px_-24px_rgba(0,0,0,0.8)]">
              <Upload className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <p className="text-base font-semibold text-ink">クリックまたはドラッグ＆ドロップ</p>
              <p className="text-sm text-muted">1ファイルのみ / 10MB以下 / 横幅が同じ画像で比較</p>
            </div>
          </div>
        )}
      </label>
    </section>
  );
}

export function VisualRegressionPage() {
  const [beforeImage, setBeforeImage] = useState<LoadedImage | null>(null);
  const [afterImage, setAfterImage] = useState<LoadedImage | null>(null);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [showDiffOverlay, setShowDiffOverlay] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [draggingSlot, setDraggingSlot] = useState<SlotKey | null>(null);

  useEffect(() => {
    return () => {
      if (beforeImage) {
        URL.revokeObjectURL(beforeImage.objectUrl);
      }
      if (afterImage) {
        URL.revokeObjectURL(afterImage.objectUrl);
      }
    };
  }, [beforeImage, afterImage]);

  const canCompare = Boolean(beforeImage && afterImage && !isComparing);

  const resultSummary = useMemo(() => {
    if (!diffResult) {
      return '画像を選択すると、ここに差分サマリーを表示します。';
    }

    if (diffResult.diffPixelCount === 0) {
      return `差分なし / 差分率 ${formatRatio(diffResult.diffRatio)} / 差分ピクセル数 ${formatCount(diffResult.diffPixelCount)}`;
    }

    return `差分あり / 差分率 ${formatRatio(diffResult.diffRatio)} / 差分ピクセル数 ${formatCount(diffResult.diffPixelCount)}`;
  }, [diffResult]);

  function revokeLoadedImage(image: LoadedImage | null) {
    if (image) {
      URL.revokeObjectURL(image.objectUrl);
    }
  }

  function resetDiffState() {
    setDiffResult(null);
  }

  async function handleCompare(nextBeforeImage: LoadedImage | null, nextAfterImage: LoadedImage | null) {
    resetDiffState();

    if (!nextBeforeImage) {
      setErrorMessage('Before画像をアップロードしてください。');
      return;
    }

    if (!nextAfterImage) {
      setErrorMessage('After画像をアップロードしてください。');
      return;
    }

    if (nextBeforeImage.width !== nextAfterImage.width) {
      setErrorMessage('画像の横幅が一致していません。同じ横幅の画像を選択してください。');
      return;
    }

    setErrorMessage(null);
    setIsComparing(true);

    try {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
      const nextDiff = await compareImages(nextBeforeImage, nextAfterImage);
      setDiffResult(nextDiff);
    } catch (error) {
      console.error(error);
      setErrorMessage('画像の読み込みに失敗しました。別のファイルでお試しください。');
    } finally {
      setIsComparing(false);
    }
  }

  async function validateAndLoadFile(file: File): Promise<LoadedImage> {
    if (!isAcceptedMimeType(file)) {
      throw new Error('対応していない画像形式です。PNG / JPEG / WebP を使用してください。');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error('ファイルサイズが大きすぎます。10MB以下の画像を選択してください。');
    }

    try {
      return await loadFileAsImageData(file);
    } catch (error) {
      console.error(error);
      throw new Error('画像の読み込みに失敗しました。別のファイルでお試しください。');
    }
  }

  async function applyFile(slot: SlotKey, file: File | null) {
    if (!file) {
      return;
    }

    try {
      const loadedImage = await validateAndLoadFile(file);
      setErrorMessage(null);

      if (slot === 'before') {
        revokeLoadedImage(beforeImage);
        setBeforeImage(loadedImage);
        await handleCompare(loadedImage, afterImage);
      } else {
        revokeLoadedImage(afterImage);
        setAfterImage(loadedImage);
        await handleCompare(beforeImage, loadedImage);
      }
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('画像の読み込みに失敗しました。別のファイルでお試しください。');
      }
    }
  }

  function handleFileInput(slot: SlotKey) {
    return async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      await applyFile(slot, file);
      event.target.value = '';
    };
  }

  function handleDrop(slot: SlotKey) {
    return async (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      setDraggingSlot(null);
      const file = event.dataTransfer.files?.[0] ?? null;
      await applyFile(slot, file);
    };
  }

  function handleReset() {
    revokeLoadedImage(beforeImage);
    revokeLoadedImage(afterImage);
    setBeforeImage(null);
    setAfterImage(null);
    setDiffResult(null);
    setShowDiffOverlay(true);
    setErrorMessage(null);
    setIsComparing(false);
    setDraggingSlot(null);
  }

  return (
    <>
      <Seo meta={PAGE_SEO.visualRegression} />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-10 pt-20 sm:px-6 sm:pb-14 sm:pt-24">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-accent">
              ← ツール一覧へ戻る
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Visual Regression</p>
            <h1 className="max-w-3xl text-3xl font-black leading-tight text-ink sm:text-4xl">
              Before / After のスクリーンショット差分を、ブラウザだけで見つける
            </h1>
            <p className="max-w-3xl text-sm text-muted sm:text-base">
              2枚の画像を比較し、After画像の上に差分ハイライトを重ねて確認できます。比較処理はブラウザ内で完結し、画像は外部サーバーへ送信しません。
            </p>
          </div>
        </div>

        <section className="grid gap-5 xl:grid-cols-2">
          <UploadCard
            slot="before"
            title="Before"
            description="改修前のスクリーンショットを選択します。"
            image={beforeImage}
            isDragging={draggingSlot === 'before'}
            onInputChange={handleFileInput('before')}
            onDrop={handleDrop('before')}
            onDragEnter={() => setDraggingSlot('before')}
            onDragLeave={() => setDraggingSlot((current) => (current === 'before' ? null : current))}
            onDragOver={(event) => event.preventDefault()}
          />
          <UploadCard
            slot="after"
            title="After"
            description="改修後のスクリーンショットを選択します。"
            image={afterImage}
            isDragging={draggingSlot === 'after'}
            onInputChange={handleFileInput('after')}
            onDrop={handleDrop('after')}
            onDragEnter={() => setDraggingSlot('after')}
            onDragLeave={() => setDraggingSlot((current) => (current === 'after' ? null : current))}
            onDragOver={(event) => event.preventDefault()}
          />
        </section>

        <section className="glass-panel rounded-3xl p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-ink">比較操作</p>
              <p className="text-sm text-muted">画像を差し替えると自動で再比較されます。必要に応じて手動でも再実行できます。</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => handleCompare(beforeImage, afterImage)}
                disabled={!canCompare}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isComparing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                比較を実行
              </button>

              <label className="inline-flex cursor-pointer items-center gap-3 rounded-full border border-border/80 bg-panel/65 px-4 py-3 text-sm font-medium text-ink">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-accent"
                  checked={showDiffOverlay}
                  onChange={(event) => setShowDiffOverlay(event.target.checked)}
                />
                {showDiffOverlay ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                差分表示
              </label>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border/80 bg-panel/65 px-5 py-3 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent"
              >
                <RefreshCcw className="h-4 w-4" />
                リセット
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="rounded-[1.5rem] border border-border/70 bg-panelSoft/60 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">結果サマリー</p>
              <p className="mt-2 text-sm text-ink">{resultSummary}</p>
              {diffResult ? (
                <p className="mt-2 text-xs text-muted">
                  比較サイズ: {diffResult.width} × {diffResult.height}px / 差分表示: {showDiffOverlay ? 'ON' : 'OFF'}
                </p>
              ) : null}
            </div>

            <div className="rounded-[1.5rem] border border-border/70 bg-panelSoft/60 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">比較ルール</p>
              <ul className="mt-2 space-y-2 text-sm text-muted">
                <li>横幅が同じ画像のみ比較できます。</li>
                <li>縦幅が異なる場合、不足している領域も差分として扱います。</li>
                <li>差分は After 画像の上に重ねて表示します。</li>
                <li>比較処理はブラウザ内だけで実行します。</li>
              </ul>
            </div>
          </div>

          {errorMessage ? (
            <div
              role="alert"
              className="mt-5 flex items-start gap-3 rounded-[1.5rem] border border-rose-400/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-100"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          ) : null}
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <article className="glass-panel rounded-3xl p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Preview</p>
                <h2 className="mt-2 text-xl font-bold text-ink">Before</h2>
              </div>
              {beforeImage ? (
                <span className="rounded-full border border-border/80 bg-panelSoft/60 px-3 py-1 text-xs text-muted">
                  {beforeImage.width} × {beforeImage.height}px
                </span>
              ) : null}
            </div>

            <div className="vr-preview-shell flex min-h-[22rem] items-center justify-center overflow-auto rounded-[1.75rem] px-3 py-3">
              {beforeImage ? (
                <img src={beforeImage.objectUrl} alt="Before画像の比較表示" className="h-auto max-w-full rounded-2xl object-contain" />
              ) : (
                <p className="px-6 text-center text-sm text-muted">Before画像をアップロードすると、ここに表示されます。</p>
              )}
            </div>
          </article>

          <article className="glass-panel rounded-3xl p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Preview</p>
                <h2 className="mt-2 text-xl font-bold text-ink">After + 差分ハイライト</h2>
              </div>
              {afterImage ? (
                <span className="rounded-full border border-border/80 bg-panelSoft/60 px-3 py-1 text-xs text-muted">
                  {afterImage.width} × {afterImage.height}px
                </span>
              ) : null}
            </div>

            <div className="vr-preview-shell relative flex min-h-[22rem] items-center justify-center overflow-auto rounded-[1.75rem] px-3 py-3">
              {afterImage ? (
                <div className="relative">
                  <img src={afterImage.objectUrl} alt="After画像の比較表示" className="relative z-10 h-auto max-w-full rounded-2xl object-contain" />
                  {diffResult && showDiffOverlay ? (
                    <img
                      src={diffResult.overlayDataUrl}
                      alt="差分ハイライトオーバーレイ"
                      className="pointer-events-none absolute inset-0 z-20 h-full w-full rounded-2xl object-contain mix-blend-screen"
                    />
                  ) : null}
                </div>
              ) : (
                <p className="px-6 text-center text-sm text-muted">After画像をアップロードすると、ここに差分付きで表示されます。</p>
              )}

              {isComparing ? (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/40 backdrop-blur-[2px]">
                  <div className="flex items-center gap-3 rounded-full border border-white/15 bg-slate-950/80 px-4 py-3 text-sm text-white shadow-[0_18px_32px_-24px_rgba(0,0,0,0.85)]">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    比較中...
                  </div>
                </div>
              ) : null}
            </div>
          </article>
        </section>
      </main>
    </>
  );
}
