# 03 — Phân tích BASS-II (Burning and Suppression of Solids II, NASA PSI-25)

> **Nguồn:** `BASS-II/PSI-25_Experimental table_BASS-II.csv` (đọc toàn bộ 129 hàng), `BASS-II Test Matrix by PI Final.xlsx` (6 sheet), `Fan calibration data.xlsx`, `BASS-II data FAQ.docx`, `BASS-II Procedure.docx`, `BASS-II Summary Report.pdf` (NASA/TM-20210011385, 144 trang), `SRD_BASS-II.pdf`, `BASS-2 Engineering Requirements.pptx`, metadata ISA-Tab PSI-25.
> **Nhãn:** [DOC] tài liệu (file, trang PDF) · [CSV] tính từ dữ liệu · [HYP] giả thuyết · [UNVERIFIED] không kiểm chứng được.
> **Quy ước trang Summary Report:** "SR p.N" = trang PDF N; trang in = N − 8 (ví dụ SR p.15 = trang in 7).

---

## 1. Bối cảnh thí nghiệm [DOC]

- Ống dẫn dòng nhỏ 7.6 × 7.6 × 17 cm đặt trong **Microgravity Science Glovebox (MSG)** trên ISS; quạt tốc độ thay đổi; 0–2 **flow restrictor** để giảm lưu lượng; đầu dò vận tốc đa hướng TSI 8475 (thời gian đáp ứng ~1 phút); thermopile radiometer chưa hiệu chuẩn; camera video có overlay (N2 flow, fan voltage, air velocity, radiometer) và máy ảnh Nikon D300s 12.3 MP (SR p.12–13).
- Vận tốc tối đa ~55 cm/s (0 restrictor), ~35 cm/s (2 restrictor) (SR p.12). ⚠️ Metadata ISA-Tab ghi "up to 40 cm/s" → mâu thuẫn nhỏ.
- O2 được **giảm bằng cách pha loãng thể tích làm việc MSG (250 L) bằng GN2**, mất 1–3 giờ; mô hình CSTR dùng để tính thời gian xả (SR p.14, App. B).
- O2/CO (CSA-CP) và CO2 (CDM) được đọc **trước và sau mỗi lần cháy** — chỉ 2 điểm, không phải time-series (SR p.14; Procedure bước 8.5, 9.11).
- Giả thuyết: vật liệu trong vi trọng lực, với thông gió đủ, cháy tốt bằng hoặc hơn trên Trái Đất (SR p.11; SRD tr.9).
- Báo cáo nêu **126 test** đã thực hiện (SR p.11); CSV có **129 hàng** (chênh 3 – có thể do cách đếm a/b hoặc test không đánh lửa) [UNVERIFIED].

---

## 2. Cấu trúc dữ liệu [CSV]

