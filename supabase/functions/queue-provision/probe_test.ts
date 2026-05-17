Deno.test("probe env", () => {
  const keys = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY"];
  for (const k of keys) console.log(k, "=", Deno.env.get(k) ? "SET("+Deno.env.get(k)!.length+")" : "MISSING");
});
