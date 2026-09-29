import { supabase } from "../supabase";

export async function fetchReservations() {
  const { data, error } = await supabase.rpc("get_reservations");

  if (error) throw error;

  return data || [];
}

export async function deleteReservationById(id) {
  const { error } = await supabase.rpc("delete_reservation", {
    p_reservation_id: String(id),
  });

  if (error) throw error;
}