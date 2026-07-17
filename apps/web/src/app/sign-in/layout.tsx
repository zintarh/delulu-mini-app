import { RightPanelProvider } from "@/contexts/right-panel-context";

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return <RightPanelProvider>{children}</RightPanelProvider>;
}
