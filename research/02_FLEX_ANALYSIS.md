# 02 — Phân tích FLEX (Flame Extinguishment Experiment, NASA PSI-69)

> **Nguồn dữ liệu chính:** `FLEX/PSI-69_Experimental table_FLEX.csv` (đọc toàn bộ 274 hàng).
> **Tài liệu đối chiếu:** `FLEX_EIRD_v4.pdf` (Research Requirements Document – RRD, 2005), `FLEX_Test_Plan.pdf`, `FLEX Engineering Requirements Document.pdf` (thực chất là FLEX-2 ERD), `FLEX Overall Ext File-2.pdf`, `1G17-070HE-0166.pdf`, `2G11-070HE-0310.pdf`, `20130010979.pdf`, `Cool Flames in Space…pdf`, `FLEX DoD.docx`, `i_Investigation.txt`.
> **Quy ước nhãn độ tin cậy:**
> - **[DOC]** = được tài liệu trong repo nêu rõ (kèm file + trang PDF).
> - **[CSV]** = tính trực tiếp từ CSV (có thể tái lập).
> - **[HYP]** = giả thuyết khoa học hợp lý, chưa được tài liệu xác nhận.
> - **[UNVERIFIED]** = không thể kiểm chứng bằng dữ liệu hiện có.
>
> Số trang = số trang PDF (không phải số in trên trang), trừ khi ghi "trang in".

---

## 1. Cấu trúc file

