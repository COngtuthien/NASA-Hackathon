# 06 — Phân tích tài liệu khoa học & khả thi của RAG

> Đã đọc toàn văn (sau trích xuất) 12 PDF, 4 DOCX, 1 PPTX, 3 ISA-Tab metadata. Trang = trang PDF (SR = `BASS-II Summary Report.pdf`; trang in = PDF − 8).
> Nhãn: **[DOC]** tài liệu nêu rõ · **[COMPUTED]** tính từ CSV/XLSX · **[HYP]** giả thuyết hợp lý · **[UNSUPPORTED]** không kiểm chứng được/không được hỗ trợ.

---

## 1. Danh mục tài liệu

### 1.1 FLEX

| File | Tiêu đề chính xác | Mục đích | Điều kiện thực nghiệm | Phát hiện / nội dung chính | Bảng/hình quan trọng | Định nghĩa đo lường | Hạn chế | ID thí nghiệm được nhắc |
|---|---|---|---|---|---|---|---|---|
| `FLEX_EIRD_v4.pdf` (81 tr.) | *Research Requirements Document — Droplet Flame Extinguishment in Microgravity (FLEX)*, Williams, Hicks, Nayagam, Choi, Dryer, Shaw, 4/11/2005 | Nền tảng khoa học + yêu cầu cho thí nghiệm bay | Kế hoạch: O2 0.10–0.50, P 0.5–1.0 atm, D0 2–5 mm, chất ức chế CO2/He/SF6 tới 0.70 (tr.29–30) | LOI, MEC, Damköhler; mục tiêu (tr.28); science data end products (tr.31–33) | Hình 2 flammability map; Bảng 3 Science Data End Products (tr.33); Bảng 6–12 test matrix | Kích thước giọt từ ảnh backlit → burning rate & extinction size (tr.30); OH imaging; radiometer 1.87 µm & 0.6–5 µm (tr.31) | Tài liệu **trước khi bay**; ma trận "không phải ma trận cuối cùng" | Số test matrix 1–290 (không phải ID bay) |
| `FLEX_Test_Plan.pdf` (15 tr.) | Trích RRD (trang in 11–12, 44–55) | Quy trình LOI + ma trận test | như trên | Công thức LOI = 0.209(1 − MEC) (tr.3); quy trình 8 bước (tr.4) | Bảng 2 MEC (CO2 0.16/0.19; He 0.27/0.31; N2 0.26/0.38) (tr.3); Bảng 6–12 | Áp suất ±0.01 atm, nhiệt độ ±0.5 °C, đồng bộ GMT ±0.03 s (tr.4) | Trùng nội dung RRD | – |
| `FLEX Engineering Requirements Document.pdf` (37 tr.) | *FLEX-2 Engineering Requirements Document*, FLX-REQ-0001, 04/02/2010 | Yêu cầu kỹ thuật **FLEX-2** | P 0.5–3 atm ±0.05; O2 0.1–0.4 ±0.005; T 18–27 °C; RH < 10 %; dòng 0.1–5 cm/s (tr.22–23) | – | – | Droplet view 30 µm, ≥30 fps, FOV 3 cm (tr.24); radiometer 30 Hz, ±5 % FS | **Không phải FLEX** — chỉ dùng như tham khảo phần cứng MDCA | – |
| `FLEX Overall Ext File-2.pdf` (30 tr.) | *Selections from Engineering Documents for FLEX* (G. Berger, 21/5/2015) | Tổng hợp tài liệu phần cứng | – | CIR imaging (HiBMs 1024², 30 fps; LLL-UV 310 nm OH*); MDCA; FLEX dùng **Methanol và Heptane**, FLEX-2 dùng Ethanol, Decane, hỗn hợp (tr.15) | TABLE IV–V imaging specs (tr.5); TABLE 2 fuels (tr.15) | – | Kỹ thuật, không có kết quả | – |
| `1G17-070HE-0166.pdf` (13 tr.) | *Isolated Alkane Droplet Combustion in Microgravity: "Cool Flames"*, T. Farouk & F.L. Dryer, 8th US Nat. Combust. Meeting 2013 | Mô phỏng số cool flame n-heptane | Ca cơ sở D0 = 3.91 mm, không khí, 1 atm (tr.5); mô phỏng thêm CO2, He | Ngọn lửa nóng tắt bức xạ → chuyển sang giai đoạn 2 "cool flame" ~750 K; mô hình dự đoán Dext nhỏ hơn thực nghiệm 3.5 lần (tr.5); tăng CO2 hoặc He kích hoạt cool flame (tr.5–6) | Hình 3–7 (tr.9–13) | Peak temperature làm marker vị trí ngọn lửa (tr.5) | Đồng thuận **định tính**; cơ chế hóa học rút gọn 128 loài/565 phản ứng | Không (chỉ "do = 3.91 mm"; **không có hàng heptane D0 = 3.91 trong CSV**) |
| `2G11-070HE-0310.pdf` (10 tr.) | *Effect of Varying the Initial Diameter of n-Octane and n-Decane Droplets over a Wide Range…*, Liu, Trenou, Rah, Hicks, Avedisian, 2013 | Ảnh hưởng D0 lên burning rate | n-octane, n-decane; D0 0.5–5 mm; ISS (D0 > 1.7) + drop tower; không khí 1 atm | K giảm khi D0 tăng; fiber SiC 80 µm làm tăng K ở giọt 1–2 mm (tr.9–10) | Hình 9–13 | d²-law định nghĩa K (tr.2); xử lý ảnh đo D, Ds, Df (tr.4–5) | **Nhiên liệu không có trong CSV FLEX** | D0 cụ thể, không ID |
| `20130010979.pdf` (15 tr.) | *Dynamics of Water Absorption and Evaporation During Methanol Droplet Combustion in Microgravity*, Hicks, Dietrich, Nayagam, Williams, ASGSR 2012 | Hấp thụ nước trong giọt methanol → extinction | ZGF drop tower (Ar/N2) + ISS FLEX (CO2/N2, O2 13–21 %) | Lý thuyết dự đoán de tuyến tính theo d0 (tr.11); OH* chemiluminescence cho điểm chuyển dòng nước (tr.15) | Bảng test ZGF H-7-62…H-8-13 (tr.12) | K = 0.67 và 0.44 "m2/s" (**lỗi đơn vị**, tr.7, 9) | Slide, thiếu chi tiết; mâu thuẫn thành phần khí tr.9 vs tr.10 | **"FLEX-145"** (tr.9–10); ZGF H-x-xx |
| `Cool Flames in Space, a Hot Prospect on Earth!.pdf` (24 tr.) | *"Cool Flames" in Space, a Hot Prospect on Earth! — Anomalous combustion of alkane fuel droplets in space*, V. Nayagam, ISS R&D Conf. 2013 | Truyền thông khoa học về phát hiện cool flame | heptane trong không khí, 18/82 O2/N2, 18/67/15 O2/N2/CO2 (tr.8) | Hai chế độ extinction diffusive/radiative (tr.3); cool flame giai đoạn 2 lần đầu quan sát (tr.9, 23); nguy cơ tái bắt lửa (tr.22) | Nhiều hình | – | Slide, chủ yếu hình | Không |
| `FLEX DoD.docx` | Mô tả dữ liệu FLEX trên PSI | Tổ chức dữ liệu | – | 5 bản ghi: Calibration, LCTF Calibration, Radiometer Calibration, HEP, MeOH | – | – | Không có định nghĩa cột | – |

