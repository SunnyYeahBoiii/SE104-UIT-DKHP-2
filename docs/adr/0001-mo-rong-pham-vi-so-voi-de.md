# 0001. Mở rộng phạm vi so với đề 1.13

- Trạng thái: accepted
- Ngày: 2026-09-30
- Nguồn: phiên grill 2026-09-30, câu 2 và 8

## Bối cảnh

Đề 1.13 ([de-bai.md](../de-bai.md)) chỉ mô tả 7 biểu mẫu. Đăng ký ở mức "môn học" (BM5), không có lớp, lịch,
điểm hay thanh toán thật. Một hệ thống chỉ có vậy không dùng được cho đăng ký thật ở trường. Đó cũng không phải
thứ nhóm muốn xây: mục tiêu là 1000 người dùng đồng thời và tranh chấp chỗ ngồi thực sự.

## Quyết định

Chọn phạm vi C: làm đủ BM1–BM7 và mở rộng thêm lớp học phần, lịch học, tiên quyết, điểm, GPA, tín chỉ tích lũy,
học phí lai và thanh toán qua SePay. Các chỗ lệch với đề:

| Đề | Hệ thống |
|---|---|
| Đăng ký "môn học" | Đăng ký **lớp học phần** của môn ([ADR-0002](./0002-lop-hoc-phan-va-tach-lt-th.md)) |
| QĐ5: học phí = tín chỉ × đơn giá | Học phí cố định theo khoá + phụ thu theo tín chỉ ([ADR-0003](./0003-mo-hinh-hoc-phi-lai.md)) |
| QĐ6: phiếu thu "dựa trên phiếu đăng ký" | Phiếu thu ghi có vào sổ cái của cặp (sinh viên, học kỳ) ([ADR-0004](./0004-so-cai-cong-no-append-only.md)) |
| Không có điểm | Điểm, GPA, tích lũy (để có học lại, cải thiện, tiên quyết) |

Mọi QĐ gốc vẫn còn đúng nghĩa: QĐ5 giữ đơn giá 27.000đ/37.000đ, QĐ6 giữ "đóng nhiều lần" và cấm thi, QĐ7 giữ
"phải đóng ≤ đăng ký".

## Hệ quả

- Khối lượng lớn hơn đề nhiều lần. Phần ngoài phạm vi được liệt kê rõ trong [requirements.md](../requirements.md#ngoài-phạm-vi) để chặn phình thêm.
- Báo cáo môn học cần có bảng đối chiếu QĐ → quy tắc (cột "Nguồn" trong requirements).

## Phương án đã cân nhắc

- **A. Đúng đề:** đơn giản, nhưng không có tranh chấp, không có bài toán thật để giải.
- **B. Đề + lớp học phần:** có tranh chấp chỗ, nhưng thiếu điểm nên không suy ra được học lại, cải thiện, tiên quyết.
