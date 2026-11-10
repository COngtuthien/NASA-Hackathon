# 09 — Lộ trình triển khai hackathon 48 giờ

> Kiến trúc mục tiêu: **Phương án D, triển khai "A trước, D sau"** (xem 08 §5).
> Giả định đội 4–5 người, laptop thông thường, không GPU. Nếu luật NASA Space Apps cho phép chuẩn bị trước, nên làm sẵn phần **tiền xử lý dữ liệu** (mục 2) trước giờ bắt đầu; nếu không, dành 8–10 giờ đầu cho phần này.

---

## 1. Phân loại tính năng

### 1.1 MVP bắt buộc
| # | Tính năng | Dữ liệu dùng | Lý do |
|---|---|---|---|
| M1 | **Data layer chuẩn hóa** (FLEX 274, BASS-II 129, SAFFIRE 2 + manifest tóm tắt) với `value_text_raw`, đơn vị, vai trò, cờ chất lượng | 3 CSV, 2 XLSX | Mọi thứ khác dựa vào đây |
| M2 | **Evidence search** hybrid (BM25 + embedding) trên ~17 tài liệu, trích dẫn file + trang | PDF/DOCX/PPTX | Lõi "Scientific RAG" |
| M3 | **Q&A có trích dẫn** với nhãn DOC / COMPUTED / HYPOTHESIS và numeric grounding | M1 + M2 | Chống bịa số |
| M4 | **Experiment Explorer**: bảng lọc theo dataset, fuel/material, O2, outcome, cờ | M1 | Demo trực quan |
| M5 | **Trang chi tiết thí nghiệm**: giá trị gốc ↔ chuẩn hóa, cờ, các đoạn tài liệu liên kết | M1 + evidence_link | "Từ con số đến bằng chứng" |

### 1.2 Tác động cao
| # | Tính năng | Ghi chú |
|---|---|---|
| H1 | **FLEX flammability map** (D0 vs XO2, màu theo outcome, lọc diluent/áp suất) + Dext/D0 theo O2 | Đã chứng minh xu hướng (02 §6) |
| H2 | **d²-law consistency check** cho từng test FLEX (t đo vs (D0²−Dext²)/K) | Phát hiện lỗi đơn vị & bất thường |
| H3 | **BASS-II gas balance**: ΔO2 vs ΔCO2 so đường stoichiometric 5/6; CO/CO2 theo hình học | Tái lập SR Fig. 1.3 từ CSV |
| H4 | **Similar experiments** (kNN/Gower trong từng dataset, giải thích facet) | Bài toán ML phù hợp nhất |
| H5 | **Data Quality panel**: danh sách bất thường thật (P = 0, ID trùng, Dext ≥ D0, final O2 40 %, nhãn F2 sai…) | Thể hiện độ nghiêm ngặt khoa học |
| H6 | **Fan → velocity converter** có cờ (chỉ khi có hiệu chuẩn cùng ngày) | Minh họa xử lý "derived" đúng cách |

### 1.3 Nâng cao (tùy chọn, chỉ khi lõi ổn định)
| # | Tính năng | Điều kiện |
|---|---|---|
| O1 | Baseline ML FLEX: P(Extinction vs Completion) + log burn time không dùng K/Dext, GroupKFold theo mã hỗn hợp, so physics baseline, hiển thị bất định | Sau H1–H2 |
| O2 | Timeline downlink SAFFIRE-I (frame theo thời gian, % nhận, đoạn thiếu) | Dữ liệu đã tính sẵn (04 §3.3) |
| O3 | Trích xuất nhãn kết cục từ SR App. A bằng LLM + người duyệt | Nếu còn thời gian curation |
| O4 | Song ngữ Anh–Việt cho câu trả lời | Thấp |

### 1.4 Tránh
- Mô hình ML **thống nhất** cho 3 dataset; "chỉ số an toàn cháy" tổng hợp.
- Dự đoán cho **cabin thật** / khuyến nghị vận hành an toàn.
- Tải và xử lý ảnh/video thô (SAFFIRE ~78,000 frame; FLEX/BASS video) trong 48 h.
- Deep learning / fine-tune LLM.
- Để LLM tự tính toán số liệu thay vì gọi công cụ.
- Hứa hẹn "dự đoán chính xác 95 %" hay số liệu chưa kiểm chứng trên slide.

---

## 2. Tiền xử lý dữ liệu bắt buộc

