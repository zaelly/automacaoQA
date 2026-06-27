const supabase = require('./supabase');

async function findOne(table, match = {}) {
  let q = supabase.from(table).select('*');
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data;
}

async function findAll(table, match = {}, { select = '*', order, ascending = false, limit, offset } = {}) {
  let q = supabase.from(table).select(select);
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  if (order) q = q.order(order, { ascending });
  if (offset !== undefined && limit !== undefined) {
    q = q.range(offset, offset + limit - 1);
  } else if (limit !== undefined) {
    q = q.limit(limit);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function insert(table, data) {
  const { data: result, error } = await supabase.from(table).insert(data).select().single();
  if (error) throw error;
  return result;
}

async function update(table, match, data) {
  let q = supabase.from(table).update(data);
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  const { data: result, error } = await q.select();
  if (error) throw error;
  return result?.[0] || null;
}

async function remove(table, match) {
  let q = supabase.from(table).delete();
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  const { data, error } = await q.select();
  if (error) throw error;
  return (data || []).length;
}

async function countRows(table, match = {}) {
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  const { count, error } = await q;
  if (error) throw error;
  return count || 0;
}

module.exports = { supabase, findOne, findAll, insert, update, remove, countRows };
