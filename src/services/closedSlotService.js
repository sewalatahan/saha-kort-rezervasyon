import { supabase } from "../supabase";

export async function fetchClosedSlots() {
  const { data, error } = await supabase
    .from("closed_slots")
    .select("*");

  if (error) throw error;

  return data || [];
}

export async function createClosedSlotService(payload) {
  const { error } = await supabase
    .from("closed_slots")
    .insert(payload);

  if (error) throw error;
}

export async function deleteClosedSlotService(id) {
  const { error } = await supabase
    .from("closed_slots")
    .delete()
    .eq("id", id);

  if (error) throw error;
}