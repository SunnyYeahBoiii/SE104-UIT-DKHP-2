# Yêu cầu hệ thống DKHP

Tài liệu này là đặc tả nghiệp vụ và phi chức năng của hệ thống. Thuật ngữ in đậm được định nghĩa trong
[CONTEXT.md](../CONTEXT.md). Đề gốc nằm ở [de-bai.md](./de-bai.md). Lý do của các quyết định lớn nằm trong
[adr/](./adr/).

Mỗi quy tắc có một mã (ví dụ `DK-05`). **Mọi quy tắc phải có ít nhất một test tham chiếu mã của nó** (xem
[ADR-0016](./adr/0016-chien-luoc-kiem-thu.md)). Cột "Nguồn" ghi QĐ của đề, hoặc "Mở rộng" nếu là phần bổ sung
(xem [ADR-0001](./adr/0001-mo-rong-pham-vi-so-voi-de.md)).

## 1. Phạm vi

Hệ thống phục vụ ba nghiệp vụ:

1. **Sinh viên đăng ký học phần:** tra cứu lớp mở, đăng ký, huỷ, xem phiếu đăng ký (BM5) và thời khoá biểu; xem
   công nợ và đóng học phí.
2. **Phòng Đào tạo quản lý đăng ký học phần:** hồ sơ sinh viên (BM1, chỉ các thông tin việc đăng ký và tính học
   phí cần) và tài khoản sinh viên, đối tượng ưu tiên, khoá tuyển sinh; mốc thời gian của học kỳ và khung giờ đăng
   ký; giới hạn tín chỉ; nhập thời khoá biểu học kỳ (BM4) từ tệp Excel của trường; điều chỉnh lớp học phần; danh
   sách sinh viên của lớp (BB01).
3. **Phòng Tài vụ quản lý đóng học phí:** bảng phí và đơn giá, tài khoản nhận, công nợ theo sổ cái, thu tại quầy
   và chuyển khoản qua SePay (BM6), gán giao dịch chưa khớp, đối soát, báo cáo sinh viên chưa đóng học phí (BM7).

Dữ liệu mà ba nghiệp vụ trên cần đọc nhưng không quản lý là **dữ liệu nền**: nạp sẵn bằng seed, hệ thống chỉ đọc
(HS-09, [ADR-0019](./adr/0019-thu-hep-pham-vi-du-lieu-nen.md)).

Phần mở rộng so với đề, đều phục vụ ba nghiệp vụ trên:

- hệ đào tạo: sinh viên, lớp học phần và bảng phí đều gắn với một hệ
- lớp học phần có sĩ số, lịch học theo ngày; kiểm tra trùng lịch và hết chỗ
- vòng đời học kỳ và đợt đăng ký (Đăng ký, Điều chỉnh, chốt phiếu)
- điều kiện tiên quyết, đăng ký có điều kiện, môn tương đương, hình thức học
- học phí lai (cố định theo khoá + phụ thu theo tín chỉ), sổ cái công nợ, tính lại học phí khi sửa hồ sơ
- thanh toán online qua SePay (VietQR) và thu tại quầy, email khi đóng đủ

### Ngoài phạm vi

- Hồ sơ sinh viên đầy đủ: ngày sinh, giới tính, quê quán (Tỉnh, Huyện), Khoa, Ngành, quyết định trạng thái, bảo
  lưu, thôi học, đổi ngành. Sinh viên có hồ sơ được coi là đang học.
- Quản lý danh mục đào tạo: Hệ đào tạo, môn học (BM2), môn tương đương, tiên quyết, giảng viên, phòng học. Tất cả
  là dữ liệu nền.
- Chương trình học (BM3), học kỳ gợi ý, tiến độ chương trình, môn tự do.
- Lập năm học và học kỳ. Học kỳ là dữ liệu nền; Phòng Đào tạo chỉ sửa mốc thời gian.
- Nhập hàng loạt từ CSV/Excel, trừ thời khoá biểu học kỳ (BM4).
- Vai trò Quản trị, quản lý tài khoản nhân viên. Tài khoản Phòng Đào tạo và Phòng Tài vụ nạp sẵn.
- Quản lý điểm: nhập điểm, bảng điểm, GPA, tín chỉ tích lũy, xếp loại. Môn đã học và điểm học phần là dữ liệu
  nền, hệ thống chỉ đọc (xem [ADR-0018](./adr/0018-diem-la-du-lieu-dau-vao.md)).
