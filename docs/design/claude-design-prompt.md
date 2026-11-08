# Prompt cho Claude Design: giao diện DKHP

Cách dùng:

1. Tạo project mới trong Claude Design, đính kèm `docs/design/uit-logo.png` (hoặc bản SVG của logo UIT nếu có).
2. Dán toàn bộ phần dưới đường kẻ.
3. Claude Design làm theo 9 giai đoạn ở mục "Cách làm việc" và dừng sau mỗi giai đoạn. Duyệt xong thì trả lời
   "tiếp giai đoạn N".

Nguồn nghiệp vụ: [requirements.md](../requirements.md), [CONTEXT.md](../../CONTEXT.md), [prd.md](../prd.md). Prompt
đã chép đủ những gì cần cho thiết kế, Claude Design không cần đọc repo.

---

## Vai trò và mục tiêu

Bạn là product designer chính cho **DKHP**: hệ thống đăng ký học phần và học phí của Trường Đại học Công nghệ
Thông tin (UIT), ĐHQG-HCM. Hãy thiết kế **design system** và **toàn bộ trang của 3 vai trò** (Sinh viên, Phòng Đào
tạo, Phòng Tài vụ), đủ chi tiết để lập trình viên dựng thẳng bằng Next.js + Tailwind CSS v4 mà không phải đoán.

Phạm vi sản phẩm chỉ gồm ba việc: **sinh viên đăng ký học phần**, **Phòng Đào tạo quản lý đợt đăng ký** (hồ sơ sinh
viên, học kỳ, thời khoá biểu, lớp học phần) và **Phòng Tài vụ quản lý học phí**. Không có giảng viên dùng hệ thống,
không có quản trị, không có điểm hay bảng điểm trên giao diện.

Ưu tiên theo thứ tự: **đúng nghiệp vụ → rõ ràng khi căng thẳng → nhanh → đẹp**. Đợt đăng ký là lúc 1000 sinh viên
cùng tranh chỗ trên điện thoại. Giao diện phải cho biết ngay chuyện gì đã xảy ra và cần làm gì tiếp theo.

Tài liệu gồm:

- **Phần A** là design system: token, component, app shell, quy ước nội dung, màn hình dùng chung.
- **Phần B–D** mô tả từng vai trò **từ góc nhìn của chính người dùng**: họ là ai, hành trình chính kể ở ngôi thứ
  nhất, mỗi trang trả lời câu hỏi gì, nội dung theo thứ tự ưu tiên, hành động, trạng thái phải vẽ, dữ liệu mẫu.

## Cách làm việc

**Quy tắc chung:**

- Đọc hết tài liệu trước khi vẽ. Hành trình ở phần B–D là nguồn để hiểu ngữ cảnh. Thiết kế trọn hành trình,
  không chỉ từng trang rời.
- Trang của các vai trò **chỉ dùng** token và component ở phần A. Cần component mới thì đề xuất tên, lý do, trạng
  thái, vẽ trong khung "Component mới", rồi gộp vào thư viện.
- Thuật ngữ, định dạng tiền, ngày giờ theo đúng mục A.4.
- Dữ liệu mẫu nhất quán giữa mọi vai trò. Cùng một sinh viên thì cùng số liệu ở mọi màn hình.

**Thứ tự giai đoạn.** Làm lần lượt, **dừng sau mỗi giai đoạn** để tôi duyệt:

| # | Giai đoạn | Nội dung |
|---|---|---|
| 1 | Nền tảng | Token (màu kèm tỉ lệ tương phản, chữ, khoảng cách, bo góc, đổ bóng, chuyển động, dark mode), bảng ánh xạ trạng thái, họa tiết quỹ đạo |
| 2 | Thư viện component | Mục A.3.5, đủ trạng thái, kèm biến thể mobile |
| 3 | App shell | Sinh viên (mobile + desktop), nhân viên (sidebar, top bar, chuyển vai trò), màn hình dùng chung ở mục A.6 |
| 4 | Sinh viên · Đăng ký | Trang chủ, Đăng ký học phần (đủ trạng thái), Lịch học. Prototype B.2 H1 và H2 |
| 5 | Sinh viên · Học phí | Học phí, Chi tiết phiếu thu, Hồ sơ, mẫu email đóng đủ, các tình huống B.2 H4. Prototype B.2 H3 |
| 6 | Phòng Đào tạo · Sinh viên | Danh sách sinh viên, tạo hồ sơ, chi tiết sinh viên (sửa, đặt lại mật khẩu, xoá), Đối tượng ưu tiên và khoá. Prototype C.2 H3 |
| 7 | Phòng Đào tạo · Học kỳ và lớp | Tổng quan, Học kỳ và khung giờ, Thời khoá biểu và lớp (nhập Excel), Chi tiết lớp, Theo dõi đăng ký. Prototype C.2 H1 |
| 8 | Phòng Tài vụ · Thu tiền | Thu tại quầy (prototype D.2 H1), Phiếu thu, mẫu in BM6, Giao dịch ngân hàng (prototype D.2 H2), Đối soát |
| 9 | Phòng Tài vụ · Công nợ | Tổng quan, Công nợ sinh viên, Bảng phí và tham số, Báo cáo BM7 và mẫu in. Rà lại toàn bộ trang lỗi và mẫu in |

**Mỗi giai đoạn trả về:**

- Các khung đặt tên `Vai trò / Trang / Trạng thái / Mobile|Desktop`. Khung design system đặt `Design system /
  Nhóm / Tên`.
- Ghi chú cạnh mỗi trang:
  - route;
  - dữ liệu cần lấy, và dữ liệu nào cần polling;
  - thao tác ghi nào cần dialog xác nhận, khoá chống lặp (đăng ký, huỷ, thu tiền) hoặc CSRF (thao tác tài
    chính).
- Danh sách component mới phát sinh.
- Riêng giai đoạn 1: token dạng CSS `@theme`, sẵn để dán vào `apps/web`.

## Phần A. Design system

### A.1 Bối cảnh sản phẩm

| Vai trò | Thiết bị chính | Việc chính |
|---|---|---|
| Sinh viên | Điện thoại (mobile-first, rộng tối thiểu 360 px) | Đăng ký, huỷ lớp học phần. Xem phiếu đăng ký, thời khoá biểu. Xem công nợ, đóng học phí bằng QR, xem phiếu thu. |
| Phòng Đào tạo | Máy tính (desktop-first) | Hồ sơ và tài khoản sinh viên, đối tượng ưu tiên, khoá tuyển sinh. Mốc thời gian học kỳ, khung giờ đăng ký, giới hạn tín chỉ. Nhập thời khoá biểu, chỉnh lớp học phần, theo dõi đăng ký. |
| Phòng Tài vụ | Máy tính | Đơn giá, bảng phí, tài khoản nhận học phí. Thu tại quầy, gán giao dịch chưa khớp, xem đối soát, báo cáo công nợ BM7. |

- Một tài khoản cán bộ có thể giữ **cả hai vai trò** Phòng Đào tạo và Phòng Tài vụ, nên cần chỗ chuyển vai trò.
- Chỉ có **tiếng Việt**.
- **Không có thông báo trong ứng dụng** (không chuông, không trung tâm thông báo) và không có SMS. Thông báo duy
  nhất là **email đóng đủ học phí** gửi tới email trong hồ sơ sinh viên.
- Không có SSO: đăng nhập bằng MSSV (sinh viên) hoặc mã cán bộ, và mật khẩu.
- Nhiều dữ liệu là **dữ liệu nền**, hệ thống chỉ đọc, không có màn hình thêm sửa xoá: hệ đào tạo, năm học và học
  kỳ, danh mục môn học, môn tương đương, tiên quyết, giảng viên, phòng học, môn đã học và điểm của sinh viên, tài
  khoản cán bộ.

Tính cách thương hiệu: **tin cậy, rõ ràng, trẻ trung, có học thuật**. Tham chiếu cảm giác: sự gọn gàng của
Linear, độ dễ đọc của Stripe Dashboard, sự thân thiện của ứng dụng ngân hàng số Việt Nam (MoMo, Cake). Không theo
lối cổng đào tạo cũ: không bảng chi chít, không chữ đỏ in hoa, không banner nhấp nháy.

### A.2 Nguyên tắc thiết kế

1. **Trạng thái luôn hiện rõ.** Mọi thực thể có trạng thái đều hiển thị bằng chip màu kèm icon và chữ, không chỉ
   bằng màu. Các thực thể này gồm học kỳ, khung giờ, dòng đăng ký, công nợ học kỳ và giao dịch ngân hàng.
2. **Lỗi phải nói lý do và lối ra.** Ví dụ: "Trùng lịch với IT002.P21 (Thứ 3, tiết 1–3, 06/01–14/04). Chọn lớp
   khác hoặc huỷ IT002.P21." Không dùng mã lỗi trần.
3. **Tiền là con số quan trọng nhất trên màn hình.** Dùng chữ số đều (tabular), căn phải trong bảng và đủ to trên
   thẻ tóm tắt.
4. **Không làm mất thao tác.**
   - Các nút ghi quan trọng (đăng ký, huỷ, thu tiền) chuyển sang trạng thái đang xử lý và chặn bấm lặp.
   - Thao tác không hoàn tác được thì phải xác nhận, nêu rõ hệ quả. Thao tác làm đổi học phí (sửa hồ sơ sinh
     viên) phải cho **xem trước số tiền trước → sau**.
5. **Sinh viên dùng một tay.**
   - Vùng chạm ≥ 44 px, không cuộn ngang.
   - Hành động chính nằm trong vùng ngón cái (bottom sheet, thanh hành động dính đáy).
6. **Nhân viên làm việc theo lô.**
   - Bảng dày dữ liệu có header dính, lọc, tìm kiếm.
   - Bảng rộng cuộn ngang **trong khung của bảng**, không cuộn cả trang.
   - Màn thu tại quầy dùng được hoàn toàn bằng bàn phím.
7. **Dữ liệu chỉ ghi thêm thì hiển thị như lịch sử.** Sổ cái công nợ và nhật ký kiểm toán không có nút sửa hay
   xoá. Không có khoản điều chỉnh, không huỷ phiếu thu: mọi dòng sổ cái (trừ phiếu thu tại quầy) do hệ thống sinh
   theo quy tắc, kể cả các dòng đảo khi huỷ lớp hoặc khi tính lại học phí.
8. **Dữ liệu nền nhìn là biết chỉ đọc.** Trường lấy từ dữ liệu nền (hệ đào tạo, môn học, giảng viên, phòng…) hiển
   thị dạng chữ thường hoặc select, không có nút "Thêm mới" bên cạnh.
9. **Tiếp cận:**
   - Đạt WCAG 2.2 AA và có focus ring rõ.
   - Tôn trọng `prefers-reduced-motion`.
   - Không truyền đạt thông tin chỉ bằng màu.

### A.3 Token và thành phần

#### A.3.1 Màu

Màu thương hiệu lấy trực tiếp từ logo UIT: **`#2C68FC`**. Chủ đạo là **trắng và xanh**: nền trắng hoặc trắng ánh
xanh, xanh UIT cho hành động và điểm nhấn, xám ngả xanh cho chữ. Mọi cặp chữ/nền dưới đây đã được tính tương phản
WCAG.

**Brand (xanh UIT)**

| Token | Hex | Dùng cho |
|---|---|---|
| `brand-50` | `#EEF3FF` | Nền vùng được chọn, nền chip thông tin, hover dòng bảng |
| `brand-100` | `#DCE6FF` | Viền vùng được chọn, nền thanh tiến độ |
| `brand-200` | `#B9CCFF` | Viền focus phụ |
| `brand-300` | `#8BAAFE` | Minh hoạ, biểu đồ |
| `brand-400` | `#6B93FF` | Màu chính ở chế độ tối |
| `brand-500` | `#2C68FC` | **Màu logo**: icon nhấn, thanh tiến độ, biểu đồ, viền focus (4,67:1 trên trắng) |
| `brand-600` | `#1A56E8` | **Nền nút chính** (chữ trắng 5,93:1) |
| `brand-700` | `#1744C2` | Hover nút chính, link, chữ trên nền `brand-50` (7,15:1) |
| `brand-800` | `#15378F` | Active/pressed |
| `brand-900` | `#152F70` | Tiêu đề trên nền sáng có tông xanh |
| `brand-950` | `#0E1C45` | Nền sidebar tối (tuỳ chọn) |

**Neutral (xám ngả xanh)**

