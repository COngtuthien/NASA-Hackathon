# 04 — Phân tích SAFFIRE-I (Spacecraft Fire Experiment I, NASA PSI-98)

> **Nguồn:** `SAFFIRE-1/PSI-98_Experimental table_SAFFIRE-1.csv`, `SAFFIRE-1/SAFFIRE-1_MergeResult-jpeg_Update_Final_v2.xlsx` (12.3 MB, đọc **toàn bộ 12 sheet** bằng streaming XML), `SAFFIRE-I and SAFFIRE-III DoD.docx` (kể cả Bảng 2 dạng ảnh nhúng), `SAFFIRE-I Operations.pdf`, `SAFFIRE-I Image Directory Nomenclature.pdf`, metadata ISA-Tab PSI-98 (2 bản ZIP giống nhau).
> **Nhãn:** [DOC] · [CSV]/[XLSX] tính trực tiếp · [HYP] · [UNVERIFIED].

---

## 1. Bối cảnh [DOC]

- Saffire chạy trên tàu chở hàng **Cygnus** sau khi **rời ISS**, trước khi tàu tái nhập khí quyển và cháy hủy; toàn bộ dữ liệu phải downlink, tối đa **20 gigabit** (`SAFFIRE-I Operations.pdf` tr.1).
- Saffire-I và -III: **một mẫu lớn** ~0.4 m rộng × 0.94 m cao; Saffire-II: 9 mẫu nhỏ 5 × 25 cm (Operations tr.1).
- Vật liệu: **SIBAL** — cotton trên nền sợi thủy tinh (75 % cotton, 25 % fiberglass theo khối lượng) (DoD; metadata *Approach*).
- Dòng khí: **20 cm/s** cho Saffire-I (30 cm/s cho Saffire-III) (DoD).
- Mục tiêu: (1) lửa quy mô lớn tăng trưởng nhanh thế nào trong vi trọng lực và có đạt tốc độ lan truyền ổn định không; (2) so sánh giới hạn cháy vi trọng lực với phép thử sàng lọc vật liệu của NASA ở 1g (DoD; metadata *Objective*).
- Chẩn đoán (Bảng 2 của DoD, đã đọc từ ảnh nhúng): thermocouple (nhiệt độ dòng vào/ra, ngọn lửa – gắn trong mẫu, plume), **radiometer (2 nhìn mặt trước + 2 nhìn mặt sau)**, cảm biến rắn đo **CO2** (khoang avionics), **O2** (đầu vào khoang avionics), **áp suất**, **anemometer** (mỗi bên mẫu một cái), **2 camera** nhìn mặt trước, **smoke wire** ở mép trước (đánh giá độ đồng đều dòng).
  - ⚠️ Metadata ISA-Tab ghi "two radiometers", Bảng 2 ghi 4 → mâu thuẫn [DOC vs DOC].

---

## 2. CSV thực nghiệm [CSV]

Tên cột gốc (lưu ý khoảng trắng cuối ở `Sample Number ` và `Flow Direction `):

| Sample Number | Material | Sample Thickness (cm) | Sample Length (cm) | Sample Width (cm) | Air Flow (cm/s) | Percent O2 | Ignition Power (W) | Ignition Time (s) | Burn Time (s) | Flow Direction | Camera 1 | Camera 2 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S1 | SIBAL Fabric | 0.37 | 40.6 | 94 | 20 | `21.5 - 21.7` | 182 | 8 | **420** | Concurrent | S1C1 | S1C2 |
| S2 | SIBAL Fabric | 0.37 | 40.6 | 94 | 20 | `~ 21.5` | 182 | 8 | **70** | Opposed | S2C1 | S2C2 |
| F1C1/F1C2 | *Pre-test flow visulation data for sample 1* | | | | | | | | | | | |
| F2C1/F2C2 | *Pre-test flow visulation data for sample 2* | | | | | | | | | | | |

### 2.1 Số thí nghiệm thực sự
- **Chỉ có 2 lần đốt** (S1, S2). Hai hàng còn lại là **mô tả tập dữ liệu ảnh**, bị nhét vào cột `Material` → phải tách ra khỏi bảng thí nghiệm.
- S1 và S2 có cùng vật liệu, kích thước, dòng; khác **hướng lan truyền** (concurrent vs opposed) và burn time.
- Tài liệu nói Saffire-I là "một mẫu lớn" (Operations tr.1) trong khi CSV có S1, S2 riêng. Liệu S1/S2 là hai mẫu riêng hay hai lần đánh lửa trên cùng tấm vải: **không xác định được từ repo** [UNVERIFIED].