### 1.2 BASS-II

| File | Tiêu đề | Mục đích | Nội dung chính (trang) | ID được nhắc |
|---|---|---|---|---|
| `BASS-II Summary Report.pdf` (144 tr.) | *Burning and Suppression of Solids—II (BASS–II) Summary Report*, NASA/TM-20210011385, Olson, Ferkul, Bhattacharjee, Miller, Fernandez-Pello, Link, T'ien, Wichman, 10/2021 | Báo cáo tổng kết khoa học | Phần cứng (p.11–13); cảm biến (p.14); CSTR (p.14, App. B p.123–125); sản phẩm cháy, stoichiometry, CO/CO2, HRR < 100 W (p.14–17); global equivalence ratio 1.3 (p.18–19); Bhattacharjee: Vg,cr độc lập độ dày, Table 2.1 (p.21–36), thermal regime, F = 4.76, độ dày chuyển tiếp 5.2 mm (p.39–52); Ferkul: Nomex không cháy, nến (p.54); Fernandez-Pello: spread rate thanh đen (p.55–61); Miller & Wichman: **Table 5.1** spread rate (p.63–71); Olson: biên flammability thanh PMMA, Damköhler, cân bằng năng lượng bề mặt (p.72–100); T'ien: SIBAL concurrent, **Table 7.1**, quenching 1–5 cm/s (p.101–109); App. A test matrix (p.111–121); App. C anomaly (p.127–128); App. D nhiệt (p.129–136) | B1–B22, F1–F4, M1–M20, O1–O22, P1–P25, T1–T29 (+ BASS-I T7, T8, T10, T11) |
| `SRD_BASS-II.pdf` (16 tr.) | *BASS-II Science Requirements* | Yêu cầu, tiêu chí thành công, manifest | 100 mẫu/5 PI (tr.1); 4 Hz, ±10 % (tr.1); minimal/complete success (tr.3); giả thuyết & mục tiêu (tr.9); ma trận ưu tiên Olson, Bhattacharjee (tr.12–13); tr.14–16 chỉ là hình | Số ưu tiên 1–20 (không phải as-run) |
| `BASS-II data FAQ.docx` | *BASS-II data FAQ* | Định nghĩa cột | GMT = day-of-year; Fan display = V×10; Air display cm/s, đáp ứng 1 phút; O2 offset MCA; OR = > 1000 ppm; lệch ngày video do năm nhuận; danh sách công bố | – |
| `BASS-II Procedure.docx` | Quy trình vận hành BASS-2 | Bước của phi hành đoàn | Pha loãng GN2 25–225 phút; đọc CSA-CP/CDM trước–sau; dập lửa bằng tắt quạt hoặc GN2; chụp 1 fps tối đa 100 ảnh/lần nhấn; purge sau 10 lần đốt; fan cal pot 10/8/6/4/2/0 | – |
| `BASS-2 Engineering Requirements.pptx` (7 slide) | *BASS-2 Engineering Requirements* | Yêu cầu phần cứng | Kanthal igniter; N2 0–500 SCCM; 4 Hz; ±10 %; Nikon D300s; CSA-O2 + MCA | – |