| Token | Hex | Dùng cho |
|---|---|---|
| `neutral-0` | `#FFFFFF` | Nền thẻ, bảng, modal |
| `neutral-25` | `#F7F9FD` | **Nền trang** |
| `neutral-50` | `#F1F4FA` | Nền khối phụ, header bảng |
| `neutral-100` | `#E6EBF5` | Đường kẻ, viền nhạt |
| `neutral-200` | `#D3DAE7` | Viền input |
| `neutral-300` | `#B1BBCD` | Viền hover, icon tắt |
| `neutral-400` | `#94A0B8` | Placeholder (không dùng cho chữ nội dung) |
| `neutral-500` | `#5B6680` | Chữ phụ, nhãn (5,74:1) |
| `neutral-700` | `#323B52` | Chữ thân |
| `neutral-900` | `#111827` | Tiêu đề, số liệu chính (16,8:1) |
| `neutral-950` | `#0B1220` | Nền chế độ tối |

**Ngữ nghĩa** (mỗi màu có bộ `50` làm nền, `600` làm nền đặc, `700` làm chữ)

| Nhóm | 50 | 600 | 700 | Ý nghĩa |
|---|---|---|---|---|
| `success` | `#E8F7EE` | `#12873F` | `#0B7A3B` | Đã đóng đủ, đã khớp, nhập thành công |
| `warning` | `#FFF6E5` | `#D97706` | `#93520A` | Đăng ký có điều kiện, sắp hết hạn, giao dịch chưa khớp, lệch đối soát, trùng phòng |
| `danger` | `#FEEEEE` | `#D92D20` | `#B42318` | Còn nợ quá hạn, lỗi, thao tác xoá |
| `info` | `brand-50` | `brand-600` | `brand-700` | Thông tin, đang xử lý |

**Ánh xạ trạng thái nghiệp vụ → chip** (luôn có icon và chữ):

| Thực thể | Trạng thái → màu |
|---|---|
| Giai đoạn học kỳ | Chuẩn bị: neutral · **Đăng ký: brand** · Điều chỉnh: brand nhạt (viền) · Đang học: success · Kết thúc: neutral đậm |
| Khung giờ đăng ký | Sắp mở: neutral · Đang mở: brand · Đã qua: neutral nhạt |
| Dòng đăng ký | Đã đăng ký: brand · Đã chốt: neutral có icon khoá · Đã huỷ: neutral, chữ gạch ngang · Đăng ký có điều kiện: warning |
| Hình thức học | Lần đầu: neutral · Học lại: warning · Cải thiện: brand |
| Hình thức thực hành | HT1 Theo lịch: viền brand · HT2 Tự xếp lịch: viền neutral nét đứt |
| Công nợ học kỳ | Đã đóng đủ: success · Còn nợ: warning · Quá hạn còn nợ: danger · Có số dư có: brand |
| Giao dịch ngân hàng | Đã khớp: success · Chưa khớp: warning · Chờ xử lý: brand · Bỏ qua: neutral |
| Kênh thu | Chuyển khoản: viền brand · Tại quầy: viền neutral |
| Lần đối soát | Khớp: success · Có lệch: warning (kèm số "đã tự ghi bù n") |
| Nhập thời khoá biểu | Đang kiểm tra: brand · Có lỗi: danger · Đã nhập: success |

**Chế độ tối**: có bộ token cho dark mode (nền `neutral-950`, thẻ `#111A2E`, chữ `#E6EBF5`, màu chính
`brand-400`) để cổng sinh viên dùng ban đêm. Màn hình nhân viên chỉ cần light mode ở bản đầu.

Màu môn học trên thời khoá biểu: tối đa 8 màu pastel phái sinh từ `brand`, teal, violet, amber, rose, emerald, sky
và slate, nền 50 + viền trái 500. Đảm bảo phân biệt được khi in đen trắng nhờ mã môn in đậm.

#### A.3.2 Chữ

- **Font giao diện: Be Vietnam Pro** (Google Fonts, thiết kế cho tiếng Việt, dấu không bị cắt hay chồng). Dùng các
  weight 400, 500, 600, 700.
- **Font mã: JetBrains Mono** cho mã định danh: MSSV, mã cán bộ, mã lớp (`SE104.P21.1`), mã môn, mã học kỳ, mã
  hệ đào tạo (`CQUI`), mã thanh toán (`HP2452000120262`), số phiếu thu, số tài khoản, mật khẩu hiện một lần.
- Số liệu (tiền, tín chỉ, sĩ số) dùng `font-variant-numeric: tabular-nums`.
- Thang cỡ chữ (px / line-height):
  - 12/16: chú thích
  - 14/20: thân chữ nhân viên, ô bảng
  - 16/24: thân chữ sinh viên, input trên mobile; bắt buộc ≥ 16 px để iOS không tự zoom
  - 18/28 và 20/28: tiêu đề thẻ
  - 24/32: tiêu đề trang
  - 30/38: số liệu lớn
  - 36/44: số tiền QR, số tiền còn lại nổi bật
- Line-height của đoạn văn tối thiểu 1,5, vì dấu tiếng Việt cần khoảng trống phía trên.

#### A.3.3 Khoảng cách, bo góc, đổ bóng, chuyển động

- Lưới **4 px**. Các bậc: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- Lề trang: 16 px trên mobile, 24 px trên tablet, 32 px trên desktop.
- Nội dung nhân viên rộng tối đa 1440 px. Cổng sinh viên trên desktop là cột giữa rộng tối đa 720 px; riêng trang
  đăng ký có thêm cột phiếu bên phải.
- Bo góc:
  - `sm` 6 px: input, nút, chip vuông
  - `md` 10 px: thẻ
  - `lg` 16 px: modal, bottom sheet
  - `full`: chip trạng thái, avatar
- Đổ bóng nhẹ, ngả xanh, không đen:
  - `shadow-sm` `0 1px 2px rgb(17 24 39 / 0.06)`
  - `shadow-md` `0 4px 12px rgb(26 86 232 / 0.08)`
  - `shadow-lg` `0 12px 32px rgb(26 86 232 / 0.12)`
- Chuyển động 150–200 ms `ease-out`, bottom sheet 250 ms.
  - Số chỗ còn thay đổi thì đếm số mượt, không nháy.
  - Không có hiệu ứng trang trí kéo dài.
- Icon: **Lucide**, nét 1,5 px, cỡ 16, 20 hoặc 24.

#### A.3.4 Họa tiết thương hiệu

Logo UIT có **quỹ đạo**: cung tròn ôm lấy biểu tượng và một chấm tròn ở đầu cung. Dùng họa tiết này có chừng mực:

- **Vòng tiến độ** (tín chỉ đã đăng ký / tối đa, tỉ lệ sinh viên đã đóng đủ) vẽ theo dạng cung quỹ đạo có chấm
  tròn ở đầu, màu `brand-500` trên nền `brand-100`.
- Màn hình đăng nhập: một cung quỹ đạo lớn, mảnh và mờ ở nền.
- Trạng thái rỗng: minh hoạ đường nét đơn sắc xanh, có thể dùng chấm quỹ đạo.
- Không dùng gradient sặc sỡ. Gradient duy nhất cho phép: `brand-600 → brand-500` trên thẻ hero của sinh viên,
  ví dụ thẻ "Đợt đăng ký đang mở".

#### A.3.5 Thành phần (component) cần thiết kế

Mỗi thành phần cần đủ trạng thái default, hover, focus, active, disabled, loading, error, và biến thể mobile
khi khác.

- **Nền tảng:** Button (primary, secondary, ghost, danger, link; cỡ sm/md/lg; có icon; loading), IconButton,
  Input, NumberInput, MoneyInput (tự chèn dấu chấm ngăn nghìn, hậu tố "đ"), PercentInput (tỉ lệ giảm), Select,
  MultiSelect (đối tượng ưu tiên), Combobox có tìm kiếm (chọn sinh viên theo MSSV/tên, chọn môn, giảng viên,
  phòng), DatePicker, DateTimePicker (giờ Việt Nam, định dạng 24h), Checkbox, Radio, Switch, Textarea bắt buộc lý
  do (có đếm ký tự), FileDrop (kéo thả `.xlsx`).
- **Hiển thị:**
  - StatusChip theo bảng ánh xạ ở A.3.1, Badge, Avatar có chữ cái đầu.
  - Card và StatCard (nhãn, số lớn, chênh lệch).
  - ProgressBar, OrbitProgress (A.3.4).
  - Countdown ("Còn 2 ngày 04:12:09").
  - Timeline dọc cho sổ cái và nhật ký.
  - CopyField: giá trị mono + nút sao chép; khi đã sao chép thì báo "Đã sao chép" trong 2 giây.
  - BeforeAfter: hai cột "Trước" / "Sau" cho số tiền, chênh lệch tô màu (dùng khi tính lại học phí, gán giao
    dịch, thu tiền).
- **Bảng dữ liệu:**
  - Tính năng: header dính, sắp xếp, lọc dạng chip, tìm kiếm, phân trang, mật độ gọn/thường, cột số căn phải, cuộn
    ngang trong khung, sửa trực tiếp trong ô (sĩ số, tín chỉ môn mở).
  - Trạng thái: rỗng, đang tải (skeleton), lỗi.
  - Trên mobile chuyển thành danh sách thẻ.
- **Lớp phủ:** Modal, ConfirmDialog (nêu hệ quả, nút nguy hiểm màu danger; biến thể "gõ lại MSSV để xác nhận"
  cho xoá hồ sơ), BottomSheet (mobile), Drawer bên phải (desktop, cho chi tiết và form), Popover, Tooltip, Toast
  (thành công, lỗi, thông tin; có hành động "Xem"), Banner cấp trang (mất kết nối, phiên sắp hết hạn, cảnh báo
  nghiệp vụ như quá hạn đóng học phí).
- **OneTimeSecretDialog:** hộp hiện mật khẩu ban đầu hoặc mật khẩu đặt lại **một lần duy nhất**. Gồm MSSV, mật
  khẩu (mono, cỡ lớn, CopyField), cảnh báo "Đóng hộp này thì không xem lại được", checkbox "Tôi đã lưu hoặc gửi mật
  khẩu cho sinh viên" phải tick mới bật nút "Đóng". Không đóng bằng click nền hay phím Esc.
- **Điều hướng:**
  - App shell sinh viên: header + bottom tab bar 4 mục.
  - App shell nhân viên: sidebar trái thu gọn được, top bar có bộ chọn học kỳ, chuyển vai trò, tìm kiếm toàn cục
    theo MSSV và menu tài khoản.
  - Breadcrumb, Tabs, SegmentedControl, Stepper (nhập thời khoá biểu).
- **Chuyên biệt:**
  - **SectionCard:** thẻ lớp học phần gồm mã lớp, giảng viên (hoặc "Chưa phân công"), lịch, phòng, khoảng ngày
    học, chỗ còn x/y kèm thanh, chip ngôn ngữ (VN/EN), chip "Dành cho Khoá 19", ghi chú, cảnh báo trùng lịch
    inline, nút Đăng ký.
  - **ScheduleGrid:** lưới tuần thứ 2 → Chủ nhật × tiết 1–10, có bộ chọn tuần, chỉ hiện buổi có ngày học trong
    tuần đang xem, buổi trùng gạch chéo đỏ.
  - **MeetingEditor:** một buổi học gồm thứ, tiết bắt đầu–kết thúc, phòng, ngày bắt đầu, ngày kết thúc, nhịp (mỗi
    tuần / cách tuần), kèm dải chip xem trước các tuần có học.
  - **LedgerTimeline:** sổ cái công nợ.
  - **VietQRCard:** QR học phí.
  - **ReceiptTemplate:** phiếu thu in.
  - **TermTimeline:** mốc thời gian học kỳ và khung giờ theo khoá, dạng Gantt, có vạch "bây giờ" và icon khoá
    trên mốc không còn sửa được.
  - **ImportReport:** bảng lỗi theo dòng × cột của tệp Excel, tách nhóm "Lỗi" (chặn nhập) và "Cảnh báo" (không
    chặn).

### A.4 Quy ước nội dung tiếng Việt

**Định dạng:**

| Loại | Quy ước | Ví dụ |
|---|---|---|
| Tiền | Số nguyên đồng, dấu chấm ngăn nghìn, hậu tố "đ" | `15.081.000 đ` |
| Tỉ lệ giảm | Số nguyên phần trăm | `80%` |
| Ngày giờ | `dd/MM/yyyy`, 24 giờ, giờ Việt Nam | `06/01/2027 08:00` |
| Lịch học | Thứ, tiết, phòng, khoảng ngày | `Thứ 2 · Tiết 1–3 · B1.14 · 11/01–19/04` |
| Học kỳ | Tên đầy đủ kèm mã mono | `HK2 2026–2027` `20262` |
| Khoá | "Khoá" + số khoá, năm nhập học ở chú thích | `Khoá 19` (2024) |
| Hệ đào tạo | Tên đầy đủ kèm mã mono | `Chính quy` `CQUI` |

**Thuật ngữ bắt buộc** (dùng đúng chữ này, không dùng chữ trong ngoặc "tránh"):

- **Lớp học phần** (tránh: lớp, class) · **Nhóm thực hành** (tránh: lớp TH độc lập) · **Môn học**
  (tránh: học phần, khi nói về danh mục) · **Môn mở** (môn có lớp trong học kỳ, mang **tín chỉ của môn mở**)