- Khoản điều chỉnh công nợ, huỷ phiếu thu, hoàn tiền. Đóng thừa chỉ thành số dư có; sai sót công nợ sửa ngoài hệ
  thống.
- Thông báo trong ứng dụng, SMS. Thông báo duy nhất là email khi đóng đủ.
- Cấm thi. Phòng khảo thí làm ngoài hệ thống, dựa trên báo cáo BM7.
- Giảng viên dùng hệ thống. Giảng viên chỉ là mã và tên để hiển thị trên lớp.
- Chuyển học kỳ từ Đang học sang Kết thúc.
- Xét tốt nghiệp, cấp bằng.
- Rút môn sau khi chốt phiếu.
- Danh sách chờ khi lớp đầy.
- Môn song hành.
- Tự động xếp thời khoá biểu và phòng học, lịch thi, đánh giá giảng viên.
- Đa ngôn ngữ (chỉ tiếng Việt), ứng dụng di động native.
- SSO và đăng nhập qua bên thứ ba.

## 2. Vai trò và quyền

Có ba vai trò. Tài khoản Phòng Đào tạo và Phòng Tài vụ là dữ liệu nền; tài khoản sinh viên sinh ra cùng hồ sơ
(HS-13). Một tài khoản có thể giữ nhiều vai trò.

| Vai trò | Mã | Được làm |
|---|---|---|
| Sinh viên | `STUDENT` | Tra cứu lớp, đăng ký và huỷ lớp của chính mình. Xem phiếu đăng ký, thời khoá biểu, công nợ, QR học phí, phiếu thu. |
| Phòng Đào tạo | `ACADEMIC_OFFICE` | Hồ sơ và tài khoản sinh viên, đối tượng ưu tiên, khoá tuyển sinh. Mốc thời gian học kỳ, khung giờ đăng ký, giới hạn tín chỉ. Thời khoá biểu học kỳ (BM4), điều chỉnh lớp học phần. Danh sách sinh viên của lớp. |
| Phòng Tài vụ | `FINANCE_OFFICE` | Đơn giá, bảng phí, tài khoản nhận học phí. Thu tại quầy (BM6). Gán giao dịch chưa khớp. Xem đối soát. Báo cáo BM7. |

| Mã | Quy tắc | Nguồn |
|---|---|---|
| QV-01 | Chỉ Phòng Đào tạo được tạo, sửa, xoá hồ sơ sinh viên, đối tượng ưu tiên và khoá tuyển sinh. | Mở rộng |
| QV-02 | Sinh viên chỉ đọc và thao tác trên dữ liệu của chính mình. | Mở rộng |
| QV-03 | Mọi command (thao tác ghi) đều được ghi vào nhật ký kiểm toán chỉ ghi thêm: người làm, vai trò, thời điểm, dữ liệu vào, kết quả. | Mở rộng |

## 3. Hồ sơ sinh viên và dữ liệu nền

| Mã | Quy tắc | Nguồn |
|---|---|---|
| HS-02 | Mỗi đối tượng ưu tiên có tỉ lệ giảm và độ ưu tiên. Sinh viên thuộc nhiều đối tượng thì chỉ áp dụng đối tượng có độ ưu tiên cao nhất. Phòng Đào tạo thêm, sửa, xoá đối tượng ưu tiên; không xoá được đối tượng đang có sinh viên. Sửa tỉ lệ không hồi tố: chỉ áp cho khoản nợ phát sinh sau đó (HP-06). | QĐ1 |
| HS-09 | Dữ liệu nền được nạp sẵn bằng seed, hệ thống chỉ đọc và không có chức năng thêm, sửa, xoá: Hệ đào tạo (`CQUI`, `CTTT`, `CLC`, `CNTN`, `BCU`, `VB2CQ`, `LTĐH`…), năm học và học kỳ, danh mục môn học (BM2), môn tương đương, điều kiện tiên quyết, giảng viên, phòng học, môn đã học và điểm học phần của sinh viên, tài khoản Phòng Đào tạo và Phòng Tài vụ. | Mở rộng, ADR-0019 |
| HS-11 | Hồ sơ sinh viên gồm mã số sinh viên, họ tên, email, khoá tuyển sinh, hệ đào tạo và đối tượng ưu tiên (có thể không có). Phòng Đào tạo thêm, sửa, xoá hồ sơ từng cái một. Sinh viên có hồ sơ được coi là đang học. | QĐ1, Mở rộng |
| HS-12 | Mã số sinh viên là duy nhất và không sửa được sau khi tạo. Chỉ xoá được hồ sơ khi sinh viên chưa có phiếu đăng ký và chưa có dòng sổ cái; nhập sai mã thì xoá rồi tạo lại. | Mở rộng |
| HS-13 | Tạo hồ sơ thì tạo luôn tài khoản sinh viên trong cùng giao dịch, tên đăng nhập là mã số sinh viên, mật khẩu ban đầu ngẫu nhiên hiện một lần duy nhất cho Phòng Đào tạo. Phòng Đào tạo đặt lại mật khẩu bằng cùng cơ chế. Sinh viên bắt buộc đổi mật khẩu ở lần đăng nhập kế tiếp. Xoá hồ sơ thì xoá luôn tài khoản. | Mở rộng |
| HS-14 | Sửa khoá, hệ đào tạo hoặc đối tượng ưu tiên của sinh viên thì tính lại học phí (HP-12). Các dòng đăng ký đã có giữ nguyên, kể cả khi khác hệ mới: DK-19 chỉ xét lúc đăng ký. | Mở rộng |
| HS-15 | Phòng Đào tạo thêm, sửa, xoá khoá tuyển sinh; không xoá được khoá đang có sinh viên, bảng phí hoặc khung giờ. | Mở rộng |

