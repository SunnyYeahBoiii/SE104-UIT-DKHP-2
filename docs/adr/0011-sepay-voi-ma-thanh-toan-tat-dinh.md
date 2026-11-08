# 0011. Thanh toán qua SePay với mã thanh toán tất định

- Trạng thái: accepted
- Ngày: 2026-09-30
- Nguồn: phiên grill 2026-09-30, câu 20 và 21

## Bối cảnh

Sinh viên cần đóng học phí online. SePay theo dõi tài khoản ngân hàng của trường và gọi webhook khi có tiền vào,
kèm `code` được tách từ nội dung chuyển khoản theo cấu hình mã thanh toán (tiền tố 2–3 chữ cái + phần số). Sinh
viên được đóng nhiều lần (QĐ6), và có thể chuyển thiếu, chuyển thừa hoặc ghi sai nội dung.

## Quyết định

- **Mã thanh toán tất định** cho mỗi cặp (sinh viên, học kỳ): `HP` + mã số sinh viên + mã học kỳ, ví dụ `HP2352000120251`. Không có thực thể "yêu cầu thanh toán".
- QR VietQR sinh lúc hiển thị, chỉ khi số tiền còn lại > 0. Số tiền trên QR = số tiền còn lại hiện tại, sinh viên không chỉnh được.
- Webhook:
  1. Kiểm tra `Authorization: Apikey`, `transferType = in` và số tài khoản nhận.
  2. `INSERT` vào `bank_transaction` với unique trên `id` của SePay.
  3. Trả 200 ngay, rồi đẩy job.
- Worker khớp theo `code`. Trong một transaction:
  - ghi có vào sổ cái **đúng số tiền thực nhận**
  - tạo phiếu thu (BM6) kênh `BANK_TRANSFER`
  - ghi outbox để gửi thông báo
- Không khớp được mã thì vào hàng chờ gán thủ công của Phòng Tài vụ.
- Đối soát hằng ngày bằng API SePay.
- Thu tại quầy dùng cùng cấu trúc phiếu thu, kênh `COUNTER`.

## Hệ quả

- Webhook trùng không tạo phiếu thu trùng (unique trên id SePay).
- Chuyển thiếu thì còn nợ, và QR kế tiếp hiện phần còn lại: đó chính là "đóng nhiều lần" của QĐ6. Chuyển thừa thì thành số dư có.
- Mã chỉ gồm chữ và số, không phụ thuộc số tiền, nên sinh viên chuyển lại lần hai vẫn khớp.
- Hoàn tiền qua cổng nằm ngoài phạm vi.

## Phương án đã cân nhắc

- **VNPay / MoMo (cổng thanh toán có đơn hàng):** có trạng thái đơn và hoàn tiền, nhưng phí giao dịch cao hơn và phải quản lý đơn hết hạn.
- **Mã thanh toán ngẫu nhiên theo từng yêu cầu:** chống đoán mã, nhưng thêm thực thể, thêm trạng thái hết hạn, và sinh viên dùng lại QR cũ thì không khớp.
