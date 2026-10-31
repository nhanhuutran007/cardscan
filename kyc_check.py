"""
kyc_check.py — Kiểm tra & làm sạch dữ liệu khách hàng (xuất từ CardScan KYC hoặc Google Sheets).

Chức năng:
  - Chuẩn hóa SĐT Việt Nam (+84 / dấu chấm / khoảng trắng -> 0xxxxxxxxx)
  - Chuẩn hóa họ tên (viết hoa chữ cái đầu), email (chữ thường)
  - Kiểm tra định dạng email / SĐT, thiếu thông tin bắt buộc
  - Phát hiện hồ sơ trùng lặp theo SĐT hoặc email
  - Xuất file *_cleaned.csv (sẵn sàng import vào Google Sheets -> AppSheet)

Cách chạy (chỉ dùng thư viện chuẩn, không cần cài thêm):
  python kyc_check.py sample_contacts.csv
"""
import csv
import re
import sys
from collections import defaultdict
from pathlib import Path

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[a-z]{2,}$", re.I)
MOBILE_RE = re.compile(r"^0(3|5|7|8|9)\d{8}$")
LANDLINE_RE = re.compile(r"^02\d{9}$")
FREE_MAIL = {"gmail.com", "yahoo.com", "yahoo.com.vn", "hotmail.com", "outlook.com", "icloud.com"}


def normalize_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if digits.startswith("84") and len(digits) in (11, 12):
        digits = "0" + digits[2:]
    return digits


def normalize_name(raw: str) -> str:
    return " ".join(w.capitalize() for w in (raw or "").split())


def check_row(row: dict) -> tuple[str, list[str]]:
    """Trả về (trạng thái, danh sách vấn đề)."""
    fails, warns = [], []
    if not row["HoTen"]:
        fails.append("Thiếu họ tên")
    if not row["Email"] and not row["SoDienThoai"]:
        fails.append("Thiếu cả SĐT và email")
    if row["Email"]:
        if not EMAIL_RE.match(row["Email"]):
            fails.append("Email sai định dạng")
        elif row["Email"].split("@")[1] in FREE_MAIL:
            warns.append("Email cá nhân - cần xác minh")
    if row["SoDienThoai"] and not (MOBILE_RE.match(row["SoDienThoai"]) or LANDLINE_RE.match(row["SoDienThoai"])):
        fails.append("SĐT không hợp lệ")
    if not row.get("CongTy"):
        warns.append("Thiếu tên công ty")
    status = "Không đạt" if fails else ("Cần xác minh" if warns else "Đạt")
    return status, fails + warns


def main(path: str) -> None:
    src = Path(path)
    with src.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)

    for col in ("HoTen", "Email", "SoDienThoai", "CongTy", "TrangThaiKYC", "VanDe"):
        if col not in fieldnames:
            fieldnames.append(col)

    # 1) Chuẩn hóa + kiểm tra từng dòng
    for r in rows:
        for k in fieldnames:
            r[k] = (r.get(k) or "").strip()
        r["HoTen"] = normalize_name(r["HoTen"])
        r["Email"] = r["Email"].lower()
        r["SoDienThoai"] = normalize_phone(r["SoDienThoai"])
        r["TrangThaiKYC"], issues = check_row(r)
        r["VanDe"] = "; ".join(issues)

    # 2) Phát hiện trùng lặp
    index = defaultdict(list)
    for i, r in enumerate(rows):
        for key in (r["Email"], r["SoDienThoai"]):
            if key:
                index[key].append(i)
    dup_count = 0
    for key, idxs in index.items():
        if len(idxs) > 1:
            for i in idxs:
                others = ", ".join(rows[j]["HoTen"] or f"dòng {j + 2}" for j in idxs if j != i)
                note = f"Trùng ({key}) với: {others}"
                if note not in rows[i]["VanDe"]:
                    rows[i]["VanDe"] = "; ".join(filter(None, [rows[i]["VanDe"], note]))
                    dup_count += 1
                if rows[i]["TrangThaiKYC"] == "Đạt":
                    rows[i]["TrangThaiKYC"] = "Cần xác minh"

    # 3) Ghi file kết quả
    out = src.with_name(src.stem + "_cleaned.csv")
    with out.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)

    # 4) Báo cáo
    stats = defaultdict(int)
    for r in rows:
        stats[r["TrangThaiKYC"]] += 1
    print(f"\n=== BÁO CÁO KYC: {src.name} ===")
    print(f"Tổng hồ sơ     : {len(rows)}")
    for s in ("Đạt", "Cần xác minh", "Không đạt"):
        print(f"{s:<15}: {stats[s]}")
    print(f"Hồ sơ bị trùng : {dup_count}")
    print("\nChi tiết hồ sơ có vấn đề:")
    for i, r in enumerate(rows, start=2):
        if r["VanDe"]:
            print(f"  - Dòng {i:>2} | {r['HoTen'] or '(không tên)':<22} | {r['TrangThaiKYC']:<12} | {r['VanDe']}")
    print(f"\n✔ Đã ghi file sạch: {out}")


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) != 2:
        print("Cách dùng: python kyc_check.py <file.csv>")
        sys.exit(1)
    main(sys.argv[1])
