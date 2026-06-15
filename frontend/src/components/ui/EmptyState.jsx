/**
 * components/ui/EmptyState.jsx
 *
 * Displayed when a list has no items — designed, not left blank.
 * Uses an inline SVG illustration so there's no image load dependency.
 *
 * Props:
 *   icon     — lucide-react component (optional, shown above title)
 *   title    — main message (e.g. "No groups yet")
 *   message  — supporting detail
 *   action   — { label, onClick } — optional CTA button
 */

export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-fade-in">
      {/* Illustration — inline SVG so no CDN dependency */}
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-3xl bg-zinc-800/80 border border-zinc-700/50
                        flex items-center justify-center mx-auto">
          {Icon ? (
            <Icon className="w-10 h-10 text-zinc-600" strokeWidth={1.5} />
          ) : (
            /* Default: inbox / empty box SVG */
            <svg className="w-10 h-10 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
              />
            </svg>
          )}
        </div>
        {/* Decorative dots */}
        <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-brand-600/30 border border-brand-600/20" />
        <div className="absolute -bottom-1 -left-3 w-3 h-3 rounded-full bg-violet-600/30 border border-violet-600/20" />
      </div>

      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-zinc-500 max-w-xs leading-relaxed">{message}</p>

      {action && (
        <button
          onClick={action.onClick}
          className="mt-6 btn-primary w-auto px-6 py-2.5"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
