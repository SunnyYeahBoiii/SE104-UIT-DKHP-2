# Bài tập xác định yêu cầu: Quản lý đăng ký học phần và thu học phí sinh viên

> **Trường Đại học Công nghệ Thông tin, ĐHQG TP. Hồ Chí Minh. Khoa Công nghệ Phần mềm.**
>
> - Môn học: Nhập môn Công nghệ Phần mềm (SE104). Đề tài 1.13.
> - Giảng viên hướng dẫn: Đỗ Thị Thanh Tuyền.
> - Thành viên:
>   - 24521710 – Võ Lê Ngọc Thịnh
>   - 24521556 – Nguyễn Trần Tài
>   - 24521390 – Nguyễn Hồng Phúc
>   - 24521421 – Vũ Minh Phương
>
> TP. Hồ Chí Minh, 2026.

## 1. Mục tiêu và phạm vi

Tài liệu này xác định các yêu cầu của phần mềm Quản lý đăng ký học phần và thu học phí sinh viên, cùng với biểu
mẫu và qui định đi kèm từng yêu cầu. Tài liệu đi theo các bước của giai đoạn phân tích yêu cầu:

1. Xác định công việc (yêu cầu).
2. Xác định biểu mẫu liên quan.
3. Xác định qui định nghiệp vụ.
4. Xác định yêu cầu tiến hoá và yêu cầu chất lượng.

Cột "Mục DFD" ở mục 2 cho biết yêu cầu đã được mô hình hoá ở mục nào của tài liệu
[Sơ đồ luồng dữ liệu](./mo-hinh-hoa/so-do-luong-du-lieu.md).

**Người sử dụng.** Hệ thống có ba nhóm người dùng, và một tài khoản có thể giữ nhiều vai trò:

- **Sinh viên:** tra cứu và đăng ký học phần, xem công nợ, đóng học phí.
- **Phòng Đào tạo:** hồ sơ và tài khoản sinh viên, đối tượng ưu tiên, khoá tuyển sinh, mốc thời gian của học kỳ,
  khung giờ đăng ký, giới hạn tín chỉ, thời khoá biểu và lớp học phần.
- **Phòng Tài vụ:** bảng phí và đơn giá, tài khoản nhận học phí, thu tại quầy, gán giao dịch chưa khớp, xem đối
  soát, báo cáo học phí.

Ngoài ra có ba tác nhân tự động không phải người:

- **Bộ định thời:** chạy các tác vụ theo mốc thời gian.
- **Hàng đợi:** xử lý các sự kiện nghiệp vụ.
- **SePay:** cổng thanh toán, báo giao dịch chuyển khoản.

**Phạm vi.** Hệ thống chỉ phục vụ ba nghiệp vụ:

- **Sinh viên đăng ký học phần:** tra cứu lớp mở, đăng ký, huỷ, xem phiếu đăng ký và thời khoá biểu, xem công nợ
  và đóng học phí.
- **Phòng Đào tạo quản lý đăng ký học phần:**
  - hồ sơ sinh viên tối giản (BM1), chỉ gồm các thông tin việc đăng ký và tính học phí cần, kèm tài khoản sinh viên;
  - hệ đào tạo (Chính quy, Chất lượng cao, Tiên tiến…): sinh viên, lớp học phần, bảng phí đều gắn với một hệ;
  - mốc thời gian của học kỳ, khung giờ đăng ký theo khoá, giới hạn tín chỉ;
  - nhập thời khoá biểu học kỳ từ tệp Excel của trường, sau đó điều chỉnh từng lớp;
  - lớp học phần có sĩ số và lịch học theo ngày;
  - môn LT và môn TH đi kèm, nhóm thực hành theo hình thức HT1 (theo lịch) hoặc HT2 (tự xếp lịch);
  - vòng đời học kỳ: Đăng ký, Điều chỉnh, chốt phiếu;
  - điều kiện tiên quyết, đăng ký có điều kiện, môn tương đương, hình thức học.
- **Phòng Tài vụ quản lý đóng học phí:**
  - học phí cố định theo khoá kèm phụ thu theo tín chỉ, tính lại khi sửa hồ sơ sinh viên;
  - sổ cái công nợ;
  - thanh toán chuyển khoản qua mã VietQR và thu tại quầy;
  - email báo sinh viên khi đã đóng đủ học phí;
  - báo cáo sinh viên chưa đóng đủ học phí.

**Dữ liệu nền.** Các dữ liệu ba nghiệp vụ trên cần đọc nhưng không quản lý được nạp sẵn khi cài đặt, hệ thống chỉ
đọc, không có chức năng thêm, sửa, xoá (HS-09, ADR-0019):

- hệ đào tạo; năm học và học kỳ;
- danh mục môn học (BM2), môn tương đương, điều kiện tiên quyết;
- giảng viên, phòng học;
- môn đã học và điểm học phần của sinh viên;
- tài khoản Phòng Đào tạo và Phòng Tài vụ.

**Ngoài phạm vi:**

- **Hồ sơ sinh viên đầy đủ:** ngày sinh, giới tính, quê quán (Tỉnh, Huyện), Khoa, Ngành, trạng thái sinh viên,
  bảo lưu, thôi học, đổi ngành. Sinh viên có hồ sơ được coi là đang học.
- **Chương trình học (BM3):** khối kiến thức, học kỳ gợi ý, tiến độ chương trình, môn tự do.
- **Quản lý điểm và kết quả học tập:** nhập điểm, bảng điểm, GPA, tín chỉ tích lũy, xếp loại. Hệ thống chỉ đọc môn
  đã học và điểm học phần có sẵn để xét tiên quyết và hình thức học (mục 9, ADR-0018).
- **Quản lý thi:** cấm thi, gỡ cấm thi, lịch thi. Hệ thống chỉ cho biết sinh viên nào chưa đóng đủ học phí đúng
  hạn (BM7).
- **Quản trị hệ thống:** vai trò Quản trị, tạo và khoá tài khoản nhân viên, tham số vận hành.
- **Sửa công nợ thủ công:** khoản điều chỉnh, huỷ phiếu thu, hoàn tiền. Đóng thừa thành số dư có; sai sót công nợ
  được sửa ngoài hệ thống.
- **Chức năng của giảng viên:** giảng viên không dùng hệ thống, chỉ là dữ liệu nền để hiển thị trên lớp.
- **Kết thúc học kỳ:** việc chuyển học kỳ từ Đang học sang Kết thúc.
- **Các mục khác:**
  - lập năm học và học kỳ;
  - nhập hàng loạt từ tệp, trừ thời khoá biểu học kỳ;
  - xét tốt nghiệp;
  - rút môn sau khi chốt phiếu;
  - đổi lớp trong một thao tác (sinh viên huỷ rồi đăng ký lại);
  - danh sách chờ khi lớp đầy;
  - môn song hành;
  - hoàn tiền qua cổng thanh toán;
  - tự động xếp thời khoá biểu;
  - thông báo trong ứng dụng, SMS, email khác ngoài email đóng đủ;
  - giao diện đa ngôn ngữ;
  - ứng dụng di động riêng;
  - đăng nhập một lần (SSO).

## 2. Danh sách yêu cầu

