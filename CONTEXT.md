# Đăng ký học phần và Học phí (DKHP)

Hệ thống cho một trường đại học: sinh viên đăng ký lớp học phần mỗi học kỳ, phòng đào tạo lập thời khoá biểu, và
phòng tài vụ thu học phí. Tài liệu này là glossary. Mỗi thuật ngữ ghi kèm **tên duy nhất trong code (tiếng Anh)**, theo
[ADR-0014](./docs/adr/0014-ten-trong-code-bang-tieng-anh.md). Quy tắc nghiệp vụ nằm ở
[docs/requirements.md](./docs/requirements.md).

Quy ước: **Thuật ngữ** (`TenTrongCode`): định nghĩa. _Tránh_: các từ không dùng.

## Phạm vi

**Dữ liệu nền** (`reference data`):
Dữ liệu hệ thống cần đọc nhưng không quản lý, nạp sẵn khi cài đặt hoặc lấy từ hệ thống khác của trường: Hệ
đào tạo, năm học và học kỳ, danh mục môn học, môn tương đương, điều kiện tiên quyết, giảng viên, phòng học,
môn đã học và điểm học phần của sinh viên, tài khoản của Phòng Đào tạo và Phòng Tài vụ. Hệ thống chỉ đọc, không có chức năng thêm, sửa, xoá.
_Tránh_: master data

## Tổ chức và con người

**Khoá tuyển sinh** (`Cohort`):
Nhóm sinh viên nhập học cùng năm (ví dụ K2024). Phòng Đào tạo sửa được khoá của sinh viên. Khoá (cùng hệ đào tạo) quyết
định bảng phí; khoá quyết định khung giờ đăng ký. Phòng Đào tạo quản lý danh mục khoá.
_Tránh_: niên khoá, lớp sinh hoạt, batch

**Hệ đào tạo** (`TrainingSystem`):
Chương trình đào tạo theo hình thức tổ chức của trường: chính quy (`CQUI`), chương trình tiên tiến (`CTTT`), chất
lượng cao (`CLC`), cử nhân tài năng (`CNTN`), liên kết (`BCU`), văn bằng 2 (`VB2CQ`), liên thông (`LTĐH`)… Mỗi lớp
học phần và mỗi sinh viên thuộc đúng một hệ đào tạo; Phòng Đào tạo sửa được hệ của sinh viên. Sinh viên chỉ đăng ký được lớp
cùng hệ; điều này chỉ xét lúc đăng ký, đổi hệ không đụng tới các lớp đã đăng ký. Danh mục hệ là dữ liệu cố định.
_Tránh_: hệ (không kèm "đào tạo"), chương trình

**Sinh viên** (`Student`):
Người học có mã số sinh viên, thuộc một khoá tuyển sinh và một hệ đào tạo.
_Tránh_: học sinh, học viên, user

**Mã số sinh viên** (`studentCode`):
Mã định danh nghiệp vụ duy nhất của sinh viên (MSSV), dùng để đăng nhập và làm mã thanh toán. Không sửa được sau
khi tạo hồ sơ; nhập sai thì xoá hồ sơ tạo lại, chỉ khi sinh viên chưa có phiếu đăng ký và chưa có dòng sổ cái.
_Tránh_: student id (khi nói về khoá chính kỹ thuật)

**Tài khoản sinh viên** (`StudentAccount`):
Tài khoản đăng nhập của sinh viên, tên đăng nhập là mã số sinh viên. Hệ thống tạo cùng lúc với hồ sơ, với mật
khẩu ban đầu ngẫu nhiên chỉ hiện một lần cho Phòng Đào tạo; sinh viên bắt buộc đổi ở lần đăng nhập đầu. Phòng Đào
tạo **đặt lại mật khẩu** bằng cùng cơ chế đó. Xoá hồ sơ thì xoá luôn tài khoản.
_Tránh_: user, người dùng (khi nói riêng về sinh viên)

