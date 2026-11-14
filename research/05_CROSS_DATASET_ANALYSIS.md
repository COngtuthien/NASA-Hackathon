# 05 — Phân tích liên bộ dữ liệu (Cross-Dataset Analysis)

> Dựa trên kết quả ở 02 (FLEX), 03 (BASS-II), 04 (SAFFIRE-I). Nhãn: [DOC] · [CSV] · [HYP] · [UNVERIFIED].

---

## 1. Mỗi investigation nghiên cứu quá trình vật lý nào?

| | **FLEX** (PSI-69) | **BASS-II** (PSI-25) | **SAFFIRE-I** (PSI-98) |
|---|---|---|---|
| Hệ cháy | Giọt **nhiên liệu lỏng** đơn lẻ (methanol, n-heptane), ngọn lửa khuếch tán đối xứng cầu | **Chất rắn** quy mô cm (PMMA màng/tấm/thanh/cầu, SIBAL, Nomex, sáp) | **Chất rắn** quy mô **m** (tấm SIBAL ~0.4 × 0.94 m) |
| Dòng khí | Tĩnh (quiescent), có thể drift nhỏ | Cưỡng bức 0 → ~55 cm/s, thay đổi trong test | Cưỡng bức 20 cm/s |
| Hiện tượng chính | Burning rate (d²-law), **extinction** diffusive/radiative, **LOI**, hiệu quả chất ức chế, cool flame | **Flame spread** opposed/concurrent, **quenching vs blowoff**, giới hạn O2/vận tốc, sản phẩm cháy | **Tăng trưởng & lan truyền lửa quy mô lớn**, có đạt trạng thái ổn định không |
| Biến điều khiển | Fuel, P (0.7–3 atm), XO2, chất ức chế (CO2, He), D0 | Vật liệu/hình học/độ dày, O2 (pha loãng N2, 13.6–22.2 %), vận tốc dòng (fan) | Hướng lan truyền; O2 và dòng gần như cố định |
| Môi trường | Buồng CIR kín, thành phần pha sẵn | Thể tích MSG 250 L, bị suy giảm dần qua các test | Ống dẫn trong Cygnus |
| Đơn vị phân tích | 1 giọt = 1 hàng | 1 mẫu × nhiều giai đoạn dòng = 1 hàng | 1 lần đốt = 1 hàng (n=2) |
| Kích thước dữ liệu số | 274 hàng, chủ yếu số | 129 hàng, bán cấu trúc | 2 hàng + manifest ảnh |

[DOC: RRD tr.28–30; SR p.11–13; DoD SAFFIRE; Operations tr.1]

---

## 2. Biến dùng chung vs khác biệt bản chất

| Khái niệm | FLEX | BASS-II | SAFFIRE-I | Có so sánh trực tiếp được? |
|---|---|---|---|---|
| **O2 môi trường** | Phần mol, **điều kiện đặt** (pha sẵn) | % thể tích, **đo** trước/sau, hiệu chỉnh offset, **thay đổi** trong test | % (văn bản `~21.5`) | ✅ Cùng đại lượng vật lý (phần mol ≈ % thể tích/100 với khí lý tưởng), **khác vai trò** (setpoint vs đo) |
| **CO2** | **Chất ức chế đưa vào** (input, 0–0.70) | **Sản phẩm cháy đo được** (output, ~0.2–3 %) | Có cảm biến nhưng không có dữ liệu | ❌ **Ngữ nghĩa ngược nhau** — tuyệt đối không ghép chung một cột |
| Áp suất | Đo, 0.7–3 atm | Không ghi (cabin ISS ~1 atm) | Không ghi trong CSV | ❌ Chỉ FLEX |
| Vận tốc dòng | ~0 | Đo (Air display) / suy ra từ fan | 20 cm/s | ⚠️ Chế độ khác hẳn (khuếch tán thuần vs cưỡng bức) |
| Nhiên liệu | Lỏng, hóa học đơn giản | Polymer/cellulose rắn, pyrolysis | Cellulose/sợi thủy tinh | ❌ Khác pha |
| Thang đo độ dài | D0 1–5 mm | 0.1–5 mm dày; 1–2 cm rộng; thanh 6–13 mm | 0.4 × 0.94 m | ❌ Khác 2–3 bậc |
| "Burn time" | Thời gian từ đánh lửa đến tắt (suy ra, §02) | Không có trong CSV | 420 / 70 s (CSV) | ⚠️ Định nghĩa khác nhau |
| **Extinction** | Ngọn lửa tắt ở đường kính hữu hạn (diffusive/radiative) | Quenching ở dòng thấp / blowoff ở dòng cao | Không có dữ liệu | ⚠️ Cùng khái niệm "giới hạn cháy", **cơ chế và biến điều khiển khác** |
| Chất pha loãng | N2, CO2, He | N2 (pha loãng), không khí ISS | Không khí | ⚠️ Chỉ N2/không khí chung |

