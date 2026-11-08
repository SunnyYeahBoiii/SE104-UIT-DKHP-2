# 0018. Điểm học phần là dữ liệu đầu vào chỉ đọc; bỏ quản lý điểm, cấm thi và vai trò giảng viên

- Trạng thái: accepted
- Ngày: 2026-10-07
- Nguồn: phiên grill Phòng Đào tạo 2026-10-07
- Thay một phần: [ADR-0001](./0001-mo-rong-pham-vi-so-voi-de.md) (dòng "Không có điểm")

## Bối cảnh

ADR-0001 đưa điểm, GPA, tín chỉ tích lũy vào phạm vi để suy ra học lại, cải thiện và tiên quyết. Kéo theo đó là
cả một phân hệ: giảng viên nhập điểm thành phần, khoá bảng điểm, sửa điểm, bảng điểm sinh viên, xếp loại, tiến độ
chương trình, và cấm thi. Phạm vi nhóm muốn giữ chỉ là **đăng ký học phần và quản lý đóng học phí**. Ở trường, điểm
đã có hệ thống quản lý riêng.

Nhưng đăng ký vẫn cần điểm: hình thức học (Lần đầu, Học lại, Cải thiện) quyết định phụ thu, và tiên quyết cần biết
Đạt hay chưa.

## Quyết định

- Điểm học phần (thang 10) là **dữ liệu đầu vào có sẵn**, gắn với từng lần học. Hệ thống chỉ đọc để xét tiên quyết,
  hình thức học và kết quả hiện hành. Cách đưa điểm vào (đồng bộ, nhập tệp) nằm ngoài phạm vi; dữ liệu mẫu nạp bằng seed.
- Môn đã học (lần học các học kỳ trước) và điểm của chúng là dữ liệu nền
  ([ADR-0019](./0019-thu-hep-pham-vi-du-lieu-nen.md)).
- Lần học chưa có điểm là chưa có kết quả. Nếu đó là lần học môn tiên quyết thì sinh viên được đăng ký có điều kiện;
  job hằng ngày tự huỷ dòng nếu điểm về là Không đạt khi phiếu còn trong đợt (DK-05, DK-06).
- Bỏ: nhập điểm thành phần, khoá và sửa bảng điểm, bảng điểm sinh viên, GPA, xếp loại, tín chỉ tích lũy, tiến độ chương trình.
- Bỏ vai trò **giảng viên**. Giảng viên chỉ còn là danh mục (mã, tên) để hiển thị trên lớp, là dữ liệu nền.
- Bỏ **cấm thi**. Phòng khảo thí xử lý ngoài hệ thống, dựa trên báo cáo công nợ BM7.

## Hệ quả

- Phân hệ Kết quả học tập chỉ còn vài quy tắc đọc (KQ-01–KQ-04). Bớt hẳn một vai trò, một nhóm màn hình và một job định kỳ.
- Test cho tiên quyết và hình thức học dựng điểm trực tiếp trong fixture, không qua luồng nhập điểm.
- QĐ6 chỉ còn "đóng nhiều lần"; BM7 vẫn là đầu ra phục vụ việc cấm thi bên ngoài.

## Phương án đã cân nhắc

- **Giữ toàn bộ quản lý điểm (ADR-0001 cũ):** đầy đủ, nhưng gấp đôi khối lượng ở phần không phải trọng tâm.
- **Bỏ hẳn điểm:** gọn nhất, nhưng mất học lại, cải thiện, tiên quyết, tức mất luôn phụ thu theo hình thức học.