**Hồ sơ sinh viên** (`StudentProfile`):
Những thông tin của sinh viên mà việc đăng ký và tính học phí cần: mã số sinh viên, họ tên, email, khoá
tuyển sinh, hệ đào tạo, đối tượng ưu tiên, và các môn đã học kèm kết quả. Phòng Đào tạo thêm, sửa, xoá hồ sơ trong hệ
thống, trừ các môn đã học: phần này là dữ liệu nền, chỉ đọc. Mã số sinh viên không sửa được. Sửa khoá, hệ hoặc đối tượng
ưu tiên thì học phí được **tính lại**. Sinh viên có hồ sơ được coi là đang học.
_Tránh_: lý lịch, BM1 (hồ sơ không còn quê quán, ngày sinh, giới tính, ngành)

**Đối tượng ưu tiên** (`PriorityGroup`):
Diện chính sách được giảm học phí theo một tỉ lệ (ví dụ con liệt sĩ 80%). Mỗi đối tượng có một độ ưu tiên. Sinh
viên thuộc nhiều đối tượng thì chỉ áp dụng đối tượng có độ ưu tiên cao nhất. Phòng Đào tạo thêm, sửa, xoá danh
mục (không xoá được đối tượng đang có sinh viên); sửa tỉ lệ không hồi tố, chỉ áp cho khoản nợ phát sinh sau đó.
_Tránh_: diện miễn giảm, loại sinh viên

**Tỉ lệ giảm** (`discountRate`):
Phần trăm học phí được giảm theo đối tượng ưu tiên.

**Giảng viên** (`Lecturer`):
Người dạy lớp học phần. Chỉ là danh mục mã và tên để hiển thị trên lớp, không có tài khoản và không dùng hệ
thống. Là dữ liệu nền.
_Tránh_: giáo viên, teacher

**Phòng học** (`Room`):
Nơi diễn ra buổi học, chỉ gồm mã phòng (ví dụ B1.22). Là dữ liệu nền.
_Tránh_: phòng (khi dễ nhầm với Phòng Đào tạo, Phòng Tài vụ)

**Phòng Đào tạo** (vai trò `ACADEMIC_OFFICE`):
Bộ phận quản lý hồ sơ sinh viên, đối tượng ưu tiên, khoá tuyển sinh, mốc thời gian của học kỳ, khung giờ đăng ký, giới hạn tín
chỉ, thời khoá biểu và lớp học phần.
_Tránh_: PĐT (chỉ dùng khi viết tắt trong văn bản)

**Phòng Tài vụ** (vai trò `FINANCE_OFFICE`):
Bộ phận quản lý bảng phí, thu tiền tại quầy, gán giao dịch chưa khớp, xem đối soát và báo cáo công nợ (BM7).
Hạn đóng học phí do Phòng Đào tạo đặt, cùng các mốc thời gian khác của học kỳ.
_Tránh_: phòng kế toán, PTV (chỉ dùng khi viết tắt trong văn bản)

## Đào tạo

**Môn học** (`Course`):
Đơn vị kiến thức trong danh mục của trường, có mã môn, tên, loại môn và số tiết. Mỗi môn chỉ có một loại (LT
hoặc TH). Một học phần có cả lý thuyết lẫn thực hành được tách thành hai môn.
_Tránh_: học phần (khi nói về danh mục), subject

**Loại môn** (`CourseType`):
**Lý thuyết** (`THEORY`) hoặc **Thực hành** (`PRACTICE`).

**Số tiết** (`totalPeriods`):
Tổng số tiết của môn. Với môn LT phải là bội số của 15, với môn TH phải là bội số của 30.
_Tránh_: nhầm với **tiết** trong lịch học (khung giờ)

**Số tín chỉ** (`credits`):
Môn học có số tín chỉ mặc định = số tiết / 15 với môn LT, số tiết / 30 với môn TH. Mỗi môn mở mang số tín chỉ
của riêng học kỳ đó (lấy từ thời khoá biểu, không có thì lấy mặc định của môn; có thể bằng 0). Học phí của một
lần học dùng tín chỉ của môn mở ở học kỳ đó, nên đổi danh mục không làm đổi lịch sử.
Luôn là số nguyên.
_Tránh_: TC (chỉ dùng khi viết tắt trong văn bản), đơn vị học trình

