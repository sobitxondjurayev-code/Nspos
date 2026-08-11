import Shell from "@/components/Shell";
import RouteGuard from "@/components/RouteGuard";

export default function AppLayout({ children }) {
  return (
    <Shell>
      <RouteGuard>{children}</RouteGuard>
    </Shell>
  );
}