### 1.3 SAFFIRE-I

| File | Nội dung chính | Hạn chế |
|---|---|---|
| `SAFFIRE-I and SAFFIRE-III DoD.docx` | Mục tiêu, SIBAL 75/25, 20 cm/s (I) và 30 cm/s (III), F1 = pre-flow, F2 = post-flow, Bảng 1 bản ghi PSI, Bảng 2 diagnostics (ảnh), Bảng 3 image sets | Không có kết quả |
| `SAFFIRE-I Operations.pdf` (1 tr.) | Cygnus, mẫu 0.4 × 0.94 m, 9 mẫu Saffire-II, 20 gigabit | Không có kết quả |
| `SAFFIRE-I Image Directory Nomenclature.pdf` (1 tr.) | Quy ước thư mục ảnh, offset 8 byte trong RAW | – |

---

## 2. Phân loại các phát biểu khoa học quan trọng

### 2.1 Được tài liệu hỗ trợ rõ ràng [DOC]
| # | Phát biểu | Nguồn |
|---|---|---|
| D1 | FLEX nhằm xác định LOI theo áp suất và ảnh hưởng của chất ức chế lên LOI | `i_Investigation.txt` (Approach); Test Plan tr.4 |
| D2 | Chất ức chế FLEX: CO2, He, SF6; tới ~0.70 | RRD tr.29 |
| D3 | Giọt cháy đến hết hoặc tắt ở đường kính hữu hạn | RRD tr.29 |
| D4 | Hai chế độ extinction: diffusive (O2 cao, giọt nhỏ) và radiative (O2 thấp, giọt lớn) | `Cool Flames…pdf` tr.3 |
| D5 | Giọt n-heptane lớn có thể chuyển sang cháy "cool flame" sau khi ngọn lửa nhìn thấy tắt | `1G17` tr.1–2; `Cool Flames…pdf` tr.9, 23 |
| D6 | Cool flame có thể tái bắt lửa → mối lo an toàn cháy tàu vũ trụ | `Cool Flames…pdf` tr.22–23 |
| D7 | Lý thuyết dự đoán de tuyến tính theo d0 cho methanol | `20130010979.pdf` tr.11 |
| D8 | Burning rate giảm khi D0 tăng (n-octane/decane, 2–5 mm) | `2G11` tr.9–10 |
| D9 | BASS-II: O2 tiêu thụ ~ stoichiometric so với CO2 sinh ra (PMMA 6:5) | SR p.10, p.15 |
| D10 | CO/CO2 của lửa vi trọng lực cao hơn khí thải hiệu quả ~1 bậc | SR p.16, p.19 |
| D11 | HRR phần lớn < 100 W (O2 consumption calorimetry, 13.1 kJ/g O2) | SR p.16–17 |
| D12 | Global equivalence ratio ≈ 1.3 (giàu nhiên liệu), từ 19 mẫu có khối lượng | SR p.18–19 |
| D13 | Vận tốc opposed tới hạn cho radiative extinction không phụ thuộc độ dày PMMA mỏng; tăng khi O2 giảm | SR p.21, p.36 |
| D14 | Nomex III không bắt lửa (3 mẫu) | SR p.54 |
| D15 | Thanh PMMA: quenching ở dòng thấp (dao động 1.1 Hz), blowoff ở dòng cao; biên chữ U; khớp drop tower | SR p.97 |
| D16 | SIBAL concurrent: vận tốc quenching 1–5 cm/s, cao hơn khi O2 thấp | SR p.101, p.109 |
| D17 | Saffire-I: SIBAL, ~0.4 × 0.94 m, 20 cm/s, trên Cygnus | Operations tr.1; DoD |