### 2.2 Vấn đề chất lượng
| Vấn đề | Bằng chứng | Kết luận |
|---|---|---|
| **Length/Width bị đảo** | CSV: Length 40.6, Width 94 cm. Operations: "approx. 0.4 m wide by 0.94 m tall"; metadata: "0.94 meters long and 0.4 meters wide" | Rất có thể hai cột bị đảo [DOC vs CSV] |
| **Nhãn F2 sai** | CSV ghi F2 = "Pre-test flow visualization … sample 2". DoD: "F1 for pre-flow and F2 for post-flow". Workbook: F2 ghi lúc 21:08:08 UTC, **sau** khi S2 kết thúc (21:06:38) | **CSV sai, DoD đúng**: F2 là post-test flow visualization [XLSX xác nhận DOC] |
| `Percent O2` dạng văn bản | `21.5 - 21.7`, `~ 21.5` | Lưu dưới dạng khoảng [min, max] + cờ `approximate` |
| Độ dày 0.37 cm (3.7 mm) cho vải | Không có tài liệu nào trong repo nêu độ dày SIBAL | Cần xác minh đơn vị [UNVERIFIED] |
| Ignition 182 W / 8 s, burn time 420 s / 70 s | Không có tài liệu nào trong repo xác nhận | Chỉ có nguồn CSV [UNVERIFIED] |
| Chính tả | "visulation" | Giữ nguyên chuỗi gốc |

### 2.3 Metadata mâu thuẫn [DOC]
`i_Investigation.txt` ghi Investigation Start/End **2001-03-02 → 2008-02-28**, *Flight Platform* "International Space Station (ISS)", *Proposal Title* "Characterization of Smoke from Microgravity Fires for Improved Spacecraft Fire Detection". Cả ba không khớp với tài liệu vận hành (Cygnus) và dấu thời gian ảnh (06/2016, xem §3). Nhiều khả năng là lỗi sao chép metadata.

---

## 3. Workbook `SAFFIRE-1_MergeResult-jpeg_Update_Final_v2.xlsx`

