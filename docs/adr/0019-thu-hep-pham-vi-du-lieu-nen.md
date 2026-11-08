# 0019. Chốt phạm vi: ba nghiệp vụ, dữ liệu nền nạp sẵn, hồ sơ sinh viên tối giản

- Trạng thái: accepted
- Ngày: 2026-10-11
- Nguồn: chốt phạm vi với nhóm 2026-10-11
- Thay một phần: [ADR-0001](./0001-mo-rong-pham-vi-so-voi-de.md) (BM1–BM3)

## Bối cảnh

Sau ADR-0018, hệ thống vẫn còn nhiều chức năng không phục vụ trực tiếp việc đăng ký và đóng học phí: quyết định
trạng thái và bảo lưu, đổi ngành, Khoa và Ngành, quê quán, chương trình học, danh mục giảng viên và phòng học có màn
hình, vai trò Quản trị, khoản điều chỉnh, hoàn tiền, thông báo trong ứng dụng. Mỗi chức năng kéo theo màn hình, luồng
dữ liệu, quy tắc và test.

Phạm vi nhóm chốt gồm ba nghiệp vụ: sinh viên đăng ký học phần, Phòng Đào tạo quản lý đăng ký học phần, Phòng Tài vụ
quản lý đóng học phí. Để tính học phí, hệ thống chỉ cần biết khoá, hệ đào tạo, đối tượng ưu tiên và các môn sinh viên
đã học.

## Quyết định

- Ba vai trò: Sinh viên, Phòng Đào tạo, Phòng Tài vụ. Không có vai trò Quản trị; tài khoản Phòng Đào tạo và Phòng Tài
  vụ nạp sẵn.
- **Dữ liệu nền** nạp sẵn bằng seed, hệ thống chỉ đọc:
  - hệ đào tạo; năm học và học kỳ
  - danh mục môn học (BM2), môn tương đương, điều kiện tiên quyết
  - giảng viên, phòng học
  - môn đã học và điểm học phần của sinh viên (ADR-0018)
- **Hồ sơ sinh viên tối giản** do Phòng Đào tạo thêm, sửa, xoá: MSSV, họ tên, email, khoá, hệ, đối tượng ưu tiên. Có
  hồ sơ là đang học, không có trạng thái sinh viên. MSSV không sửa được; chỉ xoá hồ sơ khi sinh viên chưa có phiếu
  đăng ký và chưa có dòng sổ cái.
- **Tài khoản sinh viên** tạo cùng hồ sơ trong một giao dịch: tên đăng nhập là MSSV, mật khẩu ngẫu nhiên hiện một
  lần, bắt buộc đổi ở lần đăng nhập đầu. Phòng Đào tạo đặt lại mật khẩu bằng cùng cơ chế. Xoá hồ sơ thì xoá tài khoản.
- Phòng Đào tạo còn quản lý danh mục đối tượng ưu tiên, danh mục khoá, năm mốc thời gian của học kỳ (kể cả hạn đóng),
  khung giờ đăng ký, giới hạn tín chỉ, thời khoá biểu và lớp học phần. Không lập học kỳ.
- **Tính lại học phí**: sửa khoá, hệ hoặc đối tượng ưu tiên khi học kỳ đang trong đợt đăng ký thì đảo mọi khoản nợ
  và giảm trừ của học kỳ đó rồi ghi lại theo hồ sơ mới. Thanh toán giữ nguyên. Ngoài đợt chỉ áp từ học kỳ sau. Dòng
  đăng ký đã có không bị xét lại.
- Không có khoản điều chỉnh, huỷ phiếu thu, hoàn tiền. Ngoài phiếu thu tại quầy, mọi dòng sổ cái do hệ thống sinh
  theo quy tắc. Đóng thừa thành số dư có.
- Giữ đủ điều kiện đăng ký, kể cả tiên quyết và đăng ký có điều kiện (DK-05, DK-06). Job xét lại chỉ huỷ dòng, không
  gửi thông báo.
- Thông báo duy nhất là **email đóng đủ**, gửi khi một thanh toán làm số tiền còn lại của học kỳ về 0 hoặc thấp hơn.
- Bỏ hẳn: Khoa, Ngành, Tỉnh, Huyện, chương trình học (BM3), học kỳ gợi ý, môn tự do, trạng thái sinh viên, bảo lưu,
  đổi ngành, thông báo trong ứng dụng.

## Hệ quả

- BM1 còn ở dạng tối giản, BM2 có trong cơ sở dữ liệu nhưng không có màn hình nhập, BM3 không có. Báo cáo môn học cần
  nêu rõ chỗ lệch này.
- Hình thức học chỉ còn Lần đầu, Học lại, Cải thiện.
- Sai sót công nợ không sửa được trên giao diện, phải can thiệp dữ liệu ngoài hệ thống.
- Đổi dữ liệu nền (thêm môn, thêm điểm) là sửa seed rồi nạp lại.
- Mã của quy tắc đã bỏ không dùng lại; quy tắc mới lấy mã mới. Test tham chiếu mã quy tắc không phải đổi.

## Phương án đã cân nhắc

- **Hồ sơ sinh viên cũng là dữ liệu nền:** gọn nhất, nhưng Phòng Đào tạo không thêm được sinh viên và không có chỗ cấp
  tài khoản.
- **Tính lại bằng cách ghi phần chênh:** ít dòng sổ cái hơn, nhưng phải tính chênh cho từng loại khoản (cố định, phụ
  thu, giảm trừ chốt theo thứ tự) và khó đọc lại. Đảo toàn bộ rồi ghi lại cho kết quả giống hệt lần tính đầu, dễ kiểm.
- **Giữ BM1–BM3 có màn hình như đề:** đúng đề hơn, nhưng gần gấp đôi số màn hình của Phòng Đào tạo, toàn CRUD, không
  thuộc trọng tâm.
- **Bỏ luôn tiên quyết, tương đương, hình thức học:** gọn hơn nữa, nhưng mất phụ thu học lại, cải thiện, tức mất phần
  học phí lai của ADR-0003.
