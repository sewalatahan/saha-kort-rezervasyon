import { supabase } from "../supabase";

export async function fetchClosedSlots() {
  const { data, error } = await supabase
    .from("closed_slots")
    .select("*");

  if (error) throw error;

  return data || [];
}

export async function createClosedSlotService(payload) {
  const { error } = await supabase.rpc("create_closed_slot", {
    p_court_id: payload.court_id,
    p_close_date: payload.close_date,
    p_start_time: payload.start_time,
    p_end_time: payload.end_time,
    p_reason: payload.reason,
  });

  if (error) throw error;
}

export async function deleteClosedSlotService(id) {
  const { error } = await supabase.rpc("delete_closed_slot", {
    p_closed_slot_id: String(id),
  });

  if (error) throw error;
}