## 4. Đào tạo

| Mã | Quy tắc | Nguồn |
|---|---|---|
| DT-01 | Môn học có đúng một loại: LT hoặc TH. Học phần có cả hai phần được khai báo thành hai môn: môn TH đi kèm có mã môn LT thêm hậu tố `TH` (ví dụ `IT004TH`) và trỏ tới môn LT đó; mỗi môn LT có tối đa một môn TH đi kèm. Môn TH đứng riêng (không có môn LT đi kèm, ví dụ `CE119`) giữ mã không hậu tố. | QĐ2, ADR-0002 |
| DT-02 | Số tiết môn LT phải chia hết cho 15, môn TH phải chia hết cho 30. Số tín chỉ mặc định của môn = số tiết / 15 (LT) hoặc số tiết / 30 (TH). | QĐ2 |
| DT-04 | Môn tương đương được coi là một môn khi xét trùng môn, tiên quyết và hình thức học. | Mở rộng |
| DT-05 | Điều kiện tiên quyết có hai loại: Tiên quyết (phải Đạt) và Học trước (phải có lần học có điểm). Không hỗ trợ song hành. Điều kiện tiên quyết là dữ liệu nền; seed không được tạo chu trình. | Mở rộng |
| DT-06 | Một năm học có HK1, HK2 và có thể có học kỳ hè. | QĐ4 |
| DT-07 | Môn mở của học kỳ được tạo khi nhập thời khoá biểu: môn có ít nhất một lớp trong học kỳ. Môn mở mang số tín chỉ của học kỳ đó (lấy từ thời khoá biểu, trống thì lấy mặc định của môn, có thể bằng 0). Học phí của một dòng đăng ký dùng tín chỉ của môn mở, nên đổi danh mục không làm đổi lịch sử. | QĐ4, ADR-0017 |
| DT-08 | Lớp học phần thuộc một môn mở và một hệ đào tạo, có sĩ số tối đa > 0, không bao giờ vượt. Giảng viên có thể chưa phân công. Lớp có thể ghi khoá dành cho (một năm nhập học hoặc mọi khoá; chỉ để hiển thị và lọc, không chặn đăng ký), ngôn ngữ giảng dạy và ghi chú (chỉ hiển thị). Lớp có 0 hoặc nhiều buổi học; lớp không có buổi học (đồ án, khoá luận, nhóm thực hành HT2…) không bao giờ trùng lịch. | Mở rộng |
| DT-09 | Buổi học: thứ 2–8, tiết bắt đầu ≤ tiết kết thúc trong khoảng 1–10, phòng (có thể chưa xếp), ngày bắt đầu ≤ ngày kết thúc, nhịp lặp (mỗi tuần hoặc cách tuần). Ngày học là ngày bắt đầu cộng bội số của nhịp, không quá ngày kết thúc. Học xen kẽ là hai nhóm cách tuần, nhóm sau bắt đầu muộn hơn nhóm trước một tuần. | Mở rộng |
| DT-10 | Khi nhập thời khoá biểu hoặc điều chỉnh lớp, hệ thống cảnh báo trùng phòng và trùng giảng viên nhưng không chặn. | Mở rộng |
| DT-11 | Nhóm thực hành là con của một lớp LT có môn TH đi kèm, mã là mã lớp LT thêm `.n` (n ≥ 1, không cần liên tiếp, không giới hạn số nhóm). Lớp LT có nhóm thực hành ghi một hình thức thực hành, áp cho mọi nhóm con, không trộn. HT1 (`SCHEDULED`): mỗi nhóm có buổi học cố định. HT2 (`SELF_SCHEDULED`): nhóm không có buổi học, giảng viên và sinh viên tự hẹn lịch ngoài hệ thống. Mỗi nhóm có sĩ số riêng, không phụ thuộc sĩ số lớp LT. Hình thức thực hành chỉ sửa được khi học kỳ ở `PREPARATION`. | Mở rộng, ADR-0002 |
| DT-12 | Lớp của môn TH đứng riêng là lớp thường: có buổi học, không có hình thức thực hành, không có lớp cha, mã giữ nguyên (ví dụ `CE119.Q11.1`). | Mở rộng, ADR-0002 |

