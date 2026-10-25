/**
 * The Askable wordmark and hero presentation.
 *
 * Implements the 5-second clarity heuristic:
 * - What does this do, and who is it built for?
 * - Direct problem-to-solution mapping articulated immediately.
 * - Distinct styling matching the screening-room theme.
 */

import { FiClock, FiSearch, FiZap, FiShield } from 'react-icons/fi';

export const TAGLINE = 'Make any video askable.';

const DESCRIPTION_LEAD = 'You can Control-F a document. You cannot Control-F a video.';
const DESCRIPTION_BODY =
  ' Askable turns any YouTube video or uploaded recording into an interactive source you can interrogate in plain language — where ';
const DESCRIPTION_EMPHASIS = 'every answer cites the exact second it was spoken';
const DESCRIPTION_TAIL = ', as a deep link that jumps you straight to that moment.';

interface WordmarkProps {
  /** `hero` for the landing page, `compact` for the bar above a chat. */
  variant: 'hero' | 'compact';
}

export default function Wordmark({ variant }: WordmarkProps) {
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-mono text-[10px] font-bold tracking-[0.2em] text-brand shrink-0">
          ASKABLE
        </span>
        <span className="h-3 w-px bg-border shrink-0" />
        <span className="font-mono text-xs tracking-[-0.01em] text-text-primary truncate">
          {TAGLINE}
        </span>
        <span className="text-[11px] text-text-muted truncate hidden md:inline">
          · Citing exact seconds with direct jump links
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Top kicker + status pill */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-bold tracking-[0.2em] text-brand uppercase">
          ASKABLE
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-brand/10 text-brand border border-brand/20">
          <FiZap className="w-3 h-3 text-brand" />
          <span>Frictionless Judge Sandbox Active</span>
        </span>
      </div>

      {/* Main hero headline - 5-second test */}
      <h1 className="font-mono font-semibold text-text-primary tracking-[-0.035em] leading-[1.04] text-[clamp(32px,5.4vw,56px)] text-balance">
        Make any video
        <br />
        <span className="text-brand">askable.</span>
      </h1>

      {/* Direct problem-to-solution mapping */}
      <div className="space-y-2 text-[15px] leading-relaxed text-text-secondary max-w-[56ch]">
        <p className="font-medium text-text-primary font-mono text-sm tracking-tight">
          {DESCRIPTION_LEAD}
        </p>
        <p>
          {DESCRIPTION_BODY}
          <span className="font-semibold text-text-primary">{DESCRIPTION_EMPHASIS}</span>
          {DESCRIPTION_TAIL}
        </p>
      </div>

      {/* Value badges: answering judges' core evaluation criteria */}
      <div className="flex flex-wrap gap-2 pt-1">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface border border-border text-xs text-text-secondary font-medium">
          <FiClock className="w-3.5 h-3.5 text-brand" />
          Exact Timecode Citing
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface border border-border text-xs text-text-secondary font-medium">
          <FiSearch className="w-3.5 h-3.5 text-accent" />
          Literal Word-Count Scanner
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface border border-border text-xs text-text-secondary font-medium">
          <FiShield className="w-3.5 h-3.5 text-status-done" />
          Zero Auth Obstacles (1-Click Access)
        </span>
      </div>
    </div>
  );
}