**Môn LT đi kèm** (`companionTheoryCourse`):
Môn LT mà một môn TH gắn vào. Một môn TH có không hoặc một môn LT đi kèm; một môn LT có tối đa một môn TH đi kèm.
Lớp của môn TH có môn LT đi kèm là nhóm thực hành, con của một lớp thuộc môn LT đó.

**Môn TH đứng riêng**:
Môn TH không có môn LT đi kèm (ví dụ `CE119` Thực hành Kiến trúc máy tính). Giữ nguyên mã môn, không thêm hậu tố
`TH`. Lớp của môn này là lớp học phần thường: không có lớp cha, không phải nhóm thực hành, không mang hình thức
thực hành, có buổi học như lớp LT. Mã lớp giữ nguyên như thời khoá biểu (`CE119.Q11.1`), đuôi `.1` chỉ là tên.

**Môn tương đương** (`CourseEquivalence`):
Nhóm các môn được coi là một khi xét trùng môn và hình thức học (ví dụ môn cũ
đổi mã).
_Tránh_: môn thay thế

**Điều kiện tiên quyết** (`Prerequisite`):
Quan hệ giữa hai môn, gồm hai loại. **Tiên quyết** (`REQUIRED_PASS`): phải Đạt môn trước. **Học trước**
(`REQUIRED_ATTEMPT`): chỉ cần đã học môn trước và có điểm. Là dữ liệu nền.
_Tránh_: môn song hành (không hỗ trợ)

### Học kỳ

**Năm học** (`AcademicYear`):
Ví dụ 2025-2026. Gồm hai học kỳ chính và có thể có học kỳ hè.

**Học kỳ** (`Term`):
Một kỳ học trong năm học, gồm **HK1** (`FIRST`), **HK2** (`SECOND`) hoặc **Học kỳ hè** (`SUMMER`). Năm học và
học kỳ là dữ liệu nền. Phòng Đào tạo không lập học kỳ, chỉ điều chỉnh các **mốc thời gian** của học kỳ.
_Tránh_: semester (khi đặt tên trong code)

**Mã học kỳ** (`termCode`):
Chuỗi số định danh học kỳ, ghép từ năm bắt đầu của năm học và số kỳ (ví dụ `20251` là HK1 năm 2025-2026).

**Giai đoạn học kỳ** (`TermPhase`):
Vị trí của học kỳ trong vòng đời, theo thứ tự: **Chuẩn bị** (`PREPARATION`) → **Đăng ký** (`REGISTRATION`) →
**Điều chỉnh** (`ADJUSTMENT`) → **Đang học** (`IN_PROGRESS`) → **Kết thúc** (`CLOSED`). Nghiệp vụ đăng ký và học
phí chỉ dựa vào ba giai đoạn đầu; việc chuyển từ Đang học sang Kết thúc nằm ngoài phạm vi.

**Mốc thời gian** (`term milestones`):
Các thời điểm của một học kỳ quyết định giai đoạn: bắt đầu và kết thúc Đăng ký, bắt đầu và kết thúc Điều chỉnh,
hạn đóng học phí.
_Tránh_: lịch học kỳ, deadline (khi nói chung)

**Đợt đăng ký** (`registration period`):
Hai giai đoạn Đăng ký và Điều chỉnh gộp lại, là khoảng thời gian sinh viên được đăng ký và huỷ lớp.
_Tránh_: đợt ĐKHP, cổng đăng ký

**Khung giờ đăng ký** (`RegistrationSlot`):
Khoảng thời gian trong giai đoạn Đăng ký, chỉ dành cho một tập khoá tuyển sinh.

**Hạn đóng học phí** (`tuitionDeadline`):
Thời điểm mà sau đó sinh viên còn nợ học phí của học kỳ có tên trong báo cáo chưa đóng học phí (BM7). Việc không
cho dự thi do bộ phận khảo thí làm ngoài hệ thống, dựa trên báo cáo này.

### Môn mở và lớp

