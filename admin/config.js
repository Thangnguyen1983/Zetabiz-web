/* Kết nối Supabase cho cổng quản trị Zetabiz.
   Khoá "publishable" được phép công khai: mọi quyền truy cập dữ liệu
   đều do chính sách RLS trong cơ sở dữ liệu kiểm soát. */
window.BIZTECK_ADMIN = {
  supabaseUrl: 'https://zuucoqfylagcfwnhomet.supabase.co',
  supabaseKey: 'sb_publishable_LVQhPQFXraB7C_1i0VtFlw_WndNHxAq',
  bootstrapEmail: 'ceo@mhtbiz.com'
};
window.bizSb = window.supabase.createClient(window.BIZTECK_ADMIN.supabaseUrl, window.BIZTECK_ADMIN.supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