### Thời khoá biểu học kỳ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| TKB-01 | Phòng Đào tạo nhập thời khoá biểu học kỳ (BM4) từ tệp Excel theo mẫu của trường. Một lần nhập tạo môn mở, lớp học phần, nhóm thực hành, buổi học và hình thức thực hành của cả học kỳ. | QĐ4, Mở rộng |
| TKB-02 | Chỉ nhập khi học kỳ ở `PREPARATION`. Nhập lại thì thay toàn bộ dữ liệu thời khoá biểu của học kỳ đó. Theo kiểu tất cả hoặc không, trả báo cáo lỗi theo từng dòng. | Mở rộng |
| TKB-03 | Bộ nhập không tạo dữ liệu nền. Mã môn phải có trong danh mục môn học; mã giảng viên và mã phòng (nếu có) phải có trong dữ liệu nền; hệ đào tạo phải là một hệ có sẵn. | Mở rộng |
| TKB-04 | Dòng có cột THỰC HÀNH = 0 là lớp LT (hoặc lớp thường). Dòng THỰC HÀNH = 1 có mã `<mã lớp LT>.n` là nhóm thực hành của lớp LT đó và thuộc môn TH đi kèm, dù tệp ghi mã môn LT (dòng thực hành `AI002` vào `AI002TH`). Dòng thực hành của môn TH đứng riêng là lớp thường. Cột HTGD (`HT1`/`HT2`) của các nhóm là hình thức thực hành của lớp LT cha; các nhóm của một lớp phải cùng HTGD. | Mở rộng |
| TKB-05 | Cột TỐ TC là tín chỉ của môn mở; trống thì lấy tín chỉ mặc định của môn. Mọi dòng của cùng một môn phải cùng tín chỉ, lệch thì báo lỗi dòng. Tín chỉ 0 hợp lệ. | ADR-0017 |
| TKB-06 | Mỗi dòng có lịch tạo một buổi học: THỨ, TIẾT (chuỗi chữ số, `0` là tiết 10), PHÒNG HỌC, NBD, NKT, CÁCH TUẦN (`1` mỗi tuần, `2` cách tuần). Dòng có THỨ và TIẾT là `*` hoặc trống thì không tạo buổi học. | Mở rộng |
| TKB-07 | SĨ SỐ lấy phần số đứng trước ngoặc (`120(0)` → 120). KHOÁ HỌC quy về năm nhập học: `16` → 2021, `2021` → 2021, `0` → mọi khoá. Cột ngôn ngữ (cột cuối, không tiêu đề: `VN`, `EN`) và GHICHU lưu để hiển thị. Bỏ qua KHOA QL và Đã ĐK. | Mở rộng |

### Điều chỉnh lớp học phần

| Mã | Quy tắc | Nguồn |
|---|---|---|
| LHP-01 | Ở `PREPARATION`, Phòng Đào tạo thêm, sửa, xoá lớp học phần, nhóm thực hành và buổi học tự do. | Mở rộng |
| LHP-02 | Từ `REGISTRATION` trở đi chỉ được sửa sĩ số tối đa (không thấp hơn số đã đăng ký) và điền giảng viên hoặc phòng còn trống. Không thêm, không xoá lớp, không đổi lịch và hình thức thực hành. | Mở rộng |

### Học kỳ