| STT | Tên yêu cầu | Người dùng | Biểu mẫu | Qui định | Mục DFD | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Đăng nhập và đổi mật khẩu | Mọi vai trò | Không có | QĐ01 | 1, 2 | Yêu cầu hệ thống (Bảo mật) |
| 2 | Tra cứu lớp học phần mở | Sinh viên | Không có BM riêng | QĐ02 | 3 | Yêu cầu nghiệp vụ (Tra cứu) |
| 3 | Đăng ký lớp học phần | Sinh viên | BM5 | QĐ03 | 4 | Yêu cầu nghiệp vụ (Lưu trữ, kiểm tra, tính toán) |
| 4 | Huỷ lớp học phần | Sinh viên | BM5 | QĐ04 | 5 | Yêu cầu nghiệp vụ (Lưu trữ, tính toán) |
| 5 | Xem và in phiếu đăng ký, thời khoá biểu | Sinh viên | BM5, BB02 | QĐ05 | 6 | Yêu cầu nghiệp vụ (Tra cứu, kết xuất) |
| 6 | Xem công nợ và mã QR học phí | Sinh viên | Không có BM riêng | QĐ06 | 7 | Yêu cầu nghiệp vụ (Tra cứu, tính toán) |
| 7 | Xem và in phiếu thu | Sinh viên | BM6 | QĐ07 | 8 | Yêu cầu nghiệp vụ (Tra cứu, kết xuất) |
| 8 | Quản lý hồ sơ và tài khoản sinh viên | Phòng Đào tạo | BM1 | QĐ08 | 9, 10, 11, 12 | Yêu cầu nghiệp vụ (Lưu trữ, kiểm tra, tính toán) |
| 9 | Quản lý khoá tuyển sinh | Phòng Đào tạo | Không có BM riêng | QĐ09 | 13 | Yêu cầu nghiệp vụ (Lưu trữ, kiểm tra) |
| 10 | Cập nhật mốc thời gian học kỳ và khung giờ đăng ký | Phòng Đào tạo | Không có BM riêng | QĐ10 | 14, 15 | Yêu cầu nghiệp vụ (Lưu trữ, kiểm tra) |
| 11 | Nhập thời khoá biểu học kỳ | Phòng Đào tạo | BM4 | QĐ11 | 16 | Yêu cầu nghiệp vụ (Lưu trữ, kiểm tra) |
| 12 | Điều chỉnh lớp học phần | Phòng Đào tạo | Không có BM riêng | QĐ12 | 17 | Yêu cầu nghiệp vụ (Lưu trữ, kiểm tra) |
| 13 | Xem danh sách sinh viên của lớp | Phòng Đào tạo | BB01 | QĐ13 | 18 | Yêu cầu nghiệp vụ (Tra cứu, kết xuất) |
| 14 | Lập phiếu thu tại quầy | Phòng Tài vụ | BM6 | QĐ14 | 19 | Yêu cầu nghiệp vụ (Lưu trữ, tính toán, kết xuất) |
| 15 | Gán giao dịch chưa khớp | Phòng Tài vụ | BM6 | QĐ15 | 20 | Yêu cầu nghiệp vụ (Lưu trữ) |
| 16 | Lập báo cáo sinh viên chưa đóng học phí | Phòng Tài vụ | BM7 | QĐ16 | 21 | Yêu cầu nghiệp vụ (Kết xuất, tính toán) |
| 17 | Chuyển giai đoạn học kỳ và ghi nợ học phí cố định | Bộ định thời | Không có | QĐ17 | 22 | Yêu cầu nghiệp vụ tự động (Lưu trữ, tính toán) |
| 18 | Chốt phiếu đăng ký | Bộ định thời | BM5 | QĐ18 | 23 | Yêu cầu nghiệp vụ tự động (Lưu trữ) |
| 19 | Nhận giao dịch chuyển khoản | SePay | Không có | QĐ19 | 24 | Yêu cầu hệ thống (Lưu trữ, bảo mật) |
| 20 | Ghi nhận thanh toán chuyển khoản | Hàng đợi | BM6 | QĐ20 | 25 | Yêu cầu nghiệp vụ tự động (Lưu trữ, tính toán) |
| 21 | Đối soát giao dịch | Bộ định thời, Phòng Tài vụ (xem) | Không có | QĐ21 | 26 | Yêu cầu nghiệp vụ tự động (Lưu trữ, kiểm tra) |
| 22 | Xử lý đăng ký có điều kiện khi có điểm | Bộ định thời | BM5 | QĐ22 | 27 | Yêu cầu nghiệp vụ tự động (Lưu trữ, kiểm tra) |
| 23 | Gửi email đóng đủ học phí | Hàng đợi | Không có | QĐ23 | 28 | Yêu cầu nghiệp vụ tự động (Kết xuất) |

**Đối chiếu với đề bài.** Bảy yêu cầu của đề ứng với các yêu cầu sau:

| Yêu cầu của đề | Biểu mẫu, qui định của đề | Yêu cầu trong tài liệu này |
| --- | --- | --- |
| 1. Lập hồ sơ sinh viên | BM1, QĐ1 | YC08 (hồ sơ tối giản) |
| 2. Nhập danh sách môn học | BM2, QĐ2 | Dữ liệu nền, không có yêu cầu riêng |
| 3. Nhập chương trình học | BM3, QĐ3 | Không thực hiện (ADR-0019) |
| 4. Nhập môn học mở trong học kỳ | BM4, QĐ4 | YC10, YC11, YC12 |
| 5. Lập phiếu đăng ký học phần | BM5, QĐ5 | YC03, YC04, YC05, YC18 |
| 6. Lập phiếu thu học phí | BM6, QĐ6 | YC07, YC14, YC15, YC20 |
| 7. Lập báo cáo sinh viên chưa đóng học phí | BM7, QĐ7 | YC16 |

## 3. Danh sách biểu mẫu

Biểu mẫu nghiệp vụ chính là các biểu mẫu BM1, BM4, BM5, BM6 của đề bài. BM2 được giữ làm cấu trúc của dữ liệu nền
môn học; BM3 không thực hiện. Các trường đánh dấu _(bổ sung)_ được thêm vào để phục vụ phần mở rộng. Các dữ liệu
còn lại được lưu thẳng trong hệ thống, không tạo phiếu riêng, gồm:

- khoá tuyển sinh, mốc thời gian của học kỳ, khung giờ đăng ký;
- điều chỉnh lớp học phần sau khi nhập thời khoá biểu;
- giao dịch chuyển khoản.

### 3.1. BM1 – Hồ sơ sinh viên

**BM1: HỒ SƠ SINH VIÊN**

|                              |     |                              |     |
| ---------------------------- | --- | ---------------------------- | --- |
| Mã số sinh viên _(bổ sung)_: |     | Họ tên:                      |     |
| Email _(bổ sung)_:           |     | Đối tượng:                   |     |
| Khoá tuyển sinh _(bổ sung)_: |     | Hệ đào tạo _(bổ sung)_:      |     |

Các trường Ngày sinh, Giới tính, Quê quán, Ngành học của BM1 gốc không được lưu, vì không qui định đăng ký hay học
phí nào dùng tới (ADR-0019).

### 3.2. BM2 – Danh sách môn học (dữ liệu nền)

**BM2: DANH SÁCH MÔN HỌC**

| Stt | Mã môn học | Tên môn học | Loại môn  | Số tiết | Số tín chỉ _(bổ sung)_ | Môn LT đi kèm _(bổ sung)_ |
| --- | ---------- | ----------- | --------- | ------- | ---------------------- | ------------------------- |
| 1   |            |             | □ LT □ TH |         |                        |                           |
| 2   |            |             | □ LT □ TH |         |                        |                           |

Danh sách môn học là dữ liệu nền, nạp sẵn khi cài đặt, không có chức năng nhập. Môn TH đi kèm ghi Môn LT đi kèm và
có mã là mã môn LT thêm `TH`. Môn TH đứng riêng (không có phần LT, ví dụ `CE119`) và môn LT để trống cột này. Số
tín chỉ ở đây là tín chỉ mặc định; tín chỉ thực tế của từng học kỳ lấy từ BM4. Các qui định của QĐ2 đề (DT-01,
DT-02) là ràng buộc của dữ liệu nền.

### 3.3. BM3 – Chương trình học

Không thực hiện. Chương trình học không được dùng bởi qui định đăng ký hay học phí nào còn lại (ADR-0019).

### 3.4. BM4 – Danh sách môn học mở (thời khoá biểu học kỳ)

**BM4: DANH SÁCH MÔN HỌC MỞ**

|         |                     |          |     |
| ------- | ------------------- | -------- | --- |
| Học kỳ: | □ HK I □ HK II □ Hè | Năm học: |     |

| Stt | Môn học | Mã lớp _(bổ sung)_ | Số tín chỉ _(bổ sung)_ | Thực hành _(bổ sung)_ | HTGD _(bổ sung)_ | Giảng viên _(bổ sung)_ | Sĩ số _(bổ sung)_ | Thứ, tiết, cách tuần _(bổ sung)_ | Phòng _(bổ sung)_ | Ngày bắt đầu, kết thúc _(bổ sung)_ | Khoá _(bổ sung)_ | Hệ ĐT _(bổ sung)_ |
| --- | ------- | ------------------ | ---------------------- | --------------------- | ---------------- | ---------------------- | ----------------- | -------------------------------- | ----------------- | ---------------------------------- | ---------------- | ----------------- |
| 1   |         |                    |                        | □ 0 □ 1               | □ LT □ HT1 □ HT2 |                        |                   |                                  |                   |                                    |                  |                   |
| 2   |         |                    |                        | □ 0 □ 1               | □ LT □ HT1 □ HT2 |                        |                   |                                  |                   |                                    |                  |                   |

Mỗi dòng là một lớp học phần hoặc một nhóm thực hành, đúng cấu trúc tệp thời khoá biểu Phòng Đào tạo đang dùng.
Môn mở của học kỳ là các môn có ít nhất một dòng. Giảng viên, phòng, thứ và tiết có thể để trống hoặc `*`.

### 3.5. BM5 – Phiếu đăng ký học phần

**BM5: PHIẾU ĐĂNG KÝ HỌC PHẦN**

|                  |     |           |     |
| ---------------- | --- | --------- | --- |
| Số phiếu:        |     | Ngày lập: |     |
| Mã số sinh viên: |     | Học kỳ:   |     |
| Năm học:         |     |           |     |

| Stt | Môn học | Số tín chỉ | Lớp học phần _(bổ sung)_ | Hình thức học _(bổ sung)_       |
| --- | ------- | ---------- | ------------------------ | ------------------------------------------- |
| 1   |         |            |                          | □ Lần đầu □ Học lại □ Cải thiện |
| 2   |         |            |                          | □ Lần đầu □ Học lại □ Cải thiện |