### 2.2 Tính trực tiếp từ CSV/XLSX [COMPUTED]
| # | Kết quả | Chi tiết |
|---|---|---|
| C1 | `Burning rate` của FLEX có đơn vị mm²/s | median t/((D0²−De²)/K) = 1.041 (n=256) — 02 §4.4 |
| C2 | Cột "CO" của FLEX là CO2 | đối xứng mã C/H; khớp ma trận XCO2 — 02 §4.1 |
| C3 | Methanol ở XO2 < 0.175: 54/54 Extinction | 02 §2.4 |
| C4 | Dext/D0 của methanol tăng từ ~0.42 (XO2 0.20) lên ~0.88 (0.14) trong chuỗi CO2 1 atm | 02 §6 (n nhỏ mỗi mức) |
| C5 | BASS-II: r(ΔO2, ΔCO2) = 0.977; độ dốc 0.81 (lý thuyết PMMA 0.833) | 03 §5.2 |
| C6 | BASS-II: test nối tiếp chia sẻ khí quyển (38/129 có CO đầu = CO cuối test trước) | 03 §5.2 |
| C7 | SAFFIRE-I: ~605 s ghi mỗi lần đốt, 30 fps, S2 chỉ nhận ~25 % JPEG | 04 §3.3 |
| C8 | SAFFIRE CSV nhãn F2 sai (là post-flow) | timestamp — 04 §2.2 |

### 2.3 Giả thuyết hợp lý [HYP]
| # | Giả thuyết | Căn cứ |
|---|---|---|
| H1 | "Disruption" là nhãn vận hành/censoring (giọt trôi, vỡ, can thiệp phần cứng) | Không có định nghĩa; phân bố theo O2 |
| H2 | `F`/`R` trong mã FLEX = free / fiber (RIF) | Thuật ngữ RIF trong Overall Ext tr.16 |
| H3 | Burn time FLEX = đánh lửa → ngọn lửa nhìn thấy tắt | C1 |
| H4 | Một số test FLEX cùng ngày đốt trong cùng lần nạp buồng | áp suất tăng dần |
| H5 | Kích thước JPEG SAFFIRE tăng khi có ngọn lửa | chuỗi kích thước — chưa hiệu chuẩn |
| H6 | Final O2 39–40 % của P22b/T28b là lỗi ghi chép | phi vật lý; T28 "did not ignite" (SR p.104) |

### 2.4 Không được hỗ trợ / không kiểm chứng được [UNSUPPORTED]
| # | Phát biểu thường gặp | Lý do |
|---|---|---|
| U1 | "FLEX-145 trong slide là hàng #145 của CSV" | Điều kiện khớp nhưng D0/Dext khác |
| U2 | Mọi giá trị vận tốc BASS-II suy từ fan ở ngày không có hiệu chuẩn | Thiếu hiệu chuẩn cùng ngày |
| U3 | Tốc độ lan truyền/kích thước lửa Saffire-I | Không có tài liệu kết quả trong repo |
| U4 | LOI chính xác của methanol/heptane | Repo không báo cáo giá trị LOI; dữ liệu mỗi mức ít |
| U5 | Kết luận an toàn cháy cho cabin thật từ các thí nghiệm mm–cm | Ngoại suy quy mô |
| U6 | Định nghĩa độ dày SIBAL 0.37 cm | Không có tài liệu |

