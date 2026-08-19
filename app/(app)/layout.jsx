import Shell from "@/components/Shell";
import RouteGuard from "@/components/RouteGuard";
import BillzAutoSync from "@/components/BillzAutoSync";

export default function AppLayout({ children }) {
  return (
    <Shell>
      {/* Billz'dan fonda tortish — eskirgan bo'lsa, rahbar ochganda */}
      <BillzAutoSync />
      <RouteGuard>{children}</RouteGuard>
    </Shell>
  );
}