### 3.6. BM6 – Phiếu thu học phí

**BM6: PHIẾU THU HỌC PHÍ**

|                             |     |                              |                           |
| --------------------------- | --- | ---------------------------- | ------------------------- |
| Số phiếu:                   |     | Ngày lập:                    |                           |
| Mã số sinh viên:            |     | Số tiền thu (VNĐ):           |                           |
| Học kỳ _(bổ sung)_:         |     | Kênh thanh toán _(bổ sung)_: | □ Tại quầy □ Chuyển khoản |
| Thời điểm đóng _(bổ sung)_: |     | Người thu _(bổ sung)_:       |                           |

## 4. Các báo biểu

### 4.1. BM7 – Danh sách sinh viên chưa hoàn thành việc đóng học phí

**BM7: DANH SÁCH SINH VIÊN CHƯA HOÀN THÀNH VIỆC ĐÓNG HỌC PHÍ**

|         |     |          |     |
| ------- | --- | -------- | --- |
| Học kỳ: |     | Năm học: |     |

| Stt | Mã số sinh viên | Số tiền đăng ký | Số tiền phải đóng | Số tiền còn lại |
| --- | --------------- | --------------- | ----------------- | --------------- |
| 1   |                 |                 |                   |                 |
| 2   |                 |                 |                   |                 |

### 4.2. BB01 – Danh sách sinh viên của lớp học phần

**BB01: DANH SÁCH SINH VIÊN CỦA LỚP HỌC PHẦN**

|          |     |                 |     |
| -------- | --- | --------------- | --- |
| Học kỳ:  |     | Mã lớp:         |     |
| Môn học: |     | Sĩ số / tối đa: |     |

| Stt | Mã số sinh viên | Họ tên | Hình thức học |
| --- | --------------- | ------ | ------------- |
| 1   |                 |        |               |
| 2   |                 |        |               |

### 4.3. BB02 – Thời khoá biểu tuần

**BB02: THỜI KHOÁ BIỂU**

|                  |     |         |     |
| ---------------- | --- | ------- | --- |
| Mã số sinh viên: |     | Học kỳ: |     |

| Tiết | Thứ 2 | Thứ 3 | Thứ 4 | Thứ 5 | Thứ 6 | Thứ 7 | Chủ nhật |
| ---- | ----- | ----- | ----- | ----- | ----- | ----- | -------- |
| 1–5  |       |       |       |       |       |       |          |
| 6–10 |       |       |       |       |       |       |          |

Mỗi ô ghi Mã lớp, Phòng, ngày bắt đầu, ngày kết thúc và nhịp (mỗi tuần hoặc cách tuần). Lớp không có buổi học
(nhóm thực hành HT2, đồ án, khoá luận) không nằm trên lưới, mà được liệt kê dưới lưới, ví dụ ghi chú "HT2 – tự xếp
lịch".

## 5. Yêu cầu, biểu mẫu và qui định liên quan

**Cách đọc.** QĐnn.m là qui định thứ m của yêu cầu YCnn. Ngoặc cuối mỗi qui định ghi nguồn:

- "QĐx đề" là qui định gốc của đề bài.
- Mã như DK-05 là quy tắc trong [requirements.md](./requirements.md).

Mọi thao tác ghi đều được lưu vào nhật ký kiểm toán chỉ ghi thêm (QV-03), nên các mục dưới đây không nhắc lại.

### 5.1. YC01 – Đăng nhập và đổi mật khẩu

Biểu mẫu liên quan: Không có biểu mẫu nghiệp vụ.

Người dùng: mọi vai trò.

**Đăng nhập.**

- **QĐ01.1** Tên đăng nhập là mã số sinh viên hoặc mã cán bộ. Mỗi người có một tài khoản dùng cho mọi vai trò của mình.
- **QĐ01.2** Chỉ tài khoản có tồn tại, nhập đúng mật khẩu, mới đăng nhập được.
- **QĐ01.3** Sai tên đăng nhập và sai mật khẩu trả về cùng một thông báo, để không lộ tài khoản nào tồn tại.
- **QĐ01.4** Đăng nhập sai quá nhiều lần theo tài khoản hoặc địa chỉ IP thì bị tạm chặn (NFR-05).
- **QĐ01.5** Phiên đăng nhập hết hạn tuyệt đối sau 8 giờ (NFR-08).
- **QĐ01.6** Tài khoản còn mật khẩu tạm chỉ được vào màn hình Đổi mật khẩu.

**Đổi mật khẩu.**

- **QĐ01.7** Phải nhập đúng mật khẩu hiện tại.
- **QĐ01.8** Mật khẩu mới phải khớp với ô nhập lại và khác mật khẩu hiện tại.
- **QĐ01.9** Bắt buộc đổi mật khẩu ở lần đăng nhập đầu, và sau mỗi lần Phòng Đào tạo đặt lại mật khẩu (HS-13, NFR-08).

**Tài khoản.**

- **QĐ01.10** Tài khoản Phòng Đào tạo và Phòng Tài vụ là dữ liệu nền, nạp sẵn khi cài đặt. Không có chức năng tạo,
  khoá hay đổi vai trò tài khoản nhân viên (HS-09).
- **QĐ01.11** Tài khoản Sinh viên chỉ được tạo, đặt lại mật khẩu và xoá cùng hồ sơ sinh viên (YC08, HS-13).
- **QĐ01.12** Mật khẩu được băm bằng argon2id (NFR-08).

**Phân quyền.**

- **QĐ01.13** Một tài khoản giữ một hoặc nhiều vai trò, và chỉ dùng được chức năng của các vai trò mình giữ, theo ma trận ở mục 7.4 (§2).
- **QĐ01.14** Sinh viên chỉ đọc và thao tác trên dữ liệu của chính mình: phiếu đăng ký, công nợ, phiếu thu (QV-02).
- **QĐ01.15** Chỉ Phòng Đào tạo được tạo, sửa, xoá hồ sơ sinh viên, đối tượng ưu tiên và khoá tuyển sinh (QV-01).
- **QĐ01.16** Mọi thao tác ghi được lưu vào nhật ký kiểm toán chỉ ghi thêm: người làm, vai trò, thời điểm, dữ liệu vào, kết quả (QV-03).

### 5.2. YC02 – Tra cứu lớp học phần mở

Biểu mẫu liên quan: Không có biểu mẫu nghiệp vụ riêng.

- **QĐ02.1** Lọc được theo mã hoặc tên môn, thứ trong tuần, loại môn và khoá dành cho. Mặc định chỉ hiện lớp cùng
  hệ đào tạo với sinh viên.
- **QĐ02.2** Mỗi lớp hiển thị các thông tin sau:
  - môn, loại môn, số tín chỉ;
  - giảng viên (nếu đã phân công), lịch học kèm phòng, ngày bắt đầu, ngày kết thúc;
  - khoá dành cho, ngôn ngữ giảng dạy, ghi chú;
  - sĩ số tối đa và số chỗ còn;
  - các nhóm thực hành và hình thức thực hành (HT1 hoặc HT2), nếu có.
- **QĐ02.3** Số chỗ còn được làm mới khoảng 5 giây một lần và có thể trễ tối đa 3 giây so với thực tế. Số chính
  xác được kiểm tra lại lúc đăng ký (§10).

### 5.3. YC03 – Đăng ký lớp học phần

Biểu mẫu liên quan: BM5 – Phiếu đăng ký học phần.

- **QĐ03.1** Mỗi sinh viên có tối đa một phiếu đăng ký cho mỗi học kỳ. Phiếu được tạo khi sinh viên đăng ký lớp
  đầu tiên (QĐ5 đề, DK-01).
- **QĐ03.2** Chỉ đăng ký được khi đủ cả hai điều kiện (DK-02):
  - học kỳ đang ở giai đoạn Đăng ký hoặc Điều chỉnh;
  - nếu đang ở giai đoạn Đăng ký: đang trong khung giờ của khoá mình.
- **QĐ03.3** Chỉ đăng ký được lớp của môn có mở trong học kỳ, và lớp cùng hệ đào tạo với sinh viên (QĐ5 đề, DK-03,
  DK-19). Khoá dành cho của lớp chỉ để tham khảo, không chặn đăng ký.
- **QĐ03.4** Mỗi phiếu có tối đa một dòng còn hiệu lực cho mỗi môn, tính cả môn tương đương (DK-04).
- **QĐ03.5** Điều kiện tiên quyết được xét theo kết quả hiện hành, đọc từ điểm học phần có sẵn, tính cả môn tương
  đương (DK-05):
  - Môn Tiên quyết phải Đạt.
  - Môn Học trước phải có lần học đã có điểm.
  - Sinh viên đã có lần học của môn tiên quyết nhưng lần học đó chưa có điểm (thường là học kỳ đang học) thì dòng
    được nhận dưới dạng **đăng ký có điều kiện**, xử lý tiếp ở YC22.
