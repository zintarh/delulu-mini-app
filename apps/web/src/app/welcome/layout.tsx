import { ScrollScreen } from "@/components/scroll-screen";
import { RightPanelProvider } from "@/contexts/right-panel-context";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <RightPanelProvider>
      <ScrollScreen>{children}</ScrollScreen>
    </RightPanelProvider>
  );
}