| Mã | Quy tắc | Nguồn |
|---|---|---|
| HK-01 | Mã học kỳ = năm bắt đầu của năm học + số kỳ (1, 2, 3 = hè). Ví dụ `20251`. | Mở rộng |
| HK-02 | Thứ tự mốc thời gian bắt buộc: bắt đầu Đăng ký < kết thúc Đăng ký ≤ bắt đầu Điều chỉnh < kết thúc Điều chỉnh < hạn đóng học phí. | Mở rộng |
| HK-03 | Giai đoạn học kỳ chuyển tự động theo mốc thời gian: `PREPARATION` → `REGISTRATION` → `ADJUSTMENT` → `IN_PROGRESS`. Không chuyển ngược. Giai đoạn `CLOSED` có trong vòng đời nhưng việc chuyển sang đó nằm ngoài phạm vi; không quy tắc nào dựa vào nó. | Mở rộng |
| HK-04 | Tại mọi thời điểm có tối đa một học kỳ đang ở `REGISTRATION` hoặc `ADJUSTMENT`. | Mở rộng |
| HK-05 | Giai đoạn Đăng ký chia thành các khung giờ đăng ký theo khoá. Giai đoạn Điều chỉnh mở cho mọi khoá. | Mở rộng |
| HK-06 | Năm học và học kỳ là dữ liệu nền; Phòng Đào tạo không lập học kỳ, chỉ sửa năm mốc thời gian (bắt đầu và kết thúc Đăng ký, bắt đầu và kết thúc Điều chỉnh, hạn đóng học phí). Mốc chưa tới thì sửa được; với một khoảng: chưa bắt đầu thì sửa cả bắt đầu lẫn kết thúc, đã bắt đầu thì chỉ sửa kết thúc, đã kết thúc thì không sửa. Giá trị mới phải ≥ thời điểm hiện tại và vẫn giữ HK-02. | Mở rộng |
| HK-07 | Phòng Đào tạo thêm, sửa, xoá khung giờ đăng ký và gán khoá cho khung theo cùng luật thời gian của HK-06: khung chưa bắt đầu thì sửa tự do hoặc xoá, đang diễn ra thì chỉ sửa kết thúc, đã kết thúc thì không sửa. Khung nằm trong giai đoạn Đăng ký và có ít nhất một khoá. | Mở rộng |

## 5. Đăng ký

