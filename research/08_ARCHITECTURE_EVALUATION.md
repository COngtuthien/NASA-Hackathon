# 08 — Đánh giá kiến trúc SpaceFire AI

> Đánh giá dựa trên **bằng chứng thực tế trong repo** (báo cáo 01–07), không dựa trên giả định chung.

---

## 1. Bốn phương án

| Phương án | Mô tả | Thành phần |
|---|---|---|
| **A. Scientific RAG + Experiment Explorer** | Tìm kiếm, giải thích, trực quan hóa và trích dẫn các thí nghiệm NASA | Bảng chuẩn hóa + cờ chất lượng; hybrid search có trích dẫn trang; explorer dạng bảng/biểu đồ |
| **B. ML Prediction Platform** | Dự đoán burn time / outcome từ biến đầu vào | Pipeline ML trên FLEX (BASS-II/SAFFIRE không đủ) |
| **C. Multi-Dataset Fire Safety Intelligence** | Kết hợp 3 dataset, xếp hạng bằng chứng, so sánh nghiên cứu, giải thích "an toàn cháy" | Knowledge graph liên dataset, ranking bằng chứng, tổng hợp kết luận chéo |
| **D. Hybrid AI System** | RAG + phân tích thống kê có cấu trúc + ML tùy chọn + similarity search | A + công cụ phân tích (d²-law, gas balance, flammability map) + kNN + 1 baseline ML được đánh giá trung thực |

---

## 2. Tiêu chí & trọng số

| Tiêu chí | Trọng số | Thang điểm (1 = xấu, 10 = tốt) |
|---|---:|---|
| Scientific validity | 15 % | Kết luận có được dữ liệu/tài liệu hỗ trợ không |
| Dataset readiness | 15 % | Dữ liệu hiện có đủ cho phương án chưa (không cần dữ liệu thô) |
| AI novelty | 10 % | Mức độ mới so với "chatbot PDF" hoặc "notebook sklearn" |
| Technical complexity | 5 % | **10 = đơn giản** |
| Hackathon feasibility (48 h) | 15 % | Làm xong, ổn định trong 48 giờ với 4–5 người |
| Demo quality | 10 % | Ấn tượng, rõ ràng trong 3 phút |
| Interpretability | 10 % | Người dùng hiểu vì sao có kết quả |
| Hallucination risk | 10 % | **10 = rủi ro thấp** |
| Dependency on missing raw data | 5 % | **10 = không phụ thuộc** |
| Future research potential | 5 % | Khả năng mở rộng sau hackathon |

---

## 3. Bảng điểm

| Tiêu chí | Trọng số | A | B | C | D |
|---|---:|---:|---:|---:|---:|
| Scientific validity | 0.15 | 8 | 4 | 5 | 8 |
| Dataset readiness | 0.15 | 8 | 5 | 4 | 7 |
| AI novelty | 0.10 | 5 | 4 | 7 | 8 |
| Technical complexity (10 = dễ) | 0.05 | 8 | 8 | 3 | 5 |
| Hackathon feasibility | 0.15 | 9 | 8 | 4 | 7 |
| Demo quality | 0.10 | 7 | 5 | 8 | 9 |
| Interpretability | 0.10 | 9 | 6 | 6 | 8 |
| Hallucination risk (10 = thấp) | 0.10 | 7 | 9 | 4 | 7 |
| Raw-data independence | 0.05 | 8 | 8 | 5 | 8 |
| Future research potential | 0.05 | 6 | 5 | 8 | 9 |
| **Tổng không trọng số (/100)** | | **75** | **62** | **54** | **76** |
| **Điểm có trọng số (/10)** | | **7.65** | **6.00** | **5.25** | **7.60** |

---

## 4. Lý giải từng phương án (theo bằng chứng)

### A. Scientific RAG + Experiment Explorer — 7.65
- **Validity 8 / Readiness 8:** kho tài liệu chất lượng cao (SR 144 tr., RRD 81 tr.); BASS-II có ID khớp chính xác giữa CSV và Appendix A, Table 5.1, 7.1 (03 §2.3); FLEX CSV sạch tương đối.
- **Novelty 5:** RAG trên PDF đã phổ biến; điểm mới nằm ở grounding số liệu + cờ chất lượng, nhưng nếu chỉ làm A thì giám khảo có thể coi là "chatbot tài liệu".
- **Hallucination 7:** rủi ro LLM bịa số → giảm được bằng numeric grounding (06 §4).
- **Feasibility 9:** kho ~160k token, chạy laptop.

