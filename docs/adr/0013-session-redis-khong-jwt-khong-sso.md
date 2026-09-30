# 0013. Session opaque trong Redis, không JWT, không SSO

- Trạng thái: accepted
- Ngày: 2026-09-30
- Nguồn: phiên grill 2026-09-30, câu 27

## Bối cảnh

Tài khoản do nhà trường cấp (Quản trị hoặc Phòng Đào tạo tạo, nhập hàng loạt), không tự đăng ký. Cần thu hồi
session ngay khi khoá tài khoản hoặc đổi vai trò, và có thao tác tài chính nhạy cảm.

## Quyết định

- Chỉ có tài khoản nội bộ: mã số sinh viên hoặc mã cán bộ + mật khẩu. Bắt buộc đổi mật khẩu ở lần đăng nhập đầu.
- Băm argon2id qua `Bun.password`, bọc sau interface `PasswordHasher`.
- Session opaque lưu trong Redis. Cookie `httpOnly; Secure; SameSite=Lax` trên domain gốc.
- Hết hạn tuyệt đối 8 giờ cho mọi vai trò, không có idle timeout.
- CSRF: kiểm tra `Origin` cho mọi request ghi, và thêm double-submit token cho thao tác tài chính của Phòng Tài vụ.
- Giới hạn tần suất đăng nhập.
- Không SSO, và không xây lớp trừu tượng provider cho SSO.

## Hệ quả

- Thu hồi session tức thì bằng cách xoá key trong Redis.
- Mỗi request tốn một lần đọc Redis. Chấp nhận được.
- Mất Redis cache thì mọi người phải đăng nhập lại. Có thể tách session sang Redis queue nếu thấy cần.

## Phương án đã cân nhắc

- **JWT:** không cần lưu trạng thái, nhưng khó thu hồi, và vẫn phải có denylist.
- **SSO trường (OAuth/SAML):** chưa có yêu cầu và không có IdP để thử.
- **Idle timeout 30 phút:** người dùng không muốn.
