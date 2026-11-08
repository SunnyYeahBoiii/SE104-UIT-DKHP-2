# 0017. Số tín chỉ thuộc môn mở của học kỳ, không chỉ thuộc môn học

- Trạng thái: accepted
- Ngày: 2026-10-07
- Nguồn: phiên grill Phòng Đào tạo 2026-10-07, đối chiếu thời khoá biểu HK1 2025–2026

## Bối cảnh

QĐ2 tính tín chỉ từ số tiết: số tiết / 15 với môn LT, số tiết / 30 với môn TH. Nhưng thời khoá biểu thật của
trường ghi tín chỉ ở từng dòng lớp (cột TỐ TC), và con số này có thể khác công thức: môn không tính tín chỉ (0 tín
chỉ), môn đổi số tín chỉ qua các khoá. Học phí phụ thu lại dựa trên tín chỉ, nên nếu chỉ lưu tín chỉ ở danh mục môn
thì sửa danh mục sẽ làm đổi học phí của các học kỳ đã qua.

Kiểm tra tệp HK1 2025–2026: 417 môn, tín chỉ nhất quán theo (môn, loại LT/TH) ở mọi lớp, trừ một dòng gõ nhầm
(`CE006` ghi 50).

## Quyết định

- Môn học giữ **tín chỉ mặc định** theo QĐ2.
- **Môn mở** (môn trong một học kỳ) mang tín chỉ riêng của học kỳ đó, lấy từ cột TỐ TC khi nhập thời khoá biểu.
  Trống thì lấy mặc định của môn. Cho phép 0.
- Mọi lớp của một môn trong cùng học kỳ phải cùng tín chỉ. Bộ nhập báo lỗi dòng khi lệch, không tự chọn số đúng.
- Giới hạn tín chỉ đăng ký, phụ thu và BM5 dùng tín chỉ của môn mở. Tín chỉ được chốt vào dòng đăng ký lúc đăng ký
  ([ADR-0003](./0003-mo-hinh-hoc-phi-lai.md)).

## Hệ quả

- Sửa tín chỉ mặc định trong danh mục không đổi lịch sử học phí.
- QĐ2 vẫn đúng nghĩa ở danh mục; môn mở chỉ là nơi ghi đè theo thực tế từng học kỳ.
- Môn 0 tín chỉ không tính vào giới hạn tín chỉ và không phát sinh phụ thu.

## Phương án đã cân nhắc

- **Tín chỉ chỉ ở danh mục môn:** đơn giản, nhưng sửa danh mục làm sai học phí cũ, và không biểu diễn được môn 0 tín chỉ.
- **Tín chỉ theo từng lớp học phần:** khớp từng dòng tệp, nhưng cho phép hai lớp cùng môn khác tín chỉ, điều dữ liệu thật không có và làm học phí phụ thuộc lớp chọn.