---

## 3. Kiến trúc RAG đề xuất

### 3.1 Đặc điểm kho tài liệu
- Kích thước nhỏ: ~120,000 từ (≈ 160k token) sau khi khử trùng lặp; ~300 trang PDF hữu ích. Toàn bộ index chạy được trên laptop, không cần GPU.
- Đa dạng: bài báo, slide, báo cáo kỹ thuật, yêu cầu, quy trình, metadata, **bảng rất rộng** (SR App. A), **bảng số** (Table 5.1, 7.1), đồ thị không có số.

### 3.2 Pipeline

```
[Ingest] PDF/DOCX/PPTX/TXT/CSV/XLSX
   │  hash SHA-256 → khử trùng lặp (download.zip, ZIP metadata)
   ▼
[Extract]
   • PDF text: pdftotext -layout hoặc PyMuPDF (giữ số trang PDF + trang in)
   • Bảng: pdfplumber/camelot cho SR Table 2.1, 5.1, 7.1, App. A
     → ĐỐI CHIẾU THỦ CÔNG (bảng rộng bị trộn dòng) → CSV "curated" có cột source_page
   • DOCX/PPTX: python-docx/python-pptx (giữ style heading, bảng, notes)
   • Ảnh nhúng quan trọng (SAFFIRE DoD Bảng 2, SRD tr.14–16): chép tay hoặc OCR + duyệt
   ▼
[Chunk] theo cấu trúc khoa học
   • Ranh giới: heading/section (ví dụ "6.1.6 Conclusions"), caption Hình/Bảng, mỗi hàng bảng = 1 chunk
   • 300–600 token, overlap 10–15 %; không cắt ngang câu/phương trình
   • Metadata: doc_id, title, investigation, doc_type, page_pdf, page_printed, section_path,
     chunk_type, entities (test IDs, vật liệu, nhiên liệu, biến), year, authors, quality_notes
   ▼
[Index] Hybrid
   • Sparse: BM25 (rank_bm25 hoặc SQLite FTS5) — quan trọng cho ID ("M5", "C01M201"), ký hiệu ("Vg,cr", "LOI")
   • Dense: embedding (xem 3.3) trong FAISS hoặc ChromaDB
   • Structured: DuckDB/SQLite chứa bảng chuẩn hóa (schema ở 05 §7) + bảng curated từ PDF
   ▼
[Retrieve]
   • Bộ định tuyến truy vấn: (a) câu hỏi số liệu → SQL/pandas tool; (b) câu hỏi khái niệm → hybrid search;
     (c) câu hỏi về một test → lọc theo experiment_uid rồi lấy evidence_link
   • Hợp nhất điểm Reciprocal Rank Fusion; metadata filter (investigation, doc_type)
   • Rerank: cross-encoder (bge-reranker-base) trên top-30 → top-6
   ▼
[Generate] LLM với prompt "evidence-only"
   • Đầu vào: chunk có ID + bảng kết quả truy vấn (JSON, có đơn vị & cờ)
   • Đầu ra có cấu trúc: claims[] mỗi claim có category (DOC/COMPUTED/HYP) và citations[]
   ▼
[Verify] hậu kiểm tự động (xem §4) → hiển thị cho người dùng kèm trích dẫn file + trang
```

### 3.3 Lựa chọn mô hình
| Thành phần | Lựa chọn laptop/offline | Lựa chọn API |
|---|---|---|
| Embedding | `BAAI/bge-small-en-v1.5` hoặc `bge-base` (CPU đủ nhanh cho ~1,000 chunk); `nomic-embed-text` qua Ollama | Voyage AI, OpenAI `text-embedding-3-small` |
| Reranker | `BAAI/bge-reranker-base` (CPU) | Cohere Rerank / Voyage rerank |
| LLM sinh câu trả lời | Mô hình mở cỡ 7–8B qua Ollama (chất lượng trích dẫn kém hơn) | Claude (ví dụ `claude-sonnet-5-5` cho chất lượng, `claude-haiku-5-5` cho tốc độ/chi phí) |
| Trích xuất có cấu trúc (outcome từ App. A) | – | LLM + JSON schema, **luôn có người duyệt** |

