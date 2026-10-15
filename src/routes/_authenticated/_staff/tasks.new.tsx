import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { TaskForm, toFormValues, toPayload } from "@/components/TaskForm";
import { uploadTaskFiles } from "@/lib/tasks";

export const Route = createFileRoute("/_authenticated/_staff/tasks/new")({
  validateSearch: z.object({ parent: z.string().uuid().optional().catch(undefined) }),
  head: () => ({ meta: [{ title: "משימה חדשה – הראי״ה" }, { name: "description", content: "פתיחת משימה חדשה" }] }),
  component: NewTask,
});

function NewTask() {
  const { parent } = Route.useSearch();
  const [busy, setBusy] = useState(false);
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
            setBusy(true);
            const { data, error } = await supabase.from("tasks").insert({ ...toPayload(v), parent_id: parent ?? null }).select("id, number").single();
            if (error || !data) { setBusy(false); toast.error("השמירה נכשלה"); return; }
            try { await uploadTaskFiles(data.id, files); } catch { toast.error("חלק מהקבצים לא הועלו"); }
            qc.invalidateQueries({ queryKey: ["tasks"] });
            toast.success(`משימה #${data.number} נוצרה`);
            navigate({ to: "/tasks/$id", params: { id: data.id } });
          }}
        />
      </div>
    </div>
  );
}
