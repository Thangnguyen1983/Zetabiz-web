# Kế hoạch: quản trị đơn bán hàng & doanh thu SkyAgent và FactoryOne (MES) trên Zetabiz

## Quyết định đã chốt
- **Chỉ thu tiền trên Zetabiz.** Luồng tự thu tiền trong SkyAgent (`request_subscription`, `subscription_invoices`, `match_subscription_payment`) sẽ tắt / ẩn nút đăng ký gói, chuyển khách về Zetabiz.
- **MES = sản phẩm "Zetabiz FactoryOne"** trên website (khoá `factoryone`).

## Ba project Supabase
| Vai trò | Project ref | Tổ chức Supabase |
|---|---|---|
| Zetabiz (website + admin, nguồn sự thật về đơn/thanh toán/thuê bao) | `zuucoqfylagcfwnhomet` | `zhkbazsoeelbtfkqevov` |
| SkyAgent | `xqtamlsteaatbsmrqszu` | `hyixtjcdpyacszcpjyte` |
| MES / FactoryOne | `joibaiwbppmydhkgpnpt` | `hyixtjcdpyacszcpjyte` |

## Hiện trạng (kiểm tra 01/10/2026)
- Zetabiz đã có `orders`, `order_items`, `payments`, `subscriptions`, `subscription_events`, `organizations`, `products`, `product_plans` và các trang admin `orders.html`, `payments.html`, `subscriptions.html` (RPC `payment_review`, `subscription_set_status`, `subscription_renew`).
- SkyAgent: `organizations(plan_code, status trialing|active|past_due|suspended|cancelled, trial_ends_at, current_period_end)`, `plans` (starter 490k, business 1,49tr, travel_agency 2,99tr/tháng, enterprise), cron `update_subscription_statuses()` tự chuyển quá hạn → khoá. `platform_update_organization` chỉ cho platform admin đăng nhập.
- MES: `tenants(plan co_ban|tieu_chuan|doanh_nghiep, is_active, access_expires_at)`, `tenant_modules`, `plan_limits`. `sup_set_tenant_expiry` chỉ cho platform admin đăng nhập. Cả 3 tenant hiện **chưa có hạn dùng**.

## Việc cần làm
1. **Zetabiz DB**: bảng `product_accounts` (organization_id ↔ product_key `skyagent|factoryone` ↔ external_id) và `product_plan_map` (product_plan_id ↔ mã gói bên sản phẩm).
2. **SkyAgent DB**: hàm `zetabiz_sync_org(p_org, p_plan_code, p_status, p_period_end)` chỉ cho máy chủ (service role) gọi; thu hồi quyền anon/authenticated.
3. **MES DB**: hàm `zetabiz_sync_tenant(p_tenant, p_plan, p_is_active, p_expires_at)` tương tự.
4. **Vercel API** `api/product-sync.js`: khi thuê bao Zetabiz kích hoạt/gia hạn/tạm ngưng/huỷ → gọi hàm ở sản phẩm tương ứng. Khoá bí mật lưu ở biến môi trường Vercel: `SKYAGENT_SERVICE_KEY`, `MES_SERVICE_KEY` (không bao giờ đưa vào mã trình duyệt).
5. **Admin Zetabiz**: trang Doanh thu (theo sản phẩm / tháng / gói từ thanh toán đã duyệt) + danh sách khách sắp hết hạn / dùng thử / quá hạn; nút "Liên kết tài khoản sản phẩm" trong chi tiết thuê bao.
6. Đặt hạn dùng ban đầu cho tenant MES và ẩn luồng tự thu tiền trong SkyAgent.