- **QĐ03.6** Lớp mới không được trùng lịch với lớp nào còn hiệu lực trong phiếu (DK-07). Hai buổi trùng khi có đủ
  ba điều kiện:
  - cùng thứ;
  - khoảng tiết giao nhau;
  - có ít nhất một ngày học chung, tính từ ngày bắt đầu, ngày kết thúc và nhịp của mỗi buổi.

  Lớp không có buổi học, gồm nhóm thực hành HT2, không bao giờ trùng lịch.

- **QĐ03.7** Tổng tín chỉ còn hiệu lực trong phiếu không vượt mức tối đa do Phòng Đào tạo đặt, mặc định 24 ở học kỳ chính, 12 ở học kỳ hè
  (DK-08).
- **QĐ03.8** Lớp chỉ nhận thêm sinh viên khi số đã đăng ký nhỏ hơn sĩ số tối đa. Không có danh sách chờ (DK-09).
- **QĐ03.9** Với mỗi lớp, các điều kiện được kiểm tra theo đúng thứ tự QĐ03.2 → QĐ03.4, rồi QĐ03.10 nếu là nhóm
  thực hành, rồi QĐ03.5 → QĐ03.8. Hệ thống trả về lý do đầu tiên không thoả của lớp đó (DK-10).
- **QĐ03.10** Đăng ký môn có thực hành (DK-11, DK-12):
  - Lớp LT và nhóm thực hành là hai lớp riêng, thành hai dòng riêng trong phiếu. Học lớp LT không bắt buộc đăng ký
    nhóm thực hành.
  - Chỉ đăng ký được nhóm thực hành con của lớp LT mà sinh viên đang có dòng còn hiệu lực trong phiếu.
  - Ngoại lệ học lại tách: đã Đạt môn LT thì được đăng ký riêng nhóm thực hành, chọn trong nhóm con của bất kỳ lớp
    LT nào. Đã Đạt môn TH thì đăng ký lớp LT như môn không có thực hành.
  - Lớp của môn TH đứng riêng là lớp thường, đăng ký độc lập (DT-12).
- **QĐ03.11** Hình thức học được hệ thống tự suy ra, sinh viên không khai (DK-16):
  - Kết quả gần nhất Không đạt là Học lại.
  - Đã từng Đạt là Cải thiện.
  - Các trường hợp còn lại là Lần đầu.
- **QĐ03.12** Số tín chỉ lấy từ môn mở của học kỳ (có thể bằng 0). Số tín chỉ và đơn giá được chốt vào dòng đăng
  ký lúc đăng ký (DT-07, HP-04).
- **QĐ03.13** Phụ thu được ghi nợ ngay nếu có. Đơn giá mặc định: 27.000đ/tín chỉ LT, 37.000đ/tín chỉ TH (QĐ5
  đề, HP-03). Có phụ thu khi:
  - dòng Học lại hoặc Cải thiện ở học kỳ chính;
  - mọi dòng ở học kỳ hè.
- **QĐ03.14** Gửi lại cùng một yêu cầu, ví dụ khi mạng chập chờn, không tạo thêm dòng đăng ký (NFR-04).
- **QĐ03.15** Sinh viên gửi được nhiều lớp trong một lượt đăng ký (DK-18):
  - Mỗi lớp được xét và giành chỗ độc lập: lớp này không đạt không làm lớp khác bị từ chối.
  - Các lớp được xét lần lượt theo thứ tự trong lượt, lớp LT được xét trước nhóm thực hành con của nó. Nếu lớp LT
    không đạt thì nhóm con cũng không đạt (QĐ03.10).
  - Kết quả trả về theo từng lớp, kèm lý do nếu không đạt.

### 5.4. YC04 – Huỷ lớp học phần

Biểu mẫu liên quan: BM5.

- **QĐ04.1** Chỉ huỷ được dòng đăng ký của chính mình, đang ở trạng thái Đã đăng ký, trong điều kiện như QĐ03.2
  (DK-14).
- **QĐ04.2** Huỷ hai chiều (DK-11):
  - Huỷ lớp LT thì huỷ luôn nhóm thực hành con đang học, nếu có.
  - Huỷ nhóm thực hành thì huỷ luôn lớp LT cha, nếu có trong phiếu.
- **QĐ04.3** Chỗ được trả lại cho lớp ngay.
- **QĐ04.4** Phụ thu của dòng bị huỷ được đảo bằng một dòng sổ cái mới, không sửa dòng cũ (HP-05).
- **QĐ04.5** Không có thao tác đổi lớp. Muốn sang lớp khác, sinh viên huỷ rồi đăng ký lại. Chỗ cũ được trả ngay,
  không được giữ cho tới khi đăng ký lớp mới thành công (DK-13).

### 5.5. YC05 – Xem và in phiếu đăng ký, thời khoá biểu

Biểu mẫu liên quan: BM5; BB02 – Thời khoá biểu tuần.

- **QĐ05.1** Sinh viên chỉ xem được phiếu của chính mình (QV-02).
- **QĐ05.2** Phiếu chỉ in các dòng còn hiệu lực, theo các cột của BM5.
- **QĐ05.3** Thời khoá biểu hiển thị dạng lưới tuần, theo thứ và tiết, từ lịch của các lớp còn hiệu lực (NFR-12).

### 5.6. YC06 – Xem công nợ và mã QR học phí

Biểu mẫu liên quan: Không có biểu mẫu nghiệp vụ riêng. Số liệu cùng cách tính với BM7.

- **QĐ06.1** Công nợ của học kỳ được tính lại từ sổ cái mỗi lần xem, không lưu sẵn (HP-09):
  - Số tiền đăng ký = tổng ghi nợ trước giảm trừ.
  - Số tiền phải đóng = Số tiền đăng ký − giảm trừ.
  - Số tiền còn lại = Số tiền phải đóng − đã thanh toán.
- **QĐ06.2** Hiển thị từng dòng tạo nên công nợ: học phí cố định, phụ thu, giảm trừ, thanh toán, số dư chuyển kỳ, và các dòng đảo khi huỷ lớp hoặc tính lại học phí.
- **QĐ06.3** Mã QR chỉ hiện khi số tiền còn lại > 0. Số tiền trên mã bằng số tiền còn lại lúc xem, sinh viên
  không sửa được (TT-03).
- **QĐ06.4** Nội dung chuyển khoản là mã thanh toán gồm `HP` + mã số sinh viên + mã học kỳ, ví dụ
  `HP2352000120251` (TT-02).
- **QĐ06.5** Có nút lưu ảnh mã QR, và nút sao chép số tài khoản, số tiền, nội dung chuyển khoản (NFR-06).
- **QĐ06.6** Hiển thị hạn đóng học phí của học kỳ.

### 5.7. YC07 – Xem và in phiếu thu

Biểu mẫu liên quan: BM6 – Phiếu thu học phí.

- **QĐ07.1** Sinh viên chỉ xem được phiếu thu của chính mình (QV-02).
- **QĐ07.2** Mỗi lần đóng tiền, tại quầy hay chuyển khoản, có đúng một phiếu thu (TT-01).
- **QĐ07.3** Phiếu thu in được theo các trường của BM6.

### 5.8. YC08 – Quản lý hồ sơ và tài khoản sinh viên

Biểu mẫu liên quan: BM1 – Hồ sơ sinh viên.

**Lập hồ sơ.**

- **QĐ08.1** Chỉ Phòng Đào tạo được thêm, sửa, xoá hồ sơ, từng hồ sơ một (QV-01). Không có nhập hàng loạt.
- **QĐ08.2** Hồ sơ gồm mã số sinh viên, họ tên, email, khoá tuyển sinh, hệ đào tạo và đối tượng ưu tiên, có thể
  không có đối tượng (QĐ1 đề, HS-11). Khoá chọn từ danh mục của YC09; hệ đào tạo chọn từ dữ liệu nền; đối tượng
  chọn từ danh mục đối tượng ưu tiên (mục 6).
- **QĐ08.3** Đối tượng ưu tiên (QĐ1 đề, HS-02):
  - Sinh viên có thể thuộc nhiều đối tượng ưu tiên, ví dụ con liệt sĩ, con thương binh, vùng sâu, vùng xa.
  - Mỗi đối tượng có một tỉ lệ giảm học phí và một độ ưu tiên.
  - Đối tượng của sinh viên là đối tượng có độ ưu tiên cao nhất.
- **QĐ08.4** Mã số sinh viên là duy nhất. Sinh viên có hồ sơ được coi là đang học; không có trạng thái sinh viên
  (HS-11).
- **QĐ08.5** Lập hồ sơ thì tạo luôn tài khoản Sinh viên trong cùng giao dịch (HS-13):
  - tên đăng nhập là mã số sinh viên;
  - mật khẩu ban đầu là chuỗi ngẫu nhiên, hiện một lần duy nhất cho Phòng Đào tạo;
  - sinh viên phải đổi mật khẩu ở lần đăng nhập đầu.

**Cập nhật hồ sơ.**

