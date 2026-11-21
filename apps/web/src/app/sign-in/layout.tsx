import { RightPanelProvider } from "@/contexts/right-panel-context";
import { ScrollScreen } from "@/components/scroll-screen";

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return (
    <RightPanelProvider>
      <ScrollScreen>{children}</ScrollScreen>
    </RightPanelProvider>
  );
}
