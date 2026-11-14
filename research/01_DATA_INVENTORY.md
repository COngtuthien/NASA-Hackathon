# 01 — Kiểm kê dữ liệu (Data Inventory)

> **Phạm vi:** Quét đệ quy toàn bộ `D:\NASA Hackathon` (trừ `.git/`). Mọi kết luận dưới đây dựa trên việc **đọc nội dung thật** của file (CSV, XLSX, PDF, DOCX, PPTX, TXT, ZIP), không chỉ dựa trên tên file.
> **Công cụ:** `pdftotext -layout` (poppler) cho PDF; giải nén XML bằng `zipfile` + `xml.etree` (thư viện chuẩn Python 3.13) cho DOCX/PPTX/XLSX; `md5sum` để kiểm tra trùng lặp. Không cài thêm thư viện, không sửa file gốc. Các bản giải nén/trích xuất trung gian được đặt trong thư mục scratchpad tạm, **không** nằm trong repo.
> **Ngày khảo sát:** 2026-11-10.

---

## 1. Tổng quan nhanh

| Hạng mục | Giá trị |
|---|---|
| Tổng số file (không tính `.git`) | 29 |
| Investigation | FLEX (PSI-69), BASS-II (PSI-25), SAFFIRE-I (PSI-98) |
| File dữ liệu có cấu trúc | 3 CSV + 3 XLSX + 3 bộ metadata ISA-Tab (TXT trong ZIP) |
| Tài liệu khoa học/kỹ thuật | 12 PDF, 4 DOCX, 1 PPTX |
| File ZIP | 5 (1 ZIP lớn `download.zip` = bản sao FLEX; 4 ZIP metadata) |
| File trùng lặp byte-for-byte | 14 (xem §5) |
| File không đọc được | **0** (mọi file đều parse được); nhưng có **trang chỉ có hình** trong một số PDF (xem §6) |
| Dữ liệu thô (video, ảnh, time-series cảm biến) | **Không có** trong repo (đúng như mô tả của người dùng) |

---

## 2. Danh sách đầy đủ các file

Đường dẫn tương đối so với `D:\NASA Hackathon\`. Kích thước tính bằng byte. Số trang PDF đếm theo ký tự ngắt trang (form feed) trong output của `pdftotext`.

### 2.1 Thư mục gốc

| Đường dẫn | Ext | Kích thước | Thuộc | Nội dung thực tế (đã đọc) |
|---|---|---:|---|---|
| `README.md` | md | 21 | — | Chỉ một dòng `# NASA-Hackathon`. Không có giá trị khoa học. |
| `download.zip` | zip | 13,073,645 | FLEX | **Bản sao** của 11 file trong `FLEX/` (đã kiểm tra MD5 từng thành viên: giống hệt). Không cần giải nén. |
| `PSI-98_metadata_PSI-166_SAFFIRE-I.zip` | zip | 10,031 | SAFFIRE-I | ISA-Tab metadata (`i_Investigation.txt` 9,739 B, `s_PSI-98.txt` 56 B). **Trùng** với bản trong `SAFFIRE-1/` (MD5 `4737c984…`). |

### 2.2 `FLEX/` — Flame Extinguishment Experiment (PSI-69)