- **QĐ08.6** Mã số sinh viên không sửa được. Nhập sai mã thì xoá hồ sơ rồi tạo lại (HS-12).
- **QĐ08.7** Sửa khoá, hệ đào tạo hoặc đối tượng ưu tiên thì **tính lại học phí** (HS-14, HP-12):
  - Nếu có học kỳ đang trong đợt đăng ký (giai đoạn Đăng ký hoặc Điều chỉnh): ghi dòng đảo cho mọi khoản nợ và
    giảm trừ của sinh viên trong học kỳ đó, rồi ghi lại học phí cố định, phụ thu và giảm trừ theo hồ sơ mới.
  - Thanh toán giữ nguyên. Công nợ các học kỳ trước không đổi.
  - Ngoài đợt đăng ký: thay đổi chỉ áp từ học kỳ sau.
- **QĐ08.8** Các dòng đăng ký đã có giữ nguyên, kể cả khi lớp khác hệ đào tạo mới. Điều kiện cùng hệ chỉ xét lúc
  đăng ký (HS-14, DK-19).

**Xoá hồ sơ.**

- **QĐ08.9** Chỉ xoá được hồ sơ khi sinh viên chưa có phiếu đăng ký và chưa có dòng sổ cái nào. Xoá hồ sơ thì xoá
  luôn tài khoản (HS-12, HS-13).

**Đặt lại mật khẩu.**

- **QĐ08.10** Phòng Đào tạo đặt lại mật khẩu của sinh viên bằng cùng cơ chế với QĐ08.5: mật khẩu ngẫu nhiên mới
  hiện một lần, mọi phiên đăng nhập của sinh viên bị thu hồi, sinh viên phải đổi mật khẩu ở lần đăng nhập kế tiếp
  (HS-13, ADR-0013).

### 5.9. YC09 – Quản lý khoá tuyển sinh

Biểu mẫu liên quan: Không có biểu mẫu nghiệp vụ riêng.

- **QĐ09.1** Khoá tuyển sinh được định danh bằng năm nhập học, là duy nhất (HS-15).
- **QĐ09.2** Phòng Đào tạo thêm, sửa, xoá khoá tuyển sinh. Không xoá được khoá đang có sinh viên, bảng phí hoặc
  khung giờ đăng ký tham chiếu (HS-15).

### 5.10. YC10 – Cập nhật mốc thời gian học kỳ và khung giờ đăng ký

Biểu mẫu liên quan: Không có biểu mẫu nghiệp vụ riêng.

**Học kỳ.**

- **QĐ10.1** Năm học và học kỳ là dữ liệu nền. Một năm học có HK I, HK II, và có thể có học kỳ hè (QĐ4 đề, DT-06).
  Phòng Đào tạo không lập học kỳ, chỉ sửa mốc thời gian (HK-06).
- **QĐ10.2** Mã học kỳ = năm bắt đầu của năm học + số kỳ (1, 2, 3 = hè), ví dụ `20251` (HK-01).
- **QĐ10.3** Học kỳ có năm mốc, theo thứ tự (HK-02): Bắt đầu đăng ký < Kết thúc đăng ký ≤ Bắt đầu điều chỉnh < Kết
  thúc điều chỉnh < Hạn đóng học phí.
- **QĐ10.4** Luật sửa mốc (HK-06):
  - Khoảng chưa bắt đầu: sửa được cả bắt đầu lẫn kết thúc.
  - Khoảng đã bắt đầu: chỉ sửa được kết thúc.
  - Khoảng đã kết thúc: không sửa được.
  - Hạn đóng học phí sửa được khi chưa tới.
  - Giá trị mới phải ≥ thời điểm hiện tại và vẫn giữ thứ tự QĐ10.3.
- **QĐ10.5** Tại mọi thời điểm có tối đa một học kỳ đang ở giai đoạn Đăng ký hoặc Điều chỉnh (HK-04).

**Khung giờ đăng ký.**

- **QĐ10.6** Giai đoạn Đăng ký chia thành các khung giờ theo khoá. Giai đoạn Điều chỉnh mở cho mọi khoá (HK-05).
- **QĐ10.7** Khung giờ phải nằm trong giai đoạn Đăng ký của học kỳ và có ít nhất một khoá (HK-07).
- **QĐ10.8** Luật sửa khung giờ (HK-07):
  - Khung chưa bắt đầu: thêm, sửa, xoá, gán khoá tự do.
  - Khung đang diễn ra: chỉ sửa được giờ kết thúc.
  - Khung đã kết thúc: không sửa được.

### 5.11. YC11 – Nhập thời khoá biểu học kỳ

Biểu mẫu liên quan: BM4 – Danh sách môn học mở (thời khoá biểu học kỳ).

**Cách nhập.**

- **QĐ11.1** Phòng Đào tạo nhập thời khoá biểu từ tệp Excel theo mẫu của trường. Một lần nhập tạo môn mở, lớp học
  phần, nhóm thực hành, buổi học và hình thức thực hành của cả học kỳ (QĐ4 đề, TKB-01).
- **QĐ11.2** Chỉ nhập khi học kỳ ở giai đoạn Chuẩn bị. Nhập lại thì thay toàn bộ thời khoá biểu của học kỳ đó.
  Theo kiểu tất cả hoặc không, trả báo cáo lỗi theo từng dòng (TKB-02).
- **QĐ11.3** Bộ nhập không tạo dữ liệu nền: mã môn phải có trong danh mục môn học; mã giảng viên và mã phòng, nếu
  có, phải có trong dữ liệu nền; hệ đào tạo phải là hệ có sẵn (TKB-03).

**Môn mở và tín chỉ.**

- **QĐ11.4** Môn mở là môn có ít nhất một lớp trong học kỳ (DT-07).
- **QĐ11.5** Cột số tín chỉ là tín chỉ của môn mở; trống thì lấy mặc định của môn. Mọi dòng của cùng một môn phải
  cùng tín chỉ, lệch thì báo lỗi dòng. Tín chỉ 0 hợp lệ (TKB-05, ADR-0017).

**Lớp học phần và nhóm thực hành.**

- **QĐ11.6** Lớp học phần thuộc một môn mở và một hệ đào tạo, có sĩ số tối đa > 0. Giảng viên có thể để trống. Lớp
  ghi thêm khoá dành cho (một năm nhập học, hoặc mọi khoá), ngôn ngữ giảng dạy và ghi chú, chỉ để hiển thị (DT-08,
  TKB-07). Mã lớp là duy nhất trong học kỳ.
- **QĐ11.7** Dòng có cột Thực hành = 1 và mã `<mã lớp LT>.n` là nhóm thực hành của lớp LT đó, thuộc môn TH đi kèm,
  dù tệp ghi mã môn LT (TKB-04):
  - n ≥ 1, không cần liên tiếp, không giới hạn số nhóm. Mỗi nhóm có sĩ số riêng (DT-11).
  - Cột HTGD của các nhóm là hình thức thực hành của lớp LT cha, các nhóm của một lớp phải cùng HTGD.
  - **HT1 – Thực hành theo lịch:** mỗi nhóm có buổi học cố định.
  - **HT2 – Thực hành tự xếp lịch:** nhóm không có buổi học. Giảng viên và sinh viên tự hẹn lịch ngoài hệ thống.
- **QĐ11.8** Dòng thực hành của môn TH đứng riêng là lớp thường: có buổi học, không có lớp cha, không có hình thức
  thực hành (DT-12).

**Buổi học.**

- **QĐ11.9** Mỗi dòng có lịch tạo một buổi học gồm (DT-09, TKB-06):
  - thứ, từ thứ 2 tới chủ nhật;
  - tiết bắt đầu ≤ tiết kết thúc, trong khoảng 1–10 (tệp ghi chuỗi tiết, `0` là tiết 10);
  - phòng, có thể để trống;
  - ngày bắt đầu ≤ ngày kết thúc;
  - nhịp: mỗi tuần hoặc cách tuần.

  Ngày học là ngày bắt đầu cộng bội số của nhịp, không quá ngày kết thúc. Dòng có thứ và tiết là `*` thì lớp không
  có buổi học. Học xen kẽ là hai nhóm học cách tuần, nhóm sau bắt đầu muộn hơn nhóm trước một tuần.
- **QĐ11.10** Hệ thống cảnh báo trùng phòng hoặc trùng giảng viên theo ngày học chung, nhưng vẫn cho nhập (DT-10).

### 5.12. YC12 – Điều chỉnh lớp học phần

Biểu mẫu liên quan: Không có biểu mẫu nghiệp vụ riêng.

- **QĐ12.1** Ở giai đoạn Chuẩn bị, Phòng Đào tạo thêm, sửa, xoá lớp học phần, nhóm thực hành và buổi học tự do, theo
  đúng các qui định QĐ11.6–QĐ11.10 (LHP-01).