| Mã | Quy tắc | Nguồn |
|---|---|---|
| DK-01 | Mỗi sinh viên có tối đa một phiếu đăng ký cho mỗi học kỳ. Phiếu tạo khi sinh viên đăng ký lớp đầu tiên. | QĐ5 |
| DK-02 | Sinh viên chỉ đăng ký, huỷ lớp khi: học kỳ đang ở `REGISTRATION` hoặc `ADJUSTMENT`, và (nếu đang ở `REGISTRATION`) đang trong khung giờ của khoá mình. | Mở rộng |
| DK-03 | Chỉ đăng ký được lớp của môn có mở trong học kỳ. | QĐ5 |
| DK-19 | Chỉ đăng ký được lớp cùng hệ đào tạo với sinh viên. | Mở rộng |
| DK-04 | Mỗi phiếu có tối đa một dòng đăng ký còn hiệu lực cho mỗi môn (tính cả môn tương đương). | Mở rộng |
| DK-05 | Tiên quyết: môn Tiên quyết phải Đạt, môn Học trước phải có điểm, theo kết quả hiện hành và tính cả môn tương đương. Nếu sinh viên đã có lần học của môn tiên quyết nhưng lần học đó chưa có điểm thì cho đăng ký có điều kiện. | Mở rộng |
| DK-06 | Job hằng ngày xét các dòng đăng ký có điều kiện: khi điểm của lần học môn tiên quyết có mặt và là Không đạt, nếu phiếu còn trong đợt đăng ký thì tự huỷ dòng đó (trả chỗ, đảo phụ thu); nếu đã chốt thì giữ nguyên. Không có thông báo. | Mở rộng |
| DK-07 | Lớp mới không được trùng lịch với bất kỳ lớp nào còn hiệu lực trong phiếu. Hai buổi trùng khi cùng thứ, khoảng tiết giao nhau và có ít nhất một ngày học chung. Lớp không có buổi học, gồm nhóm thực hành HT2, không bao giờ trùng. | Mở rộng |
| DK-08 | Tổng tín chỉ của phiếu (không tính dòng đã huỷ) không vượt tối đa. Mức tối thiểu chỉ kiểm tra lúc chốt phiếu và chỉ cảnh báo cho Phòng Đào tạo. | Mở rộng |
| DK-09 | Lớp chỉ nhận thêm sinh viên khi số đã đăng ký < sĩ số tối đa. Không có danh sách chờ. | Mở rộng |
| DK-10 | Thứ tự kiểm tra cho mỗi lớp khi đăng ký: DK-02 → DK-03 → DK-19 → DK-04 → DK-11 → DK-05 → DK-07 → DK-08 → DK-09. Lỗi trả về là lỗi đầu tiên gặp phải của lớp đó. Giành chỗ (DK-09) luôn làm cuối cùng. | Mở rộng |
| DK-11 | Lớp LT và nhóm thực hành là hai dòng đăng ký riêng; học LT không bắt buộc đăng ký nhóm thực hành. Chỉ đăng ký được nhóm thực hành con của lớp LT mà sinh viên đang có dòng còn hiệu lực trong phiếu. Huỷ hai chiều: huỷ lớp LT thì huỷ luôn nhóm thực hành con, huỷ nhóm thực hành thì huỷ luôn lớp LT cha. Lớp của môn TH đứng riêng là lớp thường, đăng ký độc lập. | Mở rộng, ADR-0002 |
| DK-12 | Ngoại lệ học lại tách: đã Đạt môn LT thì được đăng ký riêng nhóm thực hành, chọn trong nhóm con của bất kỳ lớp LT nào. Đã Đạt môn TH thì đăng ký lớp LT như môn không có thực hành. | Mở rộng |
| DK-13 | Không có thao tác đổi lớp. Muốn sang lớp khác thì huỷ rồi đăng ký lại; chỗ cũ được trả ngay khi huỷ. | Mở rộng |
| DK-14 | Huỷ lớp chỉ trong đợt đăng ký. Dòng đã huỷ không tạo lần học. | Mở rộng |
| DK-15 | Hết giai đoạn Điều chỉnh, mọi phiếu tự chốt: dòng `REGISTERED` thành `FINALIZED`. Sau khi chốt không có rút môn. | Mở rộng |
| DK-16 | Hình thức học được suy ra tự động lúc đăng ký: kết quả hiện hành là Không đạt → Học lại. Kết quả hiện hành là Đạt → Cải thiện. Còn lại → Lần đầu (kể cả học vượt). Không có môn tự do. | Mở rộng |
| DK-18 | Sinh viên gửi được nhiều lớp trong một lượt đăng ký. Mỗi lớp được xét và giành chỗ độc lập, theo thứ tự trong lượt: lớp này không đạt không làm lớp khác bị từ chối. Lớp LT được xét trước nhóm thực hành con của nó; lớp LT không đạt thì nhóm con cũng không đạt. Kết quả trả về theo từng lớp, kèm lý do. | Mở rộng |

## 6. Kết quả học tập (dữ liệu nền)

Xem [ADR-0018](./adr/0018-diem-la-du-lieu-dau-vao.md).

| Mã | Quy tắc | Nguồn |
|---|---|---|
| KQ-01 | Môn đã học (lần học của các học kỳ trước) và điểm học phần là dữ liệu nền, có sẵn từ hệ thống quản lý điểm của trường, thang 10, làm tròn tới 0,1. Hệ thống chỉ đọc để xét tiên quyết và hình thức học; không tính, không nhập, không hiển thị bảng điểm. Dòng đăng ký đã chốt trong hệ thống cũng trở thành lần học. | Mở rộng |
| KQ-02 | Đạt khi điểm học phần ≥ ngưỡng Đạt. | Mở rộng |
| KQ-03 | Lần học chưa có điểm là chưa có kết quả: không tính là Đạt, cũng không tính là Không đạt. | Mở rộng |
| KQ-04 | Kết quả hiện hành = lần Đạt gần nhất nếu có, nếu không thì lần học gần nhất. Tính cả môn tương đương. | Mở rộng |

## 7. Học phí

Xem [ADR-0003](./adr/0003-mo-hinh-hoc-phi-lai.md) và [ADR-0004](./adr/0004-so-cai-cong-no-append-only.md).