- **Hình thức thực hành:** HT1 – Thực hành theo lịch, HT2 – Thực hành tự xếp lịch (tránh: "hình thức học", đó là
  Lần đầu/Học lại/Cải thiện; tránh "HT" không kèm số)
- **Lượt đăng ký:** một lần gửi nhiều lớp, mỗi lớp có kết quả riêng (tránh: giỏ môn)
- **Phiếu đăng ký học phần** (tránh: giỏ môn, đơn đăng ký) · **Dòng đăng ký** · **Đăng ký có điều kiện**
- **Huỷ lớp** (tránh: rút môn; sau khi chốt phiếu thì không có rút môn; không có "đổi lớp": huỷ rồi đăng ký
  lại) · **Chốt phiếu** (tránh: khoá sổ)
- **Hình thức học:** Lần đầu, Học lại, Cải thiện (tránh: môn tự do, học ngoài chương trình; học vượt là Lần đầu)
- **Tiên quyết** (phải Đạt) và **Học trước** (chỉ cần có điểm). Không có môn song hành.
- **Đợt đăng ký** = giai đoạn Đăng ký + giai đoạn Điều chỉnh · **Khung giờ đăng ký** (theo khoá) · **Mốc thời
  gian** · **Giới hạn tín chỉ**
- **Thời khoá biểu học kỳ** (tránh: danh sách môn học mở) · **Nhập thời khoá biểu**
- **Hồ sơ sinh viên** (tránh: lý lịch) · **Khoá tuyển sinh** (tránh: niên khoá) · **Hệ đào tạo** (tránh: "hệ"
  trơn, chương trình) · **Đối tượng ưu tiên** (tránh: diện miễn giảm) · **Đặt lại mật khẩu**
- **Số tiền đăng ký**, **Giảm trừ**, **Số tiền phải đóng**, **Đã thanh toán**, **Số tiền còn lại**, **Số dư
  có** (tránh: tiền thừa)
- **Học phí cố định**, **Phụ thu** (tránh: phí học lại) · **Tính lại học phí** (tránh: điều chỉnh học phí)
- **Phiếu thu** (tránh: biên lai, hoá đơn) · **Mã thanh toán** · **QR học phí** · **Giao dịch chưa khớp** ·
  **Đối soát** · **Email đóng đủ**
- **Phòng Đào tạo**, **Phòng Tài vụ** (không viết tắt trên giao diện)

**Giọng văn:** xưng "bạn" với sinh viên. Câu ngắn, chủ động, không viết hoa toàn bộ. Nhãn nút là động từ:
"Đăng ký 3 lớp", "Huỷ lớp", "Nhập thời khoá biểu", "Đặt lại mật khẩu", "Ghi nhận thanh toán", "Gán cho sinh
viên".

### A.5 Kiến trúc thông tin

**Chung:**

- **Đăng nhập** bằng MSSV hoặc mã cán bộ và mật khẩu. Sai nhiều lần thì báo tạm khoá theo giới hạn tần suất.
- **Đổi mật khẩu bắt buộc** ở lần đăng nhập đầu và sau khi được Phòng Đào tạo đặt lại mật khẩu. Màn riêng, không
  vào được ứng dụng trước khi đổi.
- Phiên hết hạn tuyệt đối sau 8 giờ: cảnh báo trước 5 phút bằng banner, hết phiên thì quay về đăng nhập và giữ
  đường dẫn để quay lại.
- Trang 403, 404, 500, mất kết nối.

**Sinh viên** (bottom tab): **Trang chủ · Đăng ký · Lịch học · Học phí**. Avatar ở header mở menu Hồ sơ, Đổi mật
khẩu, Đăng xuất.

**Phòng Đào tạo** (sidebar):

- Tổng quan
- Sinh viên
- Đối tượng ưu tiên và khoá
- Học kỳ và khung giờ
- Thời khoá biểu và lớp
- Theo dõi đăng ký

**Phòng Tài vụ** (sidebar): Tổng quan · Thu tại quầy · Công nợ sinh viên · Giao dịch ngân hàng · Đối soát ·
Phiếu thu · Bảng phí và tham số · Báo cáo công nợ (BM7).

### A.6 Màn hình dùng chung

Những màn hình mọi vai trò cùng đi qua:

- **Đăng nhập:**
  - Logo UIT, cung quỹ đạo mờ ở nền.
  - Ô "MSSV hoặc mã cán bộ", ô mật khẩu có nút hiện/ẩn, nút "Đăng nhập".
  - Trạng thái: sai thông tin (một câu chung, không nói rõ sai ô nào hay mã có tồn tại không); tạm khoá do thử
    quá nhiều lần (kèm thời gian chờ); đang xử lý.
  - Dòng nhỏ "Quên mật khẩu? Liên hệ Phòng Đào tạo để được đặt lại." (không có luồng tự khôi phục).
- **Đổi mật khẩu bắt buộc**: màn riêng, không có điều hướng, có checklist độ mạnh mật khẩu. Hai biến thể câu dẫn:
  lần đăng nhập đầu, và sau khi được đặt lại mật khẩu.
- **Chọn vai trò** sau đăng nhập khi tài khoản giữ cả Phòng Đào tạo và Phòng Tài vụ. Sau đó chuyển vai trò ngay
  trên top bar, không phải đăng nhập lại.
- **Phiên sắp hết hạn** (banner trước 5 phút) và **phiên đã hết hạn** (quay về đăng nhập, giữ đường dẫn cũ). Khi
  sinh viên bị đặt lại mật khẩu, mọi phiên của họ kết thúc: thiết bị đang mở cũng quay về đăng nhập với câu "Phiên
  đăng nhập đã kết thúc. Vui lòng đăng nhập lại."
- **Trang lỗi:** 403 (không có quyền, gợi ý đổi vai trò nếu có), 404, 500 (có mã request để báo lỗi), mất kết
  nối.

### A.7 Dữ liệu mẫu (dùng nhất quán trên mọi màn hình)

**Học kỳ và lịch**

- Học kỳ đang học: **HK1 2026–2027** (`20261`), hạn đóng học phí đã qua: 31/10/2026 17:00.
- Học kỳ đang mở đăng ký: **HK2 2026–2027** (`20262`):

  | Mốc | Thời điểm |
  |---|---|
  | Bắt đầu Đăng ký | 05/01/2027 08:00 |
  | Kết thúc Đăng ký | 08/01/2027 17:00 |
  | Bắt đầu Điều chỉnh | 18/01/2027 08:00 |
  | Kết thúc Điều chỉnh | 22/01/2027 17:00 |
  | Hạn đóng học phí | 28/02/2027 17:00 |

- Khung giờ đăng ký: Khoá 17–18 ngày 05/01 (đã qua), **Khoá 19 ngày 06/01 08:00–17:00 (đang mở)**, Khoá 20 ngày
  07/01 (sắp mở).
- "Bây giờ" trong mọi khung mẫu: **06/01/2027**, trừ khi khung ghi khác.
- Học kỳ hè 2026–2027 (`20263`) đang ở Chuẩn bị.
- Giới hạn tín chỉ: học kỳ chính 14–24, học kỳ hè tối đa 12.

**Hệ đào tạo và khoá** (dữ liệu nền, trừ khoá do Phòng Đào tạo quản lý)

- Hệ: Chính quy (`CQUI`), Chất lượng cao (`CLC`). Các hệ khác có trong danh mục nhưng không dùng trong mẫu.
- Khoá: Khoá 17 (2022), Khoá 18 (2023), Khoá 19 (2024), Khoá 20 (2025).

**Môn học** (dữ liệu nền; LT có môn TH đi kèm thì mã TH thêm hậu tố `TH`)

- IT001 Nhập môn lập trình · IT002 Lập trình hướng đối tượng · IT003 Cấu trúc dữ liệu và giải thuật
- IT004 Cơ sở dữ liệu · IT005 Nhập môn mạng máy tính · IT007 Hệ điều hành
- SE104 Nhập môn công nghệ phần mềm · SE100 Phương pháp phát triển phần mềm hướng đối tượng
- SE113 Kiểm chứng phần mềm · SE121 Đồ án 1 (không có lịch)
- CS106 Trí tuệ nhân tạo · MA006 Giải tích · MA003 Đại số tuyến tính · ENG01 Anh văn 1 · SS003 Tư tưởng Hồ Chí
  Minh · CE119 Thực hành Kiến trúc máy tính (môn TH đứng riêng)
- Tiên quyết: SE100 cần **Đạt** SE104; SE113 cần **Học trước** SE104.

**Lớp và lịch** (HK2 2026–2027)

- `SE104.P21` (CQUI): Thứ 2 · Tiết 1–3 · B1.14 · 11/01–19/04, mỗi tuần, sĩ số 80. Hình thức thực hành HT1.
  - Nhóm `SE104.P21.1`: Thứ 2 · Tiết 6–10 · B4.02 · cách tuần từ 11/01.
  - Nhóm `SE104.P21.2`: cùng thứ, tiết, phòng, cách tuần từ 18/01 (học xen kẽ).
- `IT004.P21` (CQUI): HT2, một nhóm `IT004.P21.1` không có lịch.
- `SE104.P23` (CLC): Thứ 4 · Tiết 6–8 · C3.12, sĩ số 50, ngôn ngữ EN.
- `CS106.P21` có sĩ số 1 và đã đầy. `SE121.P21` không có buổi học. `CE119.P21.1` là lớp thường của môn TH đứng
  riêng.
- Sĩ số LT 80, nhóm thực hành 40.

**Giảng viên** (dữ liệu nền): Nguyễn Văn Phúc, Trần Thị Thanh Hà, Lê Minh Khoa, Phạm Ngọc Diệp, Huỳnh Quốc Bảo, Võ
Thị Kim Ngân. Một số lớp "Chưa phân công".

**Đối tượng ưu tiên** (Phòng Đào tạo quản lý): Con liệt sĩ 80% · Dân tộc thiểu số vùng sâu 70% · Con thương binh
50% · Hộ nghèo 50%. Mỗi đối tượng có độ ưu tiên; Con liệt sĩ cao nhất.

**Bảng phí** (Phòng Tài vụ quản lý; đơn giá mặc định LT 27.000 đ, TH 37.000 đ)

| Khoá · Hệ | Học phí cố định / học kỳ chính | Đơn giá LT | Đơn giá TH |
|---|---|---|---|
| Khoá 19 · CQUI | 15.000.000 đ | 27.000 đ | 37.000 đ |
| Khoá 19 · CLC | 20.000.000 đ | 27.000 đ | 37.000 đ |
| Khoá 18 · CQUI | 14.500.000 đ | 27.000 đ | 37.000 đ |
| Khoá 20 · CQUI | 15.500.000 đ | 27.000 đ | 37.000 đ |
| Khoá 20 · CLC | **chưa có** (dùng cho cảnh báo thiếu bảng phí) | | |

**Sinh viên mẫu** (Khoá 19, CQUI nếu không ghi khác; học phí là của HK2 2026–2027, đã ghi nợ học phí cố định khi
học kỳ vào Đăng ký)

| MSSV | Họ tên | Tình huống |
|---|---|---|
| 24520001 | Nguyễn Minh An | Nhân vật chính. Chưa đóng: còn 15.000.000 đ (hiện QR). Email `24520001@gm.uit.edu.vn` |
| 24520002 | Trần Thị Mai | Con liệt sĩ, giảm 80%: phải đóng 3.000.000 / 15.000.000 đ |
| 24520003 | Lê Quốc Khoa | Đăng ký có điều kiện SE100 và SE113 (SE104 đang học ở HK1, chưa có điểm) |
| 24520004 | Hoàng Thị Nhi | Hai đối tượng ưu tiên, chỉ áp dụng Dân tộc thiểu số vùng sâu 70% (độ ưu tiên cao hơn Con thương binh) |
| 24520005 | Phạm Đức Long | Đóng thừa 500.000 đ ở HK1, số dư có chuyển sang HK2 khi HK2 vào Đăng ký |
| 24520009 | Võ Gia Huy | Đã Đạt IT002TH, học lại riêng IT002 (LT): phụ thu 3 tín chỉ × 27.000 = 81.000 đ. Đã huỷ IT002.P21 rồi đăng ký IT002.P22 |
| 24520010 | Trịnh Bảo Ngọc | Học lại IT003 ở học kỳ hè: không có học phí cố định, mọi dòng đều có phụ thu |
| 24520011 | Đặng Thanh Trang | Còn nợ 5.000.000 đ của HK1 sau hạn, có tên trong BM7 của `20261` |
| 24520013 | Đinh Hoàng Phúc | Phòng Đào tạo sửa hệ CQUI → CLC trong đợt: học phí HK2 được tính lại 15.000.000 → 20.000.000 đ; lớp đã đăng ký giữ nguyên |
| 23520003 | Bùi Ngọc Linh | Khoá 18, cải thiện SE113: phụ thu 81.000 đ |
| 25520010 | Mai Anh Tuấn | Khoá 20, hồ sơ vừa tạo, chưa đăng nhập lần nào, bắt buộc đổi mật khẩu |

