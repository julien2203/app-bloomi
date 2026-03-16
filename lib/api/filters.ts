import { supabase } from '../supabase';

export async function getCategories(gender?: string) {
  let query = supabase.from('categories').select('*').order('name');
  if (gender) {
    query = query.eq('gender', gender);
  }
  const { data } = await query;
  return data ?? [];
}

export async function getRootCategoriesByGender(gender: string) {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('gender', gender)
    .is('parent_id', null)
    .order('name');
  return data ?? [];
}

export async function getChildCategories(parentId: number) {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('parent_id', parentId)
    .order('name');
  return data ?? [];
}

export async function getBrands(gender?: string, type?: string) {
  let query = supabase.from('brands').select('*').order('name');
  if (gender) {
    query = query.eq('gender', gender);
  }
  if (type) {
    query = query.eq('type', type);
  }
  const { data } = await query;
  return data ?? [];
}

export async function getSizes(gender?: string, type?: string) {
  let query = supabase.from('sizes').select('*').order('sort_order');
  if (gender) {
    query = query.eq('gender', gender);
  }
  if (type) {
    query = query.eq('type', type);
  }
  const { data } = await query;
  return data ?? [];
}

export async function getColors() {
  const { data } = await supabase.from('colors').select('*').order('name');
  return data ?? [];
}

export async function getConditions() {
  const { data } = await supabase
    .from('conditions')
    .select('*')
    .order('sort_order');
  return data ?? [];
}