### B. ML Prediction Platform — 6.00
- **Validity 4:** chỉ FLEX đủ dữ liệu; burn time gần như là hàm xác định của D0, Dext, K (median tỷ số d²-law 1.04, 02 §4.4) → nếu không loại rò rỉ thì mô hình "hoàn hảo" vô nghĩa; nếu loại thì ~258 mẫu, thiết kế thích nghi, nhãn "Disruption" chưa định nghĩa.
- BASS-II: không có biến mục tiêu số nhất quán; SAFFIRE-I: n = 2.
- **Hallucination 9:** không có LLM, nhưng có rủi ro "overclaiming" độ chính xác.
- Demo yếu: một form nhập số + một con số dự đoán ít thuyết phục về khoa học.

### C. Multi-Dataset Fire Safety Intelligence — 5.25
- **Validity 5 / Readiness 4:** ba hệ cháy khác nhau (giọt lỏng / chất rắn cm / chất rắn m), CO2 trái nghĩa giữa FLEX và BASS-II, không có biến mục tiêu chung (05 §2–4). Mọi "kết luận an toàn cháy" chéo dataset dễ trở thành ngoại suy không được hỗ trợ.
- **Hallucination 4:** tổng hợp chéo khuyến khích LLM tạo khái quát hóa.
- **Complexity 3 / Feasibility 4:** knowledge graph + ranking + tổng hợp trong 48 h là rất rủi ro.
- Demo và tầm nhìn hấp dẫn → điểm demo/future cao.

### D. Hybrid AI System — 7.60
- Kế thừa toàn bộ điểm mạnh của A, cộng thêm:
  - **Công cụ phân tích có cơ sở vật lý** (d²-law check, Dext/D0 theo O2, cân bằng O2/CO2 so stoichiometry, chuyển đổi fan → vận tốc có cờ) — các phân tích **đã được chứng minh hoạt động** trong báo cáo này.
  - **Similarity search** (bài toán ML phù hợp nhất với kích thước dữ liệu, 02 §7C).
  - **Một baseline ML trung thực** cho FLEX (GroupKFold, so với physics baseline) — trình bày như "những gì dữ liệu cho phép và không cho phép".
- **Novelty 8 / Demo 9 / Future 9:** "AI biết nói *không*" — từ chối và gắn cờ khi thiếu bằng chứng — là điểm khác biệt rõ ràng.
- **Complexity 5 / Feasibility 7:** nhiều thành phần hơn A → cần cắt phạm vi kỷ luật.

---

## 5. Khuyến nghị

**Chọn Phương án D, triển khai theo thứ tự "A trước, D sau" (D-scoped).**

Lý do: A và D gần như hòa điểm (7.65 vs 7.60). Chênh lệch nằm ở chỗ D có novelty/demo cao hơn nhưng rủi ro thời gian lớn hơn. Cách tối ưu là **xây A như lõi bắt buộc** và **thêm các mô-đun D theo cổng kiểm soát**: mỗi mô-đun chỉ được bật nếu lõi A đã chạy ổn định.

| Lớp | Nội dung | Bắt buộc? |
|---|---|---|
| L0 – Data layer | Bảng chuẩn hóa FLEX + BASS-II + SAFFIRE (schema 05 §7) với cờ chất lượng; bảng curated từ SR Table 5.1, 7.1 và một phần App. A | ✅ |
| L1 – Evidence RAG | Hybrid search, trích dẫn trang, numeric grounding, nhãn DOC/COMPUTED/HYP | ✅ |
| L2 – Explorer | Bảng lọc + biểu đồ Plotly (flammability map FLEX, ΔO2 vs ΔCO2 BASS-II, timeline SAFFIRE) | ✅ |
| L3 – Physics tools | d²-law check, gas balance, fan→velocity có cờ | ⭐ Ưu tiên cao |
| L4 – Similarity | kNN/Gower trong từng dataset, giải thích facet khớp | ⭐ Ưu tiên cao |
| L5 – ML baseline | FLEX: P(extinction) và log burn time, GroupKFold, so physics baseline, hiển thị bất định | Tùy chọn |
| ✗ | Mô hình thống nhất liên dataset; dự đoán an toàn cabin; phân tích ảnh SAFFIRE | Tránh |

**Không khuyến nghị B làm sản phẩm chính** (dữ liệu không ủng hộ) và **không khuyến nghị C** (khái quát hóa chéo không có cơ sở, rủi ro hallucination và thời gian).
