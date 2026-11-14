# 10 — Tóm tắt điều hành (Executive Summary)

**Dự án:** SpaceFire AI — NASA Space Apps Challenge 2026, Challenge 8 "Flame in Freefall"
**Phạm vi:** Khảo sát nghiên cứu & khả thi trên toàn bộ dữ liệu trong `D:\NASA Hackathon` (không xây dựng ứng dụng, không huấn luyện mô hình, không sửa file gốc).
**Chi tiết:** xem `01`–`09` trong thư mục `research/`.

---

## 1. Chúng ta thực sự có dữ liệu gì?

| Investigation | Dữ liệu có cấu trúc | Tài liệu | Không có |
|---|---|---|---|
| **FLEX** (PSI-69) — giọt methanol/n-heptane, ISS 2009–2011 | **274 test × 15 cột**, chủ yếu là số (D0, Dext, K, burn time, P, thành phần khí, outcome) | RRD 2005 (81 tr.), Test Plan, 4 bài/slide khoa học, tài liệu kỹ thuật (một file thực chất là ERD của **FLEX-2**) | Video, ảnh, D(t); báo cáo dữ liệu gốc NASA/TP-2015-216046 (284 test) |
| **BASS-II** (PSI-25) — vật liệu rắn quy mô cm trong MSG, 2014–2016 | **129 test × 17 cột** bán cấu trúc (87 % số hàng có ô Fan/Air display dạng văn bản, đa số nhiều giai đoạn); bảng hiệu chuẩn quạt 27 ngày | **Summary Report 144 tr.** có Appendix A (quan sát kết cục), **Table 5.1** (spread rate Miller), **Table 7.1** (kết cục SIBAL), Table 2.1; FAQ, Procedure, SRD | Video overlay, ảnh Nikon, file "flow estimates" |
| **SAFFIRE-I** (PSI-98) — tấm SIBAL 0.4 × 0.94 m trên Cygnus, 14/6/2016 | **2 lần đốt** (S1 concurrent 420 s, S2 opposed 70 s); workbook 12 MB = **manifest ~78,000 frame** (timestamp, đã nhận/hỏng) | DoD, Operations, Nomenclature | **Mọi phép đo cảm biến**, mọi ảnh, mọi tài liệu kết quả |

Khoảng 13 MB (`download.zip`) và 2 ZIP metadata là **bản sao**. Không có file nào lỗi parse, nhưng một số trang PDF chỉ có hình.

## 2. Bộ dữ liệu nào hữu ích nhất?

1. **FLEX** — giá trị định lượng cao nhất: sạch tương đối, nhiều biến số, cấu trúc nhóm rõ (mã hỗn hợp `C01…C21`, `H01…H19`, `N01…N06`).
2. **BASS-II** — giá trị **bằng chứng** cao nhất: ID khớp chính xác giữa CSV và báo cáo 144 trang; dữ liệu khí O2/CO2 nhất quán vật lý.
3. **SAFFIRE-I** — giá trị **câu chuyện/case study** và chỉ mục dữ liệu; gần như không có giá trị định lượng trong repo.

## 3. Có thể kết luận gì một cách khoa học? (có bằng chứng)

- Cột `CO` của FLEX thực chất là **CO2**; đơn vị `Burning rate; mm` thực chất là **mm²/s** (kiểm chứng d²-law: median 1.04 trên 256 test). [COMPUTED + DOC]
- Methanol ở O2 < 17.5 % luôn tắt ở đường kính hữu hạn (54/54); Dext/D0 tăng khi O2 giảm trong chuỗi CO2 1 atm. [COMPUTED, mô tả]
- Dext tăng gần tuyến tính theo D0 (r = 0.66 methanol, 0.85 heptane), phù hợp lý thuyết. [COMPUTED + DOC]
- BASS-II: O2 tiêu thụ và CO2 sinh ra tương quan r = 0.977, tỷ lệ 0.81 ≈ stoichiometric PMMA 0.833 — tái lập kết luận của NASA từ dữ liệu thô. [COMPUTED + DOC]
- Các test BASS-II trong cùng ngày **không độc lập** (khí quyển MSG suy giảm tích lũy). [COMPUTED]
- Các kết luận khoa học đã công bố trong repo (vận tốc tắt opposed không phụ thuộc độ dày; Nomex không cháy; cool flame của heptane; quenching SIBAL 1–5 cm/s; CO/CO2 cao; HRR < 100 W…) — **có trích dẫn trang**. [DOC]
- Phát hiện **≥ 20 lỗi/bất thường dữ liệu cụ thể** (áp suất = 0, ID trùng, Dext > D0, final O2 = 40 %, năm 2018 sai, nhãn F2 sai, Length/Width đảo, metadata SAFFIRE sai ngày/nền tảng…).

## 4. Không thể kết luận gì?

- Giá trị **LOI** chính xác; ý nghĩa của nhãn **"Disruption"** (không được định nghĩa trong repo).
- Vận tốc dòng BASS-II ở các ngày không có hiệu chuẩn cùng ngày; vận tốc tại thời điểm tắt (thiếu mốc thời gian giai đoạn).
- Bất kỳ đại lượng flame spread nào của SAFFIRE-I.
- So sánh số trực tiếp giữa ba dataset (khác hệ cháy, khác quy mô; CO2 là *input* ở FLEX nhưng *output* ở BASS-II).
- Khuyến nghị an toàn cháy cho cabin thật — đều là **ngoại suy không được hỗ trợ**.