- **QĐ12.2** Từ giai đoạn Đăng ký trở đi chỉ được (LHP-02):
  - sửa sĩ số tối đa, không thấp hơn số sinh viên đã đăng ký;
  - điền giảng viên hoặc phòng còn trống.

  Không thêm, không xoá lớp, không đổi lịch, không đổi hình thức thực hành (DT-11).
- **QĐ12.3** Mỗi lớp, kể cả nhóm thực hành, có sĩ số tối đa riêng và không bao giờ vượt. Thiếu chỗ thì sinh viên
  liên hệ Phòng Đào tạo để tăng sĩ số (DK-09).
- **QĐ12.4** Cảnh báo trùng phòng, trùng giảng viên như QĐ11.10.

### 5.13. YC13 – Xem danh sách sinh viên của lớp

Biểu mẫu liên quan: BB01 – Danh sách sinh viên của lớp học phần.

- **QĐ13.1** Danh sách gồm các sinh viên có dòng đăng ký còn hiệu lực trong lớp, kèm sĩ số hiện tại so với sĩ số
  tối đa.
- **QĐ13.2** Danh sách xuất được ra Excel (NFR-12).

### 5.14. YC14 – Lập phiếu thu tại quầy

Biểu mẫu liên quan: BM6 – Phiếu thu học phí.

- **QĐ14.1** Phiếu thu được lập dựa trên công nợ của sinh viên trong một học kỳ (QĐ6 đề).
- **QĐ14.2** Sinh viên được đóng nhiều lần cho một học kỳ. Mỗi lần đóng tạo một phiếu thu và một dòng ghi có
  trong sổ cái (QĐ6 đề, TT-01).
- **QĐ14.3** Số tiền thu là số nguyên đồng lớn hơn 0 (HP-08). Thu nhiều hơn số còn lại thì phần dư thành số dư
  có, tự trừ vào học kỳ sau (HP-11).
- **QĐ14.4** Bấm lập phiếu nhiều lần với cùng một yêu cầu chỉ tạo một phiếu thu (NFR-04).
- **QĐ14.5** Phiếu thu không sửa, không xoá, không huỷ được (NFR-10, HP-13). Phiếu in được ngay sau khi lập.

### 5.15. YC15 – Gán giao dịch chưa khớp

Biểu mẫu liên quan: BM6.

- **QĐ15.1** Giao dịch có nội dung không đúng mã thanh toán thì vào hàng chờ của Phòng Tài vụ (TT-07).
- **QĐ15.2** Phòng Tài vụ gán giao dịch cho một sinh viên và một học kỳ, hoặc đánh dấu bỏ qua.
- **QĐ15.3** Gán giao dịch thì tạo phiếu thu với số tiền thực nhận. Thời điểm đóng là thời điểm giao dịch ngân
  hàng, không phải lúc gán, để xác định đúng việc đóng trước hay sau hạn.

### 5.16. YC16 – Lập báo cáo sinh viên chưa đóng học phí

Biểu mẫu liên quan: BM7.

- **QĐ16.1** Báo cáo lập theo học kỳ của năm học. Báo cáo liệt kê các sinh viên có số tiền còn lại > 0 (HP-10).
- **QĐ16.2** Ba con số được tính lại từ sổ cái như QĐ06.1 (HP-09).
- **QĐ16.3** Số tiền phải đóng ≤ Số tiền đăng ký, vì sinh viên được giảm trừ theo đối tượng ưu tiên (QĐ7 đề).
- **QĐ16.4** Giảm trừ = khoản nợ × tỉ lệ giảm, làm tròn xuống tới đồng (HP-06):
  - áp cho cả học phí cố định lẫn phụ thu;
  - tỉ lệ được chốt lúc khoản nợ phát sinh.
- **QĐ16.5** Báo cáo xuất được ra Excel và PDF (NFR-12).

### 5.17. YC17 – Chuyển giai đoạn học kỳ và ghi nợ học phí cố định

Biểu mẫu liên quan: Không có biểu mẫu nghiệp vụ.

- **QĐ17.1** Giai đoạn học kỳ tự chuyển theo mốc thời gian (HK-03):
  1. Chuẩn bị.
  2. Đăng ký.
  3. Điều chỉnh.
  4. Đang học.

  Không chuyển ngược. Giai đoạn Kết thúc có trong vòng đời nhưng việc chuyển sang nằm ngoài phạm vi.

- **QĐ17.2** Học kỳ chính vào giai đoạn Đăng ký thì mỗi sinh viên có hồ sơ được ghi nợ học phí cố định theo bảng
  phí của khoá và hệ đào tạo, kèm giảm trừ (HP-01, HP-02, HP-06). Học kỳ hè không có học phí cố định.
- **QĐ17.3** Số dư có của học kỳ trước được chuyển sang học kỳ mới (HP-11).

### 5.18. YC18 – Chốt phiếu đăng ký

Biểu mẫu liên quan: BM5.

- **QĐ18.1** Hết giai đoạn Điều chỉnh, mọi phiếu tự chốt: dòng Đã đăng ký thành Đã chốt. Sau khi chốt không có
  rút môn (DK-15).
- **QĐ18.2** Phiếu có ít hơn mức tối thiểu (mặc định 14 tín chỉ) ở học kỳ chính được đưa vào danh sách cảnh báo gửi Phòng Đào tạo. Không
  chặn (DK-08).

### 5.19. YC19 – Nhận giao dịch chuyển khoản

Biểu mẫu liên quan: Không có biểu mẫu nghiệp vụ.

- **QĐ19.1** Chỉ nhận giao dịch thoả cả ba điều kiện (TT-04):
  - đúng khoá API của SePay;
  - là giao dịch tiền vào;
  - đúng tài khoản nhận học phí.
- **QĐ19.2** Mỗi giao dịch SePay chỉ lưu một lần, dù SePay gửi lại bao nhiêu lần (TT-05).
- **QĐ19.3** Lưu xong thì trả kết quả cho SePay ngay. Việc ghi sổ làm sau, ở YC20.

### 5.20. YC20 – Ghi nhận thanh toán chuyển khoản

Biểu mẫu liên quan: BM6.

- **QĐ20.1** Nội dung chuyển khoản đúng mã thanh toán (QĐ06.4) thì giao dịch tự khớp với sinh viên và học kỳ.
  Không khớp thì vào hàng chờ của YC15.
- **QĐ20.2** Ghi có đúng số tiền thực nhận (TT-06):
  - Thiếu thì sinh viên còn nợ, và mã QR kế tiếp hiện phần còn lại.
  - Thừa thì thành số dư có.
- **QĐ20.3** Một giao dịch tạo tối đa một phiếu thu (TT-05). Nếu thanh toán làm sinh viên đóng đủ học phí thì gửi email như YC23.
- **QĐ20.4** Thời điểm đóng là thời điểm giao dịch ngân hàng, không phải lúc hệ thống ghi sổ.

### 5.21. YC21 – Đối soát giao dịch

Biểu mẫu liên quan: Không có biểu mẫu nghiệp vụ.

- **QĐ21.1** Hằng ngày, hệ thống so danh sách giao dịch trên SePay với các giao dịch đã lưu (TT-08). Giao dịch bị
  sót được tự ghi bổ sung và xử lý như YC20.
- **QĐ21.2** Các chỗ lệch còn lại, như giao dịch đã lưu nhưng không có trên SePay hoặc lệch số tiền, được liệt kê
  để Phòng Tài vụ xem. Không có thao tác sửa; sai sót được xử lý ngoài hệ thống (TT-08, HP-13).

### 5.22. YC22 – Xử lý đăng ký có điều kiện khi có điểm

Biểu mẫu liên quan: BM5.

- **QĐ22.1** Hằng ngày, hệ thống xét các dòng đăng ký có điều kiện (QĐ03.5) có lần học môn tiên quyết nay đã có
  điểm (DK-05, DK-06).
- **QĐ22.2** Đạt thì dòng bỏ đánh dấu có điều kiện, thành dòng bình thường.
- **QĐ22.3** Không đạt:
  - Học kỳ của dòng còn ở giai đoạn Đăng ký hoặc Điều chỉnh: dòng tự huỷ như YC04 (huỷ hai chiều, trả chỗ, đảo
    phụ thu).
  - Phiếu đã chốt: dòng giữ nguyên.

  Không có thông báo nào được gửi (DK-06).
- **QĐ22.4** Chỉ điều kiện loại Tiên quyết mới cần Đạt. Điều kiện Học trước thoả ngay khi lần học có điểm, dù Đạt
  hay Không đạt (DT-05).

### 5.23. YC23 – Gửi email đóng đủ học phí

Biểu mẫu liên quan: Không có biểu mẫu nghiệp vụ.

- **QĐ23.1** Khi một thanh toán làm số tiền còn lại của sinh viên trong học kỳ chuyển từ lớn hơn 0 về 0 hoặc thấp
  hơn, hệ thống gửi một email đóng đủ tới email trong hồ sơ sinh viên (TT-10). Áp cho mọi kênh: thu tại quầy
  (YC14), gán giao dịch (YC15), chuyển khoản (YC20), đối soát ghi bù (YC21).
