# 0001. Mở rộng phạm vi so với đề 1.13

- Trạng thái: accepted
- Ngày: 2026-09-30
- Nguồn: phiên grill 2026-09-30, câu 2 và 8
- Sửa đổi: 2026-10-07, thu hẹp phần điểm thành dữ liệu đầu vào chỉ đọc, bỏ cấm thi ([ADR-0018](./0018-diem-la-du-lieu-dau-vao.md)); 2026-10-11, BM1 tối giản, BM2 thành dữ liệu nền, bỏ BM3 ([ADR-0019](./0019-thu-hep-pham-vi-du-lieu-nen.md))

## Bối cảnh

Đề 1.13 ([de-bai.md](../de-bai.md)) chỉ mô tả 7 biểu mẫu. Đăng ký ở mức "môn học" (BM5), không có lớp, lịch,
điểm hay thanh toán thật. Một hệ thống chỉ có vậy không dùng được cho đăng ký thật ở trường. Đó cũng không phải
thứ nhóm muốn xây: mục tiêu là 1000 người dùng đồng thời và tranh chấp chỗ ngồi thực sự.

## Quyết định

Chọn phạm vi C: làm đủ BM1–BM7 và mở rộng thêm lớp học phần, lịch học, hệ đào tạo, tiên quyết,
học phí lai và thanh toán qua SePay. Các chỗ lệch với đề:

| Đề | Hệ thống |
|---|---|
| BM1, BM2, BM3: lập hồ sơ, nhập môn học, nhập chương trình học | BM1 tối giản (MSSV, họ tên, email, khoá, hệ, đối tượng ưu tiên) do Phòng Đào tạo quản lý; BM2 là dữ liệu nền chỉ đọc; bỏ BM3 ([ADR-0019](./0019-thu-hep-pham-vi-du-lieu-nen.md)) |
| Đăng ký "môn học" | Đăng ký **lớp học phần** của môn ([ADR-0002](./0002-lop-hoc-phan-va-tach-lt-th.md)) |
| QĐ5: học phí = tín chỉ × đơn giá | Học phí cố định theo khoá + phụ thu theo tín chỉ ([ADR-0003](./0003-mo-hinh-hoc-phi-lai.md)) |
| QĐ6: phiếu thu "dựa trên phiếu đăng ký" | Phiếu thu ghi có vào sổ cái của cặp (sinh viên, học kỳ) ([ADR-0004](./0004-so-cai-cong-no-append-only.md)) |
| Không có điểm | Đọc điểm học phần có sẵn để suy ra học lại, cải thiện, tiên quyết; không quản lý điểm ([ADR-0018](./0018-diem-la-du-lieu-dau-vao.md)) |
| BM4: danh sách môn mở | Nhập thời khoá biểu học kỳ từ tệp Excel của trường; tín chỉ thuộc môn mở ([ADR-0017](./0017-tin-chi-theo-mon-mo.md)) |

Mọi QĐ gốc vẫn còn đúng nghĩa: QĐ5 giữ đơn giá 27.000đ/37.000đ, QĐ6 giữ "đóng nhiều lần" (cấm thi làm ngoài hệ thống, dựa trên BM7), QĐ7 giữ
"phải đóng ≤ đăng ký".

## Hệ quả

- Khối lượng lớn hơn đề nhiều lần. Phần ngoài phạm vi được liệt kê rõ trong [requirements.md](../requirements.md#ngoài-phạm-vi) để chặn phình thêm.
- Báo cáo môn học cần có bảng đối chiếu QĐ → quy tắc (cột "Nguồn" trong requirements).

## Phương án đã cân nhắc

- **A. Đúng đề:** đơn giản, nhưng không có tranh chấp, không có bài toán thật để giải.
- **B. Đề + lớp học phần:** có tranh chấp chỗ, nhưng thiếu điểm nên không suy ra được học lại, cải thiện, tiên quyết.
