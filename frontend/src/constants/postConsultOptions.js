/** Values stored in `post_consult_plans` and sent to `POST /tokens/:id/end-consult`. */
export const POST_CONSULT_OPTIONS = [
  {
    id: "labs",
    label: "Lab tests",
    hint: "Lab queue; may start billing before lab work"
  },
  {
    id: "treatment",
    label: "Treatment",
    hint: "Next step is treatment / procedure"
  },
  {
    id: "pharmacy",
    label: "Pharmacy / buy medicine",
    hint: "Medication purchase; may start billing"
  },
  {
    id: "billing",
    label: "Billing / payment",
    hint: "Payment or billing desk (no new lab order)"
  }
];

export const postConsultLabel = (id) =>
  POST_CONSULT_OPTIONS.find((o) => o.id === id)?.label ?? id;