**Điểm nối thực sự giữa các bộ dữ liệu:**
1. **Vật liệu SIBAL**: BASS-II (T'ien, mẫu 1–2 cm, concurrent) ↔ SAFFIRE-I (mẫu ~40 cm, concurrent & opposed) → cùng vật liệu, khác quy mô — trục "**hiệu ứng quy mô**" đúng như tiêu đề công bố Saffire "Flame spread: Effects of microgravity and scale" (chỉ có tiêu đề trong repo).
2. **Khái niệm giới hạn cháy theo O2**: LOI của FLEX ↔ giới hạn O2 tối thiểu của thanh PMMA BASS-II (SR p.97).
3. **Vai trò tổn thất bức xạ trong vi trọng lực**: radiative extinction của giọt lớn (FLEX, `Cool Flames…pdf` tr.3) ↔ radiative extinction ở vận tốc opposed thấp (BASS-II, SR p.36).
4. **Mục tiêu an toàn cháy tàu vũ trụ** chung.

---

## 3. Có so sánh thí nghiệm giữa các bộ được không?

| Loại so sánh | Hợp lệ? |
|---|---|
| So **giá trị số** (ví dụ burn time FLEX vs burn time SAFFIRE) | ❌ Không — khác hệ, khác định nghĩa |
| So **xu hướng định tính** có cơ sở lý thuyết chung (ví dụ "giảm O2 → gần giới hạn cháy hơn"; "vận tốc rất thấp → tổn thất bức xạ chi phối") | ✅ Có, nếu mỗi phát biểu trích nguồn riêng cho từng dataset |
| So **giới hạn O2** giữa giọt lỏng và chất rắn | ⚠️ Chỉ mang tính minh họa; giới hạn phụ thuộc mạnh vào hình học, vận tốc, kích thước |
| So SIBAL quy mô nhỏ (BASS-II) vs lớn (SAFFIRE-I) | ⚠️ Có ý nghĩa khoa học cao nhưng **thiếu dữ liệu số** ở cả hai phía trong repo (BASS-II chỉ có đồ thị; SAFFIRE chỉ có burn time) |

### Kết luận có thể chuyển giao
- Khung khái niệm: Damköhler number, hai nhánh giới hạn (blowoff/quench ↔ diffusive/radiative), vai trò bức xạ khi không có đối lưu do nổi.
- Bài học vận hành/an toàn: lửa vi trọng lực có thể tạo nhiều CO (CO/CO2 cao, SR p.16), cool flame có thể tồn tại sau khi ngọn lửa nhìn thấy tắt và tái bắt lửa (`Cool Flames…pdf` tr.22) — **cả hai là phát biểu của tài liệu, không phải suy luận chéo**.

### Kết luận **không** được tổng quát hóa
- Giá trị LOI, Dext, K của FLEX → không áp dụng cho vật liệu rắn.
- Vận tốc quenching/blowoff của BASS-II → không áp dụng cho giọt lỏng hay lửa quy mô m.
- Hiệu quả CO2/He của FLEX (dạng giọt) → không suy ra hiệu quả dập lửa cho vật liệu rắn trong cabin.
- Mọi "dự đoán an toàn cháy cho tàu vũ trụ" từ dữ liệu cm/mm này → phải được đánh dấu là **ngoại suy, không được hỗ trợ**.

---

## 4. Một database thống nhất? Một mô hình ML thống nhất?

| Câu hỏi | Trả lời | Lý do |
|---|---|---|
| **Một database thống nhất** | ✅ **Có** — dạng **entity–attribute có ngữ nghĩa** (không phải một bảng rộng) | Mỗi đại lượng mang theo vai trò (setpoint/measured/derived), đơn vị, nguồn, cờ chất lượng, giai đoạn |
| **Một mô hình dự đoán thống nhất** | ❌ **Không** | Không có biến mục tiêu chung có cùng ý nghĩa vật lý; không gian đặc trưng không giao nhau (D0 vs độ dày vs vận tốc); n quá nhỏ ở BASS-II/SAFFIRE; CO2 trái nghĩa; nguy cơ mô hình học "dataset ID" thay vì vật lý |
| **Mô hình riêng** | ✅ Hợp lệ hơn | FLEX: mô hình thống kê nhỏ có ràng buộc vật lý. BASS-II: phân tích stoichiometry/khí và trích xuất bằng chứng. SAFFIRE-I: case study, không mô hình |

---

## 5. Liên kết báo cáo ↔ quan sát định lượng

| Phương pháp liên kết | Ví dụ đã kiểm chứng | Độ tin cậy |
|---|---|---|
| **Khớp ID chính xác** | BASS-II `Test #` (B1, M5, O13a…) xuất hiện nguyên văn trong Appendix A (SR p.111–121) | Cao |
| **Khớp ID + sự kiện** | CSV M5 (ΔCO2 2.78 %, CO >500) ↔ "outlier at 2.8 percent CO2 … CO sensor over-ranged" (SR p.15) ↔ Anomaly #1, GMT 51 (SR p.127) | Cao |
| **Khớp điều kiện** (không có ID) | FLEX: slide "FLEX-145" (`20130010979.pdf` tr.9–10: MeOH, 1 atm, 0.20/0.75/0.05) ↔ CSV #145 `C01M201` cùng điều kiện, **nhưng** D0 3.33 vs 3.38, Dext 1.61 vs 1.66 | **Trung bình – chưa xác nhận**; có thể khác test hoặc khác lần phân tích |
| **Khớp theo ngày (GMT)** | Anomaly #3 "GMT 205, blowoff attempt with a flat PMMA sample" (SR p.127) — CSV không có test ngày 205; ứng viên M10/M16/M19 (GMT 204, tấm PMMA, fan lên 105) nếu ngày ghi theo đồng hồ video lệch +1 (FAQ) | Thấp [HYP] |
| **Khớp tên file** | SAFFIRE CSV `S1C1` ↔ tên JPEG `S1C1-<epoch_ms>.jpeg` | Cao |
| **Khớp khái niệm** | Cột "CO" FLEX ↔ "XCO2" trong Test Plan | Cao (đa bằng chứng) |

➡️ Mỗi liên kết trong DB phải lưu `link_method` (`exact_id`, `id_plus_event`, `condition_match`, `date_match`, `filename`, `manual`) và `confidence`.

---

## 6. Xếp hạng thí nghiệm liên quan giữa các bộ dữ liệu

Đề xuất xếp hạng **hai tầng**:

1. **Lọc theo facet chung** (bắt buộc khớp/ưu tiên): `fuel_phase` (liquid/solid), `material_class`, `flow_regime` (quiescent/opposed/concurrent/stagnation), `diluent`, `outcome_type` (extinction/quench/blowoff/completion/no-ignition), khoảng O2.
2. **Khoảng cách trong từng dataset** với đặc trưng riêng (Gower distance, có trọng số giải thích được):
   - FLEX: fuel, diluent, XO2, X_suppressant, log P, D0.
   - BASS-II: material, geometry, thickness/diameter, flow direction, initial O2, restrictor, (vận tốc suy ra nếu có cờ hợp lệ).
   - SAFFIRE-I: flow direction (chỉ 2 mục).
3. **Điểm tổng hợp** = similarity × evidence_strength (số tài liệu/đoạn có trích dẫn liên kết) × quality_penalty (trừ điểm hàng có cờ nghiêm trọng).
4. Kết quả trả về **theo nhóm dataset**, không trộn thành một danh sách "giống nhau" giả tạo; giải thích *vì sao* (facet nào khớp).

---

## 7. Schema dữ liệu khoa học chuẩn hóa (đề xuất)

### 7.1 Sơ đồ thực thể

```
investigation 1──* experiment 1──* condition (stage-aware)
                         │  1──* observation (stage-aware)
                         │  1──* outcome
                         │  *──* evidence_link *──1 evidence_chunk *──1 document
                         └  1──* data_issue ──* quality_flag
claim *──* evidence_link
```

### 7.2 Bảng

**`investigation`**
| Trường | Ví dụ |
|---|---|
| `investigation_id` | `FLEX` |
| `psi_study_id` | `PSI-69` |
| `title` | Flame Extinguishment Experiment |
| `doi` | 10.60555/mbq8-0451 |
| `platform`, `facility` | ISS / CIR–MDCA |
| `metadata_source_file` | `FLEX/PSI-69_metadata_PSI-133_FLEX/i_Investigation.txt` |

**`experiment`**
| Trường | Mô tả |
|---|---|
| `experiment_uid` | Khóa toàn cục, ví dụ `FLEX:274:C01M201` (investigation : row : source id) — tránh xung đột như `193F001` trùng |
| `investigation_id` | FK |
| `source_experiment_id` | Giá trị gốc (`FLEX Identifier`, `Test #`, `Sample Number`) |
| `source_file`, `source_row`, `source_sheet` | Truy vết tới ô gốc |
| `test_date`, `test_time_utc`, `doy` | Đã chuẩn hóa + giữ chuỗi gốc |
| `sequence_index` | Thứ tự as-run (BASS-II App. A) hoặc `FLEX Test #` |
| `pi`, `sample_id`, `run_suffix` | BASS-II |
| `group_keys` | Ví dụ mã hỗn hợp `C01`, ngày, PI → dùng cho GroupKFold |
| `raw_record_json` | Toàn bộ hàng gốc, nguyên văn |

**`condition`** và **`observation`** (cùng cấu trúc)
| Trường | Mô tả |
|---|---|
| `experiment_uid`, `stage_index` | `stage_index` = 0 cho điều kiện đơn; 1..n cho chuỗi đa giai đoạn BASS-II |
| `variable` | Từ vựng kiểm soát: `ambient_O2`, `suppressant_CO2`, `product_CO2_delta`, `pressure`, `flow_velocity`, `fan_voltage`, `fan_pot`, `D0`, `D_ext_visible`, `burning_rate_K`, `burn_time`, … |
| `value_num`, `value_min`, `value_max` | Số; khoảng nếu là `21.5 - 21.7` |
| `value_text_raw` | Chuỗi gốc **không sửa** |
| `unit` (chuẩn, SI hoặc thông dụng) và `unit_source` | ví dụ `mm2/s` vs `"mm"` từ header |
| `role` | `setpoint` · `measured` · `derived` · `nominal` · `annotated` |
| `method` | ví dụ `backlit_image`, `CSA-CP`, `CDM`, `TSI8475_anemometer`, `same_day_fan_calibration`, `d2_law` |
| `source_column` | Tên cột gốc nguyên văn |
| `derivation` | Nếu `derived`: công thức + tham chiếu (ví dụ `U=1.0066*Air; calib GMT 2014-202, 2 restrictors`) |
| `uncertainty` | Giá trị/loại (ví dụ `resolution=0.1 vol%`) |
| `quality_flags` | Danh sách mã cờ |

**`outcome`**
| Trường | Mô tả |
|---|---|
| `outcome_raw` | `Extinction` / chuỗi quan sát Appendix A |
| `outcome_normalized` | `extinction_finite_diameter`, `burn_to_completion`, `disruption_undefined`, `quench_extinction`, `blowoff_extinction`, `no_ignition`, `brief_ignition`, `burned_entire_sample` |
| `evidence_id` | FK tới chunk (ví dụ SR p.112, hàng B18) |
| `confidence`, `extracted_by` | `source_label` / `manual_curation` / `llm_extraction_reviewed` |

**`document`**
`doc_id`, `file_path`, `sha256`, `title_exact`, `doc_type` (report, paper, slides, requirements, procedure, metadata), `investigation_ids`, `n_pages`, `page_offset` (ví dụ SR: trang in = PDF − 8), `date`, `duplicate_of`.

**`evidence_chunk`**
`chunk_id`, `doc_id`, `page_start`, `page_end`, `printed_page`, `section_path` (ví dụ `6.1.6 Conclusions`), `chunk_type` (text/table_row/figure_caption/list), `text`, `entities` (test IDs, vật liệu, biến), `embedding_ref`.

**`evidence_link`**
`subject_type` (experiment/variable/claim), `subject_id`, `chunk_id`, `relation` (`defines`, `reports_value`, `describes_outcome`, `mentions`, `contradicts`), `link_method`, `confidence`.

**`claim`**
`claim_id`, `text`, `category` (`DOC`, `COMPUTED`, `HYPOTHESIS`, `UNSUPPORTED`), `evidence_ids`, `computation_ref` (notebook/script + hash dữ liệu).

**`quality_flag`** (từ điển) và **`data_issue`** (thể hiện)
`flag_code`, `severity` (info/warn/error), `description`, `rule`; `data_issue`: `experiment_uid`, `variable`, `flag_code`, `evidence`.

### 7.3 Ví dụ bản ghi (rút gọn, JSON)

```json
{
  "experiment_uid": "FLEX:145:C01M201",
  "source": {"file": "FLEX/PSI-69_Experimental table_FLEX.csv", "row": 145, "encoding": "cp1252"},
  "conditions": [
    {"variable": "ambient_O2", "value_num": 0.20, "unit": "mole_fraction", "role": "setpoint",
     "source_column": "O initial ambient composition; mole fraction"},
    {"variable": "suppressant_CO2", "value_num": 0.05, "unit": "mole_fraction", "role": "setpoint",
     "source_column": "CO initial ambient composition; mole fraction",
     "quality_flags": ["header_corrected_CO_to_CO2"]},
    {"variable": "pressure", "value_num": 763.5, "unit": "mmHg", "role": "measured"},
    {"variable": "D0", "value_num": 3.33, "unit": "mm", "role": "measured", "method": "backlit_image"}
  ],
  "observations": [
    {"variable": "D_ext_visible", "value_num": 1.61, "unit": "mm", "role": "measured"},
    {"variable": "burning_rate_K", "value_num": 0.45, "unit": "mm2/s", "unit_source": "mm",
     "role": "derived", "quality_flags": ["unit_corrected_mm_to_mm2_per_s"]},
    {"variable": "burn_time", "value_num": 20.0, "unit": "s", "role": "measured"}
  ],
  "outcome": {"outcome_raw": "Extinction", "outcome_normalized": "extinction_finite_diameter"},
  "evidence_links": [
    {"chunk": "20130010979.pdf#p9", "relation": "mentions", "link_method": "condition_match",
     "confidence": "medium", "note": "slide gives D0=3.38, Dext=1.66: values differ from CSV"}
  ]
}
```

```json
{
  "experiment_uid": "BASS-II:M5",
  "conditions": [
    {"variable": "ambient_O2", "stage_index": 0, "value_num": 22.2, "unit": "vol%", "role": "measured",
     "method": "CSA-CP + daily MCA offset", "uncertainty": "resolution 0.1 vol%"},
    {"variable": "flow_velocity", "stage_index": 1, "value_num": 20, "unit": "cm/s", "role": "measured",
     "source_column": "Air display", "value_text_raw": "20  13  10  8  5"}
  ],
  "observations": [
    {"variable": "product_CO2_delta", "value_num": 2.78, "unit": "vol%", "role": "derived"},
    {"variable": "CO_final", "value_text_raw": ">500", "value_min": 500, "unit": "ppm",
     "quality_flags": ["censored_lower_bound"]}
  ],
  "evidence_links": [
    {"chunk": "BASS-II Summary Report.pdf#p15", "relation": "reports_value", "link_method": "id_plus_event"},
    {"chunk": "BASS-II Summary Report.pdf#p127", "relation": "describes_outcome", "link_method": "date_match"}
  ]
}
```

### 7.4 Nguyên tắc
1. **Không bao giờ ghi đè giá trị gốc**; mọi chuẩn hóa là cột mới + `value_text_raw`.
2. **Không điền giá trị thiếu**; giữ loại thiếu (`blank`, `dash`, `none`, `OR`).
3. Mọi đại lượng `derived` phải có công thức + nguồn.
4. Giai đoạn (stage) là công dân hạng nhất (BASS-II).
5. Cờ chất lượng được dùng trực tiếp trong ranking và trong câu trả lời của LLM.

---

## 8. Tóm tắt
- Ba investigation nghiên cứu **ba hệ cháy khác nhau**; điểm chung là khái niệm giới hạn cháy và mục tiêu an toàn cháy tàu vũ trụ.
- **Một database ngữ nghĩa chung: nên làm.** **Một mô hình ML chung: không nên.**
- Liên kết tài liệu ↔ dữ liệu khả thi nhất với BASS-II (ID chính xác) và SAFFIRE (tên file); FLEX chỉ khớp theo điều kiện (cần TP-2015-216046 để khớp ID).
