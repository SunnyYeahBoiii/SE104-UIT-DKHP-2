# 0004. Sổ cái công nợ chỉ ghi thêm, tiền là số nguyên đồng

- Trạng thái: accepted
- Ngày: 2026-09-30
- Nguồn: phiên grill 2026-09-30, câu 19

## Bối cảnh

Công nợ của một sinh viên trong học kỳ thay đổi theo nhiều nguồn: học phí cố định, phụ thu khi đăng ký, đảo phụ
thu khi huỷ, giảm trừ, thanh toán nhiều lần qua hai kênh, tính lại khi sửa hồ sơ, số dư chuyển kỳ. Nếu chỉ giữ một cột
"còn nợ" rồi cập nhật tại chỗ, thì không trả lời được câu "vì sao ra con số này", và hai thao tác đồng thời (webhook
và huỷ lớp) có thể ghi đè nhau.

## Quyết định

- Mỗi thay đổi tiền là một **dòng sổ cái** (ghi nợ hoặc ghi có) gắn với (sinh viên, học kỳ), kèm loại, nguồn (dòng đăng ký, học kỳ, phiếu thu) và người tạo.
- **Không UPDATE, không DELETE** dòng sổ cái. Muốn sửa thì ghi dòng đảo (huỷ lớp đảo phụ thu; tính lại học phí đảo toàn bộ nợ và giảm trừ của học kỳ rồi ghi lại).
- Số tiền đăng ký, phải đóng, còn lại (BM7) đều là tổng suy ra từ sổ cái.
- Ngoài phiếu thu tại quầy, mọi dòng do hệ thống sinh theo quy tắc; không có thao tác ghi dòng tuỳ ý hay huỷ phiếu thu ([ADR-0019](./0019-thu-hep-pham-vi-du-lieu-nen.md)).
- Tiền lưu `bigint` theo đồng. Giảm trừ làm tròn xuống tới đồng.
- Đóng thừa → số dư có, được chuyển sang học kỳ kế tiếp bằng một cặp dòng ghi (ra kỳ cũ, vào kỳ mới).

## Hệ quả

- Kiểm toán và đối soát dễ: mọi con số truy ngược được về từng dòng.
- Các dòng ghi thêm không tranh chấp nhau như khi cập nhật một cột tổng.
- Tổng phải tính bằng `SUM`. Khi cần nhanh (BM7, QR) có thể thêm bảng tổng hợp cập nhật trong cùng transaction, nhưng sổ cái vẫn là nguồn sự thật.
- Không dùng `float`/`numeric` có phần thập phân, nên không có lỗi làm tròn tích luỹ.

## Phương án đã cân nhắc

- **Cột số dư cập nhật tại chỗ:** đơn giản, nhưng mất lịch sử và dễ lost update.
- **Event sourcing đầy đủ:** quá nặng cho phạm vi này, xem [ADR-0008](./0008-cqrs-muc-1-va-outbox.md).
