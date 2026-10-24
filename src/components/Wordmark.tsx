/**
 * The Askable wordmark, in the two sizes the app needs.
 *
 * Single source of truth for the name, the tagline and the "link or upload"
 * line — they appear on the landing page and above every chat, and they must
 * never drift apart. Styled to match slide 1 of the pitch deck (mono display
 * face, amber kicker) so the product and the pitch read as one thing.
 */

/** Both surfaces say this. Change it here or nowhere. */
export const TAGLINE = 'Make any video askable.';

/** The capability line. `hero` shows it in full, `compact` shows the short half. */
const DESCRIPTION_LEAD = 'Paste a YouTube link or upload your own video.';
const DESCRIPTION_REST =
  ' Get a source you can interrogate in plain language — where ';
const DESCRIPTION_EMPHASIS = 'every answer cites the exact second it came from';
const DESCRIPTION_TAIL = ', as a link that jumps you there.';

interface WordmarkProps {
  /** `hero` for the landing page, `compact` for the bar above a chat. */
  variant: 'hero' | 'compact';
}

export default function Wordmark({ variant }: WordmarkProps) {
  if (variant === 'compact') {
    return (
      <div className="flex items-baseline gap-3 min-w-0">
        <span className="font-mono text-[10px] font-semibold tracking-[0.2em] text-brand shrink-0">
          ASKABLE
        </span>
        <span className="font-mono text-xs tracking-[-0.01em] text-text-primary truncate">
          {TAGLINE}
        </span>
        <span className="text-[11px] text-text-muted truncate hidden md:inline">
          {DESCRIPTION_LEAD}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="font-mono text-xs font-semibold tracking-[0.2em] text-brand">
        ASKABLE
      </p>
      <h1 className="font-mono font-semibold text-text-primary tracking-[-0.035em] leading-[1.04] text-[clamp(30px,5.2vw,54px)] text-balance">
        Make any video
        <br />
        askable.
      </h1>
      <p className="text-[15px] leading-relaxed text-text-secondary max-w-[54ch]">
        <span className="font-semibold text-text-primary">{DESCRIPTION_LEAD}</span>
        {DESCRIPTION_REST}
        <span className="font-semibold text-text-primary">{DESCRIPTION_EMPHASIS}</span>
        {DESCRIPTION_TAIL}
      </p>
    </div>
  );
}