- Mã thanh toán mẫu: `HP2452000120262`. Phiếu thu mẫu: `PT-20262-00012`.
- Tài khoản nhận: MBBank · `0000000000` · TRUONG DAI HOC CONG NGHE THONG TIN.

**Cán bộ** (tài khoản là dữ liệu nền)

- Đỗ Thu Hằng (`pdt.hang`): Phòng Đào tạo.
- Ngô Thị Lan (`tv.lan`): Phòng Tài vụ, thu ngân.
- Trịnh Quốc Việt (`tv.viet`): Phòng Tài vụ và Phòng Đào tạo (dùng cho màn chọn và chuyển vai trò).

### A.8 Ràng buộc bàn giao

- Frontend dùng **Next.js 16 (App Router) + React 19 + Tailwind CSS v4**.
- Xuất design token thành **CSS custom properties** đặt trong `@theme` của Tailwind v4: màu, font, cỡ chữ, bo
  góc, đổ bóng. Tên token như mục A.3, ví dụ `--color-brand-600`, `--radius-md`.
- Dark mode bằng `[data-theme="dark"]` + `prefers-color-scheme`.
- Component dựa trên Radix UI primitives (phong cách shadcn/ui) để có sẵn tiếp cận và bàn phím; icon Lucide; font
  từ Google Fonts.
- Breakpoint: 360 (mobile tối thiểu), 640, 768, 1024, 1280, 1440.
- Mỗi màn hình ghi chú: route dự kiến, vai trò được vào, dữ liệu cần lấy, hành động ghi nào cần khoá chống lặp.
  Hành động cần khoá chống lặp gồm đăng ký, huỷ và thu tiền.

## Phần B. Các trang của Sinh viên

**Thiết bị:** Mobile 360 px trước, sau đó bản desktop 1440 px cho từng trang.

### B.1 Sinh viên là ai

**Nguyễn Minh An**, MSSV `24520001`, Khoá 19, hệ Chính quy.

- Dùng điện thoại Android tầm trung, 4G ở ký túc xá, sóng chập chờn lúc đông người.
- Mở ứng dụng nhiều nhất vào hai thời điểm:
  - **phút đầu khung giờ đăng ký**: căng thẳng, sợ mất chỗ;
  - **gần hạn đóng học phí**: sợ không kịp, sợ tiền chuyển rồi mà chưa được ghi nhận.
- Không đọc hướng dẫn. Cần giao diện tự giải thích, nhất là khi bị từ chối.
- Thói quen từ app ngân hàng: quen quét QR, sao chép số tài khoản, lưu ảnh QR để mở bằng app khác.

**Điều làm sinh viên mất niềm tin:**

- bấm Đăng ký mà không biết đã được hay chưa;
- số chỗ còn nhảy lung tung;
- không hiểu vì sao bị từ chối;
- chuyển tiền rồi mà hệ thống chưa ghi nhận;
- bị tính phụ thu hoặc học phí đổi mà không biết vì sao.

### B.2 Hành trình chính (thiết kế trọn từng hành trình, không chỉ từng trang rời)

**H1. Phút đầu khung giờ đăng ký** (prototype bấm được)

> 07:50 tôi mở app, thấy khung giờ Khoá 19 mở lúc 08:00 kèm đồng hồ đếm ngược. Tôi đã xem trước danh sách lớp và
> lọc "Không trùng lịch". Danh sách chỉ có lớp của hệ Chính quy. 08:00 nút Đăng ký sáng lên. Tôi chọn lớp
> `SE104.P21` và nhóm thực hành `SE104.P21.1`, thêm `IT004.P21`, rồi bấm "Đăng ký 3 lớp". Nút quay vòng một giây
> rồi báo kết quả từng lớp: SE104.P21 và SE104.P21.1 thành công, IT004.P21 vừa đầy. Tôi chọn `IT004.P22` nhưng bị
> báo trùng lịch với SE104.P21. Lỗi chỉ cho tôi lối ra: tôi huỷ SE104.P21 (nhóm `.1` bị huỷ theo), đăng ký
> `SE104.P22` rồi đăng ký lại IT004.

**H2. Giai đoạn Điều chỉnh**

> Tuần sau tôi muốn chuyển IT004 sang lớp buổi chiều. Không có nút đổi lớp: tôi xem lớp buổi chiều còn chỗ, huỷ
> `IT004.P22` (dialog nhắc chỗ cũ trả ngay và có thể mất), rồi đăng ký `IT004.P23`. Tôi huỷ ENG01 và thấy dòng đó
> vào mục "Đã huỷ". Cuối cùng tôi in phiếu đăng ký (BM5) để lưu.

**H3. Đóng học phí bằng QR** (prototype bấm được)

> Trang chủ báo còn 15.000.000 đ, hạn 28/02. Tôi vào Học phí, bấm "Lưu ảnh QR", mở app ngân hàng quét ảnh. App
> ngân hàng không đọc được ảnh thì tôi sao chép số tài khoản, số tiền, nội dung chuyển khoản. Quay lại, trang
> báo "Đang chờ tiền về…". Một lát sau trang tự cập nhật: số tiền còn lại về 0, QR biến mất và có phiếu thu
> `PT-20262-00012`. Hộp thư của tôi có email "Bạn đã đóng đủ học phí HK2 2026–2027".

**H4. Các tình huống khó** (mỗi tình huống một bộ khung riêng)

- **Đăng ký có điều kiện** (`24520003`): đăng ký SE100 khi SE104 đang học chưa có điểm, dòng mang chip warning.
  Sau đó điểm SE104 về là Không đạt; lần mở app sau, dòng SE100 nằm ở mục "Đã huỷ" với lý do "Tự huỷ: SE104
  Không đạt" và phụ thu (nếu có) đã được đảo. Hệ thống không gửi thông báo, nên lý do phải hiện ngay trên dòng.
- **Học lại tách phần** (`24520009`): đã Đạt phần thực hành IT002, chỉ học lại phần LT; thấy phụ thu 81.000 đ và
  hiểu vì sao. Sổ cái có phụ thu, đảo phụ thu khi huỷ IT002.P21, rồi phụ thu mới khi đăng ký IT002.P22.
- **Đổi hệ đào tạo trong đợt** (`24520013`): sau khi Phòng Đào tạo sửa hệ sang CLC, danh sách lớp chỉ còn lớp
  CLC; các lớp CQUI đã đăng ký vẫn giữ. Trang Học phí có các dòng "Tính lại học phí" và số tiền phải đóng mới.
- **Đóng thừa** (`24520005`): có số dư có 500.000 đ tự trừ vào học kỳ sau.
- **Học kỳ hè** (`24520010`): không có học phí cố định, mọi dòng đều có phụ thu, tối đa 12 tín chỉ.
- **Quá hạn còn nợ** (`24520011`): banner danger ở Trang chủ và Học phí, nói rõ còn bao nhiêu và đã quá hạn từ
  ngày nào.

### B.3 Sơ đồ trang

Bottom tab (mobile) và sidebar gọn (desktop): **Trang chủ · Đăng ký · Lịch học · Học phí**. Header có avatar mở
menu Hồ sơ, Đổi mật khẩu, Đăng xuất. Không có chuông thông báo.

| Trang | Route dự kiến |
|---|---|
| Trang chủ | `/student` |
| Đăng ký học phần | `/student/registration` |
| Lịch học | `/student/schedule` |
| Học phí | `/student/tuition` |
| Chi tiết phiếu thu | `/student/receipts/[number]` |
| Hồ sơ | `/student/profile` |

### B.4 Từng trang

Mỗi trang ghi theo khuôn: **Câu hỏi khi mở trang** → **Thứ tự nội dung** → **Hành động** → **Trạng thái phải
vẽ** → **Quy tắc ảnh hưởng giao diện**.

#### B.4.1 Trang chủ

**Câu hỏi:** "Hôm nay tôi cần làm gì?"

**Thứ tự nội dung** (mobile, từ trên xuống):

1. Lời chào ngắn kèm học kỳ hiện tại (`HK1 2026–2027`).
2. **Banner khẩn**, chỉ hiện khi có: còn nợ quá hạn (danger), học phí sắp hết hạn trong 3 ngày (warning).
3. **Thẻ hero đợt đăng ký**, đổi theo giai đoạn của học kỳ đang mở đăng ký:
   - chưa tới khung giờ của tôi: "Khung giờ Khoá 19 mở lúc 08:00, 06/01", Countdown, nút phụ "Xem trước lớp";
   - đang trong khung giờ / Điều chỉnh: "Đợt đăng ký đang mở · còn 16 ngày", OrbitProgress tín chỉ đã đăng ký
     x/24, nút "Đăng ký ngay";
   - đã chốt: "Phiếu HK2 2026–2027 đã chốt · 20 tín chỉ · 7 lớp", nút "Xem phiếu";
   - không có đợt nào: thẻ ẩn.
4. **Thẻ học phí**: số tiền còn lại (số to), hạn đóng, nút "Đóng học phí". Đã đóng đủ thì thu nhỏ thành dòng
   "Đã đóng đủ học phí HK2 2026–2027".
5. **Lịch hôm nay**: các buổi học hôm nay (giờ, phòng, môn). Không có thì "Hôm nay bạn không có lịch học".

**Desktop:** 2 cột. Trái là hero + lịch hôm nay, phải là học phí.

**Trạng thái phải vẽ:**

- sinh viên mới (vừa đổi mật khẩu, chưa có phiếu);
- chưa tới khung giờ; đang trong khung giờ; phiếu đã chốt;
- còn nợ quá hạn;
- đang tải.

#### B.4.2 Đăng ký học phần

Trang quan trọng nhất, cần thiết kế kỹ nhất.

**Câu hỏi:** "Tôi đăng ký được lớp nào, đã được chưa, tổng bao nhiêu tín chỉ, có phải đóng thêm không?"

**Đầu trang:**

- Tên học kỳ đang mở đăng ký, chip giai đoạn.
- Dòng trạng thái quyền thao tác:
  - "Bạn đang trong khung giờ đăng ký đến 17:00";
  - "Giai đoạn Điều chỉnh, mở cho mọi khoá đến 22/01 17:00";
  - "Chưa tới khung giờ của Khoá 19" kèm Countdown. Khi đó mọi nút đăng ký vô hiệu, vẫn xem và lọc được.
- Khi phiếu đã chốt: "Phiếu đã chốt ngày 22/01. Không còn huỷ lớp được."

**Danh sách môn mở** (chỉ lớp cùng hệ đào tạo với sinh viên):

- Ô tìm theo mã hoặc tên môn.
- Chip lọc: "Còn chỗ", "Không trùng lịch", thứ trong tuần, loại môn (LT/TH), "Dành cho Khoá 19".
- Mỗi môn là một thẻ:
  - mã môn (mono), tên, **tín chỉ của môn mở** (có thể là 0), loại LT/TH;
  - chip hình thức học dự kiến (Lần đầu, Học lại, Cải thiện);
  - "Phụ thu dự kiến 81.000 đ" nếu có, kèm "sau giảm trừ …" khi sinh viên có đối tượng ưu tiên;
  - trạng thái tiên quyết:
    - đủ: không hiện gì;
    - thiếu: "Cần Đạt SE104" hoặc "Cần học trước SE104" (thẻ mờ, vẫn mở xem được);
    - có điều kiện: "Đăng ký có điều kiện: SE104 đang học, chưa có điểm".
  - Môn đã có trong phiếu: chip "Đã đăng ký · SE104.P21".

**Chọn lớp** (bottom sheet cao gần toàn màn hình trên mobile, panel phải trên desktop):

- **Bước 1 · Chọn lớp lý thuyết.** Danh sách SectionCard gồm mã lớp, giảng viên, các buổi (thứ, tiết, phòng,
  khoảng ngày, nhịp), chỗ còn x/y kèm thanh, ngôn ngữ, khoá dành cho, ghi chú.
  - Lớp trùng lịch: viền danger, dòng "Trùng với IT004.P21 · Thứ 3 tiết 1–3", nút đổi thành "Xem lớp trùng".
  - Lớp đầy: chip "Đã đầy", nút vô hiệu.
  - Lớp không có buổi học (ví dụ SE121): ghi "Không có lịch cố định", không bao giờ trùng.
