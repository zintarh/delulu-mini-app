import { ScrollScreen } from "@/components/scroll-screen";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ScrollScreen>{children}</ScrollScreen>;
}
