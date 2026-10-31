# CardScan KYC

Công cụ số hóa danh thiếp chạy trên trình duyệt: nhận dạng ký tự (OCR) từ ảnh danh thiếp, tự động trích xuất thông tin liên hệ, kiểm tra tính hợp lệ của hồ sơ (KYC) và xuất dữ liệu sang Google Sheets / AppSheet.

**Dùng trực tuyến:** https://nhanhuutran007.github.io/cardscan/

## Tính năng

**Nhận dạng danh thiếp**
- Chụp ảnh trực tiếp bằng camera điện thoại, chọn ảnh từ máy, kéo thả hoặc dán bằng `Ctrl + V`
- OCR tiếng Việt và tiếng Anh bằng Tesseract.js, xử lý ngay trên trình duyệt, ảnh không được gửi lên máy chủ
- **Làm thẳng thẻ**: chọn 4 góc danh thiếp trên ảnh chụp nghiêng, công cụ tự hiệu chỉnh phối cảnh về hình chữ nhật
- Tiền xử lý ảnh: chuyển xám, tăng tương phản, nhị phân hóa Otsu
- Tự thử nhiều chế độ phân tích bố cục (PSM) và giữ kết quả tốt nhất

**Trích xuất thông tin**
- Tự điền họ tên, chức danh, công ty, số điện thoại, email, website, địa chỉ
- Hỗ trợ số điện thoại Việt Nam và quốc tế; thẻ có nhiều số điện thoại
- Chịu được các lỗi OCR thường gặp: mất dấu tiếng Việt, ký tự `@` bị đọc sai, ký tự rác từ biểu tượng trên thẻ

**Kiểm tra KYC**
- Kiểm tra trường bắt buộc, định dạng email và số điện thoại
- Đối chiếu tên miền email với website công ty, cảnh báo email cá nhân (Gmail, Yahoo...)
- Phát hiện hồ sơ trùng lặp theo số điện thoại hoặc email
- Phân loại hồ sơ: **Đạt** · **Cần xác minh** · **Không đạt**

**Quản lý hồ sơ**
- Danh sách hồ sơ với thống kê, bộ lọc theo trạng thái và tìm kiếm
- Chỉnh sửa, xóa hồ sơ
- Xuất CSV (UTF-8, tên cột không dấu) tương thích Google Sheets / AppSheet, hoặc xuất JSON

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Giao diện | HTML, CSS, JavaScript thuần — không framework, một tệp duy nhất |
| OCR | [Tesseract.js](https://github.com/naptha/tesseract.js) 5 (`vie` + `eng`) |
| Xử lý ảnh | Canvas API — biến đổi phối cảnh (homography), nội suy song tuyến, ngưỡng Otsu |
| Xử lý dữ liệu hàng loạt | Python 3 (chỉ thư viện chuẩn) |
| Lưu trữ | `localStorage` của trình duyệt |

## Cấu trúc

```
index.html           Ứng dụng web
kyc_check.py         Script kiểm tra & làm sạch dữ liệu CSV hàng loạt
sample_contacts.csv  Dữ liệu mẫu để chạy thử script
```

## Chạy trên máy

```bash
git clone https://github.com/nhanhuutran007/cardscan.git
cd cardscan
python -m http.server 8765
```

Mở `http://localhost:8765`. Lần đầu sử dụng cần kết nối Internet để tải mô hình OCR, các lần sau trình duyệt dùng bản đã lưu.

## Hướng dẫn sử dụng

1. **Tải ảnh** — chụp hoặc chọn ảnh danh thiếp. Có thể dùng **Thẻ mẫu** để thử nhanh.
2. **Làm thẳng thẻ** *(khi ảnh chụp nghiêng hoặc có nền xung quanh)* — chạm lần lượt 4 góc thẻ theo thứ tự trên-trái → trên-phải → dưới-phải → dưới-trái.
3. **Chạy nhận dạng** — các trường thông tin được điền tự động.
4. **Kiểm tra KYC** — rà soát và chỉnh sửa thông tin; kết quả kiểm tra cập nhật ngay khi gõ.
5. **Lưu hồ sơ** — hồ sơ xuất hiện trong mục *Hồ sơ khách hàng*.

## Kiểm tra dữ liệu hàng loạt (Python)

```bash
python kyc_check.py khach_hang.csv
```

Script chuẩn hóa số điện thoại, họ tên, email; kiểm tra định dạng; phát hiện hồ sơ trùng; in báo cáo và ghi tệp `khach_hang_cleaned.csv`.

```
=== BÁO CÁO KYC: sample_contacts.csv ===
Tổng hồ sơ     : 6
Đạt            : 1
Cần xác minh   : 3
Không đạt      : 2
Hồ sơ bị trùng : 4
```

## Đồng bộ với Google AppSheet

1. Xuất CSV từ mục *Hồ sơ khách hàng* (nên chạy `kyc_check.py` trước để làm sạch).
2. Google Sheets → **Tệp › Nhập** → tải tệp CSV lên.
3. **Tiện ích mở rộng › AppSheet › Tạo ứng dụng**.
4. Cấu hình cột:

| Cột | Kiểu AppSheet | Ghi chú |
|---|---|---|
| `ID` | Text (Key) | Mã hồ sơ |
| `HoTen` | Name | |
| `ChucDanh` | Text | |
| `CongTy` | Text | |
| `SoDienThoai` | Phone | Đã chuẩn hóa |
| `Email` | Email | |
| `Website` | Url | |
| `DiaChi` | Address | |
| `GhiChu` | LongText | Số điện thoại phụ, nguồn |
| `TrangThaiKYC` | Enum | Đạt · Cần xác minh · Không đạt |
| `NgayTao` | DateTime | |

5. *(Tùy chọn)* Tạo Slice lọc `TrangThaiKYC = "Cần xác minh"` và Bot gửi email nhắc người phụ trách khi có hồ sơ mới.

## Giới hạn

- Độ chính xác OCR giảm với danh thiếp chữ nghệ thuật, nền tối hoặc bố cục phức tạp — luôn rà soát thông tin trước khi lưu.
- Thẻ không có tên người liên hệ (thẻ cửa hàng) có thể bị nhận nhầm tên thương hiệu thành họ tên.
- Dữ liệu lưu cục bộ trên từng trình duyệt, không đồng bộ giữa các thiết bị.

## Hướng phát triển

- Tự động phát hiện 4 góc danh thiếp (OpenCV.js)
- Ghi trực tiếp vào Google Sheets qua Apps Script thay cho xuất CSV
- Tích hợp Google Cloud Vision / Document AI để tăng độ chính xác
- Đối chiếu mã số thuế doanh nghiệp với cổng thông tin quốc gia
