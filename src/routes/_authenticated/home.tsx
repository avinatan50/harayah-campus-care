import { createFileRoute, redirect } from "@tanstack/react-router";
import { meQuery } from "@/lib/tasks";
import { pageHead } from "@/lib/metadata";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => pageHead("מעבר לחשבון", "מעבר למסך העבודה האישי במערכת הראי״ה"),
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.fetchQuery(meQuery);
    if (!me.active) throw new Error("החשבון חסום. פנו למנהל הראשי.");
    throw redirect({ to: me.role === "user" ? "/report" : "/dashboard", replace: true });
  },
  pendingComponent: Loading,
  component: Loading,
});

function Loading() {
  return <div className="flex min-h-screen items-center justify-center text-muted-foreground">טוען את החשבון…</div>;
}