- **QĐ23.2** Thanh toán tiếp theo khi đã đóng đủ không gửi thêm email. Nếu tính lại học phí (QĐ08.7) làm số tiền
  còn lại lớn hơn 0 trở lại, lần đóng đủ sau sẽ gửi email mới.
- **QĐ23.3** Email ghi học kỳ, số tiền phải đóng và tổng số tiền đã đóng.
- **QĐ23.4** Email được gửi qua hàng đợi từ sự kiện đã lưu cùng giao dịch ghi sổ (ADR-0008, ADR-0010). Gửi lỗi thì
  tự thử lại, không ảnh hưởng việc ghi sổ. Đây là thông báo duy nhất của hệ thống (NFR-11).

## 6. Yêu cầu tiến hoá

Mọi thay đổi qui định chỉ áp dụng cho tương lai, không hồi tố. Giá trị cần giữ được chép vào học kỳ, dòng đăng
ký hoặc dòng sổ cái lúc ghi (§10). Sơ đồ luồng dữ liệu của từng thay đổi nằm trong
[Mô hình hoá yêu cầu thay đổi qui định](./mo-hinh-hoa/thay-doi-qui-dinh.md).

| STT | Nghiệp vụ | Tham số cần thay đổi | Miền giá trị cần thay đổi | Người thay đổi |
| --- | --- | --- | --- | --- |
| 1 | Lập hồ sơ sinh viên (QĐ1) | Đối tượng ưu tiên | Thêm, bớt, cập nhật tỉ lệ giảm và độ ưu tiên; không xoá đối tượng đang có sinh viên | Phòng Đào tạo |
| 2 | Nhập môn học mở (QĐ4) | Tín chỉ của môn mở | Khác tín chỉ mặc định của môn, kể cả 0, theo từng học kỳ (qua thời khoá biểu) | Phòng Đào tạo |
| 3 | Lập phiếu đăng ký (QĐ5) | Đơn giá tín chỉ mặc định | Đơn giá LT, TH (mặc định 27.000đ, 37.000đ) | Phòng Tài vụ |
| 4 | Lập phiếu đăng ký (QĐ5) | Bảng phí | Học phí cố định, đơn giá LT, TH của từng khoá và hệ | Phòng Tài vụ |
| 5 | Lập phiếu thu (QĐ6) | Hạn đóng học phí | Thời điểm mới chưa qua, vẫn sau Kết thúc điều chỉnh | Phòng Đào tạo |
| 6 | Đăng ký học phần (mở rộng) | Giới hạn tín chỉ | Tối thiểu, tối đa học kỳ chính (14/24); tối đa hè (12) | Phòng Đào tạo |
| 7 | Thanh toán (mở rộng) | Tài khoản nhận học phí | Ngân hàng, số tài khoản, tên chủ tài khoản | Phòng Tài vụ |

## 7. Yêu cầu chất lượng

### 7.1. Yêu cầu hiệu quả

| STT | Nghiệp vụ                      | Tốc độ xử lý, khả năng chịu tải                                                 | Ghi chú  |
| --- | ------------------------------ | ------------------------------------------------------------------------------- | -------- |
| 1   | Đợt đăng ký học phần           | Chịu được 1000 người dùng đồng thời, trong đó 80–90% thao tác là đọc            | NFR-01   |
| 2   | Mọi thao tác trong đợt đăng ký | 95% yêu cầu được trả lời dưới 500 ms, không có lỗi máy chủ ở bài thử 1000 người | NFR-02   |
| 3   | Tra cứu lớp học phần mở        | Danh sách lớp và số chỗ còn được lưu đệm tối đa 3 giây                          | §10      |
| 4   | Mở rộng khi tải tăng           | Chạy thêm bản sao máy chủ API mà không sửa chương trình                         | ADR-0007 |

### 7.2. Yêu cầu tiện dụng

| STT | Nghiệp vụ           | Mức độ dễ học, dễ dùng                                                                   | Ghi chú    |
| --- | ------------------- | ---------------------------------------------------------------------------------------- | ---------- |
| 1   | Giao diện sinh viên | Ưu tiên điện thoại: rộng từ 360 px, không cuộn ngang, vùng chạm ≥ 44 px                  | NFR-06     |
| 2   | Đóng học phí        | Mã QR có nút lưu ảnh và nút sao chép số tài khoản, số tiền, nội dung chuyển khoản        | NFR-06     |
| 3   | Giao diện nhân viên | Ưu tiên máy tính nhưng dùng được trên điện thoại. Bảng rộng cuộn ngang trong khung riêng | NFR-07     |
| 4   | Đăng ký học phần    | Mỗi lần bị từ chối đều có lý do cụ thể. Số chỗ còn tự cập nhật, không cần tải lại trang  | DK-10, §10 |
| 5   | Toàn hệ thống       | Giao diện hoàn toàn bằng tiếng Việt, đúng thuật ngữ của nhà trường                       | §1         |
| 6   | Thông báo           | Email tới sinh viên khi đã đóng đủ học phí của học kỳ. Không có thông báo nào khác       | NFR-11     |

### 7.3. Yêu cầu tương thích

| STT | Nghiệp vụ               | Đối tượng liên quan                                  | Ghi chú    |
| --- | ----------------------- | ---------------------------------------------------- | ---------- |
| 1   | Nhập thời khoá biểu (BM4) | Tệp Excel thời khoá biểu của trường                | TKB-01     |
| 2   | Xuất BM7, danh sách lớp | Tệp Excel; BM7 thêm tệp PDF                          | NFR-12     |
| 3   | Thanh toán chuyển khoản | Mã VietQR, quét được bằng ứng dụng ngân hàng; SePay  | ADR-0011   |
| 4   | Email đóng đủ           | Máy chủ gửi thư SMTP                                 | NFR-11     |
| 5   | Kết quả học tập         | Môn đã học và điểm học phần có sẵn từ hệ thống quản lý điểm, chỉ đọc | ADR-0018 |
| 6   | Theo dõi vận hành       | Prometheus, Grafana                                  | NFR-09     |
| 7   | Truy cập                | Trình duyệt web phổ biến trên máy tính và điện thoại | NFR-06, 07 |

### 7.4. Yêu cầu bảo mật

| STT | Nghiệp vụ                                               | Phòng Đào tạo | Phòng Tài vụ | Sinh viên    |
| --- | ------------------------------------------------------- | ------------- | ------------ | ------------ |
| 1   | Hồ sơ và tài khoản sinh viên, đối tượng ưu tiên, khoá tuyển sinh | X    |              |              |
| 2   | Mốc thời gian học kỳ, khung giờ đăng ký, giới hạn tín chỉ | X           |              |              |
| 3   | Thời khoá biểu, lớp học phần, danh sách sinh viên của lớp | X           |              |              |
| 4   | Bảng phí, đơn giá, tài khoản nhận, thu tiền, gán giao dịch, đối soát, BM7 |  | X       |              |
| 5   | Đăng ký học phần, xem phiếu đăng ký, công nợ, phiếu thu |               |              | X (của mình) |

Ngoài bảng phân quyền trên:

- Mật khẩu băm bằng argon2id. Phiên đăng nhập lưu trên máy chủ, cookie `httpOnly; Secure; SameSite=Lax`, hết hạn
  sau 8 giờ (NFR-08).
- Mật khẩu ban đầu và mật khẩu đặt lại chỉ hiện một lần, sinh viên phải đổi ngay (HS-13).
- Thao tác tài chính của Phòng Tài vụ có thêm mã chống giả mạo yêu cầu (CSRF) (NFR-08).
- Giới hạn tần suất cho đăng nhập và cho API đăng ký (NFR-05).
- Giao dịch SePay chỉ được nhận khi đúng khoá API (TT-04).

### 7.5. Yêu cầu an toàn

| STT | Nghiệp vụ                 | Yêu cầu                                                                                                     | Ghi chú          |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | Đăng ký, huỷ lớp          | Không bao giờ vượt sĩ số, vượt tín chỉ tối đa, trùng lịch hay trùng môn, dù gửi song song bao nhiêu yêu cầu | NFR-03, ADR-0005 |
| 2   | Thao tác ghi quan trọng   | Gửi lại cùng yêu cầu trả cùng kết quả, không ghi trùng                                                      | NFR-04           |
| 3   | Sổ cái, nhật ký kiểm toán | Chỉ ghi thêm, không có chức năng sửa, xoá hay huỷ phiếu thu. Sai sót công nợ sửa ngoài hệ thống             | NFR-10, ADR-0004 |
| 4   | Sự kiện nghiệp vụ         | Thanh toán, chốt phiếu, ghi nợ học phí, email đóng đủ không bị mất khi máy chủ dừng đột ngột                | ADR-0008         |
| 5   | Nhập thời khoá biểu       | Tất cả hoặc không, không để lại dữ liệu dở dang                                                             | TKB-02           |
| 6   | Lập hồ sơ, tính lại học phí | Hồ sơ và tài khoản tạo cùng một giao dịch; các dòng đảo và ghi lại của một lần tính lại ghi cùng một giao dịch | HS-13, HP-12 |
| 7   | Thay đổi qui định         | Không làm sai dữ liệu đã chốt                                                                               | §10              |