## 5. Dữ liệu có đủ để huấn luyện ML không?

- **FLEX:** đủ cho mô hình **nhỏ, minh bạch, có ràng buộc vật lý** (~258 mẫu). Cần loại rò rỉ (K, Dext quyết định burn time), đánh giá bằng **GroupKFold theo mã hỗn hợp**, coi Disruption là censored. Không đủ cho deep learning.
- **BASS-II:** **không** cho ML dự đoán; phù hợp phân tích mô tả và trích xuất bằng chứng.
- **SAFFIRE-I:** **không** (n = 2).
- Bài toán ML phù hợp nhất: **similarity search** và **phát hiện bất thường dựa trên luật vật lý**.

## 6. Mô hình hiện có nào có thể tái sử dụng?

- **Không có mô hình pretrained nào** trên FLEX/BASS-II/SAFFIRE-I, không có repo mã nguồn mở liên quan (kiểm tra web 11/2026).
- Tái sử dụng được: **mô hình vật lý** trong tài liệu (d²-law, LOI–MEC, de ∝ d0, công thức Vg,cr, hệ số de Ris F = 4.76, Huggett 13.1 kJ/g O2, CSTR); mô hình **tổng quát** (embedding, LLM, SAM 2 cho ảnh trong tương lai).
- Tham khảo phương pháp: data assimilation cho flame spread/droplet (Xi, Torero et al. 2021–2022); SAM 2 đo đường kính ngọn lửa giọt (arXiv 2607.16587, chưa xác nhận trọng số).

## 7. Kiến trúc sản phẩm tốt nhất?

**Phương án D — Hybrid, triển khai "A trước, D sau"** (điểm có trọng số: A 7.65, D 7.60, B 6.00, C 5.25):
lõi **Scientific RAG có trích dẫn trang + Experiment Explorer + cờ chất lượng**, thêm **công cụ phân tích vật lý** (d²-law, cân bằng khí, flammability map), **similarity search**, và **một baseline ML FLEX trung thực** (tùy chọn). Không làm mô hình thống nhất liên dataset.

## 8. Nên xây gì trong hackathon?

MVP: data layer chuẩn hóa + evidence search + Q&A có nhãn DOC/COMPUTED/HYP và numeric grounding + explorer + trang chi tiết thí nghiệm. Tác động cao: flammability map FLEX, kiểm tra d²-law, cân bằng O2/CO2 BASS-II, similar experiments, Data Quality panel. Demo 3 phút: CO→CO2 & mm²/s → flammability map → M5 ↔ SR p.15 ↔ Anomaly #1 → cờ T28b → "AI biết nói không" (09 §6).

## 9. Còn thiếu dữ liệu/tài liệu gì?

| Ưu tiên | Thiếu | Mở khóa |
|---|---|---|
| 🔴 | **NASA/TP-2015-216046** (FLEX, 284 test) — [NTRS 20150023456](https://ntrs.nasa.gov/citations/20150023456) | Định nghĩa "Disruption", burn time, F/R, fiber; khớp ID |
| 🔴 | Dữ liệu cảm biến SAFFIRE-I (Excel trên PSI) + các bài Urban et al. 2019, Li et al. 2019 | Mọi phân tích định lượng SAFFIRE |
| 🟠 | `BASS-II Fan Cal All days with flow estimates.xlsx` | Vận tốc chính thức |
| 🟠 | Bài báo BASS-II (Olson & Ferkul C&F 2017; Bhattacharjee C&F 2016; Zhao PCI 2017; ICES-2015-196) | Số liệu đằng sau đồ thị |
| 🟡 | Video/ảnh FLEX, BASS-II, SAFFIRE (tải chọn lọc) | D(t), spread rate, image AI sau hackathon |
| 🟡 | OCR SRD tr.14–16 | Ma trận ưu tiên của 3 PI |

## 10. Các bước phát triển cụ thể tiếp theo

1. **Tải** NASA/TP-2015-216046 và các bài SAFFIRE/BASS-II then chốt; thêm vào kho tài liệu và cập nhật định nghĩa cột.
2. Viết **loader + bảng chuẩn hóa** theo schema 05 §7 (FLEX cp1252, BASS-II parser đa giai đoạn, SAFFIRE tách experiment/image set), kèm toàn bộ cờ chất lượng ở 02 §8 và 03 §9.
3. **Curate thủ công** SR Table 5.1, 7.1, 2.1 và cột quan sát Appendix A (ít nhất cho các test dùng trong demo) với `source_page`.
4. Xây **index hybrid** (BM25 + bge-small + FAISS/Chroma) với metadata trang; viết **numeric grounding verifier**.
5. Viết **40–60 câu hỏi vàng** từ các báo cáo 02–07 để kiểm thử trước khi demo.
6. Dựng **FastAPI + Next.js** theo kế hoạch 48 h (09 §4), mốc MVP ở giờ 24.
7. Chỉ sau mốc MVP: physics tools, similarity, rồi baseline ML FLEX với GroupKFold.

---

**Thông điệp chính cho giám khảo:** SpaceFire AI không giả vờ "dự đoán lửa trong không gian" từ vài trăm dòng dữ liệu. Nó biến dữ liệu vi trọng lực rời rạc của NASA thành **bằng chứng có thể kiểm chứng**: mỗi con số có nguồn, mỗi kết luận có nhãn độ tin cậy, và hệ thống biết khi nào phải nói *"không đủ bằng chứng"*.