**Thời khoá biểu học kỳ** (TKB):
Bảng do Phòng Đào tạo lập cho một học kỳ, mỗi dòng là một buổi học của một lớp học phần (mã môn, mã lớp, giảng viên,
sĩ số, hình thức giảng dạy, thứ, tiết, phòng…). Nhập thời khoá biểu là cách nhập hàng loạt môn mở, lớp học phần, nhóm
thực hành, buổi học và hình thức thực hành của học kỳ, chỉ làm được khi học kỳ ở giai đoạn Chuẩn bị; nhập lại thì
thay toàn bộ môn mở và lớp của học kỳ đó. Sau khi nhập, Phòng Đào tạo vẫn thêm và sửa từng lớp. Các môn
trong bảng phải có sẵn trong danh mục môn học. Trong bảng của trường, dòng thực hành ghi chung mã môn với môn LT
(`AI002` cho lớp `AI002.Q11.1`); hệ thống hiểu dòng đó thuộc môn TH đi kèm (`AI002TH`).
_Tránh_: danh sách môn học mở (BM4 cũ)

**Môn mở** (`OfferedCourse`):
Môn học được mở trong một học kỳ, mang số tín chỉ của học kỳ đó. Có môn mở khi thời khoá biểu học kỳ có ít nhất
một lớp của môn đó.
_Tránh_: môn học mở (khi viết tắt trong code)

**Lớp học phần** (`CourseSection`):
Một lớp cụ thể của một môn mở, có mã lớp (ví dụ `SE104.P21`), giảng viên (có thể chưa phân công), khoá dành cho (một khoá hoặc mọi khoá; chỉ để
hiển thị và lọc, không chặn đăng ký), ngôn ngữ giảng dạy và ghi chú (chỉ để hiển thị),
sĩ số tối đa và không hoặc nhiều buổi
học. Đây là đơn vị sinh viên đăng ký. Lớp không có buổi học (đồ án, khoá luận, thực tập, nhóm HT2) do giảng viên và
sinh viên tự hẹn lịch, không bao giờ trùng lịch với lớp khác. Ở giai đoạn Chuẩn bị, Phòng Đào tạo thêm, sửa, xoá
lớp tự do; từ giai đoạn Đăng ký trở đi chỉ được sửa sĩ số tối đa (không thấp hơn số đã đăng ký) và điền giảng viên
hoặc phòng còn trống, không thêm hay xoá lớp.
_Tránh_: lớp (không kèm "học phần"), class, section (trong văn bản)

**Nhóm thực hành** (`PracticeSection`):
Lớp học phần của môn TH, là con của một lớp thuộc môn LT đi kèm (ví dụ `SE104.P21.1` thuộc `SE104.P21`). Mỗi lớp LT
có một hoặc nhiều nhóm, mã `.1`, `.2`, `.3`… Sinh viên đăng ký nhóm thực hành như một lớp học phần riêng (một dòng riêng
trong lượt đăng ký, không gộp với lớp LT) và chỉ chọn được nhóm con của lớp LT mình đang đăng ký (trừ khi đã Đạt môn LT). Học LT
không bắt buộc phải có nhóm thực hành.
_Tránh_: lớp TH độc lập

**Hình thức thực hành** (`PracticeMode`):
Cách tổ chức phần thực hành của một lớp LT có nhóm thực hành. Mọi nhóm con của lớp đó có chung một hình thức, không
trộn. Lớp LT có một hoặc nhiều nhóm (`.1`, `.2`…), sĩ số mỗi nhóm độc lập với nhau và với lớp LT. **HT1 – Thực
hành theo lịch** (`SCHEDULED`): mỗi nhóm có buổi học cố định. **HT2 – Thực hành tự xếp lịch** (`SELF_SCHEDULED`):
giảng viên và sinh viên của nhóm tự hẹn lịch, nhóm không có buổi học nào trong hệ thống nên không bao giờ trùng
lịch với lớp khác. Hình thức thực hành có sẵn trong thời khoá biểu học kỳ (hoặc Phòng Đào tạo nhập khi mở lớp) ở
giai đoạn Chuẩn bị và không đổi từ giai đoạn Đăng ký trở đi.
_Tránh_: hình thức học (đó là `AttemptType`), HT (không kèm số)