| Mã | Quy tắc | Nguồn |
|---|---|---|
| HP-01 | Mỗi (khoá, hệ đào tạo) có bảng phí gồm học phí cố định mỗi học kỳ chính và đơn giá tín chỉ LT, TH. | Mở rộng, thay QĐ5 |
| HP-02 | Khi học kỳ chính vào `REGISTRATION`, hệ thống ghi nợ học phí cố định cho mọi sinh viên có hồ sơ. Học kỳ hè không có học phí cố định. | Mở rộng |
| HP-03 | Phụ thu = số tín chỉ của môn mở × đơn giá theo loại môn, áp cho dòng đăng ký Học lại và Cải thiện ở học kỳ chính, và mọi dòng ở học kỳ hè. Lần đầu ở học kỳ chính không phụ thu. | QĐ5 (đơn giá) |
| HP-04 | Số tín chỉ và đơn giá được chốt vào dòng đăng ký lúc đăng ký. Đổi bảng phí sau đó không ảnh hưởng. | Mở rộng |
| HP-05 | Huỷ lớp thì ghi một dòng đảo phụ thu tương ứng. Không sửa hay xoá dòng sổ cái cũ. | Mở rộng |
| HP-06 | Giảm trừ = khoản nợ × tỉ lệ giảm của đối tượng ưu tiên, áp cho cả học phí cố định lẫn phụ thu. Tỉ lệ được chốt lúc khoản nợ phát sinh. Làm tròn xuống tới đồng. | QĐ1, QĐ7 |
| HP-08 | Tiền lưu dưới dạng số nguyên đồng (VND), không dùng số thực. | Mở rộng |
| HP-09 | BM7: Số tiền đăng ký = tổng ghi nợ trước giảm. Số tiền phải đóng = Số tiền đăng ký − giảm trừ. Số tiền còn lại = Số tiền phải đóng − đã thanh toán. Luôn có Số tiền phải đóng ≤ Số tiền đăng ký. | QĐ7 |
| HP-10 | Báo cáo BM7 liệt kê sinh viên có số tiền còn lại > 0 của một học kỳ, xuất được Excel và PDF. | BM7 |
| HP-11 | Đóng thừa tạo số dư có, tự trừ vào học kỳ kế tiếp. Không có hoàn tiền. | Mở rộng |
| HP-12 | Tính lại học phí (khi sửa khoá, hệ hoặc đối tượng ưu tiên, HS-14): với học kỳ đang trong đợt đăng ký, hệ thống ghi dòng đảo cho mọi khoản nợ và giảm trừ của sinh viên trong học kỳ đó, rồi ghi lại học phí cố định, phụ thu và giảm trừ theo hồ sơ mới. Thanh toán giữ nguyên, học kỳ trước không đổi. Sửa hồ sơ ngoài đợt đăng ký chỉ áp từ học kỳ sau. | Mở rộng, ADR-0019 |
| HP-13 | Không có khoản điều chỉnh, không huỷ phiếu thu. Ngoài phiếu thu tại quầy, mọi dòng sổ cái do hệ thống sinh theo quy tắc. Sai sót công nợ được sửa ngoài hệ thống. | Mở rộng, ADR-0019 |

## 8. Thanh toán

Xem [ADR-0011](./adr/0011-sepay-voi-ma-thanh-toan-tat-dinh.md).

| Mã | Quy tắc | Nguồn |
|---|---|---|
| TT-01 | Sinh viên được đóng nhiều lần cho một học kỳ. Mỗi lần tạo một phiếu thu (BM6) và một dòng ghi có. | QĐ6 |
| TT-02 | Mã thanh toán = `HP` + mã số sinh viên + mã học kỳ, ví dụ `HP2352000120251`. | Mở rộng |
| TT-03 | QR học phí chỉ hiển thị khi số tiền còn lại > 0. Số tiền trên QR = số tiền còn lại tại lúc hiển thị, sinh viên không chỉnh được. | Mở rộng |
| TT-04 | Webhook SePay: kiểm tra header `Authorization: Apikey`, `transferType = in` và số tài khoản nhận. Lưu giao dịch với ràng buộc duy nhất trên `id` của SePay rồi trả 200 ngay. Xử lý ghi sổ ở worker. | Mở rộng |
| TT-05 | Một giao dịch SePay chỉ tạo tối đa một phiếu thu, dù webhook đến bao nhiêu lần. | Mở rộng |
| TT-06 | Ghi có đúng số tiền thực nhận. Thiếu thì còn nợ, và QR kế tiếp hiện phần còn lại. Thừa thì thành số dư có. | QĐ6 |
| TT-07 | Giao dịch không khớp mã thanh toán vào hàng chờ gán thủ công của Phòng Tài vụ. | Mở rộng |
| TT-08 | Đối soát hằng ngày với API SePay: tự ghi giao dịch có trên ngân hàng mà webhook bỏ sót; các chỗ lệch còn lại chỉ để Phòng Tài vụ xem, không có thao tác sửa. | Mở rộng |
| TT-09 | Thu tại quầy dùng cùng cấu trúc phiếu thu với kênh `COUNTER`. | QĐ6 |
| TT-10 | Khi một thanh toán (mọi kênh, kể cả gán thủ công và đối soát ghi bù) làm số tiền còn lại của học kỳ về 0 hoặc thấp hơn, hệ thống gửi email đóng đủ tới email trong hồ sơ sinh viên. Email đi qua outbox, gửi lỗi không ảnh hưởng việc ghi sổ. | Mở rộng |

