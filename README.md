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

**Quản lý & đồng bộ hồ sơ**
- Danh sách hồ sơ với thống kê, bộ lọc theo trạng thái và tìm kiếm
- Chỉnh sửa, xóa hồ sơ
- **Đồng bộ trực tiếp lên Google Sheets** qua Google Apps Script — chỉ gửi hồ sơ mới hoặc đã sửa, không tạo dòng trùng, có thể tự động đồng bộ khi lưu
- Xuất CSV (UTF-8, tên cột không dấu) hoặc JSON

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Giao diện | HTML, CSS, JavaScript thuần — không framework, một tệp duy nhất |
| OCR | [Tesseract.js](https://github.com/naptha/tesseract.js) 5 (`vie` + `eng`) |
| Xử lý ảnh | Canvas API — biến đổi phối cảnh (homography), nội suy song tuyến, ngưỡng Otsu |
| Đồng bộ | Google Apps Script (ứng dụng web) → Google Sheets → AppSheet |
| Xử lý dữ liệu hàng loạt | Python 3 (chỉ thư viện chuẩn) |
| Lưu trữ | `localStorage` của trình duyệt |

## Cấu trúc

```
index.html             Ứng dụng web
apps-script/Code.gs    Mã Google Apps Script nhận dữ liệu đồng bộ và ghi vào Google Sheets
kyc_check.py           Script kiểm tra & làm sạch dữ liệu CSV hàng loạt
sample_contacts.csv    Dữ liệu mẫu để chạy thử script
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

## Đồng bộ với Google Sheets & AppSheet

```
CardScan ──POST JSON──▶ Apps Script (ứng dụng web) ──▶ Google Sheets "KhachHang" ──▶ AppSheet
```

### 1. Cài đặt Apps Script (một lần)

1. Mở [sheets.new](https://sheets.new), đặt tên trang tính (ví dụ “CardScan”).
2. Trong CardScan › **Tích hợp AppSheet**: bấm **Tạo mã** để sinh mã bảo mật, rồi **Sao chép mã** — mã Apps Script được sao chép kèm mã bảo mật đã điền sẵn.
3. Trong Google Sheets: **Tiện ích mở rộng › Apps Script**, xóa mã mặc định, dán mã vừa sao chép, lưu.
4. **Triển khai › Tùy chọn triển khai mới › Ứng dụng web**
   - Thực thi dưới dạng: **Tôi**
   - Người có quyền truy cập: **Bất kỳ ai**
   - Bấm **Triển khai** và cấp quyền truy cập trang tính.
5. Sao chép **URL ứng dụng web** (kết thúc bằng `/exec`), dán vào CardScan cùng mã bảo mật, bấm **Lưu** rồi **Kiểm tra kết nối**.

> Mỗi lần sửa `Code.gs`, cần **Triển khai › Quản lý các bản triển khai › Chỉnh sửa › Phiên bản mới** để thay đổi có hiệu lực (URL giữ nguyên).

### 2. Đồng bộ

- Mục **Hồ sơ khách hàng › Đồng bộ Google Sheets**: gửi các hồ sơ mới hoặc đã chỉnh sửa kể từ lần đồng bộ trước. Hồ sơ trùng `ID` được cập nhật, không tạo dòng mới.
- Bật **Tự động đồng bộ khi lưu hồ sơ** để mỗi hồ sơ được gửi ngay khi lưu.
- Trang tính `KhachHang` được tạo tự động; cột số điện thoại để dạng văn bản nên giữ nguyên số 0 đầu.
- Xóa hồ sơ trong CardScan không xóa dòng tương ứng trên Google Sheets.

### 3. Tạo ứng dụng AppSheet

1. Sau lần đồng bộ đầu tiên, trong Google Sheets chọn **Tiện ích mở rộng › AppSheet › Tạo ứng dụng**.
2. Cấu hình cột (**Data › KhachHang**):

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
| `CapNhatLuc` | DateTime | Lần đồng bộ gần nhất |
| `AnhDanhThiep` | Image | Chụp ảnh thẻ trong AppSheet — CardScan không ghi đè cột này |

3. *(Tùy chọn)* Tạo Slice lọc `[TrangThaiKYC] <> "Đạt"`, Action đặt `TrangThaiKYC = "Đạt"` sau khi xác minh, và Bot gửi email nhắc người phụ trách khi có hồ sơ mới cần xác minh.

**Không dùng Apps Script?** Có thể xuất CSV tại mục *Hồ sơ khách hàng* (nên chạy `kyc_check.py` trước), rồi nhập vào Google Sheets qua **Tệp › Nhập** — bỏ chọn “Chuyển đổi văn bản thành số, ngày tháng” để giữ số 0 đầu số điện thoại.

## Giới hạn

- Độ chính xác OCR giảm với danh thiếp chữ nghệ thuật, nền tối hoặc bố cục phức tạp — luôn rà soát thông tin trước khi lưu.
- Thẻ không có tên người liên hệ (thẻ cửa hàng) có thể bị nhận nhầm tên thương hiệu thành họ tên.
- Dữ liệu lưu cục bộ trên từng trình duyệt; dùng tính năng đồng bộ để gom hồ sơ từ nhiều thiết bị về một Google Sheets.
- Mã bảo mật được lưu trong trình duyệt của người dùng; chỉ chia sẻ cho người được phép ghi dữ liệu.

## Hướng phát triển

- Tự động phát hiện 4 góc danh thiếp (OpenCV.js)
- Đồng bộ hai chiều: cập nhật trạng thái KYC từ AppSheet ngược về CardScan
- Tích hợp Google Cloud Vision / Document AI để tăng độ chính xác
- Đối chiếu mã số thuế doanh nghiệp với cổng thông tin quốc gia