**Sĩ số tối đa** (`capacity`) / **Số đã đăng ký** (`enrolledCount`):
Số chỗ của lớp học phần và số chỗ đã có sinh viên giữ.

**Buổi học** (`Meeting`):
Một lịch lặp lại của lớp học phần: thứ trong tuần, tiết bắt đầu, tiết kết thúc, phòng (có thể chưa xếp), ngày bắt
đầu, ngày kết thúc và nhịp lặp (mỗi tuần hoặc cách tuần). Các ngày học là ngày bắt đầu cộng bội số của nhịp, không
quá ngày kết thúc.

**Tiết** (`slot`):
Khung giờ học đánh số trong ngày (tiết 1 đến tiết 10).

**Học xen kẽ**:
Hai nhóm thực hành cùng một lớp LT học cùng thứ, tiết, phòng, cùng nhịp cách tuần, nhóm sau bắt đầu muộn hơn nhóm
trước một tuần. Chỉ là cách nhập ngày bắt đầu, không phải quy định.

**Trùng lịch** (`ScheduleConflict`):
Hai buổi học cùng thứ, có khoảng tiết giao nhau và có ít nhất một ngày học chung.

## Đăng ký

**Phiếu đăng ký học phần** (`RegistrationForm`):
Tập hợp các dòng đăng ký của một sinh viên trong một học kỳ (BM5). Mỗi sinh viên có tối đa một phiếu cho mỗi
học kỳ.
_Tránh_: phiếu ĐKHP (chỉ dùng khi viết tắt trong văn bản), đơn đăng ký, giỏ môn

**Lượt đăng ký** (`RegistrationRequest`):
Một lần sinh viên gửi đăng ký nhiều lớp cùng lúc. Mỗi lớp trong lượt được xét và giành chỗ độc lập: lớp này lỗi
không kéo lớp khác lỗi theo. Lớp LT và nhóm thực hành của nó là hai lớp riêng trong lượt.
_Tránh_: giỏ môn, batch (trong văn bản)

**Dòng đăng ký** (`Enrollment`):
Việc một sinh viên chiếm một chỗ trong một lớp học phần của một môn. Trạng thái: **Đã đăng ký** (`REGISTERED`),
**Đã huỷ** (`CANCELLED`), **Đã chốt** (`FINALIZED`).
_Tránh_: đăng ký môn, registration (khi chỉ một dòng)

**Lần học** (`Enrollment` ở trạng thái `FINALIZED`):
Một lần sinh viên học một môn ở một học kỳ. Lần học của các học kỳ trước là dữ liệu nền; dòng đăng ký đã chốt
trong hệ thống cũng trở thành lần học. Lần học chưa có điểm học phần là chưa có kết quả.
_Tránh_: lượt học, attempt (trong văn bản)

**Chốt phiếu** (`finalize`):
Việc khoá phiếu đăng ký khi hết giai đoạn Điều chỉnh. Từ lúc đó các dòng đăng ký trở thành lần học.
_Tránh_: khoá sổ

**Huỷ lớp** (`cancel`):
Bỏ một dòng đăng ký trong đợt đăng ký. Lớp đã huỷ không để lại lần học nào. Huỷ lớp LT thì huỷ luôn nhóm thực
hành con đang học; huỷ nhóm thực hành thì huỷ luôn lớp LT cha. Không có thao tác đổi lớp: muốn sang lớp khác thì
huỷ rồi đăng ký lại.
_Tránh_: rút môn, drop (khái niệm rút môn sau khi chốt không tồn tại), đổi lớp, chuyển lớp

**Đăng ký có điều kiện** (`pendingPrerequisite`):
Dòng đăng ký được chấp nhận trong khi lần học của môn tiên quyết chưa có điểm. Khi điểm về là Không đạt: nếu còn
trong đợt đăng ký thì hệ thống tự huỷ dòng; nếu đã chốt thì dòng giữ nguyên. Không có thông báo.
_Tránh_: kiểm duyệt, duyệt đăng ký

**Giới hạn tín chỉ** (`creditLimit`):
Tổng tín chỉ tối thiểu và tối đa của các dòng đăng ký của sinh viên trong một học kỳ. Vượt tối đa thì không đăng ký
được; dưới tối thiểu chỉ cảnh báo. Phòng Đào tạo đặt giới hạn này.