- **Bước 2 · Chọn nhóm thực hành** (không bắt buộc), chỉ khi lớp LT có nhóm. Chỉ liệt kê nhóm con của lớp vừa
  chọn hoặc lớp LT đã có trong phiếu, kèm chip hình thức thực hành:
  - HT1 "Theo lịch": một hoặc nhiều nhóm `.1`, `.2`…, mỗi nhóm hiện lịch riêng (thường xen kẽ cách tuần);
  - HT2 "Tự xếp lịch": nhóm không có buổi học, ghi "Giảng viên và sinh viên tự hẹn lịch", không bao giờ trùng
    lịch.

  Một dòng giải thích: "Lớp LT và nhóm thực hành là hai dòng riêng. Huỷ một trong hai thì huỷ luôn cái kia."
- **Học lại tách phần:**
  - Đã Đạt phần TH: bỏ bước 2.
  - Đã Đạt phần LT: chỉ chọn nhóm thực hành, được chọn nhóm của **bất kỳ** lớp LT nào.
- **Môn TH đứng riêng** (ví dụ CE119): chọn lớp như lớp thường, không có bước 2.
- **Thanh xác nhận** dính đáy màn hình: các lớp trong lượt đăng ký (được chọn nhiều môn rồi gửi một lần), tín chỉ
  sẽ cộng, phụ thu dự kiến, nút "Đăng ký N lớp".
- Số chỗ còn tự cập nhật mỗi 5 giây. Đổi số bằng hiệu ứng đếm, không nhảy layout.

**Phiếu đăng ký:**

- Mobile: thanh dính trên bottom tab "Phiếu · 18/24 tín chỉ · 5 lớp", bấm để mở sheet.
- Desktop: cột phải cố định.
- Nội dung:
  - thanh tín chỉ x/tối đa, chuyển warning khi còn ≤ 3 tín chỉ;
  - từng dòng: mã lớp, tên môn, tín chỉ, chip hình thức học, chip trạng thái (Đã đăng ký, Đăng ký có điều kiện,
    Đã chốt); nhóm thực hành hiển thị lồng dưới lớp LT;
  - hành động mỗi dòng: "Huỷ lớp";
  - tổng phụ thu dự kiến;
  - mục "Đã huỷ" thu gọn, chữ gạch ngang, có lý do khi do hệ thống tự huỷ;
  - nút "Xem thời khoá biểu" mở xem trước lưới tuần của phiếu;
  - nút "In phiếu đăng ký (BM5)".

**Kết quả thao tác:**

- Kết quả hiện **theo từng lớp** trong lượt: lớp đạt có dấu tick và sáng nhẹ trong phiếu; lớp không đạt nêu **một
  lỗi đầu tiên** và lối ra. Lớp này không đạt không làm lớp khác bị từ chối. Toast tóm tắt "Đã đăng ký 3/4 lớp".
- Lớp LT không đạt thì nhóm thực hành con trong cùng lượt cũng không đạt, ghi "Lớp LT cha không đăng ký được".
- Vẽ đủ 9 mẫu lỗi theo đúng thứ tự kiểm tra:

  | # | Lỗi | Lối ra gợi ý |
  |---|---|---|
  | 1 | Ngoài khung giờ của khoá bạn, hoặc học kỳ không mở đăng ký | Hiện giờ mở kế tiếp |
  | 2 | Môn không mở trong học kỳ | Quay lại danh sách |
  | 3 | Lớp thuộc hệ đào tạo khác (lớp `CLC`, bạn thuộc `CQUI`) | Chọn lớp cùng hệ của môn này |
  | 4 | Đã có môn này hoặc môn tương đương trong phiếu | Mở phiếu để huỷ dòng cũ rồi đăng ký lại |
  | 5 | Nhóm thực hành không thuộc lớp LT bạn đang đăng ký | Chọn nhóm của lớp LT trong phiếu, hoặc đăng ký lớp LT cha cùng lượt |
  | 6 | Chưa Đạt môn tiên quyết / chưa học trước | "Cần Đạt SE104". Liên hệ Phòng Đào tạo nếu kết quả chưa đúng |
  | 7 | Trùng lịch với lớp X | Nút "Huỷ lớp X" hoặc "Chọn lớp khác" |
  | 8 | Vượt tín chỉ tối đa (còn được N tín chỉ) | Mở phiếu để huỷ bớt |
  | 9 | Lớp vừa đầy | Gợi ý lớp khác của môn còn chỗ |

- Mạng chậm: nút ở trạng thái đang xử lý; quá 3 giây hiện thêm "Đang giữ chỗ, đừng tắt trang". Không cho bấm lặp.
- Mất mạng giữa chừng: banner mất kết nối. Khi có mạng lại, trang tự kiểm tra kết quả thật của thao tác (không
  bắt sinh viên bấm lại).

**Huỷ lớp:**

- ConfirmDialog nêu hệ quả:
  - huỷ hai chiều: huỷ lớp LT thì huỷ luôn nhóm thực hành con, huỷ nhóm thực hành thì huỷ luôn lớp LT cha;
  - chỗ được trả ngay; muốn sang lớp khác thì đăng ký lại sau khi huỷ, lớp mới có thể đã đầy;
  - phụ thu của dòng này (nếu có) được đảo trong sổ cái.

**Trạng thái phải vẽ:**

- chưa tới khung giờ (chỉ xem);
- phiếu rỗng: "Bạn chưa đăng ký lớp nào. Tìm môn theo mã hoặc tên để bắt đầu.";
- đang đăng ký bình thường;
- gần chạm tín chỉ tối đa;
- 9 lỗi ở trên;
- lượt đăng ký có lớp đạt và lớp không đạt;
- dòng bị tự huỷ vì trượt tiên quyết;
- phiếu đã chốt;
- học kỳ hè (tối đa 12 tín chỉ, mọi dòng đều có phụ thu, không có học phí cố định).

#### B.4.3 Lịch học

**Câu hỏi:** "Tuần này tôi học gì, ở đâu, lúc mấy giờ?"

- **Mobile:**
  - Hàng chọn ngày T2–CN trên cùng, có chấm cho ngày có lịch, vuốt ngang để đổi ngày.
  - Dưới là danh sách buổi: tiết + giờ thực, môn, mã lớp, phòng, giảng viên, nhãn LT/TH.
- **Desktop:** ScheduleGrid tuần, bộ chọn tuần, tô hôm nay. Chỉ hiện buổi có ngày học thật trong tuần đang xem
  (nhóm học cách tuần chỉ hiện ở tuần của mình).
