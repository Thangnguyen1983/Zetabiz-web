/* Kết nối Supabase cho cổng quản trị Zetabiz.
   Khoá "publishable" được phép công khai: mọi quyền truy cập dữ liệu
   đều do chính sách RLS trong cơ sở dữ liệu kiểm soát. */
window.ZETABIZ_ADMIN = {
  supabaseUrl: 'https://zuucoqfylagcfwnhomet.supabase.co',
  supabaseKey: 'sb_publishable_LVQhPQFXraB7C_1i0VtFlw_WndNHxAq',
  bootstrapEmail: 'ceo@mhtbiz.com'
};
window.zbSb = window.supabase.createClient(window.ZETABIZ_ADMIN.supabaseUrl, window.ZETABIZ_ADMIN.supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