### 3.1 Cấu trúc [XLSX]
- Không có thư mục `xl/media/` → **không có ảnh nhúng**. Không có biểu đồ. 28 *query table* (nhập từ file văn bản danh sách file đã nhận). Đường dẫn gốc lưu trong workbook: `G:\20160614_S1_Ops_20160713\`.
- ~600,000 công thức Excel, chủ yếu dạng `IF(NOT(ISERROR(MATCH(FileName, RCVD, 0))), FileName, "")` để đánh dấu file đã nhận, và `(A − A$2)/86400000 + DATE(1970,1,1)` để đổi timestamp → thời gian trôi qua.

| # | Sheet | Kích thước (dimension) | Header (giữ nguyên) | Nội dung |
|---|---|---|---|---|
| 1 | `PreFlowVis - TimeSort` | A1:I1620 | Timestamp, Time delta, Jpeg File Name, Pre FV Received, Pre FV Rec'd Corrupt, Jpeg File size (bytes), Zip File Name, Zips Received, Zip File size (bytes) | F1 sắp theo thời gian, xen 2 camera |
| 2 | `PostFlowVis - jpeg TimeSort` | A1:I1656 | tương tự (Post FV …) | F2 |
| 3 | `Sample1 - jpeg TimeSort` | A1:I36500 | tương tự (S1 …) | S1C1 + S1C2 |
| 4 | `Sample2 - jpeg TimeSort` | A1:I36497 | tương tự (S2 …) | S2C1 + S2C2 |
| 5 | `BIT - jpeg` | A1:J1801 | Timestamp, Time delta, Jpeg File ID (hex), Jpeg File ID (decimal), Jpeg File Name, Jpeg File size (bytes), Zip File ID (hex), Zip File ID (decimal), Zip File Name, Zip File size (bytes) | Ảnh Built-In Test |
| 6 | `PreFlowVis - jpeg` | A1:M1620 | + File ID hex/decimal | F1 theo camera |
| 7 | `PostFlowVis - jpeg` | A1:M1656 | | F2 theo camera |
| 8 | `Sample1 - jpeg` | A1:M36500 | | S1 theo camera |
| 9 | `Sample2 - jpeg` | A1:M36497 | | S2 theo camera |
| 10 | `Received - jpeg` | A1:D29011 | S1 Received, S2 Received, F1 Received, F2 Received | Danh sách JPEG đã nhận |
| 11 | `Received - jpeg Corrupted` | A1:D28516 | S1/S2/F1/F2 Received Corrupted | JPEG nhận bị hỏng |
| 12 | `Received - jpeg Zips` | A1:D28517 | S1-zip … F2-zip Received | ZIP đã nhận |

Kiểu dữ liệu: timestamp và kích thước là số; tên file là chuỗi; cột trạng thái là chuỗi (rỗng nếu chưa nhận).

### 3.2 Workbook chứa gì / không chứa gì
| Loại thông tin | Có? |
|---|---|
| Phép đo vật lý đã hiệu chuẩn (nhiệt độ, O2, CO2, vận tốc, vị trí ngọn lửa) | **Không** |
| Ảnh | **Không** |
| Tham chiếu ảnh (tên file JPEG/ZIP, ID hex) | **Có** |
| Timestamp từng frame | **Có** (epoch ms trong tên file) |
| Trạng thái downlink (đã nhận / hỏng) | **Có** |
| Kích thước file JPEG | **Có** (không phải đại lượng vật lý) |

Diễn giải timestamp là **Unix epoch (ms)** được hỗ trợ bởi công thức `DATE(1970,1,1)` trong workbook và đường dẫn `20160614` [XLSX].

### 3.3 Thống kê tính được [XLSX]

| Tập / Camera | Số frame | Bắt đầu (UTC, 2016-06-14) | Thời lượng | Δt trung vị | JPEG nhận được | JPEG hỏng | ZIP nhận/liệt kê |
|---|---:|---|---:|---:|---:|---:|---|
| BIT / F1C1, F1C2, S1C1, S1C2 | 600, 600, 300, 300 | 19:07:17 – 19:08:28 | 10–20 s | 33 ms | **0 %** | 0 | 0/60 |
| PreFlowVis / F1C1 | 809 | 20:42:51 | 26.9 s | 33 ms | 94.4 % | 45 | 27/27 |
| PreFlowVis / F1C2 | 810 | 20:42:51 | 27.0 s | 33 ms | 80.7 % | 66 | 25/27 |
| **Sample1 / S1C1** | **18,124** | **20:44:58** | **604.9 s** | 33 ms | **79.4 %** | 74 | 484/605 |
| **Sample1 / S1C2** | **18,109** | 20:44:58 | 605.0 s | 33 ms | **80.4 %** | 23 | 485/603 |
| **Sample2 / S2C1** | **18,150** | **20:56:33** | 604.9 s | 33 ms | **25.1 %** | 70 | 154/605 |
| **Sample2 / S2C2** | **18,150** | 20:56:33 | 604.9 s | 33 ms | **25.4 %** | 6 | 154/605 |
| PostFlowVis / F2C1, F2C2 | 809, 810 | 21:08:08 | 27 s | 33 ms | 96 % | 31, 32 | 27/27 |

Nhận xét:
- Camera chạy ~**30 fps**; mỗi lần đốt được ghi một cửa sổ cố định **~605 s**, dài hơn burn time trong CSV (420 s, 70 s).
- ~1 ZIP mỗi giây mỗi camera (605 ZIP / 605 s). Nội dung ZIP (có thể là ảnh RAW lấy mẫu 1 Hz, theo `Raw_DistroMaster` "downlinked on command") — **chưa xác minh** [UNVERIFIED].
- **Sample 2 chỉ nhận được ~25 % JPEG** → dữ liệu ảnh của lần đốt opposed bị thiếu nghiêm trọng.
- Khung thời gian toàn bộ chiến dịch: F1 (20:42) → S1 (20:44–20:55) → S2 (20:56–21:06) → F2 (21:08), cùng một ngày.

### 3.4 Kích thước JPEG theo thời gian — chỉ là proxy chưa hiệu chuẩn [XLSX + HYP]
Trung bình kích thước file theo cửa sổ 10 s:
- S1C1: ~29.6 kB (0–10 s) → **33.5–33.9 kB (10–70 s)** → giảm dần về ~29 kB sau ~140 s.
- S2C2: ~30.5 kB (0–10 s) → **34.2–34.8 kB (10–30 s)** → ~29 kB (30–40 s) → ~27 kB về sau.

Kích thước JPEG tăng khi ảnh có nhiều chi tiết/độ sáng (ví dụ có ngọn lửa), **nhưng** cũng thay đổi theo exposure/gain (ICMAD) và nội dung nền. Đây **không phải phép đo flame spread**; chỉ dùng như tín hiệu gợi ý để chọn đoạn ảnh cần tải về, và phải ghi rõ là `proxy, uncalibrated`.

### 3.5 Liên kết với CSV
| CSV | Workbook |
|---|---|
| `Sample Number` S1 / S2 | Sheet `Sample1 …` / `Sample2 …` |
| `Camera 1`/`Camera 2` = S1C1, S1C2, S2C1, S2C2 | Tiền tố tên file `S1C1-<epoch_ms>.jpeg` … |
| Hàng F1C1/F1C2, F2C1/F2C2 | Sheet `PreFlowVis`, `PostFlowVis` |
| Thư mục ảnh trên PSI | Quy ước `Xn_jpeg`, `Xn_jpeg_corrupt`, `Xn_Raw_DistroMaster`… (Nomenclature PDF) với X = loại run, n = số run |

⚠️ DoD Bảng 1 liệt kê bản ghi PSI `S1C1, S1C2, S2C2` (**không có S2C1**), trong khi CSV và workbook đều có S2C1 → có thể bản ghi PSI của S2C1 bị thiếu [UNVERIFIED].

### 3.6 Workbook có hỗ trợ phân tích flame spread mà không cần ảnh thô?
**Không.** Workbook chỉ cho biết **khi nào** có frame và frame nào đã về. Để đo vị trí mép ngọn lửa, chiều dài, diện tích cháy, tốc độ lan truyền, cần ảnh (tốt nhất là `Jpeg_Mapped` hoặc `Raw2TIFF_Mapped` đã hiệu chỉnh méo theo DoD Bảng 3) và lưới hiệu chuẩn `DistortionGrids_Sample_ROI`.

---

## 4. Hành vi lan truyền ngọn lửa được báo cáo

- **Trong repo không có tài liệu kết quả nào** mô tả tốc độ lan truyền, kích thước ngọn lửa hay kết cục của Saffire-I. Chỉ có: burn time trong CSV (S1 = 420 s concurrent; S2 = 70 s opposed) và mục tiêu nghiên cứu.
- Metadata liệt kê các công bố liên quan (chỉ có tiêu đề/DOI, **không có nội dung** trong repo):
  - Urban et al., "Flame spread: Effects of microgravity and scale", *Combustion and Flame* (DOI 10.1016/j.combustflame.2018.10.012).
  - Li et al., "Transient flame growth and spread processes over a large solid fabric in concurrent low-speed flows in microgravity – Model versus experiment", *Proc. Combust. Inst.* (DOI 10.1016/j.proci.2018.05.168).
  - Jomaas et al., "Fire safety in space – beyond flammability testing of small samples", *Acta Astronautica* (DOI 10.1016/j.actaastro.2014.11.025).
  - Ruff & Urban, "Operation and Development Status of the Spacecraft Fire Experiments (Saffire)" (NTRS 20170000230), Schoren/Ruff/Urban "Objectives, Development and Status" (NTRS 20170001636).
- ➡️ Mọi phát biểu định lượng về hành vi flame spread của Saffire-I hiện là **[UNVERIFIED]** đối với repo này; cần tải các bài trên vào kho tài liệu trước khi hệ thống được phép trả lời.

---

## 5. Mức độ phù hợp

| Nhiệm vụ | Đánh giá | Lý do |
|---|---|---|
| **A. Trực quan hóa flame spread** | ⚠️ Chỉ sau khi tải ảnh | Hiện chỉ vẽ được **timeline thu thập/downlink** (frame theo thời gian, % nhận, khoảng trống). Với ảnh: S1 có ~14,400 JPEG/camera; S2 chỉ ~4,600 |
| **B. Phân tích time-series** | ❌ Hiện tại | Time-series cảm biến (TC, radiometer, O2, CO2, P, anemometer) **không có** trong repo; chỉ có timestamp frame và kích thước JPEG (proxy) |
| **C. Phân tích tiến triển lửa từ ảnh** | ⚠️ Khả thi kỹ thuật nếu tải ảnh | Cần ảnh đã hiệu chỉnh méo, ngưỡng hóa/segmentation, xử lý 20–75 % frame thiếu, exposure/gain thay đổi |
| **D. Case study khoa học** | ✅ Có (định tính) | Câu chuyện "fire quy mô lớn đầu tiên trong vi trọng lực trên tàu không người lái", so sánh concurrent vs opposed, nối với SIBAL của BASS-II (cùng vật liệu, quy mô nhỏ) |
| **E. Mô hình dự đoán** | ❌ Không | n = 2 lần đốt; không có biến mục tiêu định lượng ngoài burn time |

---

## 6. Tóm tắt

1. SAFFIRE-I trong repo = **2 lần đốt** + **manifest ~78,000 frame** (không có ảnh, không có phép đo).
2. Workbook có giá trị như **chỉ mục dữ liệu**: liên kết CSV ↔ tên file ảnh ↔ timestamp ↔ trạng thái downlink; cho phép lập kế hoạch tải ảnh có mục tiêu.
3. Phát hiện lỗi: Length/Width đảo, nhãn F2 sai (là post-flow), metadata ngày/nền tảng sai, mâu thuẫn số radiometer, thiếu bản ghi PSI S2C1.
4. Dùng tốt nhất cho **case study có trích dẫn**, không cho ML.