**Hình thức học** (`AttemptType`):
Phân loại một dòng đăng ký, suy ra từ kết quả hiện hành. Gồm **Lần đầu** (`FIRST`, chưa có lần học nào của
môn), **Học lại** (`RETAKE`, kết quả hiện hành là Không đạt) và **Cải thiện** (`IMPROVEMENT`, kết quả hiện hành là
Đạt).
_Tránh_: môn tự do, học ngoài chương trình (không phân biệt), học vượt (học vượt là Lần đầu), HT1/HT2 (đó là
hình thức thực hành)

## Kết quả học tập

**Điểm học phần** (`courseScore`):
Điểm của một lần học, theo thang 10, làm tròn 0,1. Là dữ liệu nền: hệ thống chỉ đọc điểm để xét tiên quyết
và suy ra hình thức học, không tính, không nhập, không hiển thị bảng điểm. Điểm đến từ hệ thống quản lý điểm của trường;
cách đưa vào nằm ngoài phạm vi.
_Tránh_: điểm tổng kết môn, điểm chữ (không dùng điểm chữ)

**Đạt / Không đạt** (`PASSED` / `FAILED`):
Kết luận của một lần học: Đạt khi điểm học phần ≥ 5,0.

**Kết quả hiện hành** (`EffectiveResult`):
Lần học đại diện cho một môn (hoặc nhóm tương đương) của một sinh viên. Nếu đã có lần Đạt thì lấy **lần Đạt gần
nhất**. Nếu chưa thì lấy **lần học gần nhất**. Hình thức học dựa trên khái niệm này.
_Tránh_: điểm cao nhất, điểm cuối cùng

## Học phí

**Bảng phí** (`FeeSchedule`):
Bộ tham số học phí của một khoá tuyển sinh thuộc một hệ đào tạo: học phí cố định mỗi học kỳ chính, và đơn giá tín chỉ LT và TH.

**Học phí cố định** (`BaseTuition`):
Khoản phí trọn gói của một học kỳ chính, không phụ thuộc vào số lớp đăng ký.
_Tránh_: học phí niên chế, học phí khoá

**Đơn giá tín chỉ** (`creditRate`):
Số tiền cho mỗi tín chỉ, khác nhau giữa LT và TH (mặc định theo QĐ5 là 27.000đ và 37.000đ).

**Phụ thu** (`Surcharge`):
Khoản thu theo tín chỉ cho các dòng đăng ký học lại, cải thiện, và cho mọi dòng đăng ký của học kỳ hè.
_Tránh_: học phí tín chỉ, phí học lại

**Sổ cái công nợ** (`TuitionLedger`):
Nhật ký chỉ ghi thêm của mọi khoản nợ và khoản có của một sinh viên, chia theo học kỳ.
_Tránh_: bảng công nợ, tài khoản học phí

**Dòng sổ cái** (`LedgerEntry`):
Một khoản **ghi nợ** (học phí cố định, phụ thu, đảo giảm trừ khi tính lại học phí) hoặc **ghi
có** (thanh toán, giảm trừ, đảo phụ thu, đảo nợ khi tính lại học phí, chuyển số dư) trong sổ cái.
Ngoài phiếu thu tại quầy, mọi dòng do hệ thống sinh ra theo luật; không có thao tác ghi dòng tuỳ ý hay huỷ
phiếu thu. Sai sót (ví dụ nhập nhầm số tiền thu tại quầy) được sửa ngoài hệ thống.
_Tránh_: khoản điều chỉnh (không có)

**Tính lại học phí** (`TuitionRecalculation`):
Việc hệ thống ghi dòng đảo cho mọi khoản nợ và giảm trừ của học kỳ đang trong đợt đăng ký, rồi ghi lại theo hồ sơ
mới (bảng phí, đơn giá, tỉ lệ giảm), khi Phòng Đào tạo sửa khoá, hệ hoặc đối tượng ưu tiên của sinh viên. Thanh
toán giữ nguyên; học kỳ trước không đổi. Sửa hồ sơ ngoài đợt đăng ký chỉ áp từ học kỳ sau.
_Tránh_: điều chỉnh học phí, ghi chênh