| Thuộc tính | Giá trị |
|---|---|
| Số hàng (thí nghiệm) | **274** [CSV] |
| Số cột | **15** [CSV], mọi hàng đủ 15 trường |
| Encoding | **cp1252** (không phải UTF-8). Byte `0x96` = ký tự `–` (en dash) xuất hiện **34 lần**, dùng như ký hiệu "không có giá trị". Nếu đọc bằng UTF-8 sẽ thành `�`. |
| Khoảng thời gian | 2009-03-05 → 2011-12-08 [CSV] |
| Định dạng ngày | Lẫn lộn `m/d/yyyy` (224 hàng) và `m/d/yy` (50 hàng) [CSV] |
| Thứ tự | `FLEX Test #` 1→274 liên tục, nhưng **8 vị trí** ngày không đơn điệu theo `Test #` (ví dụ #52 `210F002`, #71, #91, #104, #107, #115, #147, #165) [CSV] |

### 1.1 Từ điển cột (giữ nguyên tên gốc)

| # | Tên cột gốc | Kiểu suy ra | Giá trị rỗng | Ký hiệu phi số | Phạm vi / phân bố | Ý nghĩa vật lý & đơn vị |
|---|---|---|---:|---|---|---|
| 0 | `FLEX Test #` | int | 0 | – | 1–274, duy nhất | Số thứ tự trong bảng |
| 1 | `FLEX Identifier` | string | 0 | – | 273 giá trị khác nhau; **`193F001` lặp 2 lần** | Mã test (xem §3) |
| 2 | `Test Date` | date (text) | 0 | – | 80 ngày khác nhau | Ngày thí nghiệm |
| 3 | `Test GMT` | time (text) | **1** (#9 `30CAL07`) | – | – | Giờ GMT bắt đầu (hoặc đánh lửa – [UNVERIFIED]) |
| 4 | `Fuel` | category | 0 | – | Methanol 157, Heptane 117 | Nhiên liệu lỏng |
| 5 | `Ambient pressure; mmHg` | float | 0 | – | 0.0 – 2319.9; **1 giá trị = 0** | Áp suất buồng, mmHg. Độ chính xác yêu cầu ±0.01 atm (`FLEX_Test_Plan.pdf` tr.4 = trang in 44) [DOC] |
| 6 | `O initial ambient composition; mole fraction` | float | 0 | – | 0.12 – 0.34 (15 mức) | Phần mol **O2** ban đầu |
| 7 | `N initial ambient composition; mole fraction` | float | 0 | – | 0.09 – 0.88 | Phần mol **N2** |
| 8 | `CO initial ambient composition; mole fraction` | float | 0 | – | 0 – 0.70 | Phần mol chất ức chế — **thực chất là CO2** (xem §4.1) |
| 9 | `He initial ambient composition; mole fraction` | float | 0 | – | 0 – 0.45 | Phần mol Heli |
| 10 | `Droplet initial diameter; mm` | float | 6 | `–` ×6 | 1.10 – 4.67 (n=262) | Đường kính giọt ban đầu D0 (mm), đo từ ảnh backlit [DOC: RRD tr.30] |
| 11 | `Visible flame extinction diameter; mm` | float | 49 | `–` ×28 | 0.0 – 4.6 (n=197; **8 giá trị = 0**) | Đường kính **giọt** tại thời điểm **ngọn lửa nhìn thấy được** tắt (mm) |
| 12 | `Burning rate; mm` | float | 16 | – | 0.05 – 1.06 (n=258) | Hằng số burning rate K của d²-law. **Đơn vị trong header sai**: đúng là **mm²/s** (xem §4.4) |
| 13 | `Burn time; s` | float | 6 | `~6`, `~9` | 0.3 – 39.2 (n=266) | Thời gian cháy (s) – định nghĩa chính xác **không có trong repo** |
| 14 | `Test end` | category | 0 | – | Extinction 186, Disruption 61, Completion 27 | Kết cục test (xem §4.3) |

> ⚠️ **Phân biệt ô rỗng và ô `–`**: hai dạng thiếu dữ liệu cùng tồn tại trong một cột (ví dụ cột 11: 49 rỗng, 28 `–`). Ý nghĩa khác nhau có thể có (ví dụ "không đo được" vs "chưa phân tích") nhưng **không có tài liệu nào trong repo giải thích** → [UNVERIFIED]. Khuyến nghị: giữ nguyên hai mã thiếu khác nhau trong bảng chuẩn hóa (`missing_blank`, `missing_dash`), **không** gộp, **không** điền giá trị.

---

## 2. Phân bố thống kê [CSV]

### 2.1 Theo nhiên liệu

| Biến | Methanol (n=157) | Heptane (n=117) |
|---|---|---|
| D0 (mm) | n=154, mean 3.08, median 3.05, min 1.61, max 4.53 | n=108, mean 2.88, median 2.92, min 1.10, max 4.67 |
| Dext (mm) | n=117, mean 1.85, median 1.66, 0.40–3.96 | n=80, mean 2.00, median 2.32, 0.0–4.60 |
| K (mm²/s) | n=151, mean 0.472, median 0.46, 0.20–0.74 | n=107, mean 0.545, median 0.54, 0.05–1.06 |
| Burn time (s) | n=155, mean 13.6, median 12.1, 0.3–39.2 | n=111, mean 7.9, median 7.5, 0.55–24.0 |
| Test end | Ext 126 / Disr 23 / Comp 8 | Ext 60 / Disr 38 / Comp 19 |

### 2.2 Áp suất (mmHg → atm)

| Mức (atm) | Số test | Ghi chú |
|---|---:|---|
| ~0.70 (530–543 mmHg) | 103 | |
| ~1.00 (750–772 mmHg) | 161 | |
| ~2.0 (1546–1554 mmHg) | 2 | |
| ~2.7–3.05 (2055–2320 mmHg) | 7 | Phù hợp ma trận "radiative environment" (Bảng 12, `FLEX_Test_Plan.pdf` tr.15) [DOC] |
| **0** | **1** | `C11M201` (#114). Các test cùng mã hỗn hợp `C11` đều ở ~0.70 atm → giá trị 0 là **lỗi/placeholder**, không phải chân không [CSV + HYP] |

### 2.3 Thành phần khí
- 52 tổ hợp (O, N, CO, He) khác nhau. Phổ biến nhất: không khí 0.21/0.79 (29 test), 0.24/0.56/0.20 CO (16), 0.30/0.70 (15).
- **Tổng phần mol ≠ 1** ở 6 hàng (tổng = 0.98): `193R002`, `203R002`, `203F001`, `179F001`, `207F001`, `207F002` — có thể do làm tròn hoặc thành phần chưa ghi [HYP].
- Không có test nào có đồng thời CO > 0 và He > 0 [CSV].

### 2.4 Kết cục theo O2 [CSV]

| Fuel | XO2 < 0.175 | 0.175 ≤ XO2 < 0.215 | XO2 ≥ 0.215 |
|---|---|---|---|
| Methanol | **54 Ext / 0 / 0** | 59 Ext / 6 Disr / 3 Comp | 13 Ext / 17 Disr / 5 Comp |
| Heptane | 19 Ext / 1 Disr / 5 Comp | 34 Ext / 15 Disr / 10 Comp | 7 Ext / 22 Disr / 4 Comp |

Quan sát: ở O2 thấp, methanol **luôn** extinction; tỷ lệ Disruption tăng mạnh ở O2 cao. Heptane có 5 "Completion" ở O2 < 0.175 — bất thường so với methanol, phù hợp với hiện tượng cool flame (xem §4.3) [HYP].

### 2.5 Theo nhóm thiết kế (fuel × diluent × pressure) [CSV]

| Fuel | Diluent | 0.7 atm | 1.0 atm | 2–3 atm |
|---|---|---|---|---|
| Methanol | CO2 | 38 (E27/D7/C4) | 29 (E27/D1/C1) | 7 (+1 áp suất = 0) |
| Methanol | He | 14 (E12/D2) | 14 (E14) | – |
| Methanol | chỉ N2 | 12 (E2/D8/C2) | 42 (E37/D4/C1) | – |
| Heptane | CO2 | 19 (E13/D6) | 27 (E13/D11/C3) | 2 |
| Heptane | He | 10 (E8/C2) | 12 (E6/D2/C4) | – |
| Heptane | chỉ N2 | 10 (E1/D8/C1) | 37 (E18/D10/C9) | – |

---

## 3. Cấu trúc mã `FLEX Identifier` (giải mã từ dữ liệu)

| Mẫu | Số lượng | Thời gian | Đặc trưng [CSV] |
|---|---:|---|---|
| `##CAL##` (ví dụ `20CAL08`) | 9 | 3–4/2009 | Không khí 1 atm; nhiều khả năng là test kiểm tra/hiệu chuẩn ban đầu (FLEX DoD liệt kê bản ghi "FLEX – Calibration") [HYP] |
| `###F###` | 59 | 5/2009 – 6/2010 | Đánh số 3 chữ số + chữ `F` |
| `###R###` | 25 | 5/2009 – 6/2010 | Chữ `R` (23 methanol, 2 heptane) |
| `C##M###` / `C##H###` | 64 / 44 | 6/2010 – 8/2011 | **Toàn bộ 108 test có CO > 0, He = 0** |
| `H##M###` / `H##H###` | 28 / 22 | 9/2011 – 12/2011 | **Toàn bộ 50 test có He > 0, CO = 0** |
| `N##M###` / `N##H###` | 9 / 14 | 8/2011 – 9/2011 | **Toàn bộ 23 test chỉ O2/N2** |

**Giải mã đã kiểm chứng [CSV]:**
- Chữ thứ 4 `M`/`H` khớp 100% với cột `Fuel` (Methanol/Heptane).
- Hai chữ số `##` sau tiền tố là **mã hỗn hợp khí**: mỗi mã ứng với đúng một thành phần (ví dụ `C01` = 0.20/0.75/0.05/0, `C07` = 0.14/0.50/0.36/0, `H08` = 0.13/0.47/0/0.40, `N06` = 0.12/0.88). Mã `C08`, `C06`, `C11` có sai khác ±0.01 trong 1–2 hàng (làm tròn).
- Chuỗi `C01`→`C07` (1 atm) và `C08`→`C14` (0.7 atm) có tỷ lệ O2/N2 ≈ 0.21/0.79 của không khí, tức là **không khí được pha loãng dần bằng chất ức chế**: ví dụ `C01` = 95% không khí + 5% chất ức chế.

**Chưa giải mã được [UNVERIFIED]:**
- Ý nghĩa `F` vs `R` trong mã số (giả thuyết: `F` = free droplet, `R` = droplet treo trên **Retractable Indexing Fiber (RIF)**, thuật ngữ có trong `FLEX Overall Ext File-2.pdf` tr.16 — **chưa xác nhận**). Nếu đúng, thì **thông tin có fiber hay không bị thiếu** ở các series C/H/N — đây là biến gây nhiễu quan trọng vì fiber ảnh hưởng burning rate với giọt nhỏ (`2G11-070HE-0310.pdf` tr.10, kết luận 4) [DOC].
- Ý nghĩa 3 chữ số đầu của mã `###F###` (không khớp số test trong Test Plan).
- Chữ số thứ 5 trong mã C/H/N không tương ứng với áp suất.

---

## 4. Ý nghĩa vật lý của các biến

### 4.1 Cột `CO initial ambient composition` là CO, CO2 hay gì khác?

**Kết luận: gần như chắc chắn là CO2 (carbon dioxide), header bị cắt/ghi sai.** Bằng chứng:

1. **[DOC]** Chất ức chế được nghiên cứu là **CO2, He và SF6**; nồng độ chất ức chế lên tới 0.70 (`FLEX_EIRD_v4.pdf` tr.29; Test Plan tr.5, Bảng 8–12 dùng ký hiệu `XCO2` với giá trị 0.15/0.25/0.50/0.70 và `XN2 = 1 − XO2 − XCO2`).
2. **[DOC]** Metadata `i_Investigation.txt` (Objective): "measure the effectiveness of various gaseous fire suppressants such as CO2, He, and SF6". Bài `1G17-070HE-0166.pdf` tr.1: diluent gồm "helium, nitrogen, and carbon dioxide".
3. **[CSV]** Giá trị tối đa 0.70 (ở 2–3 atm) khớp đúng Bảng 12 "Suppressant in a radiative environment" (`XCO2 = 0.70`, Test Plan tr.15).
4. **[CSV]** Mã test series `C` ↔ cột này > 0 (108/108), series `H` ↔ cột He > 0 — đối xứng "C = CO2, H = Helium".
5. **[DOC + vật lý]** Slide `20130010979.pdf` tr.11 mô tả các test methanol FLEX "with diluent mixtures of CO2/N2" ở O2 13–21%.
6. **Lập luận vật lý:** CO là **nhiên liệu dễ cháy và độc**; không thể là chất ức chế ở 5–70% mol. FLEX-2 ERD (tr.24, yêu cầu 4.1.51) còn quy định buồng phải có **< 0.02** mol CO, CO2 và sản phẩm cháy khác **trước** mỗi test — CO ở 0.05–0.70 sẽ vi phạm hoàn toàn.

➡️ Trong schema chuẩn hóa: đổi tên hiển thị thành `X_CO2_initial` **nhưng giữ `source_column = "CO initial ambient composition; mole fraction"`** và gắn cờ `header_corrected: CO→CO2 (evidence: …)`.

> Lưu ý về mâu thuẫn trong tài liệu: `20130010979.pdf` tr.9 ghi test point FLEX-145 là "20% O2 / 75% CO2 / 5% N2", nhưng tr.10 cùng file ghi "O2 20% / N2 75% / CO2 5%". CSV hàng #145 (`C01M201`) có 0.20/0.75 N/0.05 CO → khớp với tr.10. Tr.9 có lỗi đảo thứ tự [DOC + CSV].

### 4.2 D0 và Dext
- **[DOC]** Kích thước giọt đo từ ảnh **backlit** (HiBMs camera); "the time evolution of the droplet size yields the droplet burning rate … and extinction droplet size" (`FLEX_EIRD_v4.pdf` tr.30). FLEX-2 ERD yêu cầu độ phân giải 30 µm, ≥30 fps (tr.24) — đây là yêu cầu của FLEX-2, chỉ là tham khảo cho FLEX.
- **"Visible flame extinction diameter"** là đường kính **giọt** khi **ngọn lửa nhìn thấy được** tắt. Với **heptane**, ngọn lửa nóng có thể tắt bức xạ (radiative extinction) nhưng giọt **tiếp tục cháy bằng cool flame** không nhìn thấy, rồi mới tắt hẳn ở đường kính nhỏ hơn (`1G17-070HE-0166.pdf` tr.1–2; `Cool Flames…pdf` tr.7–9) [DOC]. ➡️ Dext của heptane **không nhất thiết** là thời điểm kết thúc cháy.
- **[CSV]** Có 10 test `Completion` nhưng Dext > 0 (ví dụ `194F001` Dext 3.04, `C08M101` 2.6, `C10M401` 2.35) → nhất quán với cách hiểu "ngọn lửa nhìn thấy tắt nhưng giọt vẫn tiếp tục cháy/bay hơi đến hết" [HYP].
- **[CSV]** 8 test heptane có Dext = 0 (outcome Disruption hoặc Completion) → "0" có lẽ mang nghĩa "không có extinction ở đường kính hữu hạn", **không phải** phép đo 0 mm [HYP].

### 4.3 Extinction, Disruption, Completion
| Nhãn | Bằng chứng trong repo | Cách hiểu |
|---|---|---|
| **Extinction** | RRD tr.29: "ignited droplet burns to either completion or the flame extinguishes at a finite droplet diameter" [DOC] | Ngọn lửa tắt khi giọt còn đường kính hữu hạn (diffusive hoặc radiative extinction; `Cool Flames…pdf` tr.3) |
| **Completion** | Cùng câu trên [DOC] | Giọt cháy đến hết (hoặc gần hết) |
| **Disruption** | **Không có định nghĩa nào trong repo** (đã tìm toàn văn tất cả tài liệu FLEX) | [UNVERIFIED]. Giả thuyết: test bị gián đoạn/không đạt điều kiện lý tưởng (giọt trôi khỏi trường nhìn — `2G11` tr.4 nêu "some small drift" khi rút kim; vỡ giọt/microexplosion; tương tác fiber/igniter). Tỷ lệ Disruption cao ở O2 cao (§2.4) và cao hơn với heptane. **Định nghĩa chính thức có thể nằm trong NASA/TP-2015-216046 (không có trong repo).** |

➡️ "Disruption" nhiều khả năng là **nhãn vận hành/censoring**, không phải trạng thái vật lý cùng loại với Extinction/Completion. Không nên gộp vào bài toán phân loại vật lý mà không xác minh.

### 4.4 Đơn vị của `Burning rate; mm` có đúng không?

**Không đúng. Đơn vị đúng là mm²/s** (hằng số burning rate K của d²-law).

- **[DOC]** d²-law: `(D/D0)² = 1 − K·t/D0²` (`2G11-070HE-0310.pdf` tr.2) → K có đơn vị độ dài²/thời gian.
- **[DOC]** `20130010979.pdf` tr.7: test ZGF với D0=1.69 mm, Dext=0.79 mm, "K = 0.67 m2/s"; tr.9: FLEX-145 "K = 0.44 m2/s". Giá trị số trùng thang mm²/s; "m2/s" là lỗi đánh máy (0.44 m²/s là phi vật lý cho giọt mm).
- **[CSV] Kiểm chứng định lượng:** nếu K tính bằng mm²/s thì `Burn time ≈ (D0² − Dext²)/K`. Tỷ số `t_measured / [(D0² − Dext²)/K]` (Dext rỗng → 0) trên **256 hàng** có:
  - **median = 1.041**, decile 10%–90% = 0.80 – 1.13.
  - Sai số ~4% dương hợp lý do giai đoạn đánh lửa/transient ban đầu.
  - ➡️ Xác nhận K là mm²/s **và** cho thấy `Burn time` ≈ thời gian từ đánh lửa đến lúc ngọn lửa nhìn thấy tắt (hoặc đến khi giọt hết) [HYP mạnh].

**Hệ quả quan trọng:** `Burn time`, `D0`, `Dext`, `K` **không độc lập** — ba trong bốn biến gần như xác định biến thứ tư (xem rò rỉ dữ liệu ở §7).

### 4.5 Ngoại lệ của kiểm tra d²-law (ứng viên bất thường) [CSV]
| Test | D0 | Dext | K | t | Tỷ số | Diễn giải |
|---|---|---|---|---|---|---|
| `C13H102` (#129) | 3.33 | **3.34** | 0.33 | 0.55 | −2.72 | Dext > D0 → **phi vật lý** (lỗi đo hoặc nhập) |
| `C13H201` (#130) | 2.91 | 2.89 | **0.05** | 0.6 | 0.26 | Tắt gần như ngay; K tính trên khoảng quá ngắn → không tin cậy |
| `196F001`, `205F001`, `256F002`, `N04H201` | – | rỗng | – | – | 0.33–0.47 | Không có Dext; test Disruption/không có extinction diameter → burn time bị **cắt ngắn** (censored) |
| `N04H101`, `C03H501`, `C12H201`, `C09H101`, `C11H201` | ~D0 | ≈D0 | – | 1.4–6 s | 1.6–4.6 | Heptane tắt bức xạ rất sớm (Dext ≈ D0): thời gian bị chi phối bởi giai đoạn đánh lửa, d²-law không áp dụng |
| `193F001` (#70 và #73) | 4.67 / 4.64 | 4.6 / 4.58 | 0.41 / **0.56** | 1.6 / 1.5 | – | **ID trùng, cùng ngày/giờ** nhưng giá trị khác → nhập trùng hoặc hai phân tích khác nhau của cùng một test |

---

## 5. Tính độc lập, nhóm điều kiện và lặp lại

- **Nhóm điều kiện:** 89 tổ hợp (fuel, thành phần khí, mức áp suất); **72** tổ hợp có ≥ 2 test, 17 tổ hợp chỉ 1 test, tối đa 17 test/tổ hợp [CSV].
- **Không phải lặp lại thuần túy:** theo quy trình LOI, cùng một điều kiện khí người ta **thay đổi D0 có chủ đích** ("Increase the droplet size or repeat the test", Test Plan tr.4, bước 5) [DOC]. Vì vậy các test cùng điều kiện là "cùng khí quyển, khác D0".
- **Thiết kế tuần tự/thích nghi:** điều kiện test sau được chọn **dựa trên kết quả test trước** (bước 4–8 của quy trình) [DOC] → dữ liệu **không phải mẫu ngẫu nhiên i.i.d.**, có thiên lệch chọn mẫu dày đặc quanh ranh giới extinction.
- **Có thể không độc lập về khí quyển:** trong cùng ngày và cùng mã hỗn hợp, áp suất tăng dần qua các test liên tiếp (ví dụ `C01M101` 761.9 → `C01M201` 763.5 → `C01M301` 765.5 mmHg ngày 16/11/2010) [CSV] → nhiều giọt có thể được đốt trong **cùng một lần nạp buồng**, sản phẩm cháy tích lũy [HYP]. FLEX-2 ERD cho phép tăng áp ≤ 10% trong mỗi test point (tr.22, 4.1.35) [DOC].
- **Thiếu biến:** fiber/free droplet (xem §3), nhiệt độ buồng, vận tốc trôi của giọt, thời gian đánh lửa.

---

## 6. Các quan hệ có thể nghiên cứu một cách khoa học

| Quan hệ | Bằng chứng sơ bộ [CSV] | Cơ sở lý thuyết [DOC] |
|---|---|---|
| K tăng theo XO2 | Pearson r = **0.69** (methanol, n=151), 0.42 (heptane, n=107) | Lý thuyết droplet combustion cổ điển |
| K giảm nhẹ theo D0 | r = −0.18 (MeOH), −0.35 (heptane) | `2G11` tr.9–10: burning rate giảm khi D0 tăng (bức xạ, soot) |
| Dext tăng tuyến tính theo D0 | r = 0.66 (MeOH, n=103), 0.85 (heptane, n=56) | `20130010979.pdf` tr.11: lý thuyết Zhang–Card–Williams dự đoán quan hệ tuyến tính de–d0 cho methanol |
| Dext/D0 tăng khi O2 giảm (methanol, CO2, 1 atm) | `C01`(0.20): 0.42 → `C03`(0.18): 0.42 → `C05`(0.16): 0.71 → `C06`(0.15): 0.77 → `C07`(0.14): 0.88 | Tiếp cận LOI: tại LOI, extinction xảy ra ngay sau đánh lửa (Test Plan tr.2, Hình 2) |
| Hiệu quả CO2 vs He vs N2 | So sánh Dext/D0 hoặc tỷ lệ Extinction ở cùng XO2 | MEC/LOI (Test Plan tr.2–3, công thức LOI = 0.209(1 − MEC)) |
| Ảnh hưởng áp suất 0.7 vs 1.0 atm | Hai nhóm đủ lớn (103 vs 161) | RRD tr.29: áp suất ít ảnh hưởng burning rate nhưng ảnh hưởng hóa học |
| Hai chế độ extinction (diffusive vs radiative) | Heptane: Dext ≈ D0 ở D0 lớn (radiative) | `Cool Flames…pdf` tr.3; `1G17` tr.2 |

> Lưu ý: n mỗi mã hỗn hợp thường chỉ 1–6 test có Dext → các xu hướng trên là **mô tả**, cần khoảng tin cậy bootstrap, không nên khẳng định LOI chính xác.

---

## 7. Đánh giá các bài toán Machine Learning (chưa huấn luyện)

**Số mẫu khả dụng [CSV]:** D0 & burn time có số và áp suất hợp lệ: **258**; D0 hợp lệ: **261**; Extinction có Dext > 0: **159**.

### A. Hồi quy Burn time
| Mục | Đánh giá |
|---|---|
| Input hợp lệ | `Fuel`, `Ambient pressure`, XO2, XN2, X_CO2, XHe, D0 (+ diluent type, mã hỗn hợp chỉ dùng để chia nhóm) |
| Target | `Burn time; s` (log-transform khuyến nghị) |
| Số mẫu | ~258 |
| **Rò rỉ dữ liệu** | **Nghiêm trọng nếu dùng K hoặc Dext** (t ≈ (D0²−Dext²)/K → R² gần 1 một cách giả tạo). Cũng rò rỉ nếu dùng `Test end`. Rò rỉ nhóm: các test cùng hỗn hợp/cùng ngày → phải dùng **GroupKFold theo mã hỗn hợp** hoặc chia theo thời gian. |
| Vấn đề censoring | Test **Disruption** có burn time bị cắt ngắn → hoặc loại bỏ, hoặc mô hình survival (censored regression) |
| Metric | MAE, RMSE trên log(t), R²; báo cáo riêng từng fuel; so với baseline vật lý |
| Đủ lớn? | Đủ cho mô hình **ít tham số** (≤ 7 biến). Không đủ cho deep learning. |
| Hạn chế khoa học | Định nghĩa burn time không có trong repo; heptane cool flame làm burn time mơ hồ |
| Baseline đề xuất | (1) **Physics baseline**: t̂ = D0²/K̂ với K̂ = hồi quy tuyến tính K theo (fuel, XO2, diluent); (2) Ridge trên log t ~ log D0 + XO2 + …; (3) Gradient boosting nông (depth ≤ 3) + monotonic constraint theo D0; (4) Gaussian Process cho bất định |

### B. Phân loại Test end
| Mục | Đánh giá |
|---|---|
| Input | như A |
| Target | `Test end` (3 lớp: 186/61/27 → mất cân bằng) |
| Số mẫu | ~261 |
| Rò rỉ | Dext (có/không/0), burn time, K đều mã hóa outcome → **cấm dùng** |
| Đề xuất | Bài toán **nhị phân Extinction vs Completion** (n ≈ 213), coi Disruption là censored/loại bỏ cho tới khi có định nghĩa chính thức |
| Metric | Balanced accuracy, macro-F1, log-loss, **calibration** (reliability curve), GroupKFold |
| Đủ lớn? | Biên; Completion chỉ 27 mẫu |
| Hạn chế | Thiết kế thích nghi quanh ranh giới → mô hình học được "ranh giới đã được dò", không phải phân bố tổng quát; heptane cool flame làm nhãn Completion khó hiểu |
| Baseline | Logistic regression (interpretable), decision tree depth 2–3, GBM nhỏ; so sánh với **luật đơn giản** "XO2 < 0.175 ⇒ Extinction" (đúng 54/54 với methanol) |

### C. Truy xuất thí nghiệm tương tự (Similar experiment retrieval)
| Mục | Đánh giá |
|---|---|
| Input | Fuel (khớp chính xác), diluent type, XO2, X_CO2, XHe, log(P), D0 |
| Target | Không cần nhãn |
| Số mẫu | 274 (toàn bộ, kể cả thiếu một số trường) |
| Rò rỉ | Không áp dụng; nhưng không dùng biến kết quả trong khoảng cách nếu mục đích là "dự đoán bằng hàng xóm" |
| Metric | Kiểm tra định tính bởi người; proxy: leave-one-out kNN dự đoán outcome/K; tỷ lệ hàng xóm cùng mã hỗn hợp |
| Đủ lớn? | Có — đây là bài toán **phù hợp nhất** với kích thước dữ liệu |
| Baseline | kNN với Gower distance / chuẩn hóa z-score có trọng số; giải thích được từng thành phần khoảng cách |

### D. Phân tích điều kiện extinction
| Mục | Đánh giá |
|---|---|
| Input | XO2, diluent, P, D0 |
| Target | Dext, Dext/D0, xác suất extinction |
| Số mẫu | 159 (Dext > 0) |
| Rò rỉ | Không dùng burn time, K làm input |
| Metric | Hệ số hồi quy + CI bootstrap; so với lý thuyết tuyến tính de–d0 |
| Hạn chế | Ít mẫu mỗi hỗn hợp; heptane có hai chế độ extinction; LOI chỉ ước lượng thô |
| Baseline | Hồi quy tuyến tính Dext = a·D0 theo từng hỗn hợp; logistic/GLM cho P(extinction) theo (XO2, D0); bản đồ flammability dạng scatter |

### E. Phát hiện bất thường khoa học
| Mục | Đánh giá |
|---|---|
| Input | Tất cả biến số |
| Target | Không nhãn |
| Phương pháp | **Luật vật lý trước** (d²-law ratio ngoài [0.6, 1.5], Dext ≥ D0, P = 0, tổng phần mol ≠ 1, K ngoài khoảng, ID trùng), sau đó robust z-score trong nhóm hỗn hợp, cuối cùng Isolation Forest (chỉ để gợi ý) |
| Metric | Precision khi người duyệt; đã có danh sách 15+ bất thường thật ở §4.5, §2 làm tập kiểm tra |
| Đủ lớn? | Có cho luật; ML không giám sát chỉ mang tính phụ |

**Kết luận ML cho FLEX:** dữ liệu **đủ cho mô hình thống kê nhỏ, minh bạch và có ràng buộc vật lý**, **không đủ** cho deep learning. Giá trị cao nhất: (C) similarity search, (E) anomaly/quality flags, (D) phân tích extinction có CI, và một baseline (A) **physics-informed** được đánh giá trung thực bằng GroupKFold.

---

## 8. Danh sách cờ chất lượng đề xuất (áp dụng cho bảng chuẩn hóa)

| Cờ | Hàng bị ảnh hưởng |
|---|---|
| `invalid_pressure_zero` | #114 `C11M201` |
| `duplicate_identifier` | #70, #73 `193F001` |
| `mole_fraction_sum_0.98` | 6 hàng (§2.3) |
| `dext_ge_d0` | #129 `C13H102` |
| `dext_zero_ambiguous` | 8 hàng heptane |
| `approximate_value` (`~6`, `~9`) | #223 `H01M104`, #224 `H01H102` |
| `missing_blank` / `missing_dash` | theo từng ô |
| `d2law_ratio_outlier` | các hàng §4.5 |
| `possible_censored_burn_time` | toàn bộ `Disruption` |
| `header_corrected_CO_to_CO2` | cột 8, toàn bộ |
| `unit_corrected_mm_to_mm2_per_s` | cột 12, toàn bộ |
| `calibration_series_CAL` | 9 hàng `##CAL##` |
| `date_format_2digit_year` | 50 hàng |

---

## 9. Tóm tắt

1. FLEX CSV là bộ dữ liệu **tốt nhất** trong repo cho phân tích định lượng: 274 test, 15 cột, chủ yếu là số, cấu trúc nhóm rõ ràng.
2. Hai lỗi header quan trọng: `CO` → **CO2**; `Burning rate; mm` → **mm²/s** (đã kiểm chứng định lượng, median tỷ số d²-law = 1.04).
3. "Disruption" chưa có định nghĩa → không dùng như nhãn vật lý.
4. Thiết kế thích nghi + các biến phụ thuộc nhau → ML phải tránh rò rỉ và đánh giá theo nhóm.
5. Thiếu dữ liệu D(t), video và báo cáo TP-2015-216046 hạn chế việc xác minh định nghĩa.
