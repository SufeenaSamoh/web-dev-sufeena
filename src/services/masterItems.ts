import { supabase } from "@/lib/supabase";

export async function getItems() {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .order("code");

  if (error) throw error;

  return data;
}

export async function createItem(item: any) {
  const { data, error } = await supabase
    .from("items")
    .insert(item)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function updateItem(id: string, item: any) {
  const { data, error } = await supabase
    .from("items")
    .update(item)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function deleteItem(id: string) {
  const { error } = await supabase
    .from("items")
    .delete()
    .eq("id", id);

  if (error) throw error;
}