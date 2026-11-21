/**
 * A full-screen page that scrolls on its own. html/body never scroll
 * (globals.css — the app shell feels native), so screens outside the app
 * shell (sign-in, welcome, terms) need this or anything below the first
 * screen — and an input under the phone keyboard — can't be reached.
 */
export function ScrollScreen({ children }: { children: React.ReactNode }) {
  return <div className="h-dvh overflow-y-auto overscroll-contain">{children}</div>;
}