## 9. Phi chức năng

| Mã | Yêu cầu |
|---|---|
| NFR-01 | Chịu được 1000 người dùng đồng thời trong đợt đăng ký, 80–90% là đọc. |
| NFR-02 | p95 thời gian phản hồi < 500 ms và 0 lỗi 5xx ở bài k6 1000 VU. |
| NFR-03 | Tính đúng dưới tranh chấp: không bao giờ vượt sĩ số, vượt tín chỉ tối đa, trùng lịch hay trùng môn trong một phiếu, dù sinh viên gửi song song bao nhiêu request (xem [ADR-0005](./adr/0005-chien-luoc-dong-thoi-khi-dang-ky.md)). |
| NFR-04 | Request ghi quan trọng (đăng ký, huỷ, thu tiền) có khoá chống lặp: gửi lại cùng khoá trả cùng kết quả. |
| NFR-05 | Giới hạn tần suất theo sinh viên cho API đăng ký, và theo tài khoản/IP cho đăng nhập. |
| NFR-06 | Giao diện sinh viên mobile-first: rộng tối thiểu 360 px, không cuộn ngang, vùng chạm ≥ 44 px. QR có nút lưu ảnh, và các nút sao chép số tài khoản, số tiền, nội dung chuyển khoản. |
| NFR-07 | Giao diện nhân viên desktop-first nhưng dùng được trên di động. Bảng rộng cuộn ngang trong khung riêng của bảng. |
| NFR-08 | Mật khẩu băm argon2id. Session opaque lưu Redis, cookie `httpOnly; Secure; SameSite=Lax`, hết hạn tuyệt đối sau 8 giờ. Đổi mật khẩu bắt buộc ở lần đăng nhập đầu. Thao tác tài chính của Phòng Tài vụ có thêm CSRF token. |
| NFR-09 | Log JSON có request id và correlation id. `/metrics` cho Prometheus, có dashboard Grafana. |
| NFR-10 | Nhật ký kiểm toán và sổ cái chỉ ghi thêm, không có API sửa hay xoá. |
| NFR-11 | Thông báo duy nhất là email đóng đủ (TT-10). Không có thông báo trong ứng dụng và SMS. |
| NFR-12 | Xuất file: BM7 (Excel, PDF), danh sách lớp (Excel). Thời khoá biểu dạng lưới tuần. |

## 10. Tham số mặc định

Tham số nghiệp vụ do phòng ban phụ trách đổi trên giao diện. Thay đổi không hồi tố.

| Tham số | Mặc định | Người đổi |
|---|---|---|
| Tín chỉ tối thiểu / tối đa mỗi học kỳ chính | 14 / 24 | Phòng Đào tạo |
| Tín chỉ tối đa học kỳ hè | 12 | Phòng Đào tạo |
| Đối tượng ưu tiên (tỉ lệ giảm, độ ưu tiên) | theo seed | Phòng Đào tạo |
| Tín chỉ của môn mở | theo thời khoá biểu | Phòng Đào tạo |
| Hạn đóng học phí của học kỳ | theo học kỳ | Phòng Đào tạo |
| Đơn giá tín chỉ LT / TH | 27.000đ / 37.000đ | Phòng Tài vụ |
| Bảng phí của (khoá, hệ) | theo seed | Phòng Tài vụ |
| Tài khoản nhận học phí | theo seed | Phòng Tài vụ |

Tham số kỹ thuật và ngưỡng Đạt là cấu hình triển khai (biến môi trường hoặc seed), không đổi trên giao diện.

| Tham số | Mặc định |
|---|---|
| Ngưỡng Đạt | 5,0 |
| Chu kỳ polling trang đăng ký | 5 giây |
| TTL cache danh sách lớp và chỗ còn | vài giây (mặc định 3 giây) |
| TTL khoá chống lặp | 24 giờ |
| Thời hạn session | 8 giờ tuyệt đối |
| Timeout / maxWait transaction đăng ký | 5 giây / 2 giây |