| Đường dẫn | Ext | Kích thước | Trang | Loại nội dung | Nội dung thực tế |
|---|---|---:|---:|---|---|
| `FLEX/PSI-69_Experimental table_FLEX.csv` | csv | 24,776 | — | **Dữ liệu có cấu trúc** | 274 thí nghiệm × 15 cột. Encoding **cp1252** (không phải UTF-8): byte `0x96` (dấu gạch ngang `–`) dùng làm ký hiệu "không có dữ liệu" (34 ô). |
| `FLEX/PSI-69_metadata_PSI-133_FLEX.zip` | zip | 24,780 | — | Metadata | ISA-Tab: `i_Investigation.txt`, `s_PSI-69.txt`. |
| `FLEX/PSI-69_metadata_PSI-133_FLEX/i_Investigation.txt` | txt | 24,488 | — | **Metadata** | Study PSI-69: Approach, Hypothesis, Objective, phần cứng (CIR/MDCA), DOI `10.60555/mbq8-0451`, **51 công bố** kèm DOI/link, 7 nhà nghiên cứu. Phần INVESTIGATION để trống. |
| `FLEX/PSI-69_metadata_PSI-133_FLEX/s_PSI-69.txt` | txt | 56 | — | Metadata | Chỉ có header + dòng `Do not use this`. Không có thông tin mẫu. |
| `FLEX/FLEX DoD.docx` | docx | 18,758 | — | Metadata / mô tả dữ liệu | "Description of Data": cách tổ chức dữ liệu FLEX trên PSI (Calibration, LCTF Calibration, Radiometer Calibration, HEP, MeOH; Raw/Analyzed data, Raw videos, Images). |
| `FLEX/FLEX_Test_Plan.pdf` | pdf | 185,799 | 15 | Kế hoạch thử nghiệm | Trích từ *Research Requirements Document* (Williams et al., 4/11/2005), các trang in 11–12 và 44–55: định nghĩa LOI/MEC, quy trình xây dựng flammability map, test matrix đề xuất (Bảng 6–12). **Trùng nội dung** với các trang tương ứng của `FLEX_EIRD_v4.pdf` (ví dụ Bảng 6 nằm ở trang PDF 46 của EIRD). |
| `FLEX/FLEX_EIRD_v4.pdf` | pdf | 3,240,704 | 81 | **Giải thích khoa học + yêu cầu** | Thực chất là **Research Requirements Document** "Droplet Flame Extinguishment in Microgravity (FLEX)", 4/11/2005 (không phải "EIRD" như tên file gợi ý). Gồm nền tảng lý thuyết extinction, Damköhler, LOI, mục tiêu, biến độc lập, chẩn đoán, science data end products. |
| `FLEX/FLEX Engineering Requirements Document.pdf` | pdf | 237,373 | 37 | **Đặc tả kỹ thuật** | ⚠️ Là ERD của **FLEX-2** (FLX-REQ-0001, 04/02/2010), **không phải FLEX**. Có yêu cầu về áp suất (0.5–3 atm), O2 (0.1–0.4), độ chính xác cảm biến, camera (30 fps, 30 µm). |
| `FLEX/FLEX Overall Ext File-2.pdf` | pdf | 2,267,043 | 30 | Đặc tả kỹ thuật | "Selections from Engineering Documents for FLEX" (Gordon Berger, 21/5/2015): trích CIR Payload Accommodations Handbook (2008) + Reflight Safety Data Package MDCA/FLEX2 (2010). Mô tả phần cứng, camera (HiBMs, LLL-UV), nhiên liệu FLEX (Methanol, Heptane) vs FLEX-2. |
| `FLEX/1G17-070HE-0166.pdf` | pdf | 516,392 | 13 | **Bài báo khoa học** | Farouk & Dryer, "Isolated Alkane Droplet Combustion in Microgravity: 'Cool Flames'", 8th US National Combustion Meeting, 2013. Mô hình số + so sánh với dữ liệu ISS n-heptane. |
| `FLEX/2G11-070HE-0310.pdf` | pdf | 915,193 | 10 | Bài báo khoa học | Liu et al., "Effect of Varying the Initial Diameter of n-Octane and n-Decane Droplets…", 2013. ⚠️ Nhiên liệu **n-octane/n-decane** — **không có** trong CSV FLEX (chỉ Methanol, Heptane). |
| `FLEX/20130010979.pdf` | pdf | 1,116,919 | 15 | Slide khoa học | Hicks et al., "Dynamics of Water Absorption and Evaporation During Methanol Droplet Combustion in Microgravity", ASGSR 2012. |
| `FLEX/Cool Flames in Space, a Hot Prospect on Earth!.pdf` | pdf | 4,524,480 | 24 | Slide khoa học | Nayagam, ISS R&D Conference 2013: phát hiện cool flame trên FLEX. Nhiều trang chủ yếu là hình. |