- Khi đang trong đợt đăng ký, có công tắc "Học kỳ đang học / Học kỳ đang đăng ký" để xem trước lịch kỳ sau.
- Nút "Xuất thời khoá biểu" (lưới tuần, in được).
- **Trạng thái:** tuần không có lịch, lớp không có lịch cố định (SE121, nhóm HT2: hiện ở mục "Không có lịch cố
  định"), đang tải.

#### B.4.4 Học phí

**Câu hỏi:** "Tôi còn nợ bao nhiêu, đóng thế nào, đã nhận tiền chưa, sao lại có khoản này?"

**Đầu trang:** bộ chọn học kỳ (mặc định học kỳ còn nợ gần nhất).

**Thẻ tóm tắt BM7:**

- Số tiền đăng ký → Giảm trừ (ghi tên đối tượng ưu tiên đang áp dụng) → **Số tiền phải đóng** → Đã thanh toán →
  **Số tiền còn lại** (số to nhất, màu theo trạng thái).
- Hạn đóng kèm Countdown.
- Sau hạn mà còn nợ: banner danger "Học phí HK1 2026–2027 đã quá hạn từ 31/10/2026, còn 5.000.000 đ. Hãy đóng
  ngay và liên hệ Phòng Tài vụ nếu cần hỗ trợ."

**VietQRCard**, chỉ hiện khi Số tiền còn lại > 0:

- QR lớn, nền trắng kể cả ở dark mode; nút "Lưu ảnh QR".
- CopyField: Ngân hàng, Số tài khoản, Chủ tài khoản, **Số tiền** (khoá, không sửa), **Nội dung chuyển khoản**
  (`HP2452000120262`).
- Ghi chú: "Giữ nguyên nội dung chuyển khoản để hệ thống tự ghi nhận. Có thể chuyển nhiều lần."
- Sau khi bấm sao chép hoặc lưu ảnh: hiện trạng thái "Đang chờ tiền về…" (tự kiểm tra định kỳ) kèm link "Tôi đã
  chuyển nhưng chưa thấy ghi nhận" mở hướng dẫn liên hệ Phòng Tài vụ.
- Tiền về: chuyển cảnh thành công gồm số tiền, số phiếu thu, nút "Xem phiếu thu". Nếu đã đóng đủ thì thêm dòng
  "Email xác nhận sẽ gửi tới 24520001@gm.uit.edu.vn".

**Sổ cái** (LedgerTimeline, mới nhất trước):

- Mỗi dòng có ngày, diễn giải dễ hiểu, số tiền +/−. Ví dụ:
  - "Học phí cố định HK2 2026–2027 · Khoá 19 · CQUI"
  - "Giảm 80% · Con liệt sĩ"
  - "Phụ thu IT002 · Học lại · 3 tín chỉ × 27.000 đ"
  - "Huỷ IT002.P21 · Đảo phụ thu"
  - "Tính lại học phí (đổi hệ đào tạo) · Đảo học phí cố định"
  - "Thanh toán · Phiếu thu PT-20262-00012"
  - "Số dư có chuyển từ HK1 2026–2027"
- Các dòng sinh ra cùng một lần tính lại học phí được nhóm lại dưới một tiêu đề, có ngày và lý do.
- Dòng nào có phiếu thu thì bấm được để mở phiếu.

**Phiếu thu:** danh sách gồm số phiếu, ngày (thời điểm ngân hàng ghi nhận với chuyển khoản), số tiền, kênh
(Chuyển khoản / Tại quầy).

**Trạng thái phải vẽ:**

- còn nợ toàn bộ;
- đã đóng một phần (QR hiện phần còn lại);
- đã đóng đủ: không có QR, thẻ "Bạn đã đóng đủ học phí học kỳ này";
- có số dư có;
- quá hạn còn nợ;
- vừa được tính lại học phí;
- học kỳ hè: chỉ có phụ thu;
- đang chờ tiền về; vừa nhận tiền.

#### B.4.5 Chi tiết phiếu thu

- Hiển thị giống bản in BM6: số phiếu, ngày thu, MSSV, họ tên, khoá, hệ đào tạo, học kỳ, số tiền bằng số và bằng
  chữ, kênh thu, mã giao dịch ngân hàng hoặc người thu.
- Nút "Tải PDF".

#### B.4.6 Hồ sơ

- Chỉ đọc: họ tên, MSSV, email, khoá, hệ đào tạo, đối tượng ưu tiên (ghi rõ đối tượng nào đang được áp dụng nếu
  có nhiều).
- Ghi chú dưới email: "Email đóng đủ học phí gửi tới địa chỉ này."
- Ghi chú "Thông tin sai? Liên hệ Phòng Đào tạo để sửa."
- Nút "Đổi mật khẩu".

#### B.4.7 Email đóng đủ học phí

Email HTML rộng 600 px, đọc tốt cả khi chặn ảnh:

- Logo UIT, tiêu đề "Bạn đã đóng đủ học phí HK2 2026–2027".
- Họ tên, MSSV, học kỳ, số tiền phải đóng, tổng đã thanh toán, số dư có (nếu đóng thừa).
- Phiếu thu của lần thanh toán cuối cùng.
- Nút "Xem học phí" dẫn về trang Học phí.
- Chân email: "Đây là email tự động, vui lòng không trả lời."

### B.5 Dữ liệu mẫu

Dùng bảng sinh viên mẫu ở mục A.7. Các nhân vật chính của phần này: `24520001` (H1, H2, H3), `24520003`,
`24520009`, `24520013`, `24520005`, `24520010`, `24520011` (H4).

## Phần C. Các trang của Phòng Đào tạo

**Thiết bị:** Desktop-first 1440 px. Mỗi trang thêm một bản mobile 360 px chứng minh vẫn dùng được (bảng cuộn
ngang trong khung, form một cột).

### C.1 Phòng Đào tạo là ai

**Chuyên viên Đỗ Thu Hằng**, Phòng Đào tạo. Chịu trách nhiệm hồ sơ của khoảng 6.000 sinh viên và đợt đăng ký của
từng học kỳ.

- Làm cả ngày trên máy tính màn hình rộng, quen Excel, thường mở nhiều tab cùng lúc.
- Công việc có mùa:

  | Thời điểm | Việc |
  |---|---|
  | Trước học kỳ | Nhập thời khoá biểu từ Excel, chỉnh lớp, đặt mốc thời gian, chia khung giờ |
  | Đợt đăng ký | Theo dõi lớp đầy, tăng sĩ số, trả lời sinh viên thắc mắc |
  | Sau chốt phiếu | Liên hệ sinh viên dưới tín chỉ tối thiểu, xuất danh sách lớp gửi giảng viên |
  | Rải rác cả năm | Tạo hồ sơ khoá mới, đặt lại mật khẩu, sửa hồ sơ sai, cập nhật đối tượng ưu tiên |

- Mọi thao tác ghi đều vào nhật ký kiểm toán. Chuyên viên cần thấy rõ thao tác nào có hậu quả lớn (sửa hồ sơ làm
  tính lại học phí, nhập lại thời khoá biểu, xoá hồ sơ) trước khi bấm.

**Chuyên viên cần:**

- tra một sinh viên theo MSSV từ bất kỳ đâu (ô tìm trên top bar);
- thấy ngay việc tồn đọng;
- nhập thời khoá biểu từ tệp Excel của trường mà không phải gõ lại.

**Điều làm chuyên viên sợ:**

- nhập tệp thời khoá biểu 3.000 dòng thì hỏng một nửa;
- mở đăng ký với mốc thời gian sai;
- xếp lịch trùng phòng mà không biết;
- sửa hồ sơ làm học phí sinh viên đổi mà không biết;
- làm lộ mật khẩu của sinh viên.

### C.2 Hành trình chính

**H1. Chuẩn bị HK2 2026–2027** (prototype bấm được)

> Học kỳ `20262` đã có sẵn, đang ở Chuẩn bị. Tôi sửa các mốc thời gian. Hệ thống báo đỏ ngay ô "Bắt đầu Điều
> chỉnh" vì sớm hơn "Kết thúc Đăng ký", và TermTimeline xem trước cho tôi thấy chỗ sai. Tôi chia giai đoạn Đăng ký
> thành khung giờ cho Khoá 17–18, 19, 20 trên một Gantt.
>
> Sang Thời khoá biểu, tôi kéo tệp `tkb_hk2_2026.xlsx` vào. Bước kiểm tra báo "3.012 dòng · 3 lỗi · 14 cảnh báo":
> một mã môn không có trong danh mục, một môn có hai dòng ghi tín chỉ khác nhau, một dòng tiết sai. 14 cảnh báo
> trùng phòng không chặn. Nút Nhập bị khoá cho tới khi tệp sạch. Tôi sửa tệp, tải lại, nhập thành công một lần:
> 412 môn mở, 1.380 lớp, 920 nhóm thực hành.
>
> Tôi sửa tín chỉ của môn mở SE121 về 2 ngay trên bảng. Thêm tay lớp `SE104.P24`: chọn giảng viên, sĩ số 80, thêm
> buổi Thứ 5 tiết 1–3. Khi tôi xếp vào phòng B1.14 trùng giờ với lớp khác, một cảnh báo vàng hiện ra nhưng tôi
> vẫn lưu được.

**H2. Sáng mở khung giờ Khoá 19**

> Màn Theo dõi đăng ký cập nhật liên tục. `IT004.P21` đầy sau 2 phút. Tôi tăng sĩ số lên 90 ngay trên bảng; thử
> giảm xuống 70 thì bị báo "Không thấp hơn số đã đăng ký (80)". Một sinh viên gọi điện thắc mắc; tôi gõ MSSV trên
> top bar, mở tab Phiếu đăng ký của bạn ấy, thấy các dòng và dòng nào đã huỷ.

**H3. Hồ sơ sinh viên** (prototype bấm được)

> Tôi tạo hồ sơ cho Mai Anh Tuấn, Khoá 20, CQUI. Lưu xong, hộp mật khẩu hiện một lần; tôi sao chép gửi cho bạn
> ấy, tick "Tôi đã lưu" rồi mới đóng được.
>
> Sinh viên `24520013` chuyển sang hệ CLC. Tôi sửa hệ đào tạo. Vì HK2 đang trong đợt đăng ký, dialog cho tôi xem
> trước: học phí HK2 được tính lại, số tiền phải đóng 15.000.000 → 20.000.000 đ, thanh toán đã có giữ nguyên, các
> lớp đã đăng ký giữ nguyên. Tôi xác nhận.
>
> Một sinh viên quên mật khẩu. Tôi bấm "Đặt lại mật khẩu", dialog nhắc mọi phiên đăng nhập của bạn ấy sẽ kết
> thúc. Mật khẩu mới hiện một lần.
>
> Tôi phát hiện vừa tạo nhầm MSSV `25520099`. Hồ sơ chưa có phiếu và chưa có dòng sổ cái nên xoá được; tôi gõ lại
> MSSV để xác nhận. Với `24520001` thì nút Xoá bị khoá, tooltip giải thích vì sao.

**H4. Sau chốt phiếu**

> Hết Điều chỉnh, phiếu tự chốt. Tổng quan báo 5 sinh viên dưới 14 tín chỉ; tôi xuất danh sách để gọi điện. Tôi
> mở lớp `SE104.P21`, xuất danh sách sinh viên (BB01) ra Excel gửi giảng viên.

### C.3 Sơ đồ trang

Sidebar nhóm theo việc. Top bar có bộ chọn học kỳ, ô tìm MSSV toàn cục, chuyển vai trò, menu tài khoản.

| Nhóm | Trang | Route dự kiến |
|---|---|---|
| | Tổng quan | `/academic` |
| Sinh viên | Danh sách sinh viên | `/academic/students` |
| | Chi tiết sinh viên | `/academic/students/[code]` |
| | Đối tượng ưu tiên và khoá | `/academic/catalog` |
| Học kỳ | Học kỳ và khung giờ | `/academic/terms`, `/academic/terms/[code]` |
| | Thời khoá biểu và lớp | `/academic/terms/[code]/timetable` |
| | Chi tiết lớp học phần | `/academic/sections/[code]` |
| | Theo dõi đăng ký | `/academic/terms/[code]/monitor` |

### C.4 Từng trang

#### C.4.1 Tổng quan

**Câu hỏi:** "Học kỳ đang ở đâu, hôm nay có việc gì tồn đọng?"

- **TermTimeline** của học kỳ đang mở và học kỳ đang học, đánh dấu "bây giờ".
- **Hàng StatCard** đổi theo giai đoạn:
  - Chuẩn bị: thời khoá biểu đã nhập chưa, số môn mở, số lớp, cảnh báo trùng phòng;
  - đợt đăng ký: số sinh viên đã có phiếu / tổng sinh viên, lớp đầy, lớp dưới 10 sinh viên;
  - sau chốt: số sinh viên dưới tín chỉ tối thiểu.
- **Danh sách việc cần xử lý.** Mỗi mục có số lượng và link:
  - học kỳ sắp vào Đăng ký mà chưa nhập thời khoá biểu;
  - (khoá, hệ) có sinh viên nhưng chưa có bảng phí: "Khoá 20 · CLC chưa có bảng phí. Học kỳ sẽ không chuyển sang
    Đăng ký được. Liên hệ Phòng Tài vụ.";
  - lớp đã đầy trong đợt đăng ký;
  - lịch có trùng phòng hoặc trùng giảng viên;
  - sinh viên dưới tín chỉ tối thiểu sau khi chốt phiếu (chỉ cảnh báo).
- Hoạt động gần đây của phòng (từ nhật ký).

#### C.4.2 Danh sách sinh viên

**Câu hỏi:** "Tìm sinh viên này" / "Khoá 19 hệ CLC có bao nhiêu người thuộc đối tượng ưu tiên?"

- Bảng gồm MSSV, họ tên, email, khoá, hệ đào tạo, đối tượng ưu tiên đang áp dụng.
- Lọc dạng chip: khoá, hệ đào tạo, đối tượng ưu tiên. Tìm theo MSSV hoặc tên.
- Hành động: "Thêm sinh viên".

**Thêm sinh viên** (drawer):

- MSSV (8 chữ số, mono) kèm cảnh báo "Không sửa được sau khi tạo"; kiểm tra trùng ngay khi gõ xong.
- Họ tên, email.
- Khoá tuyển sinh (select), hệ đào tạo (select, dữ liệu nền).
- Đối tượng ưu tiên (MultiSelect, không bắt buộc). Chọn nhiều thì hiện "Đang áp dụng: … (70%)".
- Lưu → OneTimeSecretDialog với mật khẩu ban đầu.

#### C.4.3 Chi tiết sinh viên

**Header** cố định: họ tên, MSSV, khoá, hệ đào tạo. Hành động: "Sửa hồ sơ", "Đặt lại mật khẩu", "Xoá hồ sơ".

**Các tab:**

- **Hồ sơ:** sáu trường của hồ sơ, đối tượng ưu tiên ghi rõ cái nào đang áp dụng.
- **Phiếu đăng ký:** phiếu từng học kỳ, chỉ đọc. Gồm dòng, trạng thái, hình thức học, dòng đã huỷ kèm lý do.
- **Nhật ký:** mọi thao tác liên quan sinh viên này (tạo, sửa, đặt lại mật khẩu, tính lại học phí).
- Nếu tài khoản cũng có vai trò Phòng Tài vụ: link "Mở công nợ ở Phòng Tài vụ".

**Sửa hồ sơ** (drawer): họ tên, email, khoá, hệ đào tạo, đối tượng ưu tiên. MSSV chỉ đọc.

- Không đổi khoá, hệ hay đối tượng ưu tiên: lưu thẳng.
- Có đổi một trong ba trường đó và **đang trong đợt đăng ký**: ConfirmDialog "Tính lại học phí HK2 2026–2027":
  - BeforeAfter: học phí cố định, phụ thu, giảm trừ, số tiền phải đóng, số tiền còn lại;
  - "Hệ thống sẽ ghi dòng đảo cho các khoản nợ và giảm trừ của học kỳ này rồi ghi lại theo hồ sơ mới. Thanh toán
    đã có giữ nguyên. Các học kỳ trước không đổi.";
  - đổi hệ: thêm dòng "Các lớp đã đăng ký giữ nguyên dù khác hệ mới.";
  - (khoá, hệ) mới chưa có bảng phí: chặn lưu, báo "Chưa có bảng phí cho Khoá 19 · CLC. Liên hệ Phòng Tài vụ."
- Có đổi và **ngoài đợt đăng ký**: dialog thông tin "Thay đổi áp dụng từ học kỳ sau. Học phí đã phát sinh không
  đổi."

**Đặt lại mật khẩu:** ConfirmDialog "Mọi phiên đăng nhập của sinh viên này sẽ kết thúc. Sinh viên phải đổi mật
khẩu ở lần đăng nhập tới." → OneTimeSecretDialog.

**Xoá hồ sơ:**

- Chỉ bật khi sinh viên chưa có phiếu đăng ký và chưa có dòng sổ cái. Khi bị khoá, tooltip nêu lý do cụ thể ("Đã
  có phiếu đăng ký HK2 2026–2027").
- ConfirmDialog nguy hiểm, gõ lại MSSV để xác nhận: "Xoá hồ sơ và tài khoản của 25520099. Không hoàn tác được."

#### C.4.4 Đối tượng ưu tiên và khoá

Hai tab.

- **Đối tượng ưu tiên:** bảng gồm tên, tỉ lệ giảm, độ ưu tiên, số sinh viên đang thuộc.
  - Thêm, sửa trong drawer. Sửa tỉ lệ: ghi chú "Không hồi tố. Chỉ áp cho khoản nợ phát sinh sau khi lưu."
  - Xoá bị khoá khi còn sinh viên thuộc đối tượng, tooltip nêu số sinh viên.
  - Hai đối tượng cùng độ ưu tiên: cảnh báo warning (không chặn).
- **Khoá tuyển sinh:** bảng gồm tên khoá, năm nhập học, số sinh viên, số bảng phí, số khung giờ.
  - Thêm, sửa trong drawer.
  - Xoá bị khoá khi khoá có sinh viên, bảng phí hoặc khung giờ.

#### C.4.5 Học kỳ và khung giờ

**Danh sách:** theo năm học, mỗi năm có HK1, HK2, Hè. Mỗi học kỳ có mã mono và chip giai đoạn. Không có nút "Tạo
học kỳ" (năm học và học kỳ là dữ liệu nền).

**Thẻ Giới hạn tín chỉ** ở đầu danh sách: tối thiểu / tối đa học kỳ chính (14 / 24), tối đa học kỳ hè (12). Nút
"Sửa". Dialog ghi rõ: "Giá trị mới áp cho các học kỳ đang ở Chuẩn bị: HK hè 2026–2027. Học kỳ đã mở đăng ký giữ
giá trị cũ."

**Chi tiết học kỳ:**

- **Năm mốc thời gian** (DateTimePicker giờ Việt Nam): bắt đầu và kết thúc Đăng ký, bắt đầu và kết thúc Điều
  chỉnh, hạn đóng học phí.
  - Kiểm tra thứ tự: bắt đầu Đăng ký < kết thúc Đăng ký ≤ bắt đầu Điều chỉnh < kết thúc Điều chỉnh < hạn đóng.
  - Luật sửa theo thời gian, thể hiện ngay trên ô:
    - mốc chưa tới: sửa được;
    - khoảng đã bắt đầu: ô bắt đầu khoá (icon khoá, tooltip "Đã bắt đầu, chỉ sửa được ngày kết thúc");
    - khoảng đã kết thúc hoặc mốc đã qua: khoá cả hai;
    - giá trị mới phải sau thời điểm hiện tại.
  - Báo lỗi ngay tại ô sai. TermTimeline xem trước tô khoảng sai.
  - Gia hạn đóng học phí: được khi hạn cũ chưa qua.
  - Lỗi khi đợt đăng ký chồng với học kỳ khác: "HK1 2026–2027 đang trong đợt đăng ký từ … đến …".
- **Giới hạn tín chỉ** của học kỳ: chỉ đọc (đã chép vào khi học kỳ ở Chuẩn bị).
- **Khung giờ đăng ký:** Gantt mỗi khung một hàng trong giai đoạn Đăng ký, mỗi khung gán một hoặc nhiều khoá.
  - Khung chưa bắt đầu: kéo để chỉnh, sửa khoá, xoá.
  - Khung đang diễn ra: chỉ kéo mép kết thúc.
  - Khung đã kết thúc: khoá.
  - Khung nằm ngoài giai đoạn Đăng ký hoặc không có khoá nào: báo lỗi. Khoá chưa có khung nào: cảnh báo.
- Giai đoạn tự chuyển theo mốc, không có nút chuyển tay. Ghi chú "Giai đoạn chuyển tự động theo mốc thời gian".

#### C.4.6 Thời khoá biểu và lớp

**Câu hỏi:** "Học kỳ này mở môn gì, bao nhiêu lớp, đã khớp tệp của trường chưa?"

**Chưa có thời khoá biểu:** trạng thái rỗng với nút "Nhập thời khoá biểu" và link tải tệp mẫu.

**Nhập thời khoá biểu** (Stepper 4 bước, chỉ khi học kỳ ở Chuẩn bị; giai đoạn khác thì nút vô hiệu kèm lý do):

1. **Chọn tệp:** FileDrop `.xlsx` theo mẫu của trường, hiện tên tệp và số dòng.
2. **Kiểm tra:**
   - Tóm tắt "3.012 dòng · 3 lỗi · 14 cảnh báo".
   - ImportReport: lỗi theo dòng × cột, ô lỗi tô danger, mô tả bằng lời. Ví dụ:
     - "Dòng 214 · MÃ MH: `IT999` không có trong danh mục môn học";
     - "Dòng 530 · SỐ TC: SE104 có dòng ghi 3 tín chỉ, dòng 528 ghi 4";
     - "Dòng 1.102 · TIẾT: `12` không hợp lệ".
   - Cảnh báo tách riêng, không chặn: trùng phòng, trùng giảng viên.
   - Nút "Tải báo cáo lỗi".
3. **Xác nhận:**
   - Còn một lỗi thì nút "Nhập" vô hiệu, kèm câu "Nhập theo kiểu tất cả hoặc không: sửa hết lỗi rồi tải lại".
   - Học kỳ đã có thời khoá biểu: ConfirmDialog danger "Thay toàn bộ 412 môn mở và 1.380 lớp hiện có".
4. **Kết quả:** số môn mở, lớp, nhóm thực hành, buổi học đã tạo.

**Sau khi nhập**, ba tab:

- **Môn mở:** mã, tên, loại, **tín chỉ của môn mở** (sửa trong ô khi học kỳ ở Chuẩn bị; cho phép 0), tín chỉ mặc
  định của môn (chữ phụ), số lớp, tổng sĩ số.
- **Lớp học phần:** bảng gồm mã lớp, môn, hệ đào tạo, giảng viên, sĩ số, số đã đăng ký, khoá dành cho, ngôn ngữ,
  số buổi, hình thức thực hành. Lọc theo hệ, môn, khoá dành cho, "Có cảnh báo". Nút "Thêm lớp" (chỉ ở Chuẩn bị).
- **Lịch tổng:** ScheduleGrid theo phòng hoặc theo giảng viên, ô trùng gạch chéo.

**Form lớp học phần** (drawer):

- Ở **Chuẩn bị**, sửa tự do:
  - mã lớp, môn mở, hệ đào tạo, giảng viên (combobox, có thể để trống), sĩ số tối đa > 0, khoá dành cho (một khoá
    hoặc mọi khoá), ngôn ngữ, ghi chú;
  - **Buổi học** (lặp được, có thể không có buổi nào): MeetingEditor;
  - lớp LT có môn TH đi kèm: chọn **Hình thức thực hành** (SegmentedControl HT1 "Theo lịch" / HT2 "Tự xếp
    lịch"). Mục **Nhóm thực hành** liệt kê nhóm con `.1`, `.2`… (không giới hạn số nhóm), mỗi nhóm có sĩ số và
    giảng viên riêng; HT1 thì mỗi nhóm có buổi học, HT2 thì không. Nút "Sao chép lịch nhóm trước, lùi một tuần"
    để tạo nhóm học xen kẽ;
  - xoá lớp, xoá nhóm, xoá buổi.
- Từ **Đăng ký** trở đi:
  - chỉ sửa được sĩ số tối đa (không thấp hơn số đã đăng ký) và điền giảng viên hoặc phòng **còn trống**;
  - mọi trường khác khoá, banner thông tin "Từ giai đoạn Đăng ký chỉ sửa được sĩ số và điền giảng viên, phòng
    còn trống";
  - không có nút thêm hay xoá lớp.
- **Cảnh báo trùng phòng / trùng giảng viên:** viền warning inline tại buổi bị trùng, nêu lớp trùng. Không chặn
  lưu.

#### C.4.7 Chi tiết lớp học phần

- Thông tin lớp, các buổi học, nhóm thực hành, sĩ số và số đã đăng ký.
- **Danh sách sinh viên (BB01):** STT, MSSV, họ tên, khoá, hệ đào tạo, hình thức học, trạng thái dòng. Mặc định
  ẩn dòng đã huỷ.
- Nút "Xuất Excel".

#### C.4.8 Theo dõi đăng ký

**Câu hỏi:** "Lớp nào đầy, lớp nào vắng, cần mở thêm chỗ không?"

- Bảng lớp tự cập nhật: mã lớp, môn, hệ, giảng viên, `đã đăng ký / sĩ số` kèm thanh đầy.
- Lọc: Đã đầy, ≥ 90%, < 10 sinh viên, theo môn, theo hệ.
- Sửa sĩ số trực tiếp trong ô (không nhỏ hơn số đã đăng ký; báo lỗi tại ô nếu nhỏ hơn).
- Biểu đồ nhỏ số dòng đăng ký theo phút trong khung giờ hiện tại.
- Chỉ báo "Cập nhật 3 giây trước".
- Sau khi chốt phiếu: tab "Dưới tín chỉ tối thiểu" gồm MSSV, họ tên, khoá, tổng tín chỉ, nút "Xuất Excel".

### C.5 Trạng thái phải vẽ (ngoài rỗng / tải / lỗi chung)

- Form mốc thời gian sai thứ tự; mốc đã khoá một nửa (khoảng đang diễn ra).
- Đợt đăng ký chồng học kỳ khác.
- Gantt khung giờ có khung đang diễn ra và khung đã qua.
- Tệp thời khoá biểu có lỗi; tệp chỉ có cảnh báo; nhập lại thay toàn bộ; nhập thành công.
- Lớp có cảnh báo trùng phòng.
- Form lớp ở Chuẩn bị và ở Đăng ký (đa số trường khoá).
- Giảm sĩ số dưới số đã đăng ký.
- OneTimeSecretDialog sau khi tạo hồ sơ và sau khi đặt lại mật khẩu.
- Dialog tính lại học phí (trong đợt), dialog ngoài đợt, lỗi thiếu bảng phí.
- Xoá hồ sơ được và bị khoá.
- Xoá đối tượng ưu tiên hoặc khoá bị khoá.

### C.6 Dữ liệu mẫu

Dùng mục A.7. Bổ sung:

- Tệp mẫu `tkb_hk2_2026.xlsx`: 3.012 dòng; ba lỗi và 14 cảnh báo như hành trình H1.
- Sinh viên `25520099` (hồ sơ tạo nhầm, xoá được).
- 5 sinh viên dưới 14 tín chỉ sau chốt, trong đó có `24520004` (11 tín chỉ).

## Phần D. Các trang của Phòng Tài vụ

**Thiết bị:** Desktop-first 1440 px, kèm bản mobile 360 px chứng minh vẫn dùng được. Mẫu in vẽ đúng khổ giấy.

### D.1 Phòng Tài vụ là ai

Có hai người dùng chính:

**1. Chị Ngô Thị Lan, thu ngân tại quầy.**

- Gần hạn đóng học phí, hàng chờ trước quầy dài.
- Mỗi sinh viên chỉ có khoảng 1 phút: nhận tiền mặt hoặc quẹt thẻ, ghi nhận, in phiếu thu, gọi người tiếp theo.
- Cần màn hình gõ MSSV là ra số tiền, ít click, phím tắt, in nhanh.
- Sợ nhất: ghi nhận hai lần cho một lần thu; gõ nhầm số tiền.

**2. Anh Trịnh Quốc Việt, kế toán công nợ.**

- Làm việc ở bàn, đầu giờ sáng.
- Việc hằng ngày và theo mùa:
  - xử lý hàng chờ giao dịch chuyển khoản không khớp (sinh viên ghi sai nội dung);
  - xem kết quả đối soát với ngân hàng;
  - trước mỗi học kỳ: lập bảng phí cho (khoá, hệ) mới, kiểm tra tài khoản nhận;
  - cuối kỳ xuất báo cáo công nợ BM7.
- Sợ nhất: tiền vào mà không ghi sổ; ghi có nhầm sinh viên; số liệu báo cáo lệch với ngân hàng.

**Nguyên tắc nghiệp vụ người dùng phải cảm nhận được:**

- **Sổ cái chỉ ghi thêm.** Không có nút sửa hay xoá dòng, không có khoản điều chỉnh, không huỷ phiếu thu. Sai sót
  (ví dụ nhập nhầm số tiền tại quầy) được xử lý ngoài hệ thống. Vì vậy bước xác nhận thu tiền phải rất rõ.
- Mọi số tiền là số nguyên đồng.
- Mọi thao tác tài chính đều có xác nhận và chặn bấm lặp.

### D.2 Hành trình chính

**H1. Thu tại quầy** (prototype bấm được)

> Sinh viên đưa thẻ, tôi gõ `24520001` (con trỏ đã nằm sẵn trong ô tìm). Màn hình hiện thẻ sinh viên và công nợ
> từng học kỳ: HK2 2026–2027 còn 15.000.000 đ. Ô số tiền điền sẵn số còn lại. Sinh viên chỉ đưa 10.000.000 đ nên
> tôi sửa lại; màn hình báo "Còn lại sau lần thu: 5.000.000 đ".
>
> Bấm "Ghi nhận thanh toán" (hoặc Ctrl+Enter), dialog xác nhận hiện số tiền to, bằng chữ, và họ tên. Xác nhận →
> phiếu thu `PT-20262-00045` hiện ra, máy in nhiệt in luôn. Bấm "Sinh viên tiếp theo" (Esc) để ô tìm được xoá và
> focus lại.
>
> Sinh viên kế tiếp đóng nốt phần còn lại; panel kết quả ghi thêm "Đã đóng đủ. Email xác nhận sẽ gửi tới sinh
> viên."

**H2. Hàng chờ giao dịch chưa khớp** (prototype bấm được)

> Sáng nay có 2 giao dịch chưa khớp. Một giao dịch 15.000.000 đ, nội dung "HP 24520007 hoc phi" (thiếu mã học
> kỳ). Tôi bấm "Gán cho sinh viên", gõ 24520007, chọn HK2 2026–2027. Màn hình xem trước công nợ trước và sau khi
> gán, tôi xác nhận và phiếu thu được tạo.
>
> Giao dịch còn lại 200.000 đ, nội dung "ung ho quy" không phải học phí. Tôi bấm "Bỏ qua", ghi lý do.

**H3. Đối soát và báo cáo**

> Kết quả đối soát đêm qua: ngân hàng 412 giao dịch, hệ thống 410 trước khi đối soát. Hệ thống đã tự ghi bù 2
> giao dịch mà webhook bỏ sót, mỗi giao dịch có phiếu thu. Còn 1 chỗ lệch số tiền chỉ để xem; tôi ghi lại và xử
> lý với ngân hàng ngoài hệ thống.
>
> Cuối kỳ tôi mở Báo cáo công nợ BM7 của HK1 2026–2027, lọc theo khoá, xem trước bản in và xuất PDF, Excel.

**H4. Chuẩn bị học kỳ mới**

> Tổng quan cảnh báo "Khoá 20 · CLC có sinh viên nhưng chưa có bảng phí". Tôi vào Bảng phí và tham số, thêm bảng
> phí cho cặp đó; đơn giá LT, TH được điền sẵn từ đơn giá mặc định. Ngân hàng báo đổi tài khoản nhận, tôi sửa tài
> khoản nhận; dialog nhắc QR học phí và kiểm tra webhook sẽ dùng tài khoản mới ngay sau khi lưu.

### D.3 Sơ đồ trang

Sidebar: **Tổng quan · Thu tại quầy · Công nợ sinh viên · Giao dịch ngân hàng · Đối soát · Phiếu thu · Bảng phí
và tham số · Báo cáo công nợ (BM7)**.

Top bar: bộ chọn học kỳ, ô tìm MSSV toàn cục, chuyển vai trò, menu tài khoản. Mục "Giao dịch ngân hàng" có badge
số giao dịch chưa khớp.

| Trang | Route dự kiến |
|---|---|
| Tổng quan | `/finance` |
| Thu tại quầy | `/finance/counter` |
| Công nợ sinh viên | `/finance/students/[code]` |
| Giao dịch ngân hàng | `/finance/transactions` (tab "Chưa khớp" mặc định khi còn) |
| Đối soát | `/finance/reconciliation` |
| Phiếu thu | `/finance/receipts` |
| Bảng phí và tham số | `/finance/settings` |
| Báo cáo công nợ BM7 | `/finance/reports/bm7` |

### D.4 Từng trang

#### D.4.1 Tổng quan

**Câu hỏi:** "Học kỳ này đã thu được bao nhiêu, còn bao nhiêu, có gì cần xử lý?"

**StatCard theo học kỳ:**

- Số tiền phải đóng;
- Đã thu (tách Chuyển khoản / Tại quầy);
- Số tiền còn lại;
- tỉ lệ sinh viên đã đóng đủ (OrbitProgress).

**Hạn đóng:** kèm Countdown. Sau hạn hiện số sinh viên còn nợ, link sang BM7.

**Biểu đồ:**

- cột tiền về theo ngày, màu brand, tách 2 kênh;
- đường luỹ kế so với Số tiền phải đóng.

**Việc cần xử lý:**

- giao dịch chưa khớp;
- lệch còn lại ở lần đối soát gần nhất;
- (khoá, hệ) có sinh viên nhưng chưa có bảng phí.

#### D.4.2 Thu tại quầy (BM6)

Màn dùng nhiều nhất, tối ưu cho tốc độ.

**Bố cục 2 cột:**

- **Trái:**
  - Ô tìm MSSV lớn, autofocus; gõ đủ 8 số là tự tìm.
  - Thẻ sinh viên: họ tên, MSSV, khoá, hệ đào tạo, đối tượng ưu tiên đang áp dụng.
  - Bảng công nợ từng học kỳ còn nợ: Số tiền phải đóng / Đã thanh toán / Số tiền còn lại, chip quá hạn nếu có.
- **Phải** (form thu):
  - chọn học kỳ (mặc định học kỳ còn nợ cũ nhất);
  - MoneyInput, mặc định bằng Số tiền còn lại;
  - dòng tính trực tiếp "Còn lại sau lần thu";
  - nhập lớn hơn số còn lại: cảnh báo warning "Thừa 500.000 đ sẽ thành số dư có, tự trừ vào học kỳ sau";
  - ghi chú tuỳ chọn;
  - nút "Ghi nhận thanh toán".

**Xác nhận:** dialog có số tiền to, bằng chữ, họ tên, MSSV, học kỳ, câu nhắc "Phiếu thu không huỷ được sau khi
ghi nhận". Nút xác nhận có trạng thái đang xử lý và chặn bấm lặp.

**Sau khi ghi nhận:**

- Panel phiếu thu, nút "In (A5)", "In (80 mm)", "Sinh viên tiếp theo".
- Nếu lần thu làm số tiền còn lại về 0 hoặc thấp hơn: dòng success "Đã đóng đủ. Email xác nhận sẽ gửi tới sinh
  viên."
- Danh sách "Phiếu thu ca này" bên dưới (người thu hiện tại, hôm nay), kèm tổng tiền ca.

**Phím tắt:** hiện gợi ý nhỏ dưới form.

| Phím | Việc |
|---|---|
| `/` | Focus ô tìm |
| Ctrl+Enter | Ghi nhận |
| Esc | Sinh viên tiếp theo |
| Ctrl+P | In |

**Trạng thái phải vẽ:**

- chưa tìm;
- không thấy MSSV;
- sinh viên không còn nợ: form ẩn, hiện "Không có khoản cần thu" và số dư có nếu có;
- thu thiếu; thu thừa; thu đủ (kèm dòng email);
- đang ghi nhận;
- ghi nhận lỗi mạng: không biết đã ghi hay chưa → trang tự kiểm tra lại bằng cùng khoá chống lặp, không để thu
  ngân bấm lần hai.

#### D.4.3 Công nợ sinh viên

**Câu hỏi:** "Vì sao sinh viên này nợ số tiền này?"

- **Header:** thẻ sinh viên, tổng còn nợ mọi học kỳ, số dư có.
- **Tóm tắt BM7 theo học kỳ:** chọn học kỳ để xem chi tiết.
- **LedgerTimeline đầy đủ.**
  - Cột: thời điểm, loại dòng, diễn giải, ghi nợ, ghi có, số dư luỹ kế, người tạo (hệ thống hoặc thu ngân), dòng
    liên quan.
  - Loại dòng: học phí cố định, đảo học phí cố định, phụ thu, đảo phụ thu, giảm trừ, đảo giảm trừ, thanh toán,
    chuyển số dư ra, chuyển số dư vào.
  - Diễn giải phải dễ hiểu, ví dụ "Phụ thu IT002 · Học lại · 3 tín chỉ × 27.000 đ · giảm 80%".
  - Các dòng của một lần tính lại học phí nhóm dưới một tiêu đề: "Tính lại học phí · đổi hệ CQUI → CLC · bởi
    Phòng Đào tạo · 06/01/2027 10:12".
  - Dòng thanh toán link sang phiếu thu và giao dịch ngân hàng.
- **Không có** nút sửa, xoá hay tạo dòng. Ghi chú cố định ở đầu bảng: "Sổ cái chỉ ghi thêm. Mọi dòng do hệ thống
  sinh theo quy tắc, trừ phiếu thu tại quầy. Sai sót được xử lý ngoài hệ thống."

#### D.4.4 Giao dịch ngân hàng

**Câu hỏi:** "Tiền chuyển khoản đã vào đúng người chưa?"

- **Tab:** Chưa khớp (badge) · Tất cả · Bỏ qua.
- **Bảng:**
  - Cột: thời điểm ngân hàng ghi nhận, số tiền, nội dung chuyển khoản, mã thanh toán nhận diện được, chip trạng
    thái, sinh viên + học kỳ đã khớp, phiếu thu, nguồn (webhook / đối soát ghi bù).
  - Ghi chú nhỏ: phiếu thu ghi theo thời điểm ngân hàng ghi nhận, không theo lúc hệ thống nhận được.
- **Drawer chi tiết:** toàn bộ trường của giao dịch, dữ liệu gốc từ SePay dạng JSON thu gọn, lịch sử xử lý.
- **Gán cho sinh viên** (chỉ giao dịch chưa khớp):
  - combobox MSSV/tên, gợi ý sẵn nếu nội dung có chuỗi giống MSSV;
  - chọn học kỳ;
  - BeforeAfter công nợ trước → sau;
  - xác nhận → tạo phiếu thu (và email đóng đủ nếu về 0).
- **Bỏ qua:** lý do bắt buộc.

**Trạng thái phải vẽ:** hàng chờ rỗng ("Không còn giao dịch chưa khớp"); giao dịch có nhiều MSSV gợi ý; gán làm
phát sinh số dư có.

#### D.4.5 Đối soát

**Câu hỏi:** "Hệ thống có khớp với ngân hàng không?"

- Ghi chú đầu trang: "Đối soát chạy tự động hằng ngày. Giao dịch webhook bỏ sót được tự ghi bù. Chỗ lệch còn lại
  chỉ để xem, xử lý ngoài hệ thống."
- Danh sách các lần đối soát: ngày, số giao dịch phía ngân hàng, số trong hệ thống, số đã tự ghi bù, số lệch còn
  lại, chip trạng thái (Khớp / Có lệch).
- **Chi tiết một lần:**
  - "Đã tự ghi bù": từng giao dịch kèm link phiếu thu đã tạo.
  - "Lệch còn lại": từng mục kèm loại lệch (có trong hệ thống nhưng không thấy ở ngân hàng, lệch số tiền…), chỉ
    đọc, **không có nút thao tác**.

#### D.4.6 Phiếu thu

- Bảng gồm số phiếu (mono), ngày thu, MSSV, họ tên, học kỳ, số tiền, kênh (Chuyển khoản / Tại quầy), người thu.
- Lọc theo học kỳ, kênh, người thu, khoảng ngày. Tổng tiền theo bộ lọc.
- Mở phiếu → xem như bản in, nút "In lại" (bản in lại có dấu "Bản sao"). Không có nút huỷ.

#### D.4.7 Bảng phí và tham số

Ba thẻ trên một trang, thao tác lưu đều có xác nhận và CSRF.

- **Đơn giá tín chỉ mặc định:** LT 27.000 đ, TH 37.000 đ. Ghi chú: "Chỉ là giá điền sẵn khi lập bảng phí mới.
  Bảng phí đã có không đổi theo."
- **Bảng phí theo (khoá, hệ):**
  - Cột: khoá, hệ đào tạo, học phí cố định mỗi học kỳ chính, đơn giá LT, đơn giá TH, số sinh viên.
  - Thêm (đơn giá điền sẵn từ mặc định), sửa trong drawer. Không trùng cặp (khoá, hệ).
  - Dòng cảnh báo danger cho (khoá, hệ) có sinh viên mà chưa có bảng phí: "Học kỳ chính kế tiếp sẽ không chuyển
    sang Đăng ký được."
  - Ghi chú: "Thay đổi không hồi tố. Dòng đăng ký đã chốt đơn giá lúc đăng ký; học phí cố định đã ghi nợ không
    đổi."
  - Lịch sử thay đổi lấy từ nhật ký kiểm toán.
- **Tài khoản nhận học phí:** ngân hàng, số tài khoản, chủ tài khoản. ConfirmDialog khi lưu: "QR học phí và kiểm
  tra webhook dùng tài khoản mới ngay sau khi lưu. Giao dịch vào tài khoản cũ sẽ bị từ chối."
- **Hạn đóng học phí:** danh sách học kỳ với hạn đóng, chỉ đọc, ghi "Do Phòng Đào tạo đặt".

#### D.4.8 Báo cáo công nợ (BM7)

**Câu hỏi:** "Cuối kỳ còn ai nợ, tổng bao nhiêu?"

- Chọn học kỳ. Lọc khoá, hệ đào tạo, đối tượng ưu tiên.
- Bảng gồm sinh viên có Số tiền còn lại > 0.
  - Cột: STT, MSSV, Họ tên, **Số tiền đăng ký**, **Số tiền phải đóng**, **Số tiền còn lại**.
  - Dòng tổng ở cuối.
- Ghi chú: "Ba con số luôn tính lại từ sổ cái. Danh sách sau hạn đóng được gửi bộ phận khảo thí."
- Hành động: "Xem trước bản in", "Xuất Excel", "Xuất PDF".

### D.5 Mẫu in

**Phiếu thu BM6:**

- Hai khổ: **A5 dọc** và **giấy in nhiệt 80 mm**.
- Nội dung:
  - logo UIT, tên trường;
  - "PHIẾU THU HỌC PHÍ", số phiếu, ngày giờ thu;
  - MSSV, họ tên, khoá, hệ đào tạo, học kỳ;
  - số tiền bằng số và **bằng chữ** ("Mười lăm triệu đồng chẵn");
  - kênh thu;
  - người thu (tại quầy) hoặc mã giao dịch ngân hàng (chuyển khoản);
  - chỗ ký người nộp và người thu (A5).
- Bản 80 mm: một cột, chữ ≥ 9 pt, không có màu nền.

**Báo cáo BM7:**

- A4 ngang. Tiêu đề "BÁO CÁO SINH VIÊN CHƯA HOÀN THÀNH HỌC PHÍ", học kỳ, ngày lập, người lập.
- Bảng có header lặp lại mỗi trang, dòng tổng, số trang "Trang x/y".
- Chỗ ký người lập và trưởng phòng.

### D.6 Dữ liệu mẫu

Dùng mục A.7. Bổ sung:

- Hai giao dịch chưa khớp như hành trình H2 (`24520007` thiếu mã học kỳ; 200.000 đ "ung ho quy").
- Lần đối soát đêm 05/01/2027: ngân hàng 412, hệ thống 410, tự ghi bù 2, lệch còn lại 1.
- Phiếu thu tại quầy `PT-20262-00045` (10.000.000 đ, người thu Ngô Thị Lan).
- BM7 của `20261`: 37 sinh viên còn nợ, có `24520011` còn 5.000.000 đ.
