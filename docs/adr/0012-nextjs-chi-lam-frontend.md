# 0012. Next.js chỉ làm frontend

- Trạng thái: accepted
- Ngày: 2026-09-30
- Nguồn: phiên grill 2026-09-30, câu 26

## Bối cảnh

Next.js App Router có Server Actions và Route Handlers, nên dễ bị dùng làm backend thứ hai. Nếu làm vậy thì logic
nghiệp vụ và truy cập DB bị chia đôi, và các bất biến ở [ADR-0005](./0005-chien-luoc-dong-thoi-khi-dang-ky.md) có
thể bị bỏ qua.

## Quyết định

- NestJS là backend duy nhất. Next.js **không** chứa logic nghiệp vụ, **không** truy cập DB, và không dùng Server Actions hay Route Handlers cho thao tác ghi.
- Trang đăng ký là client component, gọi thẳng API NestJS qua TanStack Query, polling số chỗ còn khoảng 5 giây. Không dùng WebSocket.
- Trang khác được dùng SSR/RSC để đọc.
- Build `output: 'standalone'`. UI dùng shadcn/ui + Tailwind, mobile-first cho màn hình sinh viên.
- Cùng domain qua nginx: `/api` → NestJS, `/` → Next.js. Nhờ vậy cookie session dùng chung và không cần CORS.

## Hệ quả

- Hợp đồng API nằm ở `packages/contracts` (zod + `nestjs-zod`, sinh OpenAPI) và được dùng chung hai phía.
- Polling 5 giây với 1000 người là khoảng 200 req/s đọc, được cache Redis hấp thụ.

## Phương án đã cân nhắc

- **Vite SPA:** đơn giản hơn, nhưng mất SSR cho các trang đọc.
- **Next.js full-stack:** ít service hơn, nhưng logic bị tách đôi.
- **WebSocket đẩy số chỗ còn:** cập nhật tức thì, nhưng thêm kết nối giữ lâu và phải xử lý fan-out khi scale.