| # | Việc | Ước lượng | Chi tiết |
|---|---|---:|---|
| P1 | Loader FLEX đọc **cp1252**, giữ `–` vs ô rỗng, sửa nhãn hiển thị CO→CO2, đơn vị K → mm²/s, gắn 13 loại cờ (02 §8) | 2 h | Script khảo sát hiện có là điểm xuất phát |
| P2 | Parser BASS-II: tách chuỗi đa giai đoạn thành danh sách, nhận diện thang (V×10 vs pot), chuẩn hóa vật liệu → (material, color, geometry, thickness/diameter, width, sides), cờ (03 §9) | 4 h | Giữ chuỗi gốc |
| P3 | Bảng hiệu chuẩn quạt dạng dài: (GMT day, restrictors, pot, fan_display, air_display) | 1.5 h | 27 khối |
| P4 | **Curate thủ công** SR Table 5.1 (20 hàng), Table 7.1 (31 hàng), Table 2.1; và cột "observations" App. A cho ít nhất các test dùng trong demo | 3–5 h | Đối chiếu trực tiếp với PDF |
| P5 | Tách bảng SAFFIRE thành `experiments` (S1, S2) + `image_sets` (F1, F2), sửa nhãn F2 = post-flow (có cờ), đảo Length/Width có cờ | 0.5 h | |
| P6 | Tóm tắt manifest SAFFIRE (thống kê theo camera, chuỗi 10 s) — đã có trong 04 §3.3 | 0.5 h | Không cần nạp 12 MB vào app |
| P7 | Trích văn bản + chunk + metadata trang cho 17 tài liệu; khử trùng lặp | 2 h | |
| P8 | Bộ 40–60 câu hỏi vàng (golden Q&A) từ báo cáo 02–07 | 2 h | Dùng để kiểm thử và chọn câu demo |

---

## 3. Công nghệ đề xuất

| Lớp | Lựa chọn | Lý do |
|---|---|---|
| Frontend | **Next.js** (React) + Tailwind + `react-plotly.js` | Nhanh, đẹp, Plotly cho biểu đồ khoa học tương tác |
| Backend | **Python FastAPI** | Gần với pandas/sklearn |
| Dữ liệu | **pandas** + **DuckDB** (hoặc SQLite) cho bảng chuẩn hóa | Truy vấn SQL cho công cụ có cấu trúc |
| Trích PDF | PyMuPDF / `pdftotext` (đã chạy tốt), pdfplumber cho bảng | |
| Sparse search | `rank_bm25` hoặc SQLite FTS5 | Bắt ID như `M5`, `C01M201` |
| Dense search | `sentence-transformers` + `BAAI/bge-small-en-v1.5` (CPU) → **FAISS** hoặc **ChromaDB** | ~1,000 chunk, index < 1 phút |
| Rerank (tùy chọn) | `BAAI/bge-reranker-base` | |
| LLM | API (ví dụ Claude `claude-sonnet-5-5`; `claude-haiku-5-5` cho chi phí thấp) với structured output; fallback mô hình mở qua Ollama | Chất lượng trích dẫn |
| ML | **scikit-learn** (LogisticRegression, Ridge, GradientBoosting, KNN); XGBoost không cần thiết với n ≈ 260 | |
| Đóng gói | `docker compose` (frontend + backend) hoặc 2 tiến trình local | |

Yêu cầu phần cứng: laptop 8–16 GB RAM, không GPU.

---

## 4. Kế hoạch 48 giờ

| Khung giờ | Data/ML (1–2 người) | Backend/RAG (1–2 người) | Frontend (1 người) | Khoa học & demo (1 người) |
|---|---|---|---|---|
| **0–4** | P1, P5 | Khung FastAPI, schema DuckDB | Khung Next.js, layout | Chốt câu chuyện demo, chọn 8–10 câu hỏi |
| **4–12** | P2, P3 | P7: chunk + index BM25/FAISS | Explorer bảng (M4) | P4: curate SR Table 5.1, 7.1, 2.1 |
| **12–20** | Cờ chất lượng, endpoint thống kê | Endpoint `/search`, `/ask` + nhãn claim | Trang chi tiết thí nghiệm (M5) | P4 tiếp (App. A cho test demo); P8 golden Q&A |
| **20–24** | ⏸ **Mốc 1: MVP chạy end-to-end** (M1–M5) — sửa lỗi, không thêm tính năng | | | |
| **24–32** | H1 flammability map, H2 d²-law | Numeric grounding verifier; tool-calling (`get_experiment`, `stats`, `similar`) | Biểu đồ Plotly H1, H3 | Kiểm thử golden Q&A, ghi lỗi |
| **32–38** | H4 similarity, H3 gas balance, H6 converter | Cache câu trả lời demo; xử lý từ chối khi thiếu bằng chứng | Data Quality panel (H5), similarity UI | Viết slide/README khoa học |
| **38–42** | O1 ML baseline (chỉ nếu Mốc 1 ổn) | O2 timeline SAFFIRE (nếu kịp) | Hoàn thiện UI | Diễn tập demo lần 1 |
| **42–46** | Đóng băng dữ liệu | Đóng băng API; chế độ offline | Đánh bóng | Quay **video dự phòng**; diễn tập lần 2 |
| **46–48** | Buffer, nộp bài, kiểm tra link | | | |