**Giảm trừ** (`Discount`):
Khoản ghi có tính từ tỉ lệ giảm của đối tượng ưu tiên, được chốt vào lúc khoản nợ tương ứng phát sinh.

**Số tiền đăng ký** (`grossAmount`):
Tổng các khoản ghi nợ của học kỳ, trước giảm trừ (cột BM7).

**Số tiền phải đóng** (`netAmount`):
Số tiền đăng ký trừ giảm trừ (cột BM7, luôn ≤ số tiền đăng ký).

**Số tiền còn lại** (`outstandingAmount`):
Số tiền phải đóng trừ số tiền đã thanh toán của học kỳ (cột BM7).
_Tránh_: nợ học phí (khi cần con số chính xác)

**Số dư có** (`CreditBalance`):
Phần tiền sinh viên đã đóng vượt số phải đóng, được tự trừ vào học kỳ sau.
_Tránh_: tiền thừa, tiền hoàn

**Thanh toán** (`Payment`):
Một lần tiền về cho một sinh viên và một học kỳ, qua một kênh thu.

**Email đóng đủ** (`TuitionSettledEmail`):
Email gửi tới sinh viên khi một thanh toán làm số tiền còn lại của học kỳ về 0 hoặc thấp hơn (đóng thừa), với mọi
kênh thu. Đây là thông báo duy nhất của hệ thống; không có thông báo trong ứng dụng.
_Tránh_: thông báo thanh toán, biên nhận điện tử

**Kênh thu** (`PaymentChannel`):
**Tại quầy** (`COUNTER`) hoặc **Chuyển khoản** (`BANK_TRANSFER`).

**Phiếu thu** (`Receipt`):
Chứng từ cho một lần thanh toán (BM6), sinh ra với mọi kênh thu.
_Tránh_: biên lai, hoá đơn

**Mã thanh toán** (`paymentCode`):
Nội dung chuyển khoản cố định của một cặp (sinh viên, học kỳ): `HP` + mã số sinh viên + mã học kỳ.

**QR học phí** (`TuitionQr`):
Mã VietQR hiển thị khi số tiền còn lại lớn hơn 0, chứa số tiền còn lại và mã thanh toán. Sinh viên không chỉnh được.
_Tránh_: yêu cầu thanh toán, đơn hàng (không có thực thể này)

**Giao dịch ngân hàng** (`BankTransaction`):
Một khoản tiền vào tài khoản của trường, được SePay báo về.

**Giao dịch chưa khớp** (`UnmatchedTransaction`):
Giao dịch ngân hàng không xác định được sinh viên và học kỳ. Chờ Phòng Tài vụ gán thủ công.

**Đối soát** (`Reconciliation`):
Việc so danh sách giao dịch ngân hàng với sổ cái để tìm chỗ lệch. Hệ thống tự chạy hằng ngày, tự ghi các giao
dịch mà thông báo của SePay bị lỡ; các chỗ lệch còn lại chỉ để Phòng Tài vụ xem, không có thao tác sửa.

## Các điểm dễ nhầm đã chốt

- "Đăng ký môn" luôn nghĩa là đăng ký **lớp học phần** của môn đó. Không có việc đăng ký một môn mà không chọn lớp.
- **Huỷ lớp** chỉ có trong đợt đăng ký. Sau khi chốt phiếu, không còn khái niệm rút môn.
- **Số tiết** (thuộc môn học, dùng để tính tín chỉ) khác **tiết** (khung giờ trong lịch học).
- **Cải thiện mà trượt** không làm mất trạng thái Đạt: kết quả hiện hành vẫn là lần Đạt gần nhất.
- Học phí **không** tính theo tín chỉ như QĐ5. Đơn giá tín chỉ chỉ dùng cho phụ thu (xem [ADR-0003](./docs/adr/0003-mo-hinh-hoc-phi-lai.md)).
- **Số tiền phải đóng** là số sau khi giảm. **Số tiền còn lại** là số sau khi đã trừ các lần thanh toán.