Lưu ý: kho nhỏ đến mức có thể đưa cả tài liệu vào ngữ cảnh dài, nhưng RAG vẫn ưu việt vì (1) trích dẫn chính xác theo trang, (2) chi phí thấp, (3) kiểm soát được nguồn.

### 3.4 Truy xuất dữ liệu có cấu trúc
- **Không để LLM tự tính toán** trên số liệu thô. LLM chỉ chọn **công cụ** đã định nghĩa sẵn: `get_experiment(uid)`, `filter_experiments(...)`, `similar_experiments(uid, k)`, `stats(variable, group_by, filters)`, `d2_law_check(uid)`, `gas_balance(test_id)`.
- Mọi công cụ trả về giá trị **kèm đơn vị, vai trò (measured/derived), cờ chất lượng, nguồn (file/hàng/cột)**.

---

## 4. Ngăn chặn số liệu bịa và khuyến nghị không được hỗ trợ

| Rủi ro | Biện pháp |
|---|---|
| LLM bịa một con số | **Numeric grounding check**: trích mọi số trong câu trả lời bằng regex; mỗi số phải khớp (± làm tròn) một giá trị trong chunk/bảng đã truy xuất, nếu không → chặn hoặc gắn nhãn đỏ |
| Trích dẫn sai trang | Trích dẫn chỉ được sinh từ `chunk_id` có sẵn (không cho LLM tự viết số trang); hiển thị đoạn văn gốc khi rê chuột |
| Trộn ngữ nghĩa (CO2 ức chế vs CO2 sản phẩm) | Từ vựng biến kiểm soát + metadata `role`; prompt hệ thống cấm so sánh trực tiếp khác `variable` |
| Dùng giá trị lỗi | Cờ chất lượng được truyền vào ngữ cảnh; câu trả lời bắt buộc nêu cờ nếu dùng giá trị bị cờ `error` |
| Ngoại suy sang an toàn cabin | Bộ phân loại "khuyến nghị vận hành" → buộc gắn nhãn `HYPOTHESIS/EXTRAPOLATION` + từ chối đưa ra chỉ dẫn an toàn thực tế |
| Trả lời khi không có bằng chứng | Ngưỡng điểm truy xuất; nếu dưới ngưỡng → "Không có bằng chứng trong kho tài liệu" + gợi ý tài liệu còn thiếu (ví dụ TP-2015-216046) |
| Tài liệu sai metadata (FLEX ERD thực ra là FLEX-2; SAFFIRE metadata ngày 2001–2008) | Ghi chú `quality_notes` cấp tài liệu, đưa vào ngữ cảnh |
| Mâu thuẫn giữa nguồn | Phát hiện trùng thực thể với giá trị khác nhau → hiển thị **cả hai** với nhãn "contradiction" (ví dụ FLEX-145; số radiometer SAFFIRE) |
| Phân loại claim | Định dạng đầu ra buộc mỗi câu là `DOC` / `COMPUTED` / `HYPOTHESIS` / `UNSUPPORTED` |

**Bộ đánh giá đề xuất (trước demo):** 40–60 câu hỏi vàng do nhóm viết từ chính các báo cáo 02–05 (ví dụ "Đơn vị của burning rate trong FLEX?", "Vì sao Nomex không cho dữ liệu O2?", "Vận tốc Vg,cr ở 16 % O2?"), đo: tỷ lệ trích dẫn đúng trang, tỷ lệ số liệu được grounding, tỷ lệ từ chối đúng khi không có bằng chứng.

---

## 5. Kết luận khả thi
- RAG **rất khả thi** và là thành phần có tỷ lệ "giá trị / rủi ro" tốt nhất của SpaceFire AI: kho nhỏ, chất lượng cao, có ID khớp với dữ liệu (đặc biệt BASS-II).
- Phần tốn công nhất **không** phải embedding mà là **trích bảng PDF có kiểm duyệt** (App. A, Table 5.1, 7.1) và **gán nhãn chất lượng**.
- Hệ thống phải phân biệt rõ bốn loại phát biểu và không bao giờ để LLM tự tạo số liệu.