---

## 5. Phụ thuộc & rủi ro kỹ thuật

| Rủi ro | Xác suất | Ảnh hưởng | Giảm thiểu |
|---|---|---|---|
| Trích bảng PDF (App. A) sai dòng | Cao | Cao | Curate thủ công phạm vi nhỏ; luôn lưu `source_page` |
| API LLM lỗi/mạng yếu khi demo | Trung bình | Cao | Cache câu trả lời cho các câu demo; video dự phòng; fallback chế độ "search-only" |
| LLM bịa số | Trung bình | Rất cao (uy tín khoa học) | Numeric grounding, cấm LLM tính toán, golden Q&A |
| Encoding cp1252 (FLEX) bị đọc sai | Cao nếu quên | Trung bình | Test đơn vị cho loader |
| Mở rộng phạm vi (scope creep) | Cao | Cao | Mốc 1 ở giờ 24; tính năng tùy chọn có cổng |
| Hiểu sai khoa học (CO vs CO2, "Disruption") | Trung bình | Cao | Dùng đúng các kết luận đã kiểm chứng ở 02–05; hiển thị nhãn UNVERIFIED |
| Chi phí embedding/LLM | Thấp | Thấp | Embedding cục bộ; LLM nhỏ cho truy vấn thường |

---

## 6. Kịch bản demo 3 phút (dùng dữ liệu NASA thật)

| Thời gian | Nội dung | Dữ liệu/bằng chứng thật |
|---|---|---|
| **0:00–0:20** | Vấn đề: dữ liệu cháy vi trọng lực của NASA nằm rải rác trong CSV, bảng PDF rộng 36 cột, slide; header có lỗi; khó tin cậy để dùng | 3 investigation, 274 + 129 + 2 thí nghiệm, 17 tài liệu |
| **0:20–0:55** | Hỏi: *"Cột 'CO' trong bảng FLEX là gì, và burning rate có đơn vị gì?"* → SpaceFire trả lời **CO2** và **mm²/s**, mỗi câu có nhãn và trích dẫn: Test Plan tr.5 (XCO2), metadata Objective; `2G11` tr.2 (d²-law) + **biểu đồ kiểm tra d²-law** (median 1.04 trên 256 test) | 02 §4.1, §4.4 |
| **0:55–1:35** | Explorer FLEX: flammability map methanol + CO2 ở 1 atm; Dext/D0 tăng từ ~0.42 (20 % O2) đến ~0.88 (14 % O2); click `C07M…` → "Similar experiments" + trích dẫn `20130010979.pdf` tr.11 (lý thuyết de tuyến tính theo d0) | 02 §6 |
| **1:35–2:15** | BASS-II: *"Test nào làm hỏng phần cứng?"* → `M5`: ΔCO2 2.78 %, CO > 500 ppm (CSV) ↔ "outlier at 2.8 percent CO2" (SR p.15) ↔ Anomaly #1 GMT 51 (SR p.127). Biểu đồ ΔO2 vs ΔCO2: độ dốc 0.81 so với stoichiometric 0.833 | 03 §5 |
| **2:15–2:40** | Data Quality panel: final O2 = 40.4 % ở T28b bị gắn cờ **phi vật lý**, và Table 7.1 (SR p.104) xác nhận "did not ignite"; áp suất = 0 ở `C11M201` | 02 §8, 03 §2.3 |
| **2:40–3:00** | "AI biết nói không": *"LOI chính xác của methanol là bao nhiêu?"* → hệ thống từ chối đưa con số, giải thích thiếu bằng chứng và chỉ ra tài liệu còn thiếu (NASA/TP-2015-216046). Kết: SpaceFire AI = **bằng chứng trước, dự đoán sau** | 06 §2.4 |

---

## 7. Sản phẩm bàn giao cuối hackathon
1. Ứng dụng web (Explorer + Ask + Quality panel).
2. Bảng dữ liệu chuẩn hóa (CSV/Parquet) + từ điển cột + danh sách cờ — đóng góp tái sử dụng được cho cộng đồng.
3. Golden Q&A + kết quả đánh giá grounding.
4. README khoa học nêu rõ giới hạn (dựa trên 10_EXECUTIVE_SUMMARY.md).
5. Video demo dự phòng.