### 2.3 `BASS-II/` — Burning and Suppression of Solids II (PSI-25)

| Đường dẫn | Ext | Kích thước | Trang | Loại | Nội dung thực tế |
|---|---|---:|---:|---|---|
| `BASS-II/PSI-25_Experimental table_BASS-II.csv` | csv | 16,590 | — | **Dữ liệu có cấu trúc** | 129 test × 17 cột, UTF-8 có BOM. Nhiều ô là **văn bản tự do nhiều giai đoạn** (ví dụ `"1.7 (52)   1.25   0.9   0.6   0.4   0.35"`). |
| `BASS-II/BASS-II Test Matrix by PI Final.xlsx` | xlsx | 28,956 | — | Dữ liệu có cấu trúc | 6 sheet theo PI (Bhattacharjee 22, Ferkul 4, Miller 20, Olson 27, Fernandez-Pello 27, T'ien 29 hàng = 129). **Cùng dữ liệu với CSV**; CSV là bản xuất (dấu phẩy trong ô bị thay bằng khoảng trắng). Ngày lưu dạng Excel serial. Không có công thức. |
| `BASS-II/Fan calibration data.xlsx` | xlsx | 23,973 | — | **Dữ liệu hiệu chuẩn** | 1 sheet (A1:DE35), 27 khối theo ngày: Pot → Fan Display → Air Display cho 0/1/2 restrictor; công thức mẫu `U = 1.0066 × AIR` (dựa trên SPICE calibration). Có **external link** tới file không có trong repo: `/BASS-II Olson analysis/BASS-II Fan Cal All days with flow estimates.xlsx`. |
| `BASS-II/BASS-II data FAQ.docx` | docx | 21,538 | — | **Metadata / định nghĩa cột** | Định nghĩa từng cột (GMT = day-of-year, Fan display = volt×10, Air display = cm/s, O2 calibrated bằng offset MCA, …) + danh sách công bố đến 4/2017. |
| `BASS-II/BASS-II Procedure.docx` | docx | 1,111,856 | — | Quy trình vận hành | Quy trình phi hành đoàn: pha loãng GN2, đọc CSA-CP/CDM trước–sau mỗi burn, đánh lửa, chụp ảnh 1 fps, fan calibration cuối ngày. 18 hình. |
| `BASS-II/BASS-II Summary Report.pdf` | pdf | 48,972,416 | 144 | **Báo cáo khoa học chính** | NASA/TM-20210011385 (10/2021), Olson et al. Gồm tổng quan, sản phẩm cháy, CSTR model, báo cáo của 5 PI, **Appendix A: test matrix chi tiết có cột "Test observations and anomalies"** (nguồn duy nhất về kết cục/extinction), App. B–E. |
| `BASS-II/SRD_BASS-II.pdf` | pdf | 1,108,340 | 16 | Yêu cầu khoa học | Science Requirements, success criteria, manifest mẫu, test matrix ưu tiên của Olson & Bhattacharjee. ⚠️ Trang 14–16 (matrix của T'ien, Miller, Fernandez-Pello) **chỉ là hình**, không trích được văn bản. |
| `BASS-II/BASS-2 Engineering Requirements.pptx` | pptx | 1,123,356 | 7 slide | **Đặc tả kỹ thuật** | Yêu cầu chung, đo lường (4 Hz, ±10%), camera Nikon D300s, phần cứng SPICE, ảnh mẫu (11 media). |
| `BASS-II/PSI-25_metadata_PSI_metadata_PSI-101_BASS-II.zip` | zip | 13,439 | — | Metadata | `i_Investigation.txt` (13,147 B) + `s_PSI-25.txt` (56 B, placeholder). DOI `10.60555/4qc4-de67`, 17 công bố. **Không giải nén vào repo**; đã đọc trong bộ nhớ tạm. |

### 2.4 `SAFFIRE-1/` — Spacecraft Fire Experiment I (PSI-98)

| Đường dẫn | Ext | Kích thước | Trang | Loại | Nội dung thực tế |
|---|---|---:|---:|---|---|
| `SAFFIRE-1/PSI-98_Experimental table_SAFFIRE-1.csv` | csv | 469 | — | Dữ liệu có cấu trúc | 4 hàng: **2 mẫu thật (S1, S2)** + 2 hàng mô tả dữ liệu flow visualization (F1, F2) bị nhét vào cùng bảng. 13 cột. |
| `SAFFIRE-1/SAFFIRE-1_MergeResult-jpeg_Update_Final_v2.xlsx` | xlsx | 12,325,177 | — | **Manifest ảnh / downlink** | 12 sheet, ~165,000 hàng, ~600,000 công thức, 28 query table. **Không chứa ảnh nhúng** (không có `xl/media/`), **không chứa phép đo vật lý**. Chỉ là danh sách file JPEG/ZIP theo timestamp (epoch ms), trạng thái đã nhận/bị hỏng, kích thước file. |
| `SAFFIRE-1/SAFFIRE-I and SAFFIRE-III DoD.docx` | docx | 65,426 | — | Metadata | Mục tiêu SAFFIRE-I/III, vật liệu SIBAL, tổ chức dữ liệu trên PSI (F1C1…S2C2), danh sách image set; **Bảng 2 (diagnostics) là hình nhúng** (đã xem trực tiếp: thermocouples, radiometers, CO2/O2/pressure sensor, anemometers, cameras, smoke wire). |
| `SAFFIRE-1/SAFFIRE-I Operations.pdf` | pdf | 13,957 | 1 | Vận hành | Saffire chạy trên Cygnus sau khi rời ISS; mẫu lớn 0.4 m × 0.94 m; giới hạn downlink 20 gigabit. |
| `SAFFIRE-1/SAFFIRE-I Image Directory Nomenclature.pdf` | pdf | 262,860 | 1 | Metadata ảnh | Quy ước thư mục ảnh: Raw_CamOriginal, Raw_DistroMaster, Raw2TIFF, …, jpeg, jpeg_corrupt, jpeg2png_icmad. |
| `SAFFIRE-1/PSI-98_metadata_PSI-166_SAFFIRE-I (1).zip` | zip | 10,031 | — | Metadata | **Trùng** với file ZIP ở thư mục gốc. DOI `10.60555/0t15-1z43`, 6 công bố. |

---

## 3. Phân loại theo vai trò

| Vai trò | File |
|---|---|
| **Dữ liệu thực nghiệm có cấu trúc** | `FLEX/...FLEX.csv`; `BASS-II/...BASS-II.csv`; `BASS-II/BASS-II Test Matrix by PI Final.xlsx`; `SAFFIRE-1/...SAFFIRE-1.csv` |
| **Dữ liệu hiệu chuẩn** | `BASS-II/Fan calibration data.xlsx` |
| **Metadata / manifest** | 3 bộ ISA-Tab `i_Investigation.txt`; `FLEX DoD.docx`; `BASS-II data FAQ.docx`; `SAFFIRE-I and SAFFIRE-III DoD.docx`; `SAFFIRE-I Image Directory Nomenclature.pdf`; `SAFFIRE-1_MergeResult-jpeg_Update_Final_v2.xlsx` (manifest ảnh) |
| **Giải thích khoa học** | `FLEX_EIRD_v4.pdf` (RRD), `FLEX_Test_Plan.pdf`, `1G17-070HE-0166.pdf`, `2G11-070HE-0310.pdf`, `20130010979.pdf`, `Cool Flames in Space…pdf`, `BASS-II Summary Report.pdf` |
| **Đặc tả kỹ thuật / vận hành** | `FLEX Engineering Requirements Document.pdf` (FLEX-2), `FLEX Overall Ext File-2.pdf`, `SRD_BASS-II.pdf`, `BASS-2 Engineering Requirements.pptx`, `BASS-II Procedure.docx`, `SAFFIRE-I Operations.pdf` |

---

## 4. Nội dung các file ZIP (đã kiểm tra trước khi quyết định giải nén)

| ZIP | Thành viên | Quyết định |
|---|---|---|
| `download.zip` | 11 file: CSV FLEX, ZIP metadata FLEX, 8 PDF FLEX, `FLEX DoD.docx` | **Không cần giải nén.** Cả 11 thành viên giống byte-for-byte với file trong `FLEX/` (đã so MD5 từng file). |
| `FLEX/PSI-69_metadata_PSI-133_FLEX.zip` | `i_Investigation.txt`, `s_PSI-69.txt` | Đã có bản giải nén giống hệt trong `FLEX/PSI-69_metadata_PSI-133_FLEX/`. |
| `BASS-II/PSI-25_metadata_…BASS-II.zip` | `i_Investigation.txt`, `s_PSI-25.txt` | Đọc trong bộ nhớ tạm (không ghi vào repo). Có giá trị: danh sách 17 công bố + DOI. |
| `PSI-98_metadata_PSI-166_SAFFIRE-I.zip` và `SAFFIRE-1/…(1).zip` | `i_Investigation.txt`, `s_PSI-98.txt` | Hai ZIP giống hệt nhau. Đọc trong bộ nhớ tạm. |

Không có ZIP nào chứa tài liệu bổ sung **mới** ngoài metadata.

---

## 5. File trùng lặp

| Nhóm | File | Bằng chứng |
|---|---|---|
| D1 | 11 thành viên của `download.zip` ↔ 11 file trong `FLEX/` | MD5 giống từng cặp (ví dụ CSV `10b423c8…`, EIRD `3e619f5a…`) |
| D2 | `FLEX/PSI-69_metadata_PSI-133_FLEX.zip` ↔ thư mục `FLEX/PSI-69_metadata_PSI-133_FLEX/` | Nội dung 2 file TXT giống byte |
| D3 | `PSI-98_metadata_PSI-166_SAFFIRE-I.zip` ↔ `SAFFIRE-1/PSI-98_metadata_PSI-166_SAFFIRE-I (1).zip` | MD5 `4737c984589e77bfa53a2e1a96d0e7d7` |
| D4 (trùng nội dung, khác file) | `FLEX_Test_Plan.pdf` ↔ trang 11–12, 44–55 của `FLEX_EIRD_v4.pdf` | Trang 1 của Test Plan ghi rõ là trích từ RRD; Bảng 6 xuất hiện ở trang PDF 46 của EIRD |
| D5 (trùng nội dung) | `BASS-II/...BASS-II.csv` ↔ `BASS-II Test Matrix by PI Final.xlsx` | 129 hàng, cùng giá trị; khác biệt duy nhất là định dạng (ngày, dấu phẩy) |
| D6 (trùng một phần) | Appendix A của `BASS-II Summary Report.pdf` ⊃ CSV BASS-II | Appendix A có thêm cột (flow direction, igniter, O2 chưa hiệu chuẩn, ghi chú quan sát…) |

**Khuyến nghị cho pipeline:** dùng `FLEX/` làm nguồn duy nhất cho FLEX, bỏ qua `download.zip`; khử trùng lặp bằng hash nội dung trước khi index vào hệ RAG (tránh chunk trùng làm lệch ranking).

---

## 6. File/trang không đọc được hoặc thiếu

### 6.1 Không có file nào lỗi parse
Tất cả 12 PDF đều trích được văn bản bằng `pdftotext` (không có lỗi trong stderr). Tất cả DOCX/PPTX/XLSX đều mở được bằng `zipfile` + XML.

### 6.2 Trang hoặc phần chỉ có hình (văn bản không trích được)
| File | Vị trí | Hệ quả |
|---|---|---|
| `SRD_BASS-II.pdf` | Trang 14–16 (test matrix của T'ien, Miller, Fernandez-Pello) | Chỉ có tiêu đề; nội dung bảng là ảnh → cần OCR nếu muốn dùng |
| `BASS-II Summary Report.pdf` | Trang PDF 8, 24, 70, 86, 88, 110, 122, 126, 128, 136, 142–145 (< 40 từ/trang) | Chủ yếu là hình/đồ thị; dữ liệu trên đồ thị (ví dụ spread rate) **không có dạng số** |
| `Cool Flames in Space…pdf` | Nhiều slide chỉ có hình | Chỉ dùng như minh họa |
| `SAFFIRE-I and SAFFIRE-III DoD.docx` | Bảng 2 là ảnh PNG nhúng | Đã đọc trực quan; cần chép tay vào metadata |
| `BASS-II Summary Report.pdf`, Appendix A | Bảng rất rộng (≈36 cột) | `pdftotext` làm **trộn dòng** giữa các test (ví dụ F3/F4) → cần trích bảng có kiểm tra thủ công |

### 6.3 Dữ liệu/tài liệu được tham chiếu nhưng **không có** trong repo
| Thiếu | Được nhắc ở đâu | Tầm quan trọng |
|---|---|---|
| Video, ảnh thô, raw/analyzed data `.txt` của FLEX | `FLEX DoD.docx` | Cao (cần cho image analysis, D(t)) |
| **NASA/TP-2015-216046** "Detailed Results from FLEX, March 2009 to December 2011" (Dietrich et al.) — báo cáo **284 test** (CSV chỉ có 274) | FLEX metadata, publication [50]; xác minh tại [NTRS 20150023456](https://ntrs.nasa.gov/citations/20150023456) | **Rất cao**: có lẽ chứa định nghĩa các cột và "Test end" |
| `BASS-II Fan Cal All days with flow estimates.xlsx` | External link trong `Fan calibration data.xlsx` | Cao: bảng ước lượng vận tốc chính thức |
| Video BASS-II (overlay fan/air/radiometer 4–5 Hz), ảnh Nikon | FAQ, Procedure | Cao cho flame spread |
| Dữ liệu cảm biến SAFFIRE-I (thermocouple, radiometer, O2, CO2, pressure, anemometer – "excel files") | `SAFFIRE-I and SAFFIRE-III DoD.docx` | **Rất cao**: đây mới là time-series thật |
| Ảnh SAFFIRE-I (JPEG/RAW/TIFF, >10.000 ảnh/set) | DoD, Nomenclature, manifest XLSX | Cao |
| "SAFFIRE Objectives, Development and Status.pdf" | DoD | Trung bình |
| `s_PSI-*.txt` (sample files) | ISA-Tab | Chỉ là placeholder `Do not use this` |

---

## 7. Ghi chú chất lượng metadata

- FLEX `i_Investigation.txt`: khối INVESTIGATION trống; email PI có lỗi chính tả (`nasa.goc`).
- SAFFIRE-I `i_Investigation.txt`: Investigation Start/End `03-02-2001` → `02-28-2008`, *Flight Platform* = ISS, *Proposal Title* = "Characterization of Smoke from Microgravity Fires…" — **mâu thuẫn** với tài liệu vận hành (Saffire-I chạy trên Cygnus sau khi rời ISS; manifest ảnh có timestamp năm 2016). Nhiều khả năng là lỗi copy metadata; cần xác minh ở nguồn PSI.
- BASS-II metadata ghi tốc độ dòng "up to 40 cm/s", trong khi Summary Report (trang PDF 12) ghi tối đa ~55 cm/s không restrictor, ~35 cm/s với 2 restrictor.

---

## 8. Kết luận kiểm kê

1. Dữ liệu định lượng **thực sự hữu dụng** gồm: FLEX CSV (274 hàng, sạch tương đối), BASS-II CSV/XLSX (129 hàng, bán cấu trúc) + Fan calibration, SAFFIRE-I CSV (2 mẫu) + manifest ảnh (chỉ metadata thời gian/downlink).
2. Tài liệu khoa học có giá trị nhất cho RAG: `BASS-II Summary Report.pdf` (144 trang), `FLEX_EIRD_v4.pdf` (RRD, 81 trang), 4 bài/slide FLEX, FAQ/DoD.
3. ~45% dung lượng repo (13 MB `download.zip`) là bản sao, có thể bỏ qua.
4. Các khoảng trống lớn nhất: báo cáo TP-2015-216046 của FLEX, dữ liệu cảm biến/ảnh của SAFFIRE-I, video BASS-II.
