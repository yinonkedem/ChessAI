/**
 * Mastery ring. Pure SVG, sized by CSS so it scales with the surrounding text.
 *
 * stroke-dasharray on a circle is the whole trick: the circumference is
 * 2*pi*r, so a dash of percent% of that draws exactly that fraction of arc.
 */
export default function ProgressRing({ percent = 0, size = 44, label }) {
    const r = 18;
    const c = 2 * Math.PI * r;
    const shown = Math.max(0, Math.min(100, percent));

    return (
        <svg
            className="ring"
            width={size}
            height={size}
            viewBox="0 0 44 44"
            role="img"
            aria-label={label ?? `${shown}% mastered`}
        >
            <circle className="ring__track" cx="22" cy="22" r={r} />
            <circle
                className="ring__fill"
                cx="22"
                cy="22"
                r={r}
                strokeDasharray={`${(c * shown) / 100} ${c}`}
                /* start at 12 o'clock rather than 3 */
                transform="rotate(-90 22 22)"
            />
            <text className="ring__text" x="22" y="22" dominantBaseline="central" textAnchor="middle">
                {shown}
            </text>
        </svg>
    );
}
