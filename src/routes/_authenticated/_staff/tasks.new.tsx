import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { TaskForm, toFormValues, toPayload } from "@/components/TaskForm";
import { uploadTaskFiles } from "@/lib/tasks";
import { pageHead } from "@/lib/metadata";

export const Route = createFileRoute("/_authenticated/_staff/tasks/new")({
  validateSearch: z.object({ parent: z.string().uuid().optional().catch(undefined) }),
  head: () => pageHead("משימה חדשה", "פתיחת משימה חדשה"),
  component: NewTask,
});

function NewTask() {
  const { parent } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [requestKey] = useState(() => crypto.randomUUID());
  const navigate = useNavigate();
  const qc = useQueryClient();
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">{parent ? "תת־משימה חדשה" : "משימה חדשה"}</h1>
      <div className="rounded-2xl border bg-card p-6">
        <TaskForm
          mode="create"
          initial={toFormValues()}
          busy={busy}
          onSubmit={async (v, files) => {
            if (busy) return;
            setBusy(true);
            let { data, error } = await supabase.from("tasks").insert({ ...toPayload(v), parent_id: parent ?? null, request_key: requestKey }).select("id, number").single();
            if (error?.code === "23505") ({ data, error } = await supabase.from("tasks").select("id, number").eq("request_key", requestKey).single());
            if (error || !data) { setBusy(false); toast.error("השמירה נכשלה; הטופס נשמר וניתן לנסות שוב"); return; }
            try { await uploadTaskFiles(data.id, files); } catch { toast.error("המשימה נשמרה, אך חלק מהקבצים לא הועלו"); }
            qc.invalidateQueries({ queryKey: ["tasks"] });
            toast.success(`משימה #${data.number} נוצרה`);
            navigate({ to: "/tasks/$id", params: { id: data.id } });
          }}
        />
      </div>
    </div>
  );
}