### 7.6. Yêu cầu công nghệ

| STT | Yêu cầu        | Mô tả chi tiết                                                                                | Ghi chú  |
| --- | -------------- | --------------------------------------------------------------------------------------------- | -------- |
| 1   | Dễ sửa lỗi     | Mỗi nghiệp vụ là một module riêng (tài khoản, hồ sơ sinh viên, đào tạo, đăng ký, học phí, thông báo) | ADR-0007 |
| 2   | Dễ bảo trì     | Mỗi qui định có mã, và mỗi mã có ít nhất một bài kiểm thử mang tên mã đó                      | ADR-0016 |
| 3   | Tái sử dụng    | Các phép tính (ngày học và trùng lịch, công nợ, phụ thu, giảm trừ) là hàm độc lập, dùng cho nhiều yêu cầu | PRD      |
| 4   | Dễ mang chuyển | Đóng gói bằng container, chạy được trên máy chủ Linux bất kỳ                                  | ADR-0015 |
| 5   | Theo dõi       | Nhật ký dạng JSON có mã truy vết, có chỉ số và bảng theo dõi                                  | NFR-09   |

## 8. Bảng đối chiếu biểu mẫu – yêu cầu

| Biểu mẫu, báo biểu                                     | Yêu cầu sử dụng                                                                  |
| ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| BM1 – Hồ sơ sinh viên                                  | YC08                                                       |
| BM2 – Danh sách môn học                                | Dữ liệu nền, được đọc ở YC02, YC03, YC11                   |
| BM3 – Chương trình học                                 | Không thực hiện                                            |
| BM4 – Danh sách môn học mở (thời khoá biểu học kỳ)     | YC11                                                       |
| BM5 – Phiếu đăng ký học phần                           | YC03, YC04, YC05, YC18, YC22                               |
| BM6 – Phiếu thu học phí                                | YC07, YC14, YC15, YC20                                     |
| BM7 – Danh sách sinh viên chưa hoàn thành đóng học phí | YC16                                                       |
| BB01 – Danh sách sinh viên của lớp học phần            | YC13                                                       |
| BB02 – Thời khoá biểu tuần                             | YC05                                                       |
| Không có biểu mẫu nghiệp vụ                            | YC01, YC02, YC06, YC09, YC10, YC12, YC17, YC19, YC21, YC23 |

## 9. Ghi chú về các qui ước phạm vi

**Điểm lệch so với đề bài.** Nhóm thống nhất một số qui ước để làm rõ những chỗ đề bài không qui định chi tiết:

- **Thu hẹp BM1–BM3** (ADR-0019). BM1 chỉ giữ các trường việc đăng ký và tính học phí cần, thêm email để gửi email
  đóng đủ. BM2 là dữ liệu nền nạp sẵn. BM3 không thực hiện, nên không có môn tự do.
- **Học phí lai thay cho QĐ5** (ADR-0003). Học phí gồm học phí cố định mỗi học kỳ chính theo khoá, cộng phụ thu
  theo tín chỉ cho học lại, cải thiện và học hè. Đơn giá 27.000đ/37.000đ của đề được giữ làm đơn giá phụ thu mặc
  định.
- **Hạn đóng học phí và việc dự thi.** QĐ6 ghi sinh viên không đóng đủ trước hạn thì không được dự thi cuối kỳ.
  Hệ thống chỉ quản lý hạn đóng và cho biết sinh viên nào chưa đóng đủ (BM7, tính theo thời điểm giao dịch ngân
  hàng). Việc không cho dự thi do bộ phận khảo thí thực hiện ngoài hệ thống, dựa trên BM7.
- **Sổ cái công nợ** (ADR-0004). BM7 không lưu sẵn mà luôn tính lại từ sổ cái, nên báo cáo luôn khớp với phiếu
  thu. Ngoài phiếu thu tại quầy, mọi dòng sổ cái do hệ thống sinh theo qui định; không có khoản điều chỉnh.
- **Tính lại học phí** (ADR-0019). Sửa khoá, hệ hoặc đối tượng ưu tiên trong đợt đăng ký thì đảo toàn bộ nợ và
  giảm trừ của học kỳ rồi ghi lại theo hồ sơ mới, thay vì ghi phần chênh, để kết quả giống hệt lần tính đầu.
- **Mã số sinh viên, khoá tuyển sinh, hệ đào tạo** được bổ sung vào BM1 để định danh sinh viên và chọn bảng phí.
- **Lớp học phần và thời khoá biểu.** Đề chỉ có "môn học mở". Hệ thống thêm lớp học phần có sĩ số và lịch học, để
  kiểm tra hết chỗ và trùng lịch. BM4 được mở rộng thành tệp thời khoá biểu học kỳ Phòng Đào tạo đang dùng: một lần
  nhập tạo cả môn mở lẫn lớp. Giảng viên chỉ là dữ liệu nền để hiển thị, giảng viên không dùng hệ thống.
- **Tín chỉ thuộc môn mở** (ADR-0017). Tín chỉ tính theo QĐ2 chỉ là mặc định. Tín chỉ dùng để đăng ký và tính học
  phí là tín chỉ của môn trong học kỳ đó, lấy từ thời khoá biểu, có thể bằng 0.
- **Hệ đào tạo** được bổ sung vào BM1, BM4. Sinh viên chỉ đăng ký lớp cùng hệ.
- **Môn có cả lý thuyết và thực hành** được khai báo thành hai môn LT và TH, môn TH trỏ tới môn LT đi kèm
  (ADR-0002). Sinh viên đăng ký lớp LT và nhóm thực hành thành hai dòng riêng. Huỷ một bên thì huỷ luôn bên kia.
  Môn TH đứng riêng (không có phần LT) có lớp thường.
- **Hình thức thực hành HT1/HT2** là cách tổ chức lịch của nhóm thực hành, khác với hình thức học (Lần đầu, Học
  lại, Cải thiện). Nhóm HT2 không có lịch trong hệ thống. Một lớp LT có thể có nhiều nhóm.
- **Không có đổi lớp.** Sinh viên muốn sang lớp khác thì huỷ rồi đăng ký lại, chấp nhận có thể mất chỗ cũ.

**Kết quả học tập là dữ liệu nền** (ADR-0018). Quản lý điểm nằm ngoài phạm vi, nhưng các qui định đăng ký
cần biết sinh viên đã Đạt hay Không đạt môn nào:

- điều kiện tiên quyết và đăng ký có điều kiện (QĐ03.5, YC22);
- đăng ký riêng phần LT hoặc TH (QĐ03.10);
- hình thức học Học lại, Cải thiện, kéo theo phụ thu (QĐ03.11, QĐ03.13).

Hệ thống chỉ đọc môn đã học và điểm học phần (thang 10, Đạt khi ≥ 5,0) của từng lần học, do hệ thống quản lý điểm
của trường cung cấp. Hệ thống không nhập, không sửa, không tính điểm, không hiển thị bảng điểm. Lần học chưa có
điểm là chưa có kết quả. Cách đưa điểm vào hệ thống nằm ngoài phạm vi; dữ liệu mẫu được nạp sẵn.

**Điểm requirements chưa nói rõ.** Tài liệu tạm giả định như sau:

- Số dư có được chuyển sang học kỳ sau khi học kỳ đó vào giai đoạn Đăng ký.
- Việc chuyển học kỳ sang Kết thúc nằm ngoài phạm vi, vì không qui định đăng ký hay học phí nào dựa vào nó.
- Đăng ký có điều kiện được xét lại hằng ngày (YC22), vì cách điểm được đưa vào nằm ngoài phạm vi.
- Email đóng đủ không có nội dung tuỳ biến; gửi lỗi sau nhiều lần thử lại thì bỏ qua, công nợ vẫn đúng.

## 10. Kết luận

Tài liệu đã xác định:

- 23 yêu cầu (16 yêu cầu do người dùng thao tác và 7 tác vụ tự động), chỉ thuộc ba nghiệp vụ sinh viên đăng ký học
  phần, Phòng Đào tạo quản lý đăng ký học phần và Phòng Tài vụ quản lý đóng học phí;
- 4 biểu mẫu nghiệp vụ (BM1, BM4, BM5, BM6), BM2 làm cấu trúc dữ liệu nền, và 3 báo biểu (BM7, BB01, BB02);
- các qui định đi kèm từng yêu cầu;
- 7 yêu cầu tiến hoá và các yêu cầu chất lượng.

Mỗi qui định truy ngược được về QĐ gốc của đề hoặc mã quy tắc trong requirements. Tài liệu là cơ sở cho bước mô
hình hoá yêu cầu bằng sơ đồ luồng dữ liệu, rồi tới các bước thiết kế dữ liệu và xử lý tiếp theo.