129 hàng × 17 cột; không có `Test #` trùng; 107 mẫu khác nhau, **20 mẫu được dùng nhiều lần** (ví dụ `220m` ×3, `144m` ×3, hậu tố `a`/`b` trong Test # như `O3a`/`O3b`).

| PI | Số hàng | Vật liệu chính | Hình học/chế độ dòng (FAQ) |
|---|---:|---|---|
| T'ien | 29 | SIBAL fabric 1 cm/2 cm (75/25 cotton/fiberglass) + 2 test cầu PMMA 4 cm | Concurrent (mẫu phẳng); cầu = stagnation |
| Olson | 27 | Thanh PMMA (chủ yếu trong suốt) 1/4", 3/8", 1/2" | Đánh lửa đầu thượng lưu → stagnation/concurrent |
| Fernandez-Pello | 27 | Thanh PMMA (chủ yếu đen) | Đánh lửa đầu hạ lưu → opposed |
| Bhattacharjee | 22 | Màng PMMA mỏng 0.1–0.4 mm, rộng 1–2 cm | Opposed |
| Miller | 20 | Tấm PMMA dày 1–5 mm, 1 mặt / 2 mặt | Opposed |
| Ferkul | 4 | Nomex III (3), nến sáp Japan wax (1) | Concurrent / stagnation |

### 2.1 Từ điển cột (tên gốc) và chất lượng

| Cột gốc | Ý nghĩa [DOC: FAQ] | Số ô thuần số | Ghi chú chất lượng [CSV] |
|---|---|---:|---|
| `PI` | Nhà nghiên cứu chính | – | 6 giá trị |
| `Test #` | Chữ cái đầu PI + số trong ma trận ban đầu; `a`/`b` = nhiều lần chạy cùng mẫu cùng ngày | – | Duy nhất |
| `Date` | Ngày thực tế. "Video display is one day later … due to a leap year the on-board computer did not account for" | – | **T9, T18 ghi năm 2018** (GMT 175 → đúng ra 24/6/**2014**); O20–O22 năm 2016 (hợp lệ, SR ghi "last 3 tests from 2016") |
| `GMT` | **Ngày trong năm (day-of-year)**, *không phải giờ* | 129 | **O10**: ngày 7/22/2014 (= DOY 203) nhưng GMT = **213** → mâu thuẫn |
| `Sample #` | Mã mẫu; hậu tố `m`/`M`/`L` không có giải thích | – | Hoa/thường lẫn lộn (`205M`, `205m`?) [UNVERIFIED] |
| `Fuel Sample Material` | Mô tả tự do | – | **51 chuỗi khác nhau** cho 8 lớp vật liệu (xem §3) |
| `Flow restrictor` | 0 = lưu lượng cao nhất, 2 = thấp nhất | 129 | 2: 101, 1: 16, 0: 12 |
| `Fan display` | "Instantaneous fan voltage×10 on the video display. Maximum was 122 (12.2 V). Also listed sometimes are pot settings on the control box. 10 is max." | **19** | 13 rỗng, 97 là chuỗi nhiều giai đoạn trộn **hai thang khác nhau** (volt×10 và pot 0–10), ví dụ `"49   46.5   44 … (1.3   1.0   0.7 …)"` |
| `Air display` | "Flow speed measured in the duct in cm/s … response time very slow (~1 min)" | **25** | Chuỗi như `"5 down to ext"`, `"10   blowoff"`, `"2  0  2  0  etc"`, `"no ign at any flow"` |
| `Radiometer gain   (1000   250   50   10)` | Gain chưa hiệu chuẩn, chỉnh để tránh bão hòa | 110 | 19 chuỗi đổi gain giữa chừng (`250>50>250`) |
| `Total Frames Shot` | Số ảnh Nikon (gồm ảnh sau cháy) | 123 | `video` ×3, `none`, `300+   +102`, `10 postburn only` |
| `Calibrated  initial O2 % by vol ` | O2 đã hiệu chỉnh offset theo MCA | 129 | 13.6 – 22.2 % (chú ý **2 khoảng trắng** và khoảng trắng cuối trong tên cột gốc) |
| `Calibrated final O2 % by vol` | | 127 | `none` ×2; **5 giá trị phi vật lý** (§5) |
| `Initial CO2 % by vol` | CDM | 127 | `none` ×2 |
| `Final CO2 % by vol` | | 123 | `none` ×5, rỗng ×1 |
| `Initial CO (ppm)` | CSA-CP | 126 | `none` ×2, `OR` (over range > 1000 ppm); **13 giá trị âm** (−1 … −3) |
| `Final CO (ppm)` | | 120 | `none` ×4, `OR` ×2, `>500`, `over`, rỗng |

### 2.2 Thông tin **có trong tài liệu nhưng không có trong CSV**
Bảng Appendix A của Summary Report (SR p.111–121) có thêm: thời gian bắt đầu/kết thúc, **as-run test number** (thứ tự thời gian 1–126), loại igniter, **hướng dòng (Opposed / Concurrent / Stagnation)**, khoảng cách mẫu, GN2 pot/display, thông số máy ảnh, **O2 chưa hiệu chuẩn**, và cột **"Test observations and anomalies (ignited, spread, extinguished, burn time, color, etc.)"** — đây là **nguồn duy nhất về kết cục** (ví dụ: "extinguished at pot 0.35", "flame blew out at a fan pot of 7.0", "no ign at any flow", "Ignited briefly but did not spread").
⚠️ Khi trích bằng `pdftotext`, các hàng của bảng rất rộng này bị **trộn lẫn** (ví dụ hàng F3 và F4 ở SR p.113) → cần trích bảng có kiểm tra thủ công.

### 2.3 Các bảng số liệu có cấu trúc khác trong Summary Report (giá trị cao, chưa có trong CSV)

| Bảng | Trang | Nội dung | Liên kết với CSV |
|---|---|---|---|
| **Table 5.1** (Miller, 20 test) | SR p.65 (trang in 57) | Độ dày (mm), rộng (cm), 1/2 mặt, **vận tốc từng giai đoạn (cm/s)**, **spread rate từng giai đoạn (mm/s)** (ví dụ M7: 10/6/5/3 cm/s → 0.106/0.099/0.083/0.07 mm/s), **burn time (phút)**, O2 đầu/cuối | Khớp chính xác theo `Test #` M1–M20. ⚠️ Cột bị lệch khi trích văn bản → cần đối chiếu thủ công |
| **Table 7.1** (T'ien, SIBAL) | SR p.104 (trang in 96) | Rộng mẫu, dòng (ví dụ "10 to 2.2"), O2, **nhận xét kết cục chuẩn hóa**: *Quenched*, *No ignition*, *Blow-off*, *No blowoff*, *Reused, did not ignite* | Khớp `Test #` dạng `GMT175-T9`. Cho biết **T9, T10, T12, T23, T28a, T28b không bắt lửa** → ΔO2 của các test này không mang thông tin cháy; T28a/b final O2 (0.9/40.4) chắc chắn là lỗi ghi |
| ⚠️ Xung đột ID | SR p.104 | 4 test **BASS (I)** cũ cũng mang tên T7, T8, T10, T11 (`GMT96-T8`, `GMT131-T10`…) | ➡️ Khóa phải gồm investigation + GMT + Test #, không chỉ Test # |
| **Table 2.1** | SR p.36 | Vận tốc opposed tới hạn Vg,cr cho PMMA mỏng ở 1 atm: 21 % O2 → thực nghiệm **10 ± 5 mm/s**, tính toán 15, lý thuyết 7.5; 16 % O2 → **30 ± 5**, 35, 10 mm/s | Tổng hợp từ nhiều test Bhattacharjee |
| Table 4.2 | SR p.56 | Khoảng O2 và vận tốc theo đường kính thanh (Fernandez-Pello) | Tổng hợp |
| Table D.2 | SR p.136 | Burn duration "Test 18–21" (1:40, 0:50, 1:15, 1:40) | Không rõ hệ đánh số (as-run?) → [UNVERIFIED] |

➡️ Với Table 5.1 và 7.1, BASS-II có **~49 test có kết cục/đại lượng số có cấu trúc** (20 Miller + 29 T'ien), đủ cho truy xuất bằng chứng và phân tích mô tả, vẫn **không đủ** cho ML tổng quát.

---

## 3. Vật liệu, hình học, độ dày

| Lớp chuẩn hóa | n | Cách viết gốc (ví dụ) | Thông số hình học trích được |
|---|---:|---|---|
| PMMA thin film | 22 | `100 micron PMMA film   2 cm wide`, `2 cm   0.2 mm PMMA film`, `200 micron  2 cm wide `, `2 cm   0.4 mm thick film` | Độ dày 0.1/0.2/0.3/0.4 mm (µm và mm lẫn lộn); rộng 1 hoặc 2 cm |
| PMMA slab | 20 | `3 mm thick PMMA   2 sided   2 cm thick` (*"2 cm thick" thực ra là rộng*), `4 mm thick   2 cm 2ide PMMA slab` (lỗi gõ) | Dày 1–5 mm; rộng 1/2 cm; 1 mặt / 2 mặt (thường chỉ ghi khi 1 sided) |
| PMMA rod clear | 28 | `1/4" clear rod`, `3/8"clear rod`, `1/2" clear PMMA rod`, `1/4 clear rod` | Đường kính 6.35 / 9.525 / 12.7 mm |
| PMMA rod black | 26 | `1/4" black rod`, `1/4 blac rod`, `0.5" black rod` | như trên |
| PMMA sphere | 2 | `4 cm spherical section` | Đường kính 4 cm |
| SIBAL fabric | 27 | `2 cm SIBAL`, `SIBAL 2 cm`, `2 cm Sibal   moved igniter`, `1 cm SIBAL   top side ign` | Rộng 1/2 cm (SR p.101 ghi chính xác 1.2 và 2.2 cm, dài 10 cm) — **ghi chú vận hành bị lẫn vào tên vật liệu** |
| Nomex III | 3 | `Nomex natural (nomex III)` | – |
| Japan wax candle | 1 | `Japan Wax candle` | – |

➡️ Cần một bước **chuẩn hóa vật liệu** có kiểm tra bằng tay: tách `material`, `color`, `geometry`, `thickness_mm`, `diameter_mm`, `width_cm`, `sides`, `operational_note`, giữ nguyên chuỗi gốc.

---

## 4. Dòng khí, quạt và hiệu chuẩn

### 4.1 Ý nghĩa các biến dòng [DOC]
- `Fan display` = điện áp quạt × 10 (38 ≈ 3.8 V ≈ quạt tắt; 122 = 12.2 V tối đa). `pot` = núm chỉnh 0–10 trên hộp điều khiển.
- `Air display` = **vận tốc đo thực tế** (cm/s) bởi đầu dò trong ống, đáp ứng ~1 phút → chỉ đúng khi giữ cùng một cài đặt lâu.
- Fan voltage được hiệu chuẩn với đầu dò **vào cuối mỗi ngày vận hành** (SR p.13; Procedure bước 11).

### 4.2 Nội dung `Fan calibration data.xlsx` [CSV từ XLSX]
- 27 khối theo ngày (GMT 2014-043 … 2014-216); mỗi khối có bảng Pot → Fan Display → Air Display cho 0, 1 và 2 restrictor (nhiều khối chỉ đo restrictor đang dùng hôm đó). Ghi chú: "Some days we ran out of time before the fan cal could be complete" và "the fan turns off at a finite voltage (above 3.8 volts), so it is recommended to not use the 3.8 volts zero flow value."
- **Pot → Fan display là hàm xác định** (10→122, 8→105/105.5, 6→88.5, 4→72, 2→55, 1→46.5/47, 0.5→42, 0→38).
- **Fan display → Air display thay đổi mạnh theo ngày và số restrictor.** Ví dụ pot 10, 2 restrictor: 18 (cột ví dụ), 22 (GMT 45), 31 (GMT 49), 34.5 (GMT 91, sau sửa cửa), 38 (GMT 175), 27 (GMT 188 sau làm sạch soot), 40 (GMT 202), 20–22 (GMT 209–210). Một số khối được đánh dấu "post soot cleaning", "door repair" → hiệu suất ống thay đổi theo bụi soot và rò rỉ.
- Công thức mẫu (cột 5): `U cm/s* = 1.0066 × AIR`, chú thích "Based on SPICE fan calibration data at 56 mm downstream, 36 mm from bottom (centerline)". → Hiệu chỉnh từ chỉ số đầu dò sang vận tốc tại **một vị trí cụ thể** trong ống.
- External link tới `BASS-II Fan Cal All days with flow estimates.xlsx` (**không có** trong repo) — có lẽ là bảng ước lượng vận tốc chính thức.

### 4.3 Có thể chuyển fan setting → vận tốc không?
| Trường hợp | Khả năng | Phương pháp hợp lệ |
|---|---|---|
| `Air display` là số đơn (25 hàng) | **Có** | U ≈ 1.0066 × Air display (chỉ hợp lệ ở trạng thái ổn định ≥ 1 phút) |
| `Fan display`/pot là số đơn, có khối hiệu chuẩn **cùng ngày, cùng số restrictor** | **Có, có điều kiện** | Nội suy tuyến tính trong bảng ngày đó → Air → ×1.0066; gắn cờ `derived_from_same_day_calibration` |
| Không có hiệu chuẩn cùng ngày | **Không nên** | Các ngày test **không có** khối hiệu chuẩn: GMT 51, 164, 167, 204, 211 (2014) và GMT 57 (2016). Dùng ngày lân cận = giả định, phải gắn cờ `calibration_borrowed` |
| Chuỗi nhiều giai đoạn | Chỉ tách được **danh sách cài đặt**, **không** có thời điểm từng giai đoạn | Thời điểm chỉ có trong video overlay (không có trong repo) |
| Vận tốc rất thấp (< ~2 cm/s), pot < 1 | Rất không chắc chắn | SR p.21: "significant uncertainties … as the calibration at such low velocity has high error bars"; quạt tắt ở điện áp hữu hạn |

➡️ **Không được** coi mọi giá trị Fan display là vận tốc. Mọi vận tốc suy ra phải là `derived`, kèm nguồn hiệu chuẩn và bất định.

---

## 5. Khí O2, CO2, CO

### 5.1 Đặc tính cảm biến [DOC: SR p.14; FAQ]
- O2 (CSA-CP): không hiệu chuẩn lại trên quỹ đạo → hiệu chỉnh **offset hằng số theo ngày** bằng MCA; độ phân giải **0.1 % O2**.
- CO (CSA-CP): zero-calibrate mỗi 60 ngày; 0–1000 ppm; độ phân giải 1 ppm; `OR` = > 1000 ppm.
- CO2 (CDM): 0–5 %, độ phân giải **0.1 %** — nhưng CSV ghi 2 chữ số thập phân (0.44, 0.51) → **độ chính xác hiển thị cao hơn độ phân giải danh định** [DOC + CSV]; ΔCO2 < 0.1 % nằm dưới độ phân giải.
- Giá trị đo là của **không khí trộn đều trong thể tích làm việc MSG 250 L**, không phải tại ngọn lửa.

### 5.2 Kiểm tra tính nhất quán [CSV]
- **Chuỗi nối tiếp:** trong cùng ngày, giá trị *initial* của test sau thường bằng *final* của test trước (38/129 test có Initial CO trùng với một Final CO cùng ngày, ví dụ T3 final CO 113 → T12 initial 113 → T12 final 117 → T14 initial 117). ➡️ Các test **không độc lập**: khí quyển bị suy giảm tích lũy cho tới khi purge (Procedure: purge sau mỗi 10 lần đốt).
- **O2 tiêu thụ vs CO2 sinh ra:** trên 120 test có đủ số liệu và ΔO2 < 3 %: Pearson **r = 0.977**; hệ số góc qua gốc ΔCO2/ΔO2 = **0.81** (n = 121).
  - Theo vật liệu (chỉ test có ΔO2 > 0.2): thanh PMMA đen 0.80 (n=19), thanh PMMA trong 0.82 (n=21), tấm PMMA 0.79 (n=19).
  - Phương trình PMMA C5H8O2 + 6 O2 → 5 CO2 + 4 H2O cho tỷ lệ **5/6 = 0.833** (SR p.14, Eq. 1.1). ➡️ Dữ liệu CSV tái lập kết luận "O2 burning nearly stoichiometrically to CO2" của báo cáo (SR p.10, p.15) [CSV xác nhận DOC].
  - Màng mỏng (Bhattacharjee): tỷ lệ 0.47 nhưng chỉ 5 test có ΔO2 > 0.2; đa số ΔO2 ≈ 0–0.1 (dưới độ phân giải).
  - SIBAL và Nomex: ΔO2 median = 0 → mẫu nhỏ, cháy ngắn, hoặc không cháy (Nomex: "The three Nomex samples did not ignite", SR p.54).
- **CO âm** (−1…−3 ppm, 13 ô): trôi điểm 0 của cảm biến; giữ nguyên, gắn cờ `sensor_zero_offset`, **không** đặt bằng 0.

### 5.3 Giá trị phi vật lý / đáng ngờ [CSV]
| Test | Initial O2 | Final O2 | Vấn đề |
|---|---:|---:|---|
| B2 | 22.2 | **1.6** | Không thể giảm 20 điểm % O2 trong 250 L do một màng PMMA nhỏ; Appendix A: "No stills taken, cable came loose" |
| P22a / P22b | 20.8 / 20.0 | **0.6 / 39.1** | Phi vật lý (O2 không thể tăng lên 39 %); P22a final CO2 = none |
| T28a / T28b | 20.7 / 20.7 | **0.9 / 40.4** | Mẫu hình giống P22: có thể là lỗi ghi chép (đảo cột/đọc nhầm) [HYP] |
| M5 | 22.2 | 19.0 | Hợp lệ: đây là test cháy lâu làm hỏng cửa (ΔCO2 2.78 %, CO > 500) — khớp "outlier at 2.8 percent CO2 … CO sensor over-ranged" (SR p.15) và Anomaly #1 ngày GMT 51 (SR p.127) |
| B14, F3 | – | `none` | Không có đọc sau cháy (F3: "no postburn sensor readings taken", SR p.113) |

### 5.4 Khi nào nồng độ khí **không** diễn giải được?
- Khi không biết **thời gian cháy** (không có trong CSV) → không tính được HRR (báo cáo dùng O2 consumption calorimetry 13.1 kJ/g O2 + burn time; SR p.16, Fig. 1.6).
- Khi nhiều giai đoạn dòng trong một test → ΔO2 là **tổng tích phân** của mọi giai đoạn, không gán được cho một vận tốc cụ thể.
- Khi test nối tiếp chưa purge → nồng độ ban đầu đã bị pha sản phẩm cháy của test trước (đặc biệt CO).
- Khi ΔO2 hoặc ΔCO2 ≤ độ phân giải (0.1 %).
- CO được bộ lọc MSG chuyển thành CO2 trong lúc purge (SR p.11, p.16) → giá trị sau purge không phản ánh một test.

---

## 6. Thiết lập nhiều giai đoạn (multi-stage)

- **[CSV]** **112/129 hàng (87 %)** có Fan display hoặc Air display dạng chuỗi văn bản (đa số là nhiều giá trị). Quy trình chuẩn: đánh lửa ở dòng vừa phải, rồi **giảm dần** dòng cho tới tắt (quenching), hoặc **tăng dần** cho tới blowoff (SRD tr.12–13; SR p.56, p.72).
- **[DOC]** Hai cơ chế tắt: *quenching* ở dòng rất thấp (ngọn lửa co lại thành bán cầu xanh, dao động 1.1 Hz trước khi tắt) và *blowoff* ở dòng cao (lỗ thủng ở vùng stagnation) (SR p.97).
- ➡️ Một hàng CSV = **một mẫu với một chuỗi điều kiện**, không phải một điểm điều kiện. Đơn vị phân tích đúng là **(test, giai đoạn)**, nhưng thời điểm giai đoạn không có trong repo.

---

## 7. Kết cục thí nghiệm theo tài liệu [DOC]

| Kết quả | Nguồn |
|---|---|
| Vận tốc dòng opposed tới hạn cho radiative extinction **không phụ thuộc độ dày** màng PMMA (~1 cm/s cho 100–300 µm; ~1.5 cm/s cho 400 µm), tăng khi O2 giảm; có công thức đóng | SR p.21, p.36 |
| Hệ số de Ris F = 4.76 (21 % O2); độ dày chuyển tiếp thin/thick cho PMMA ≈ 5.2 mm | SR p.52 |
| Nomex III không bắt lửa (3 mẫu); nến sáp cháy ở 5 vận tốc, bắn giọt sáp nóng chảy | SR p.54 |
| Thanh PMMA đen opposed: không duy trì lan truyền dưới ~4 mm/s (rod 6.35 và 9.525 mm); spread rate tăng theo vận tốc và O2 | SR p.56 |
| Tấm PMMA: cháy 2 mặt nhanh hơn 1 mặt; dày hơn → chậm hơn; mô hình dự đoán spread rate cao hơn thực nghiệm | SR p.71 |
| Thanh PMMA concurrent: thời gian trễ đánh lửa tăng mạnh gần giới hạn O2; ngọn lửa toàn cục stoichiometric ở O2 cao, giàu nhiên liệu gần giới hạn; biên flammability hình chữ U; blowoff khớp drop tower 5.18 s | SR p.72, p.97 |
| SIBAL concurrent: vận tốc quenching 1–5 cm/s, cao hơn khi O2 thấp | SR p.101, p.109 |
| CO/CO2 cao hơn khí thải hiệu quả một bậc; HRR phần lớn < 100 W; global equivalence ratio ≈ 1.3 (giàu nhiên liệu) | SR p.10, p.16, p.19 |

⚠️ Các **spread rate**, **vận tốc extinction**, **biên flammability** chỉ có trong **đồ thị** (ảnh) của báo cáo, **không có dạng số** trong repo.

---

## 8. Mức độ phù hợp cho từng nhiệm vụ

| Nhiệm vụ | Khả thi? | Điều kiện / Lý do |
|---|---|---|
| **A. So sánh cháy giữa vật liệu** | ⚠️ Chỉ mô tả | Mỗi PI = một lớp vật liệu + một quy trình + một hình học + một hướng dòng → **nhiễu chéo hoàn toàn** (confounding). So sánh hợp lệ chỉ **trong cùng PI** (ví dụ thanh đen vs trong cùng đường kính; độ dày màng). Có thể so ΔO2/ΔCO2/CO-per-CO2 theo hình học như báo cáo đã làm. |
| **B. Phân tích tiêu thụ O2** | ✅ Có | ΔO2 = initial − final (giới hạn độ phân giải 0.1 %), loại 5 giá trị phi vật lý, xử lý chuỗi nối tiếp. Tái lập được Fig. 1.3. |
| **C. Thay đổi CO và CO2** | ✅ Có (có cảnh báo) | ΔCO2/ΔO2 so với stoichiometry; CO/CO2 theo hình học (SR p.15–17). Cần cờ `OR`, giá trị âm, test nối tiếp. HRR **không** tính được nếu không có burn time. |
| **D. Truy xuất bằng chứng extinction** | ✅ Có — **giá trị cao** | Nguồn: cột quan sát Appendix A + các chương PI. Cần trích bảng có kiểm tra thủ công (~129 hàng, ước 3–4 giờ) để tạo nhãn: `ignited`, `extinction_mode` (quench/blowoff/none/no-ignition), `last_flow_setting_before_ext`. |
| **E. Tìm thí nghiệm tương tự** | ✅ Có | Đặc trưng: lớp vật liệu, hình học, kích thước, hướng dòng (từ Appendix A), O2 ban đầu, restrictor, PI. |
| **F. Dự đoán ML** | ❌ Không bảo vệ được | Không có biến mục tiêu số nhất quán; 129 hàng nhưng ~10 cấu hình khác nhau; điều kiện đa giai đoạn không có mốc thời gian; nhãn kết cục chỉ ở dạng văn bản tự do. Một bộ phân loại "có bắt lửa / không" sẽ có quá ít mẫu âm (Nomex 3, O12 1, F-series…). |

### Cần dữ liệu thô nào để mở khóa thêm?
- **Video overlay** (fan V, air velocity, radiometer ở 4–5 Hz) → time-series dòng và cường độ ngọn lửa, thời điểm extinction.
- **Ảnh Nikon 1 fps** → spread rate, chiều dài ngọn lửa.
- File hiệu chuẩn "All days with flow estimates".
- Dữ liệu số đằng sau các đồ thị trong Summary Report (ví dụ flame spread rate theo vận tốc/O2).

---

## 9. Cờ chất lượng đề xuất

`date_year_typo` (T9, T18) · `gmt_date_mismatch` (O10) · `final_o2_unphysical` (B2, P22a, P22b, T28a, T28b) · `sensor_zero_offset` (CO âm) · `co_over_range` · `below_sensor_resolution` (|ΔO2| ≤ 0.1, |ΔCO2| ≤ 0.1) · `chained_atmosphere` · `multi_stage_flow` · `mixed_fan_scale` (volt×10 vs pot) · `no_same_day_calibration` · `material_text_normalized` · `outcome_from_appendix_text` · `sample_reused`.

---

## 10. Tóm tắt

1. BASS-II CSV là **bản ghi vận hành bán cấu trúc**, không phải bảng đo lường sạch: chỉ 19/129 Fan display và 25/129 Air display là số đơn.
2. Phần **định lượng đáng tin nhất** là cặp O2/CO2 trước–sau: nhất quán vật lý rất tốt (r = 0.977, ΔCO2/ΔO2 ≈ 0.81 so với 0.833 lý thuyết cho PMMA).
3. Chuyển đổi fan → vận tốc **chỉ hợp lệ** với hiệu chuẩn cùng ngày/cùng restrictor, và vẫn là đại lượng suy ra.
4. Kết cục (tắt/blowoff/không cháy) nằm trong **văn bản tự do** của Summary Report → phù hợp RAG + trích xuất có kiểm duyệt, không phù hợp ML trực tiếp.
5. Giá trị lớn nhất cho SpaceFire AI: **truy xuất bằng chứng có trích dẫn** và **phân tích khí stoichiometric** có minh họa.
